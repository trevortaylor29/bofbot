"""
Download Twemoji 72x72 PNGs, resize to 64x64, save under project emoji/.
Run from repo root: python scripts/download_twemoji_assets.py
"""
from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EMOJI_DIR = ROOT / "emoji"

CDN_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72"
RAW_BASE = "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72"

# (remote_filename, local_filename(s) — same image may be written twice)
JOBS: list[tuple[str, list[str]]] = [
    ("2764.png", ["2764.png", "2764_fe0f.png"]),
    ("1f62d.png", ["1f62d.png"]),
    ("1f6a8.png", ["1f6a8.png"]),
    ("2757.png", ["2757.png"]),
]

SIZE = (64, 64)
TIMEOUT_SEC = 30
HEADERS = {"User-Agent": "tiktoked-twemoji-fetch/1.0"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
        return resp.read()


def download_png(remote_name: str) -> bytes:
    last_err: Exception | None = None
    for base in (CDN_BASE, RAW_BASE):
        url = f"{base}/{remote_name}"
        try:
            return fetch(url)
        except (urllib.error.URLError, OSError) as e:
            last_err = e
            print(f"  fail {url}: {e}", file=sys.stderr)
    raise RuntimeError(f"Could not download {remote_name}: {last_err}") from last_err


def resize_and_save(data: bytes, dest: Path) -> None:
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    im = im.resize(SIZE, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="PNG", optimize=True)


def main() -> int:
    EMOJI_DIR.mkdir(parents=True, exist_ok=True)
    for remote, locals in JOBS:
        print(f"Fetching {remote} …")
        data = download_png(remote)
        for name in locals:
            out = EMOJI_DIR / name
            resize_and_save(data, out)
            print(f"  wrote {out.relative_to(ROOT)} ({SIZE[0]}x{SIZE[1]})")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
