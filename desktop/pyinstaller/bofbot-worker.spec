# -*- mode: python ; coding: utf-8 -*-
# Run from repo root: pyinstaller desktop/pyinstaller/bofbot-worker.spec
# Requires: pip install -r requirements-worker.txt pyinstaller
#
# Windows → dist/bofbot-worker/bofbot-worker.exe; macOS/Linux → …/bofbot-worker (no .exe).

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

block_cipher = None

# UPX breaks many macOS binaries and complicates code signing; keep off on Darwin.
_USE_UPX = sys.platform != "darwin"

SPEC_DIR = Path(SPECPATH).resolve()
REPO_ROOT = SPEC_DIR.parent.parent
ENTRY = SPEC_DIR / "bofbot_worker_entry.py"

datas = [
    (str(REPO_ROOT / "emoji"), "emoji"),
    (str(REPO_ROOT / "fonts"), "fonts"),
    (str(REPO_ROOT / "config.json"), "."),
]

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "pydantic.deprecated.decorator",
    "worker",
    "worker.app",
]

for pkg in (
    "uvicorn",
    "fastapi",
    "starlette",
    "pydantic",
    "anyio",
    "watchdog",
    "PIL",
    "multipart",
):
    try:
        d, _bin, hi = collect_all(pkg)
        datas += d
        hiddenimports += hi
    except Exception:
        pass

a = Analysis(
    [str(ENTRY)],
    pathex=[str(REPO_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="bofbot-worker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=_USE_UPX,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    name="bofbot-worker",
)
