"""PyInstaller entry: local FastAPI worker (same as `python -m uvicorn worker.app:app`)."""
from __future__ import annotations

import os

import uvicorn


def main() -> None:
    port = int(os.environ.get("BOFBOT_WORKER_PORT", "8000"))
    uvicorn.run(
        "worker.app:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
