"""
Build a starter celebrity embedding library from a curated public-image list.

Input  : celebrities/seed.txt — one entry per line, format:
           name|image_url
         Lines starting with # are ignored.

Output : celebrities/library.npz  (names[N], embs[N,512])

We only embed images where InsightFace finds exactly one face — multi-face
photos would dilute the embedding. Failed entries are logged but skipped.

Sourcing rule: only use Wikimedia Commons / Wikipedia thumbs (public domain or
CC) so the library itself is redistributable inside our Docker image.
"""

from __future__ import annotations

import io
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from insightface.app import FaceAnalysis

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "celebrities" / "seed.txt"
OUT = ROOT / "celebrities" / "library.npz"


def fetch(url: str) -> np.ndarray:
    req = urllib.request.Request(url, headers={"User-Agent": "audit-worker/0.1 (https://myhim.love)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def main():
    if not SEED.exists():
        print(f"missing seed file: {SEED}", file=sys.stderr)
        sys.exit(1)

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))

    names, embs = [], []
    with SEED.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                name, url = [p.strip() for p in line.split("|", 1)]
            except ValueError:
                print(f"  skip (bad format): {line}")
                continue
            try:
                img = fetch(url)
                faces = app.get(img)
                if len(faces) != 1:
                    print(f"  skip ({len(faces)} faces): {name}")
                    continue
                emb = faces[0].normed_embedding.astype(np.float32)
                names.append(name)
                embs.append(emb)
                print(f"  ok: {name}")
            except Exception as e:
                print(f"  skip ({type(e).__name__}: {e}): {name}")

    if not names:
        print("no embeddings produced", file=sys.stderr)
        sys.exit(1)

    np.savez_compressed(OUT, names=np.array(names), embs=np.array(embs))
    print(f"\nwrote {OUT}  ({len(names)} entries)")


if __name__ == "__main__":
    main()
