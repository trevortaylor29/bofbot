#!/usr/bin/env python3
"""
Generate desktop/icon_256.ico from desktop/icon.png for electron-builder / NSIS.

Writes a multi-resolution ICO: 16, 32, 48, 128, and 256 px (PNG-compressed layers).
Requires: pip install Pillow
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

DESKTOP_DIR = Path(__file__).resolve().parent.parent
PNG_PATH = DESKTOP_DIR / "icon.png"
ICO_PATH = DESKTOP_DIR / "icon_256.ico"
SIZES = (16, 32, 48, 128, 256)


def main() -> None:
    if not PNG_PATH.is_file():
        raise SystemExit(f"Missing source image: {PNG_PATH}")

    src = Image.open(PNG_PATH).convert("RGBA")
    w, h = src.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        src = src.crop((left, top, left + side, top + side))

    images: list[Image.Image] = []
    for size in SIZES:
        images.append(src.resize((size, size), Image.Resampling.LANCZOS))

    # Pillow writes one ICO with multiple embedded sizes via append_images.
    images[0].save(
        ICO_PATH,
        format="ICO",
        sizes=[(s, s) for s in SIZES],
        append_images=images[1:],
    )
    print(f"Wrote {ICO_PATH} ({', '.join(f'{s}x{s}' for s in SIZES)})")


if __name__ == "__main__":
    main()
