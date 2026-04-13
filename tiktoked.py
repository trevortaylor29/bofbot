"""
TikTok Shop-style video overlay pipeline: Pillow PNG overlays + FFmpeg composite + optional folder watch.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import sys
from functools import lru_cache
import re
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers.polling import PollingObserver
except ImportError:  # pragma: no cover
    FileSystemEventHandler = object  # type: ignore[misc, assignment]
    PollingObserver = None  # type: ignore[misc, assignment]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("bofbot")

# Top banner chip (line 1): max pixel size before fit_banner_font scales down. ~22% below legacy 352/58 for a closer TikTok-native scale.
BANNER_LINE1_FONT_START_PX = 274
BANNER_LINE1_FONT_MIN_PX = 44
# Line-2 chip cap (legacy 232px at 352px line-1 cap), scaled to match line-1 start.
BANNER_LINE2_FONT_START_PX = int(round(232 * BANNER_LINE1_FONT_START_PX / 352))

# “FULL PRICE” strike + red % pill (`style: banner_price_strike`) — TikTok-style reference layout.
PRICE_STRIKE_LINE1_START_PX = 208
PRICE_STRIKE_LINE1_MIN_PX = 54
PRICE_STRIKE_GAP_BELOW_STRIKE_PX = 12
PRICE_STRIKE_LINE2_SIZE_MULT = 1.26
PRICE_STRIKE_LINE2_MIN_PX = 52
PRICE_STRIKE_LINE2_CAP_PX = BANNER_LINE1_FONT_START_PX + 36
PRICE_STRIKE_LINE2_BOX_FRAC = 0.72
PRICE_STRIKE_BANNER_RADIUS_PX = 28

# Broad emoji / pictograph removal when no emoji font is available
_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "\u200d"
    "\uFE0F"
    "]+",
    flags=re.UNICODE,
)


def _root() -> Path:
    """Repo / bundle root for config.json, fonts/, emoji/."""
    env_root = os.environ.get("BOFBOT_ASSET_ROOT", "").strip()
    if env_root:
        return Path(env_root).expanduser().resolve()
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def _ffmpeg_bundle_dir() -> Path | None:
    raw = os.environ.get("BOFBOT_FFMPEG_DIR", "").strip()
    if not raw:
        return None
    p = Path(raw).expanduser().resolve()
    return p if p.is_dir() else None


def _ffmpeg_executable() -> str:
    d = _ffmpeg_bundle_dir()
    if d is not None:
        name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
        p = d / name
        if p.is_file():
            return str(p)
    w = shutil.which("ffmpeg")
    if w:
        return w
    raise FileNotFoundError("ffmpeg not found on PATH or BOFBOT_FFMPEG_DIR")


def _ffprobe_executable() -> str:
    d = _ffmpeg_bundle_dir()
    if d is not None:
        name = "ffprobe.exe" if os.name == "nt" else "ffprobe"
        p = d / name
        if p.is_file():
            return str(p)
    w = shutil.which("ffprobe")
    if w:
        return w
    raise FileNotFoundError("ffprobe not found on PATH or BOFBOT_FFMPEG_DIR")


def is_emoji_char(ch: str) -> bool:
    o = ord(ch)
    if ch in "\uFE0F\u200D":
        return True
    return bool(
        (0x1F300 <= o <= 0x1FAFF)
        or (0x2600 <= o <= 0x26FF)
        or (0x2700 <= o <= 0x27BF)
        or (0x1F600 <= o <= 0x1F64F)
        or (0x1F680 <= o <= 0x1F6FF)
        or (0x1F1E6 <= o <= 0x1F1FF)
    )


def _emoji_dir() -> Path:
    return _root() / "emoji"


def _emoji_assets_available() -> bool:
    d = _emoji_dir()
    return d.is_dir() and any(d.glob("*.png"))


def _banner_line_has_png_emoji(text: str) -> bool:
    """True if this line will composite Twemoji PNGs (taller ink than metrics alone)."""
    if not _emoji_assets_available():
        return False
    for part, is_em in split_emoji_runs(text):
        if not is_em or not part:
            continue
        if _emoji_segment_plan(part):
            return True
    return False


def _emoji_segment_plan(part: str) -> list[Path]:
    """PNG paths to lay out left-to-right for one emoji run (combined or per codepoint)."""
    d = _emoji_dir()
    if not d.is_dir() or not part:
        return []
    seq = "_".join(f"{ord(c):x}" for c in part) + ".png"
    combo = d / seq
    if combo.is_file():
        return [combo]
    paths: list[Path] = []
    for ch in part:
        if ch in "\ufe0f\u200d":
            continue
        one = d / f"{ord(ch):x}.png"
        if one.is_file():
            paths.append(one)
    return paths


def _emoji_scaled_size(path: Path, target_h: int) -> tuple[int, int]:
    with Image.open(path) as im:
        w, h = im.size
    if h <= 0:
        return max(1, target_h), max(1, target_h)
    nh = max(1, target_h)
    nw = max(1, int(round(w * (nh / float(h)))))
    return nw, nh


@lru_cache(maxsize=256)
def _emoji_scaled_raster(path_s: str, target_h: int) -> Image.Image:
    path = Path(path_s)
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    nh = max(1, target_h)
    nw = max(1, int(round(w * (nh / float(h))))) if h > 0 else nh
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def _emoji_run_width(part: str, target_h: int) -> float:
    wsum = 0.0
    for p in _emoji_segment_plan(part):
        nw, _ = _emoji_scaled_size(p, target_h)
        wsum += float(nw)
    return wsum


def _emoji_target_h(font_px: int) -> int:
    return max(1, int(round(font_px * 0.92)))


def split_emoji_runs(s: str) -> list[tuple[str, bool]]:
    if not s:
        return []
    runs: list[tuple[str, bool]] = []
    buf: list[str] = []
    cur_emoji: bool | None = None
    for ch in s:
        em = is_emoji_char(ch)
        if cur_emoji is None:
            cur_emoji = em
            buf.append(ch)
            continue
        if em == cur_emoji:
            buf.append(ch)
        else:
            runs.append(("".join(buf), cur_emoji))
            buf = [ch]
            cur_emoji = em
    if buf:
        runs.append(("".join(buf), cur_emoji if cur_emoji is not None else False))
    return runs


def _latin_segment_width(
    draw: ImageDraw.ImageDraw,
    part: str,
    font: ImageFont.FreeTypeFont,
    latin_stroke_width: int,
) -> float:
    """Advance width for Latin; include stroke ink (textlength ignores outline)."""
    if not part:
        return 0.0
    if latin_stroke_width > 0:
        tb = draw.textbbox(
            (0, 0),
            part,
            font=font,
            stroke_width=latin_stroke_width,
        )
        return float(tb[2] - tb[0])
    return float(draw.textlength(part, font=font))


def mixed_text_length(
    text: str,
    draw: ImageDraw.ImageDraw,
    main_font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
    emoji_target_h: int,
    *,
    latin_stroke_width: int = 0,
) -> float:
    x = 0.0
    for part, is_em in split_emoji_runs(text):
        if not part:
            continue
        if is_em:
            ew = _emoji_run_width(part, emoji_target_h)
            if ew > 0:
                x += ew
            elif emoji_font:
                x += float(draw.textlength(part, font=emoji_font))
            else:
                x += _latin_segment_width(draw, part, main_font, latin_stroke_width)
        else:
            x += _latin_segment_width(draw, part, main_font, latin_stroke_width)
    return x


def mixed_line_ink_height(
    text: str,
    draw: ImageDraw.ImageDraw,
    main_font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
    emoji_target_h: int,
    *,
    latin_stroke_width: int = 0,
) -> int:
    hmax = 1
    for part, is_em in split_emoji_runs(text):
        if not part:
            continue
        if is_em:
            if _emoji_run_width(part, emoji_target_h) > 0:
                hmax = max(hmax, emoji_target_h)
            else:
                f = emoji_font or main_font
                tb = draw.textbbox((0, 50_000), part, font=f, anchor="mm")
                hmax = max(hmax, tb[3] - tb[1])
        else:
            kw: dict[str, Any] = {"font": main_font, "anchor": "mm"}
            if latin_stroke_width > 0:
                kw["stroke_width"] = latin_stroke_width
            tb = draw.textbbox((0, 50_000), part, **kw)
            hmax = max(hmax, tb[3] - tb[1])
    return hmax


def _draw_mixed_line(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    x_left: float,
    y_ref: float,
    text: str,
    main_font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
    fill: str,
    stroke_width: int,
    stroke_fill: str | None,
    emoji_target_h: int,
    *,
    vertical: str,
) -> None:
    """vertical='center' → y_ref is line center (banner). 'baseline' → y_ref is Latin baseline (fulltext)."""
    x = x_left
    for part, is_em in split_emoji_runs(text):
        if not part:
            continue
        if is_em:
            paths = _emoji_segment_plan(part)
            if paths:
                for ep in paths:
                    rim = _emoji_scaled_raster(str(ep.resolve()), emoji_target_h)
                    rw, rh = rim.size
                    if vertical == "center":
                        py = int(y_ref - rh / 2)
                    else:
                        ref_tb = draw.textbbox((x, y_ref), "Ay", font=main_font)
                        mid = (ref_tb[1] + ref_tb[3]) / 2.0
                        py = int(mid - rh / 2)
                    img.paste(rim, (int(x), py), rim)
                    x += float(rw)
                continue
            f = emoji_font or main_font
            w = float(draw.textlength(part, font=f))
            if vertical == "center":
                draw.text(
                    (x + w / 2, y_ref),
                    part,
                    font=f,
                    fill=fill,
                    anchor="mm",
                )
            else:
                draw.text((x, y_ref), part, font=f, fill=fill)
            x += w
            continue
        w = _latin_segment_width(draw, part, main_font, stroke_width)
        kw: dict[str, Any] = {
            "font": main_font,
            "fill": fill,
        }
        if stroke_width:
            kw["stroke_width"] = stroke_width
            kw["stroke_fill"] = stroke_fill or "#000000"
        if vertical == "center":
            kw["anchor"] = "mm"
            draw.text((x + w / 2, y_ref), part, **kw)
        else:
            draw.text((x, y_ref), part, **kw)
        x += w


def draw_text_mixed_centered(
    draw: ImageDraw.ImageDraw,
    cx: float,
    y: float,
    text: str,
    main_font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
    fill: str,
    stroke_width: int = 0,
    stroke_fill: str | None = None,
    anchor_mm: bool = False,
    emoji_target_h: int = 48,
) -> None:
    img = getattr(draw, "_image", None)
    if img is None:
        raise RuntimeError("ImageDraw missing backing image")
    tw = mixed_text_length(
        text,
        draw,
        main_font,
        emoji_font,
        emoji_target_h,
        latin_stroke_width=stroke_width,
    )
    x0 = cx - tw / 2
    _draw_mixed_line(
        img,
        draw,
        x0,
        y,
        text,
        main_font,
        emoji_font,
        fill,
        stroke_width,
        stroke_fill,
        emoji_target_h,
        vertical="center",
    )


def prepare_text_for_render(text: str, emoji_font_path: Path | None = None) -> str:
    """Keep emoji when PNG assets or a system emoji font exists; else strip."""
    if _emoji_assets_available():
        return text
    if emoji_font_path and emoji_font_path.is_file():
        return text
    return _EMOJI_RE.sub("", text).strip()


def _resolve_emoji_font(cfg: dict[str, Any]) -> Path | None:
    rel = cfg.get("emoji_font_path") or ""
    if rel:
        p = (_root() / rel).resolve()
        if p.is_file():
            return p
    windir = os.environ.get("WINDIR", r"C:\Windows")
    seg = Path(windir) / "Fonts" / "seguiemj.ttf"
    if seg.is_file():
        return seg
    return None


def _stroke_width_for_font_px(font_px: int) -> int:
    """Outline thickness for fulltext blocks (banners use no Latin stroke)."""
    return max(4, min(13, max(5, font_px // 14)))


def _shop_banner_stroke(_bg: str, _fg: str, _font_px: int) -> tuple[int, str]:
    """Banner chip Latin: no outline (fulltext overlay still uses _stroke_width_for_font_px)."""
    return 0, "#000000"


def load_config(path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or _root() / "config.json"
    with cfg_path.open(encoding="utf-8") as f:
        return json.load(f)


def resolve_font(
    cfg: dict[str, Any], key: str
) -> tuple[Path | None, ImageFont.FreeTypeFont | None]:
    rel = cfg.get(key) or ""
    p = (_root() / rel).resolve() if rel else None
    if not p or not p.is_file():
        return None, None
    try:
        return p, ImageFont.truetype(str(p), 48)
    except OSError:
        log.warning("Could not load font %s", p)
        return p, None


def load_main_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    fnt = ImageFont.truetype(str(path), size)
    try:
        axes_info = fnt.get_variation_axes()
    except (OSError, ValueError, AttributeError):
        return fnt
    if not axes_info or not isinstance(axes_info, list):
        return fnt
    # TikTok Sans variable file only (static TikTokSans-*.ttf has no axes).
    tiktok_vf = "tiktok" in path.name.lower() and "variablefont" in path.name.lower()
    vals: list[float] = []
    for ax in axes_info:
        mn = float(ax["minimum"])
        d = float(ax["default"])
        mx = float(ax["maximum"])
        name = (ax.get("name") or b"").decode("utf-8", errors="ignore").lower()
        raw_tag = ax.get("tag")
        if isinstance(raw_tag, bytes):
            tag = raw_tag.decode("ascii", errors="ignore").lower()
        else:
            tag = str(raw_tag or "").lower()
        if tiktok_vf:
            if "weight" in name or tag == "wght":
                vals.append(max(mn, min(400.0, mx)))
            elif "slant" in name or tag == "slnt":
                vals.append(max(mn, min(0.0, mx)))
            elif "width" in name or tag == "wdth":
                vals.append(max(mn, min(100.0, mx)))
            elif "optical" in name or tag == "opsz":
                vals.append(d)
            else:
                vals.append(d)
        else:
            if "weight" in name or tag == "wght":
                vals.append(max(mn, min(700.0, mx)))
            elif "optical" in name or tag == "opsz":
                vals.append(max(mn, min(mx, float(size) * 0.11)))
            elif "width" in name or tag == "wdth":
                vals.append(d)
            elif "slant" in name or tag == "slnt":
                vals.append(d)
            else:
                vals.append(d)
    try:
        fnt.set_variation_by_axes(vals)
    except (OSError, ValueError, TypeError):
        pass
    return fnt


def fit_banner_font(
    text: str,
    draw: ImageDraw.ImageDraw,
    font_path: Path,
    emoji_path: Path | None,
    max_width: int,
    start: int,
    minimum: int,
    bg: str,
    fg: str,
) -> ImageFont.FreeTypeFont:
    size = start
    while size >= minimum:
        fnt = load_main_font(font_path, size)
        emo: ImageFont.FreeTypeFont | None = None
        if emoji_path and emoji_path.is_file():
            try:
                emo = ImageFont.truetype(str(emoji_path), size)
            except OSError:
                emo = None
        eh = _emoji_target_h(size)
        sw_fit = _shop_banner_stroke(bg, fg, size)[0]
        if (
            mixed_text_length(
                text,
                draw,
                fnt,
                emo,
                eh,
                latin_stroke_width=sw_fit,
            )
            <= max_width
        ):
            return fnt
        size -= 2
    return load_main_font(font_path, minimum)


def _banner_line_fits_at_size(
    text: str,
    draw: ImageDraw.ImageDraw,
    font_path: Path,
    emoji_path: Path | None,
    size: int,
    max_width: int,
    bg: str,
    fg: str,
) -> bool:
    fnt = load_main_font(font_path, size)
    emo: ImageFont.FreeTypeFont | None = None
    if emoji_path and emoji_path.is_file():
        try:
            emo = ImageFont.truetype(str(emoji_path), size)
        except OSError:
            emo = None
    eh = _emoji_target_h(size)
    sw = _shop_banner_stroke(bg, fg, size)[0]
    return (
        mixed_text_length(
            text,
            draw,
            fnt,
            emo,
            eh,
            latin_stroke_width=sw,
        )
        <= max_width
    )


def fit_banner_line2_font_size(
    line2: str,
    draw: ImageDraw.ImageDraw,
    font_path: Path,
    emoji_path: Path | None,
    max_width: int,
    line1_font_px: int,
    bg2: str,
    fg2: str,
    *,
    ratio: float = 0.72,
    abs_floor: int = 44,
) -> int:
    """Second chip: ~70–75% of line-1 size (TikTok primary + sub chip), still within max_width."""
    target = int(round(line1_font_px * ratio))
    target = max(abs_floor, min(line1_font_px, target))
    if target % 2:
        target -= 1
    sz = target
    while sz >= abs_floor:
        if _banner_line_fits_at_size(
            line2, draw, font_path, emoji_path, sz, max_width, bg2, fg2
        ):
            return sz
        sz -= 2
    return abs_floor


def _price_strike_outline_px(font_px: int) -> int:
    """Thick black outline on white strike-through label (TikTok reference)."""
    return max(5, min(14, int(round(font_px * 0.078))))


def fit_price_strike_top_font(
    text: str,
    draw: ImageDraw.ImageDraw,
    font_path: Path,
    emoji_path: Path | None,
    max_width: int,
    start: int,
    minimum: int,
) -> ImageFont.FreeTypeFont:
    size = start
    while size >= minimum:
        fnt = load_main_font(font_path, size)
        emo: ImageFont.FreeTypeFont | None = None
        if emoji_path and emoji_path.is_file():
            try:
                emo = ImageFont.truetype(str(emoji_path), size)
            except OSError:
                emo = None
        sw = _price_strike_outline_px(size)
        eh = _emoji_target_h(size)
        if (
            mixed_text_length(
                text,
                draw,
                fnt,
                emo,
                eh,
                latin_stroke_width=sw,
            )
            <= max_width
        ):
            return fnt
        size -= 2
    return load_main_font(font_path, minimum)


def draw_rounded_banner_block(
    draw: ImageDraw.ImageDraw,
    cx: int,
    y: int,
    text: str,
    font_path: Path,
    emoji_path: Path | None,
    bg: str,
    fg: str,
    max_text_width: int,
    pad_x: int,
    pad_y: int,
    radius: int,
    font_start: int,
    font_min: int,
    box_width: int | None = None,
    forced_font_size: int | None = None,
) -> int:
    if forced_font_size is not None:
        fnt = load_main_font(font_path, forced_font_size)
    else:
        fnt = fit_banner_font(
            text,
            draw,
            font_path,
            emoji_path,
            max_text_width,
            font_start,
            font_min,
            bg,
            fg,
        )
    emoji_font: ImageFont.FreeTypeFont | None = None
    if emoji_path and emoji_path.is_file():
        try:
            emoji_font = ImageFont.truetype(str(emoji_path), fnt.size)
        except OSError:
            emoji_font = None
    sw, sc = _shop_banner_stroke(bg, fg, fnt.size)
    eh = _emoji_target_h(fnt.size)
    ink_h = mixed_line_ink_height(
        text, draw, fnt, emoji_font, eh, latin_stroke_width=sw
    )
    # Extra vertical room so full-color emoji art (e.g. red heart) stays inside the bar
    # and does not read as a “second banner” above the fill.
    emoji_slop = 10 if _banner_line_has_png_emoji(text) else 0
    bbox_h = ink_h + pad_y * 2 + min(8, sw + 1) + emoji_slop
    content_w = mixed_text_length(
        text, draw, fnt, emoji_font, eh, latin_stroke_width=sw
    )
    # Width follows this line’s text + emoji only (no coupling to the other banner).
    need_w = int(math.ceil(content_w)) + pad_x * 2
    if box_width is not None:
        rect_w = max(box_width, need_w)
    else:
        rect_w = need_w
    x1 = cx - rect_w // 2
    x2 = cx + rect_w // 2
    y1 = y
    y2 = y + bbox_h
    # TikTok Shop stickers: modest rounding (~14–22px at 1080p), not full pills.
    r_by_w = max(8, min(22, int(round(rect_w * 0.0165))))
    r_by_h = max(8, min(22, max(10, bbox_h // 4)))
    r_use = min(r_by_w, r_by_h, max(8, min(radius, 25)))
    # Inset fill slightly so anti-aliased curve pixels stay opaque inside the bar (no video fringe).
    draw.rounded_rectangle((x1, y1, x2, y2), radius=r_use, fill=bg, outline=bg, width=2)
    cy = (y1 + y2) / 2.0
    # Single-line banners: PNG emojis composited; Latin has no stroke (fulltext does).
    draw_text_mixed_centered(
        draw,
        float(cx),
        cy,
        text,
        fnt,
        emoji_font,
        fg,
        stroke_width=sw,
        stroke_fill=sc,
        anchor_mm=True,
        emoji_target_h=eh,
    )
    return y2


def render_banner_overlay(
    cfg: dict[str, Any],
    preset: dict[str, Any],
    jitter_y: int,
    font_main: Path,
) -> Image.Image:
    w, h = int(cfg["video_width"]), int(cfg["video_height"])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    line1 = prepare_text_for_render(str(preset["line1_text"]), cfg.get("_emoji_path"))
    line2 = prepare_text_for_render(str(preset["line2_text"]), cfg.get("_emoji_path"))

    # Left/right padding inside each chip (vertical uses pad_y_* only).
    banner_pad_x = 34
    # Max glyph span for fitting: ~82% frame minus chip padding on both sides.
    max_text_w = max(1, int(round(w * 0.82)) - 2 * banner_pad_x)
    # Top chip: taller bar + largest font that fits (not tied to line 2).
    pad_y_line1 = 19
    pad_y_line2 = 9
    banner_pad_x_line2 = max(22, int(round(banner_pad_x * 0.88)))

    banner_top_nudge_px = 92
    zone_top = int(h * 0.058) + jitter_y + banner_top_nudge_px
    cx = w // 2

    y = zone_top
    emo_p = cfg.get("_emoji_path")
    bg1, fg1 = str(preset["line1_bg_color"]), str(preset["line1_text_color"])
    bg2, fg2 = str(preset["line2_bg_color"]), str(preset["line2_text_color"])
    line1_fnt = fit_banner_font(
        line1,
        draw,
        font_main,
        emo_p,
        max_text_w,
        BANNER_LINE1_FONT_START_PX,
        BANNER_LINE1_FONT_MIN_PX,
        bg1,
        fg1,
    )
    line1_font_px = line1_fnt.size
    line2_font_px = fit_banner_line2_font_size(
        line2,
        draw,
        font_main,
        emo_p,
        max_text_w,
        line1_font_px,
        bg2,
        fg2,
        ratio=0.72,
        abs_floor=44,
    )
    y = draw_rounded_banner_block(
        draw,
        cx,
        y,
        line1,
        font_main,
        emo_p,
        bg1,
        fg1,
        max_text_w,
        pad_x=banner_pad_x,
        pad_y=pad_y_line1,
        radius=25,
        font_start=BANNER_LINE1_FONT_START_PX,
        font_min=BANNER_LINE1_FONT_MIN_PX,
        box_width=None,
        forced_font_size=line1_font_px,
    )
    # Second chip starts flush below the first (no negative overlap). A few px overlap used to
    # hide a subpixel seam but read as three muddy stacked layers; flush keeps two distinct bars.
    draw_rounded_banner_block(
        draw,
        cx,
        y,
        line2,
        font_main,
        emo_p,
        bg2,
        fg2,
        max_text_w,
        pad_x=banner_pad_x_line2,
        pad_y=pad_y_line2,
        radius=25,
        font_start=BANNER_LINE2_FONT_START_PX,
        font_min=44,
        box_width=None,
        forced_font_size=line2_font_px,
    )
    return img


def _hex_rgb_triplet(s: str) -> tuple[int, int, int]:
    h = str(s).strip().lstrip("#")
    if len(h) >= 6:
        try:
            return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        except ValueError:
            pass
    return 255, 0, 0


def render_banner_price_strike_overlay(
    cfg: dict[str, Any],
    preset: dict[str, Any],
    jitter_y: int,
    font_main: Path,
) -> Image.Image:
    """
    TikTok-style: outlined white strike label (no chip) + red horizontal strike + larger red pill below.
    Preset: line1_text (e.g. FULL PRICE), line2_text (e.g. 40% OFF 🚨), line2_bg_color, line2_text_color;
    optional strike_line_color (default #FF0000). line1_* chip colors are ignored for the top row.
    """
    w, h = int(cfg["video_width"]), int(cfg["video_height"])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    line1 = prepare_text_for_render(str(preset["line1_text"]), cfg.get("_emoji_path"))
    line2 = prepare_text_for_render(str(preset["line2_text"]), cfg.get("_emoji_path"))

    banner_pad_x = 34
    max_text_w = max(1, int(round(w * 0.82)) - 2 * banner_pad_x)
    pad_y_line2 = 12
    banner_pad_x_line2 = max(22, int(round(banner_pad_x * 0.88)))
    min_chip_w = max(1, int(round(w * PRICE_STRIKE_LINE2_BOX_FRAC)))

    banner_top_nudge_px = 92
    zone_top = int(h * 0.058) + jitter_y + banner_top_nudge_px
    cx = w // 2
    y = float(zone_top)
    emo_p = cfg.get("_emoji_path")
    bg2 = str(preset["line2_bg_color"])
    fg2 = str(preset["line2_text_color"])
    strike_rgb = _hex_rgb_triplet(str(preset.get("strike_line_color") or "#FF0000"))

    line1_fnt = fit_price_strike_top_font(
        line1,
        draw,
        font_main,
        emo_p,
        max_text_w,
        PRICE_STRIKE_LINE1_START_PX,
        PRICE_STRIKE_LINE1_MIN_PX,
    )
    sz1 = line1_fnt.size
    sw1 = _price_strike_outline_px(sz1)
    eh1 = _emoji_target_h(sz1)
    emoji_font1: ImageFont.FreeTypeFont | None = None
    if emo_p and Path(str(emo_p)).is_file():
        try:
            emoji_font1 = ImageFont.truetype(str(emo_p), sz1)
        except OSError:
            emoji_font1 = None
    ink_h = mixed_line_ink_height(
        line1, draw, line1_fnt, emoji_font1, eh1, latin_stroke_width=sw1
    )
    pad_v_strike = 8
    block_h = float(ink_h + pad_v_strike * 2)
    cy = y + block_h / 2.0
    tw = mixed_text_length(
        line1, draw, line1_fnt, emoji_font1, eh1, latin_stroke_width=sw1
    )
    draw_text_mixed_centered(
        draw,
        float(cx),
        cy,
        line1,
        line1_fnt,
        emoji_font1,
        "#FFFFFF",
        sw1,
        "#000000",
        True,
        eh1,
    )
    y_strike = int(round(cy))
    extend = max(8, int(round(sz1 * 0.055)))
    x1s = int(round(cx - tw / 2 - extend))
    x2s = int(round(cx + tw / 2 + extend))
    line_w = max(4, min(12, sz1 // 11))
    draw.line(
        [(x1s, y_strike), (x2s, y_strike)],
        fill=(*strike_rgb, 255),
        width=line_w,
    )

    y = int(y + block_h) + PRICE_STRIKE_GAP_BELOW_STRIKE_PX

    line2_target = int(round(sz1 * PRICE_STRIKE_LINE2_SIZE_MULT))
    line2_target = max(
        PRICE_STRIKE_LINE2_MIN_PX, min(PRICE_STRIKE_LINE2_CAP_PX, line2_target)
    )
    if line2_target % 2:
        line2_target -= 1
    sz2 = line2_target
    while sz2 >= PRICE_STRIKE_LINE2_MIN_PX:
        if _banner_line_fits_at_size(
            line2, draw, font_main, emo_p, sz2, max_text_w, bg2, fg2
        ):
            break
        sz2 -= 2
    else:
        sz2 = PRICE_STRIKE_LINE2_MIN_PX

    draw_rounded_banner_block(
        draw,
        cx,
        y,
        line2,
        font_main,
        emo_p,
        bg2,
        fg2,
        max_text_w,
        pad_x=banner_pad_x_line2,
        pad_y=pad_y_line2,
        radius=PRICE_STRIKE_BANNER_RADIUS_PX,
        font_start=BANNER_LINE2_FONT_START_PX,
        font_min=PRICE_STRIKE_LINE2_MIN_PX,
        box_width=min_chip_w,
        forced_font_size=sz2,
    )
    return img


def wrap_fulltext_lines(
    text: str,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
    max_width_px: float,
    emoji_target_h: int,
    latin_stroke_width: int,
) -> list[str]:
    lines: list[str] = []
    for paragraph in (text.splitlines() or [text]):
        words = paragraph.split()
        cur: list[str] = []
        for word in words:
            trial = (" ".join(cur + [word])).strip()
            if (
                mixed_text_length(
                    trial,
                    draw,
                    font,
                    emoji_font,
                    emoji_target_h,
                    latin_stroke_width=latin_stroke_width,
                )
                <= max_width_px
            ):
                cur.append(word)
            else:
                if cur:
                    lines.append(" ".join(cur))
                cur = [word]
        if cur:
            lines.append(" ".join(cur))
    return lines


def render_fulltext_overlay(
    cfg: dict[str, Any],
    preset: dict[str, Any],
    jitter_y: int,
    font_main: Path,
) -> Image.Image:
    w, h = int(cfg["video_width"]), int(cfg["video_height"])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    raw = prepare_text_for_render(str(preset["text"]), cfg.get("_emoji_path"))
    # Wider inset so long lines don’t hug the frame (phone safe-area / minor crop).
    side_pad = 72
    max_width_px = float(w - 2 * side_pad)
    # ~60–80px clear space below the top of the frame before the text band.
    top_breathing_px = 70
    zone_top = top_breathing_px + jitter_y
    # Barely shift the drawn lines down within the fit band (does not shrink top margin).
    fulltext_nudge_down_px = 14

    emo_p = cfg.get("_emoji_path")
    emoji_path_ft = emo_p if isinstance(emo_p, Path) else None

    def line_leading(sz: int) -> int:
        return int(round(sz * 1.03)) + 4

    fnt: ImageFont.FreeTypeFont | None = None
    emoji_font: ImageFont.FreeTypeFont | None = None
    lines: list[str] = []
    size_chosen = 80
    fit_zone_bottom = zone_top + int(h * 0.40)

    # Smaller type + tight leading (TikTok-style fulltext block).
    fulltext_max_px = 196
    fulltext_min_px = 64
    # Prefer ~40% of frame height; only widen the band if copy still cannot fit at min font.
    for band_frac in (0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70):
        band_h = int(h * band_frac)
        zone_bottom = zone_top + band_h
        available_h = max(1, zone_bottom - zone_top)
        for size in range(fulltext_max_px, fulltext_min_px - 1, -2):
            f_try = load_main_font(font_main, size)
            emo_ft: ImageFont.FreeTypeFont | None = None
            if emoji_path_ft and emoji_path_ft.is_file():
                try:
                    emo_ft = ImageFont.truetype(str(emoji_path_ft), size)
                except OSError:
                    emo_ft = None
            eh = _emoji_target_h(size)
            sw_line = _stroke_width_for_font_px(size)
            lines_try = wrap_fulltext_lines(
                raw, draw, f_try, emo_ft, max_width_px, eh, sw_line
            )
            if not lines_try:
                continue
            lh = line_leading(size)
            block_h = len(lines_try) * lh
            if block_h <= available_h:
                fnt = f_try
                emoji_font = emo_ft
                lines = lines_try
                size_chosen = size
                fit_zone_bottom = zone_bottom
                break
        if fnt is not None:
            break

    if fnt is not None:
        for _ in range(14):
            if size_chosen <= fulltext_min_px + 2:
                break
            sz_try = size_chosen - 2
            f_try = load_main_font(font_main, sz_try)
            emo_ft: ImageFont.FreeTypeFont | None = None
            if emoji_path_ft and emoji_path_ft.is_file():
                try:
                    emo_ft = ImageFont.truetype(str(emoji_path_ft), sz_try)
                except OSError:
                    emo_ft = None
            eh_try = _emoji_target_h(sz_try)
            sw_try = _stroke_width_for_font_px(sz_try)
            lines_try = wrap_fulltext_lines(
                raw, draw, f_try, emo_ft, max_width_px, eh_try, sw_try
            )
            if not lines_try:
                break
            lh_try = line_leading(sz_try)
            if len(lines_try) * lh_try > available_h:
                break
            fnt, emoji_font, lines, size_chosen = f_try, emo_ft, lines_try, sz_try

    if fnt is None:
        size_chosen = fulltext_min_px
        fnt = load_main_font(font_main, size_chosen)
        emoji_font = None
        if emoji_path_ft and emoji_path_ft.is_file():
            try:
                emoji_font = ImageFont.truetype(str(emoji_path_ft), size_chosen)
            except OSError:
                pass
        eh_fb = _emoji_target_h(size_chosen)
        sw_fb = _stroke_width_for_font_px(size_chosen)
        lines = (
            wrap_fulltext_lines(
                raw, draw, fnt, emoji_font, max_width_px, eh_fb, sw_fb
            )
            or [raw]
        )
        fit_zone_bottom = zone_top + int(h * 0.60)

    available_h = max(1, fit_zone_bottom - zone_top)

    line_height = line_leading(size_chosen)
    block_h = len(lines) * line_height
    y = zone_top + max(0, (available_h - block_h) // 2) + fulltext_nudge_down_px
    cx = w / 2
    stroke_w = _stroke_width_for_font_px(size_chosen)
    eh_draw = _emoji_target_h(size_chosen)

    for line in lines:
        tw = mixed_text_length(
            line, draw, fnt, emoji_font, eh_draw, latin_stroke_width=stroke_w
        )
        x = cx - tw / 2
        _draw_mixed_line(
            img,
            draw,
            x,
            y,
            line,
            fnt,
            emoji_font,
            "#FFFFFF",
            stroke_w,
            "#000000",
            eh_draw,
            vertical="baseline",
        )
        y += line_height
    return img


def render_preset_overlay(
    cfg: dict[str, Any],
    preset: dict[str, Any],
    jitter_y: int,
) -> Image.Image:
    font_path = cfg.get("_main_font_path")
    if not font_path or not Path(font_path).is_file():
        raise FileNotFoundError(
            "Main font missing. Set font_path in config.json to a file under fonts/."
        )
    font_main = Path(font_path)

    style = preset.get("style", "banner")
    if style == "fulltext":
        return render_fulltext_overlay(cfg, preset, jitter_y, font_main)
    if style == "banner_price_strike":
        return render_banner_price_strike_overlay(cfg, preset, jitter_y, font_main)
    return render_banner_overlay(cfg, preset, jitter_y, font_main)


def draw_brand_watermark_on_overlay(
    img: Image.Image,
    text: str,
    font_main: Path,
    *,
    font_size_px: int = 18,
    margin_px: int = 14,
    stroke_width: int = 2,
) -> None:
    """Small white label with black stroke, bottom-right (free tier); mutates RGBA overlay."""
    label = (text or "").strip()
    if not label:
        return
    if img.mode != "RGBA":
        raise ValueError("overlay image must be RGBA")
    try:
        font = load_main_font(font_main, font_size_px)
    except OSError:
        font = ImageFont.load_default()
        log.warning("Watermark font load failed; using default: %s", font_main)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = max(margin_px, img.width - tw - margin_px)
    y = max(margin_px, img.height - th - margin_px)
    draw.text(
        (x, y),
        label,
        font=font,
        fill=(255, 255, 255, 255),
        stroke_width=stroke_width,
        stroke_fill=(0, 0, 0, 255),
    )


def enrich_config(cfg: dict[str, Any]) -> dict[str, Any]:
    out = dict(cfg)
    main_p, _ = resolve_font(cfg, "font_path")
    if main_p:
        out["_main_font_path"] = main_p
    out["_emoji_path"] = _resolve_emoji_font(cfg)
    return out


def _video_has_audio(video_in: Path) -> bool:
    try:
        ffprobe_bin = _ffprobe_executable()
    except FileNotFoundError:
        return True
    r = subprocess.run(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            str(video_in),
        ],
        capture_output=True,
        text=True,
    )
    return bool((r.stdout or "").strip())


def ffprobe_video_stream_dimensions(video_in: Path) -> tuple[int, int] | None:
    """Pixel width × height of the first video stream, or None if ffprobe cannot read it."""
    try:
        ffprobe_bin = _ffprobe_executable()
    except FileNotFoundError:
        return None
    r = subprocess.run(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(video_in),
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        return None
    try:
        data = json.loads(r.stdout or "{}")
        streams = data.get("streams") or []
        if not streams:
            return None
        w = streams[0].get("width")
        h = streams[0].get("height")
        if w is None or h is None:
            return None
        wi, hi = int(w), int(h)
        if wi <= 0 or hi <= 0:
            return None
        return (wi, hi)
    except (json.JSONDecodeError, TypeError, ValueError, KeyError, IndexError):
        return None


def ffmpeg_normalize_video(
    video_in: Path,
    video_out: Path,
    width: int,
    height: int,
    *,
    timeout_sec: float | None = None,
) -> None:
    """Scale video to fit inside width×height (preserve aspect), pad to exact frame size."""
    ffmpeg_bin = _ffmpeg_executable()
    dims = ffprobe_video_stream_dimensions(video_in)
    if dims is not None and dims[0] == width and dims[1] == height:
        log.info(
            "FFmpeg normalize skip (already %dx%d): copy %s → %s",
            width,
            height,
            video_in,
            video_out,
        )
        video_out = Path(video_out)
        video_out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(video_in, video_out)
        return
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1"
    )
    has_audio = _video_has_audio(video_in)
    cmd: list[str] = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
        # Skip streams FFmpeg cannot decode (e.g. iPhone spatial apac) without OOM-heavy probing.
        "-ignore_unknown",
        "-i",
        str(video_in),
        # First video + first audio only: iPhone spatial (e.g. apac) lives on extra
        # streams FFmpeg may fail to decode; stereo is typically 0:a:0.
        "-map",
        "0:v:0",
    ]
    if has_audio:
        cmd.extend(["-map", "0:a:0"])
    cmd.extend(
        [
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "medium",
        ]
    )
    if has_audio:
        cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    else:
        cmd.append("-an")
    cmd.append(str(video_out))
    log.info("FFmpeg normalize: %s", subprocess.list2cmdline(cmd))
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as e:
        raise TimeoutError("ffmpeg normalize timed out") from e
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"ffmpeg normalize failed ({proc.returncode}): {err}")


def ffmpeg_composite(
    video_in: Path,
    overlay_png: Path,
    video_out: Path,
    *,
    timeout_sec: float | None = None,
) -> None:
    ffmpeg_bin = _ffmpeg_executable()
    # Pillow draws at config width×height; the *decoded* video frame may differ (e.g. SAR,
    # bad metadata copy-skip in normalize, or odd encoder tags). Overlaying without scaling
    # then crops or stretches one stream and yields huge/off-center bars or double-scale junk.
    # scale2ref: scale the RGBA overlay to match the main video’s actual iw×ih (Lanczos).
    filt = (
        "[1:v]format=rgba[ovin];"
        "[ovin][0:v]scale2ref=iw:ih:flags=lanczos[ov][main];"
        "[main][ov]overlay=0:0[outv]"
    )
    cmd: list[str] = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-i",
        str(video_in),
        "-i",
        str(overlay_png),
        "-filter_complex",
        filt,
        "-map",
        "[outv]",
    ]
    if _video_has_audio(video_in):
        cmd.extend(["-map", "0:a:0", "-c:a", "copy"])
    cmd.extend(
        [
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "ultrafast",
            str(video_out),
        ]
    )
    log.info("FFmpeg command: %s", subprocess.list2cmdline(cmd))
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as e:
        raise TimeoutError("ffmpeg composite timed out") from e
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {err}")


def composite_one(
    cfg: dict[str, Any],
    video_in: Path,
    video_out: Path,
    preset: dict[str, Any] | None = None,
    *,
    ffmpeg_timeout_sec: float | None = None,
    watermark_text: str | None = None,
) -> dict[str, Any]:
    video_in_path = Path(video_in).expanduser()
    if "_overlay" in video_in_path.stem.lower():
        log.warning(
            'Input filename contains "_overlay" — it may already have burned-in stickers; '
            "running again stacks a second pair of bars. Use a raw export for a clean result (%s).",
            video_in_path.name,
        )
    cfg = enrich_config(cfg)
    chosen = preset or random.choice(cfg["presets"])
    jitter = random.randint(-18, 18)
    overlay_img = render_preset_overlay(cfg, chosen, jitter)
    wt = (watermark_text or "").strip()
    if wt:
        fp = cfg.get("_main_font_path")
        if fp and Path(str(fp)).is_file():
            draw_brand_watermark_on_overlay(
                overlay_img, wt, Path(str(fp))
            )

    video_out = Path(video_out).expanduser()
    video_out.parent.mkdir(parents=True, exist_ok=True)
    video_out = video_out.resolve()

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp_overlay = Path(tf.name)
    try:
        overlay_img.save(tmp_overlay, format="PNG")
        log.info(
            "Overlay raster %dx%d → ffmpeg → %s",
            overlay_img.width,
            overlay_img.height,
            video_out,
        )
        ffmpeg_composite(
            video_in_path.resolve(),
            tmp_overlay,
            video_out,
            timeout_sec=ffmpeg_timeout_sec,
        )
    finally:
        try:
            tmp_overlay.unlink(missing_ok=True)
        except OSError:
            pass

    return chosen


def wait_until_stable(path: Path, initial_sleep: float = 5.0) -> bool:
    time.sleep(initial_sleep)
    last = -1
    stable = 0
    needed = 3
    interval = 0.5
    while stable < needed:
        if not path.is_file():
            return False
        size = path.stat().st_size
        if size > 0 and size == last:
            stable += 1
        else:
            stable = 0
        last = size
        time.sleep(interval)
    return True


@dataclass
class WatchConfig:
    raw_dir: Path
    done_dir: Path
    archive_dir: Path
    poll_interval: float = 3.0


def process_raw_file(path: Path, cfg: dict[str, Any], wcfg: WatchConfig) -> None:
    if path.suffix.lower() not in {".mp4", ".mov"}:
        return
    dest_out = wcfg.done_dir / path.name
    dest_arch = wcfg.archive_dir / path.name
    try:
        chosen = composite_one(cfg, path, dest_out)
        preset_label = chosen.get("style", "?")
        if chosen.get("style") == "banner":
            detail = f'{chosen.get("line1_text", "")} / {chosen.get("line2_text", "")}'
        else:
            detail = (chosen.get("text") or "")[:80]
        log.info('Processed "%s" | preset=%s | %s', path.name, preset_label, detail)
        shutil.move(str(path), str(dest_arch))
    except Exception as e:  # noqa: BLE001
        log.exception('Failed processing "%s": %s', path.name, e)


class _RawHandler(FileSystemEventHandler):
    def __init__(self, cfg: dict[str, Any], wcfg: WatchConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.wcfg = wcfg
        self._locks: dict[str, threading.Lock] = {}

    def _lock_for(self, key: str) -> threading.Lock:
        if key not in self._locks:
            self._locks[key] = threading.Lock()
        return self._locks[key]

    def _schedule(self, src_path: str) -> None:
        path = Path(src_path)
        if path.suffix.lower() not in {".mp4", ".mov"}:
            return
        lock = self._lock_for(str(path.resolve()))

        def job() -> None:
            with lock:
                if not path.is_file():
                    return
                if not wait_until_stable(path):
                    return
                process_raw_file(path, self.cfg, self.wcfg)

        t = threading.Thread(target=job, daemon=True)
        t.start()

    def on_created(self, event: Any) -> None:
        if getattr(event, "is_directory", False):
            return
        self._schedule(event.src_path)

    def on_modified(self, event: Any) -> None:
        if getattr(event, "is_directory", False):
            return
        self._schedule(event.src_path)


def run_watch(cfg: dict[str, Any], wcfg: WatchConfig) -> None:
    if PollingObserver is None:
        raise RuntimeError("watchdog is not installed; pip install watchdog")
    wcfg.raw_dir.mkdir(parents=True, exist_ok=True)
    wcfg.done_dir.mkdir(parents=True, exist_ok=True)
    wcfg.archive_dir.mkdir(parents=True, exist_ok=True)

    handler = _RawHandler(cfg, wcfg)
    observer = PollingObserver(timeout=wcfg.poll_interval)
    observer.schedule(handler, str(wcfg.raw_dir), recursive=False)
    observer.start()
    log.info(
        "Watching %s (poll every %ss) → done=%s archive=%s",
        wcfg.raw_dir,
        wcfg.poll_interval,
        wcfg.done_dir,
        wcfg.archive_dir,
    )
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


def cmd_composite(args: argparse.Namespace) -> int:
    cfg = load_config()
    video_in = Path(args.input).resolve()
    if not video_in.is_file():
        log.error("Input not found: %s", video_in)
        return 1
    out = Path(args.output).resolve() if args.output else video_in.with_stem(
        video_in.stem + "_overlay"
    )
    preset = None
    if args.preset_index is not None:
        presets = cfg["presets"]
        if args.preset_index < 0 or args.preset_index >= len(presets):
            log.error("preset-index out of range (0..%d)", len(presets) - 1)
            return 1
        preset = presets[args.preset_index]
    try:
        chosen = composite_one(cfg, video_in, out, preset=preset)
        log.info(
            "Composite OK → %s | preset=%s",
            out,
            chosen.get("style"),
        )
    except Exception as e:  # noqa: BLE001
        log.exception("Composite failed: %s", e)
        return 1
    return 0


def cmd_watch(_args: argparse.Namespace) -> int:
    cfg = load_config()
    root = _root()
    wcfg = WatchConfig(
        raw_dir=root / "raw",
        done_dir=root / "done",
        archive_dir=root / "archive",
        poll_interval=3.0,
    )
    try:
        run_watch(cfg, wcfg)
    except KeyboardInterrupt:
        return 0
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="TikTok-style video overlays (FFmpeg + Pillow).")
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser(
        "composite",
        help="Render overlay + FFmpeg (test without watcher).",
        epilog=(
            "Input must be a clean clip with no burned-in stickers. Files like "
            "web/public/videos/demo*.mp4 are already exported with overlays—running composite "
            "on them stacks another pair of bars. For a quick test: "
            "samples/clean_1080x1920_6s.mp4"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    pc.add_argument(
        "input",
        help="Input .mp4 or .mov (overlay-free; not a prior *_overlay export)",
    )
    pc.add_argument(
        "output",
        nargs="?",
        help="Output path (default: <input>_overlay.<ext>)",
    )
    pc.add_argument(
        "--preset-index",
        type=int,
        default=None,
        help="Force preset by index from config.json (default: random).",
    )
    pc.set_defaults(func=cmd_composite)

    pw = sub.add_parser("watch", help="Poll raw/ for new videos and process forever.")
    pw.set_defaults(func=cmd_watch)

    args = p.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
