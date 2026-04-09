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
    return Path(__file__).resolve().parent


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
    """Shared outline thickness for banner + fulltext."""
    return max(4, min(13, max(5, font_px // 14)))


def _banner_stroke(fg: str, font_px: int) -> tuple[int, str]:
    """Black on light fills, white on dark; width matches fulltext."""
    s = str(fg).strip().lstrip("#")
    light = True
    try:
        if len(s) >= 6:
            r = int(s[0:2], 16)
            g = int(s[2:4], 16)
            b = int(s[4:6], 16)
            light = (r + g + b) / 3 >= 145
    except ValueError:
        pass
    return _stroke_width_for_font_px(font_px), "#000000" if light else "#FFFFFF"


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
    vals: list[float] = []
    for ax in axes_info:
        mn = float(ax["minimum"])
        d = float(ax["default"])
        mx = float(ax["maximum"])
        name = (ax.get("name") or b"").decode("utf-8", errors="ignore").lower()
        if "weight" in name:
            vals.append(min(900.0, mx))
        elif "optical" in name:
            vals.append(max(mn, min(mx, float(size) * 0.11)))
        elif "width" in name:
            vals.append(d)
        elif "slant" in name:
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
        sw_fit = _stroke_width_for_font_px(size)
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
) -> int:
    fnt = fit_banner_font(
        text, draw, font_path, emoji_path, max_text_width, font_start, font_min
    )
    emoji_font: ImageFont.FreeTypeFont | None = None
    if emoji_path and emoji_path.is_file():
        try:
            emoji_font = ImageFont.truetype(str(emoji_path), fnt.size)
        except OSError:
            emoji_font = None
    sw, sc = _banner_stroke(fg, fnt.size)
    eh = _emoji_target_h(fnt.size)
    ink_h = mixed_line_ink_height(
        text, draw, fnt, emoji_font, eh, latin_stroke_width=sw
    )
    bbox_h = ink_h + pad_y * 2 + min(8, sw + 1)
    content_w = mixed_text_length(
        text, draw, fnt, emoji_font, eh, latin_stroke_width=sw
    )
    need_w = int(math.ceil(content_w)) + pad_x * 2
    if box_width is not None:
        rect_w = max(box_width, need_w)
    else:
        rect_w = need_w
    x1 = cx - rect_w // 2
    x2 = cx + rect_w // 2
    y1 = y
    y2 = y + bbox_h
    # Corners only (not pills): keep radius << half-height and modest vs width.
    r_cap = min(radius, bbox_h // 5, rect_w // 20, 22)
    r_use = max(8, r_cap)
    draw.rounded_rectangle((x1, y1, x2, y2), radius=r_use, fill=bg)
    cy = (y1 + y2) / 2.0
    # Single-line banners: PNG emojis composited; Latin uses stroke outline.
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

    text_inset_x = 50
    # Vertical cushion above/below text inside the colored bar.
    pad_y_banner = 17
    # Line 1 ~50–55% of frame width; line 2 ~40–45% (centered).
    box_w1 = int(round(w * 0.54))
    box_w2 = int(round(w * 0.44))
    max_w1 = max(1, box_w1 - 2 * text_inset_x)
    max_w2 = max(1, box_w2 - 2 * text_inset_x)

    banner_top_nudge_px = 50
    zone_top = int(h * 0.05) + jitter_y + banner_top_nudge_px
    cx = w // 2

    y = zone_top
    emo_p = cfg.get("_emoji_path")
    y = draw_rounded_banner_block(
        draw,
        cx,
        y,
        line1,
        font_main,
        emo_p,
        str(preset["line1_bg_color"]),
        str(preset["line1_text_color"]),
        max_w1,
        pad_x=text_inset_x,
        pad_y=pad_y_banner,
        radius=36,
        font_start=302,
        font_min=70,
        box_width=box_w1,
    )
    BANNER_LINE_GAP = 6
    y += BANNER_LINE_GAP
    draw_rounded_banner_block(
        draw,
        cx,
        y,
        line2,
        font_main,
        emo_p,
        str(preset["line2_bg_color"]),
        str(preset["line2_text_color"]),
        max_w2,
        pad_x=text_inset_x,
        pad_y=pad_y_banner,
        radius=36,
        font_start=248,
        font_min=56,
        box_width=box_w2,
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
    return render_banner_overlay(cfg, preset, jitter_y, font_main)


def enrich_config(cfg: dict[str, Any]) -> dict[str, Any]:
    out = dict(cfg)
    main_p, _ = resolve_font(cfg, "font_path")
    if main_p:
        out["_main_font_path"] = main_p
    out["_emoji_path"] = _resolve_emoji_font(cfg)
    return out


def _video_has_audio(video_in: Path) -> bool:
    if shutil.which("ffprobe") is None:
        return True
    r = subprocess.run(
        [
            "ffprobe",
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


def ffmpeg_normalize_video(
    video_in: Path,
    video_out: Path,
    width: int,
    height: int,
    *,
    timeout_sec: float | None = None,
) -> None:
    """Scale video to fit inside width×height (preserve aspect), pad to exact frame size."""
    if shutil.which("ffmpeg") is None:
        raise FileNotFoundError("ffmpeg not found on PATH")
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1"
    )
    has_audio = _video_has_audio(video_in)
    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
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
    if shutil.which("ffmpeg") is None:
        raise FileNotFoundError("ffmpeg not found on PATH")
    # No scale2ref: overlay PNG is already config-sized (e.g. 1080x1920). Scaling was
    # shrinking the overlay to match smaller phone clips and made banners look tiny.
    filt = "[1:v]format=rgba[ov];[0:v][ov]overlay=0:0[outv]"
    cmd: list[str] = [
        "ffmpeg",
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
        cmd.extend(["-map", "0:a", "-c:a", "copy"])
    cmd.extend(
        [
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "medium",
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
) -> dict[str, Any]:
    cfg = enrich_config(cfg)
    chosen = preset or random.choice(cfg["presets"])
    jitter = random.randint(-18, 18)
    overlay_img = render_preset_overlay(cfg, chosen, jitter)

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
            video_in, tmp_overlay, video_out, timeout_sec=ffmpeg_timeout_sec
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

    pc = sub.add_parser("composite", help="Render overlay + FFmpeg (test without watcher).")
    pc.add_argument("input", help="Input .mp4 or .mov")
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
