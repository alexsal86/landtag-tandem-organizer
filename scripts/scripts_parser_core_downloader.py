import hashlib
import os
import requests
from pathlib import Path
from typing import Optional

def download_pdf(url: str, cache_dir: str = ".cache/pdfs", force: bool = False) -> Path:
    Path(cache_dir).mkdir(parents=True, exist_ok=True)
    # Simple hash of URL for filename
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    out = Path(cache_dir) / f"{h}.pdf"
    if out.exists() and not force:
        return out
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    out.write_bytes(r.content)
    return out