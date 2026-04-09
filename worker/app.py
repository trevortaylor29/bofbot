"""
FastAPI worker: read raw video from local disk, run tiktoked overlay, write output to disk.

Paths in requests are relative to the media root (forward slashes), e.g. raw/{batch}/{id}.mp4.

Env:
  BOFBOT_MEDIA_ROOT — media root (preferred)
  TIKTOKED_MEDIA_ROOT — legacy alias, same value
  TIKTOKED_CONFIG — optional path to config.json (default: repo root)
  WORKER_API_KEY — optional; if set, require Authorization: Bearer <key>
"""
from __future__ import annotations

import logging
import os
import random
import shutil
import tempfile
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

import tiktoked

log = logging.getLogger("bofbot.worker")

# Per FFmpeg step (normalize, composite) — not configurable via env.
FFMPEG_TIMEOUT_SEC = 120.0

DEFAULT_BANNER_COLOR_PRESETS: list[dict[str, str]] = [
    {
        "line1_bg_color": "#FF69B4",
        "line1_text_color": "#FFFFFF",
        "line2_bg_color": "#FF0000",
        "line2_text_color": "#FFFFFF",
    },
    {
        "line1_bg_color": "#DD00FF",
        "line1_text_color": "#FFFFFF",
        "line2_bg_color": "#FF0000",
        "line2_text_color": "#FFFFFF",
    },
    {
        "line1_bg_color": "#FF8C00",
        "line1_text_color": "#FFFFFF",
        "line2_bg_color": "#FF0000",
        "line2_text_color": "#FFFFFF",
    },
    {
        "line1_bg_color": "#FF0000",
        "line1_text_color": "#FFFFFF",
        "line2_bg_color": "#FFFFFF",
        "line2_text_color": "#000000",
    },
    {
        "line1_bg_color": "#FF0000",
        "line1_text_color": "#FFFFFF",
        "line2_bg_color": "#FFFFFF",
        "line2_text_color": "#000000",
    },
]


class BannerHook(BaseModel):
    line1_text: str
    line2_text: str


class FulltextHook(BaseModel):
    text: str


class BannerColors(BaseModel):
    line1_bg_color: str
    line1_text_color: str
    line2_bg_color: str
    line2_text_color: str


class ProcessRequest(BaseModel):
    """Paths under media root, forward slashes."""

    video_rel_path: str = Field(..., description="e.g. raw/{batch}/{id}.mp4")
    processed_rel_path: str = Field(..., description="e.g. out/{batch}/{id}.mp4")
    overlay_style: Literal["banner", "fulltext"]
    banner_hooks: list[BannerHook] | None = None
    fulltext_hooks: list[FulltextHook] | None = None
    color_presets: list[BannerColors] | None = None
    watermark_text: str | None = Field(
        None,
        description="If set, drawn on overlay PNG bottom-right before composite (free tier)",
    )
    priority_processing: bool = Field(
        False,
        description="Reserved for future queue prioritization (Pro plan)",
    )

    @model_validator(mode="after")
    def _hooks_match_style(self) -> ProcessRequest:
        if self.overlay_style == "banner":
            if not self.banner_hooks:
                raise ValueError("banner_hooks required when overlay_style is banner")
            presets = self.color_presets
            if not presets:
                presets = [BannerColors(**c) for c in DEFAULT_BANNER_COLOR_PRESETS]
                self.color_presets = presets
        else:
            if not self.fulltext_hooks:
                raise ValueError("fulltext_hooks required when overlay_style is fulltext")
        return self


class ProcessResponse(BaseModel):
    processed_rel_path: str
    overlay_style: str
    hook_used: dict[str, Any]
    color_preset_used: dict[str, str] | None = None


def _config_path() -> Path:
    raw = os.environ.get("TIKTOKED_CONFIG", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return tiktoked._root() / "config.json"


def _load_cfg() -> dict[str, Any]:
    return tiktoked.load_config(_config_path())


def _media_root() -> Path:
    for key in ("BOFBOT_MEDIA_ROOT", "TIKTOKED_MEDIA_ROOT"):
        env = os.environ.get(key, "").strip()
        if env:
            return Path(env).expanduser().resolve()
    return Path(__file__).resolve().parent.parent / "web" / ".data" / "media"


def _normalize_rel_key(rel: str) -> str:
    rel_norm = rel.replace("\\", "/").strip().lstrip("/")
    parts = rel_norm.split("/")
    if not rel_norm or ".." in parts:
        raise HTTPException(status_code=400, detail="invalid path")
    return rel_norm


def _resolve_local_path(rel: str) -> Path:
    rel_norm = _normalize_rel_key(rel)
    root = _media_root()
    out = (root / rel_norm).resolve()
    try:
        out.relative_to(root)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="path escapes media root") from e
    return out


def _verify_api_key(authorization: str | None = Header(None)) -> None:
    expected = os.environ.get("WORKER_API_KEY", "").strip()
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _build_preset(req: ProcessRequest) -> tuple[dict[str, Any], dict[str, Any], dict[str, str] | None]:
    if req.overlay_style == "fulltext":
        hook = random.choice(req.fulltext_hooks or [])
        preset = {"style": "fulltext", "text": hook.text}
        meta = {"text": hook.text}
        return preset, meta, None
    hook = random.choice(req.banner_hooks or [])
    colors = random.choice(req.color_presets or [])
    cp = colors.model_dump()
    preset = {
        "style": "banner",
        "line1_text": hook.line1_text,
        "line2_text": hook.line2_text,
        **cp,
    }
    meta = {"line1_text": hook.line1_text, "line2_text": hook.line2_text}
    return preset, meta, cp


def _suffix_for_path(p: Path) -> str:
    lower = p.suffix.lower()
    if lower in (".mov", ".mp4", ".m4v"):
        return lower
    return ".mp4"


def _run_normalize_and_composite(
    cfg: dict[str, Any],
    raw_copy: Path,
    tmp_dir: Path,
    ext_in: str,
    ext_out: str,
    preset: dict[str, Any],
    t_ffmpeg: float,
    watermark_text: str | None,
) -> Path:
    norm_path = tmp_dir / "normalized.mp4"
    tmp_out = tmp_dir / f"out{ext_out}"
    try:
        tiktoked.ffmpeg_normalize_video(
            raw_copy,
            norm_path,
            int(cfg["video_width"]),
            int(cfg["video_height"]),
            timeout_sec=t_ffmpeg,
        )
    except (RuntimeError, TimeoutError, FileNotFoundError) as e:
        log.exception("Normalize failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    try:
        tiktoked.composite_one(
            cfg,
            norm_path,
            tmp_out,
            preset=preset,
            ffmpeg_timeout_sec=t_ffmpeg,
            watermark_text=watermark_text,
        )
    except (RuntimeError, TimeoutError, FileNotFoundError, OSError) as e:
        log.exception("Composite failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return tmp_out


def process_video(req: ProcessRequest) -> ProcessResponse:
    cfg = _load_cfg()
    preset_dict, hook_meta, color_meta = _build_preset(req)
    t_ffmpeg = FFMPEG_TIMEOUT_SEC

    raw_abs = _resolve_local_path(req.video_rel_path)
    out_abs = _resolve_local_path(req.processed_rel_path)

    if not raw_abs.is_file():
        raise HTTPException(
            status_code=400, detail=f"input not found: {req.video_rel_path}"
        )

    out_abs.parent.mkdir(parents=True, exist_ok=True)

    ext_in = _suffix_for_path(raw_abs)
    ext_out = _suffix_for_path(out_abs)

    with tempfile.TemporaryDirectory(prefix="bofbot_worker_") as tmp:
        tmp_path = Path(tmp)
        raw_copy = tmp_path / f"in{ext_in}"
        shutil.copy2(raw_abs, raw_copy)

        wm = (req.watermark_text or "").strip() or None
        tmp_out = _run_normalize_and_composite(
            cfg,
            raw_copy,
            tmp_path,
            ext_in,
            ext_out,
            preset_dict,
            t_ffmpeg,
            wm,
        )

        shutil.copy2(tmp_out, out_abs)

    return ProcessResponse(
        processed_rel_path=req.processed_rel_path,
        overlay_style=req.overlay_style,
        hook_used=hook_meta,
        color_preset_used=color_meta,
    )


app = FastAPI(title="BofBot Worker", version="0.5.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "storage": "local"}


@app.post("/process", response_model=ProcessResponse)
def process_endpoint(
    body: ProcessRequest,
    _auth: None = Depends(_verify_api_key),
) -> ProcessResponse:
    return process_video(body)
