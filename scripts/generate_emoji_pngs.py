"""
Create 64x64 RGBA PNGs in repo `emoji/` for tiktoked._emoji_segment_plan lookups.

Outputs: 2764.png, 2764_fe0f.png (❤️), 1f62d.png, 1f6a8.png, 2757.png.
Run: python scripts/generate_emoji_pngs.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "emoji"
SIZE = 64


def _save(name: str, im: Image.Image) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / name
    im.save(dest, format="PNG", optimize=True)
    print(f"wrote {dest.relative_to(ROOT)}")


def heart() -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((8, 14, 34, 40), fill=(221, 46, 68, 255))
    d.ellipse((30, 14, 56, 40), fill=(221, 46, 68, 255))
    d.polygon([(32, 52), (8, 28), (56, 28)], fill=(221, 46, 68, 255))
    return im


def cry_face() -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((4, 4, 60, 60), fill=(255, 204, 77, 255))
    d.ellipse((14, 22, 22, 34), fill=(102, 69, 0, 255))
    d.ellipse((42, 22, 50, 34), fill=(102, 69, 0, 255))
    d.arc((18, 36, 46, 52), start=0, end=180, fill=(102, 69, 0, 255), width=3)
    d.ellipse((6, 28, 16, 44), fill=(93, 173, 236, 255))
    d.ellipse((48, 28, 58, 44), fill=(93, 173, 236, 255))
    return im


def siren() -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(32, 6), (8, 52), (56, 52)], fill=(221, 46, 68, 255))
    d.ellipse((22, 24, 42, 48), fill=(245, 248, 250, 255))
    d.line([(32, 28), (32, 44)], fill=(190, 25, 49, 255), width=4)
    return im


def exclaim() -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((2, 2, 62, 62), fill=(255, 204, 77, 255))
    d.rounded_rectangle((26, 14, 38, 38), radius=4, fill=(35, 31, 32, 255))
    d.ellipse((26, 44, 38, 56), fill=(35, 31, 32, 255))
    return im


def main() -> None:
    h = heart()
    _save("2764.png", h)
    _save("2764_fe0f.png", h)
    _save("1f62d.png", cry_face())
    _save("1f6a8.png", siren())
    _save("2757.png", exclaim())


if __name__ == "__main__":
    main()
