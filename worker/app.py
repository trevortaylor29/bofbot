"""
FastAPI worker: download video, run tiktoked overlay, upload result.

Storage modes (mutually exclusive):
  • **R2** — set R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
    Keys in the request are S3 object keys (e.g. raw/{batch}/{id}.mp4).
  • **Local disk** — if R2 is not fully configured, use BOFBOT_MEDIA_ROOT
    (or legacy TIKTOKED_MEDIA_ROOT; default <repo>/web/.data/media).

Env:
  BOFBOT_MEDIA_ROOT — local mode (preferred)
  TIKTOKED_MEDIA_ROOT — local mode fallback
  TIKTOKED_CONFIG — optional path to config.json (default: repo root)
  WORKER_API_KEY — optional; if set, require Authorization: Bearer <key>
  WORKER_FFMPEG_TIMEOUT_SEC — per ffmpeg step (default 120)

R2 (S3-compatible, Cloudflare):
  R2_BUCKET — e.g. bofbot
  R2_ENDPOINT — https://<account_id>.r2.cloudflarestorage.com
  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
"""
from __future__ import annotations

import logging
import os
import random
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Literal

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

import tiktoked

log = logging.getLogger("bofbot.worker")

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
    """Object key (R2) or path under media root (local), forward slashes."""

    video_rel_path: str = Field(..., description="e.g. raw/{batch}/{id}.mp4")
    processed_rel_path: str = Field(..., description="e.g. out/{batch}/{id}.mp4")
    overlay_style: Literal["banner", "fulltext"]
    banner_hooks: list[BannerHook] | None = None
    fulltext_hooks: list[FulltextHook] | None = None
    color_presets: list[BannerColors] | None = None
    watermark_text: str | None = Field(
        None,
        description="If set, burn this text bottom-right (free tier branding)",
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


def _r2_configured() -> bool:
    keys = (
        "R2_BUCKET",
        "R2_ENDPOINT",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
    )
    return all(os.environ.get(k, "").strip() for k in keys)


def _r2_bucket() -> str:
    return os.environ["R2_BUCKET"].strip()


def _s3_client():
    endpoint = os.environ["R2_ENDPOINT"].strip().rstrip("/")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"].strip(),
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def _content_type_for_suffix(suffix: str) -> str:
    if suffix.lower() == ".mov":
        return "video/quicktime"
    return "video/mp4"


def _download_r2_object(client, bucket: str, key: str, dest: Path) -> None:
    try:
        client.download_file(bucket, key, str(dest))
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            raise HTTPException(
                status_code=400, detail=f"input not found in R2: {key}"
            ) from e
        log.exception("R2 download failed")
        raise HTTPException(status_code=500, detail=f"R2 download failed: {e}") from e


def _upload_r2_object(
    client, bucket: str, key: str, src: Path, content_type: str
) -> None:
    try:
        extra = {"ContentType": content_type}
        client.upload_file(str(src), bucket, key, ExtraArgs=extra)
    except ClientError as e:
        log.exception("R2 upload failed")
        raise HTTPException(status_code=500, detail=f"R2 upload failed: {e}") from e


def _ffmpeg_timeout() -> float:
    return float(os.environ.get("WORKER_FFMPEG_TIMEOUT_SEC", "120"))


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
) -> Path:
    norm_path = tmp_dir / "normalized.mp4"
    tmp_out = tmp_dir / f"out{ext_out}"
    try:
        tiktoked.ffmpeg_normalize_video(
            raw_copy, norm_path, int(cfg["video_width"]), int(cfg["video_height"]), timeout_sec=t_ffmpeg
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
        )
    except (RuntimeError, TimeoutError, FileNotFoundError, OSError) as e:
        log.exception("Composite failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return tmp_out


def _apply_brand_watermark(
    src: Path, dest: Path, label: str, timeout_sec: float
) -> None:
    """Bottom-right semi-transparent text (free tier)."""
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not found on PATH")
    safe = (
        label.replace("\\", "\\\\")
        .replace(":", r"\:")
        .replace("'", r"\'")
        .replace("%", r"\%")
    )
    vf = (
        f"drawtext=text='{safe}':fontcolor=white@0.72:fontsize=22:"
        "x=w-text_w-14:y=h-text_h-14:box=1:boxcolor=black@0.42:boxborderw=5"
    )
    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-i",
        str(src),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
    ]
    if tiktoked._video_has_audio(src):
        cmd.extend(["-c:a", "copy"])
    else:
        cmd.append("-an")
    cmd.append(str(dest))
    log.info("Watermark ffmpeg: %s", subprocess.list2cmdline(cmd))
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout_sec
        )
    except subprocess.TimeoutExpired as e:
        raise HTTPException(status_code=500, detail="watermark ffmpeg timed out") from e
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise HTTPException(
            status_code=500, detail=f"watermark ffmpeg failed: {err}"
        )


def _maybe_watermark(
    req: ProcessRequest,
    tmp_path: Path,
    composed: Path,
    ext_out: str,
    t_ffmpeg: float,
) -> Path:
    label = (req.watermark_text or "").strip()
    if not label:
        return composed
    out_wm = tmp_path / f"wm_brand{ext_out}"
    _apply_brand_watermark(composed, out_wm, label, t_ffmpeg)
    return out_wm


def process_video_r2(req: ProcessRequest) -> ProcessResponse:
    cfg = _load_cfg()
    preset_dict, hook_meta, color_meta = _build_preset(req)
    t_ffmpeg = _ffmpeg_timeout()

    key_in = _normalize_rel_key(req.video_rel_path)
    key_out = _normalize_rel_key(req.processed_rel_path)
    bucket = _r2_bucket()
    client = _s3_client()

    ext_in = _suffix_for_path(Path(key_in))
    ext_out = _suffix_for_path(Path(key_out))

    with tempfile.TemporaryDirectory(prefix="bofbot_worker_") as tmp:
        tmp_path = Path(tmp)
        raw_copy = tmp_path / f"in{ext_in}"

        _download_r2_object(client, bucket, key_in, raw_copy)

        tmp_out = _run_normalize_and_composite(
            cfg, raw_copy, tmp_path, ext_in, ext_out, preset_dict, t_ffmpeg
        )
        final_out = _maybe_watermark(req, tmp_path, tmp_out, ext_out, t_ffmpeg)

        ct = _content_type_for_suffix(ext_out)
        _upload_r2_object(client, bucket, key_out, final_out, ct)

    return ProcessResponse(
        processed_rel_path=req.processed_rel_path,
        overlay_style=req.overlay_style,
        hook_used=hook_meta,
        color_preset_used=color_meta,
    )


def process_video_local(req: ProcessRequest) -> ProcessResponse:
    cfg = _load_cfg()
    preset_dict, hook_meta, color_meta = _build_preset(req)
    t_ffmpeg = _ffmpeg_timeout()

    raw_abs = _resolve_local_path(req.video_rel_path)
    out_abs = _resolve_local_path(req.processed_rel_path)

    if not raw_abs.is_file():
        raise HTTPException(status_code=400, detail=f"input not found: {req.video_rel_path}")

    out_abs.parent.mkdir(parents=True, exist_ok=True)

    ext_in = _suffix_for_path(raw_abs)
    ext_out = _suffix_for_path(out_abs)

    with tempfile.TemporaryDirectory(prefix="bofbot_worker_") as tmp:
        tmp_path = Path(tmp)
        raw_copy = tmp_path / f"in{ext_in}"
        shutil.copy2(raw_abs, raw_copy)

        tmp_out = _run_normalize_and_composite(
            cfg, raw_copy, tmp_path, ext_in, ext_out, preset_dict, t_ffmpeg
        )
        final_out = _maybe_watermark(req, tmp_path, tmp_out, ext_out, t_ffmpeg)

        shutil.copy2(final_out, out_abs)

    return ProcessResponse(
        processed_rel_path=req.processed_rel_path,
        overlay_style=req.overlay_style,
        hook_used=hook_meta,
        color_preset_used=color_meta,
    )


def process_video(req: ProcessRequest) -> ProcessResponse:
    if _r2_configured():
        return process_video_r2(req)
    return process_video_local(req)


app = FastAPI(title="BofBot Worker", version="0.4.0")


@app.get("/health")
def health() -> dict[str, str]:
    mode = "r2" if _r2_configured() else "local"
    return {"status": "ok", "storage": mode}


@app.post("/process", response_model=ProcessResponse)
def process_endpoint(
    body: ProcessRequest,
    _auth: None = Depends(_verify_api_key),
) -> ProcessResponse:
    return process_video(body)
