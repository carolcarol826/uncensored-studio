"""
audit-worker: self-hosted content moderation for myhim.love (and friends).

Three independent checks, each open-source, fully under our control:
  1. NSFW detection      — NudeNet     (Sketchy/Hentai/Porn vs Safe)
  2. Age estimation      — InsightFace (under-18 looking = block)
  3. Celebrity face match — InsightFace embedding + ours preshipped library

Decision policy (`/moderate`):
  - Always block on CSAM-suspicion: NSFW score >= NSFW_THRESHOLD AND any face's
    estimated age < AGE_BLOCK_THRESHOLD  →  block (reason='underage_nsfw')
  - Always block when any face matches a celebrity above CELEB_THRESHOLD
    →  block (reason='celebrity:<name>')
  - Otherwise allow.

The default thresholds are intentionally tuned so ordinary AI NSFW art passes
(this is an uncensored AI site). Override via env if needed.

Auth: every request must carry `X-Audit-Token: <AUDIT_TOKEN>`. The token is set
at deploy time and shared with myhim.love via Vercel env.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import time
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

LOG = logging.getLogger("audit")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# --- Configurable thresholds (env-overridable, all decisions tuned here) ---

NSFW_THRESHOLD = float(os.environ.get("AUDIT_NSFW_THRESHOLD", "0.70"))
"""Above this NSFW score we treat the image as 'porn-class' for downstream checks."""

AGE_BLOCK_THRESHOLD = int(os.environ.get("AUDIT_AGE_BLOCK", "18"))
"""Any detected face younger than this on an NSFW image is blocked."""

CELEB_THRESHOLD = float(os.environ.get("AUDIT_CELEB_THRESHOLD", "0.55"))
"""Cosine similarity above this against the celeb library = match."""

CELEB_LIB_PATH = Path(os.environ.get("AUDIT_CELEB_LIB", "/app/celebrities/library.npz"))

AUDIT_TOKEN = os.environ.get("AUDIT_TOKEN", "")
"""Required Bearer-style token. Empty means open (dev only)."""

# --- Lazy model loading: hold off until first request so tests / health can boot fast ---

_nsfw_detector = None
_face_analyser = None
_celeb_library: Optional[dict] = None  # { "names": [str], "embs": np.ndarray (N,512) }


def _load_nsfw():
    global _nsfw_detector
    if _nsfw_detector is None:
        from nudenet import NudeDetector
        _nsfw_detector = NudeDetector()
        LOG.info("NudeNet loaded")
    return _nsfw_detector


def _load_face():
    global _face_analyser
    if _face_analyser is None:
        from insightface.app import FaceAnalysis
        # 'buffalo_l' = detection + recognition + age + gender (~300MB total)
        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        _face_analyser = app
        LOG.info("InsightFace loaded (CPU)")
    return _face_analyser


def _load_celebs() -> dict:
    global _celeb_library
    if _celeb_library is None:
        if CELEB_LIB_PATH.exists():
            data = np.load(CELEB_LIB_PATH, allow_pickle=True)
            _celeb_library = {
                "names": list(data["names"]),
                "embs": data["embs"].astype(np.float32),
            }
            # Normalize once for cosine-similarity-by-dot-product
            norms = np.linalg.norm(_celeb_library["embs"], axis=1, keepdims=True)
            _celeb_library["embs"] = _celeb_library["embs"] / np.clip(norms, 1e-9, None)
            LOG.info("Celeb library loaded: %d entries", len(_celeb_library["names"]))
        else:
            LOG.warning("No celeb library at %s — celeb check disabled", CELEB_LIB_PATH)
            _celeb_library = {"names": [], "embs": np.zeros((0, 512), dtype=np.float32)}
    return _celeb_library


# --- API models ---

class ModerateReq(BaseModel):
    image_base64: str = Field(..., description="Raw image bytes, base64. Accepts data: URLs.")
    image_url: Optional[str] = Field(None, description="Alternative to image_base64.")


class FaceInfo(BaseModel):
    age: int
    gender: str
    bbox: list[int]
    celeb_match: Optional[str] = None
    celeb_similarity: Optional[float] = None


class Decision(BaseModel):
    action: str        # "allow" | "block"
    reason: Optional[str] = None
    label: Optional[str] = None
    nsfw_score: float
    nsfw_top_class: str
    faces: list[FaceInfo] = []
    timing_ms: dict[str, int] = {}


app = FastAPI(title="audit-worker", version="0.1.0")


@app.get("/health")
def health():
    """Boot check. Does NOT load models — that happens lazily on first /moderate."""
    return {
        "ok": True,
        "version": "0.1.0",
        "celeb_lib_present": CELEB_LIB_PATH.exists(),
        "thresholds": {
            "nsfw": NSFW_THRESHOLD,
            "age_block": AGE_BLOCK_THRESHOLD,
            "celeb": CELEB_THRESHOLD,
        },
    }


def _decode(req: ModerateReq) -> np.ndarray:
    """Decode either base64 or a remote URL to an RGB numpy array."""
    if req.image_base64:
        s = req.image_base64
        if s.startswith("data:"):
            s = s.split(",", 1)[1]
        raw = base64.b64decode(s)
    elif req.image_url:
        import urllib.request
        with urllib.request.urlopen(req.image_url, timeout=15) as r:
            raw = r.read()
    else:
        raise HTTPException(400, "image_base64 or image_url required")

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def _nsfw_score(img_rgb: np.ndarray) -> tuple[float, str]:
    """Run NudeNet detector. Returns (porn_class_score, dominant_class).
    NudeDetector returns a list of detections per anatomical part; we treat the
    max detection score from explicit classes as overall NSFW.
    """
    det = _load_nsfw()
    # NudeDetector wants a file path or bytes — go via tempfile to avoid surprises.
    import tempfile, cv2
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        cv2.imwrite(f.name, cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
        path = f.name
    try:
        results = det.detect(path)
    finally:
        try: os.unlink(path)
        except OSError: pass

    EXPLICIT = {
        "FEMALE_GENITALIA_EXPOSED", "MALE_GENITALIA_EXPOSED",
        "BUTTOCKS_EXPOSED", "FEMALE_BREAST_EXPOSED",
        "ANUS_EXPOSED",
    }
    best_score, best_class = 0.0, "SAFE"
    for d in results:
        cls = d.get("class", "")
        sc = float(d.get("score", 0.0))
        if cls in EXPLICIT and sc > best_score:
            best_score, best_class = sc, cls
    return best_score, best_class


def _face_check(img_rgb: np.ndarray) -> list[FaceInfo]:
    """Detect faces, estimate age, and match against celeb library."""
    fa = _load_face()
    faces = fa.get(img_rgb)
    out: list[FaceInfo] = []
    if not faces:
        return out

    lib = _load_celebs()
    for f in faces:
        emb = f.normed_embedding  # already L2-normalized by InsightFace
        celeb_name, celeb_sim = None, None
        if lib["embs"].shape[0] > 0:
            sims = lib["embs"] @ emb
            idx = int(np.argmax(sims))
            top = float(sims[idx])
            if top >= CELEB_THRESHOLD:
                celeb_name = str(lib["names"][idx])
                celeb_sim = top

        bbox = [int(v) for v in f.bbox.tolist()]
        gender = "F" if int(getattr(f, "gender", 0)) == 0 else "M"
        out.append(FaceInfo(
            age=int(getattr(f, "age", -1)),
            gender=gender,
            bbox=bbox,
            celeb_match=celeb_name,
            celeb_similarity=celeb_sim,
        ))
    return out


@app.post("/moderate", response_model=Decision)
def moderate(req: ModerateReq, x_audit_token: Optional[str] = Header(None)):
    if AUDIT_TOKEN and x_audit_token != AUDIT_TOKEN:
        raise HTTPException(401, "bad audit token")

    timing = {}
    t0 = time.time()
    img = _decode(req)
    timing["decode_ms"] = int((time.time() - t0) * 1000)

    # 1) NSFW
    t1 = time.time()
    nsfw_score, nsfw_class = _nsfw_score(img)
    timing["nsfw_ms"] = int((time.time() - t1) * 1000)

    # Decide whether we even need face/celeb work (saves a lot of CPU on SFW)
    is_porn = nsfw_score >= NSFW_THRESHOLD

    faces: list[FaceInfo] = []
    if is_porn:
        t2 = time.time()
        faces = _face_check(img)
        timing["faces_ms"] = int((time.time() - t2) * 1000)

    # --- Decision policy ---

    # Under-age NSFW = hard block (virtual CSAM risk)
    for f in faces:
        if 0 < f.age < AGE_BLOCK_THRESHOLD:
            return Decision(
                action="block", reason="underage_nsfw", label=f"age~{f.age}",
                nsfw_score=nsfw_score, nsfw_top_class=nsfw_class,
                faces=faces, timing_ms=timing,
            )

    # Celebrity face on NSFW image = hard block (deepfake-porn risk)
    for f in faces:
        if f.celeb_match:
            return Decision(
                action="block",
                reason="celebrity_nsfw",
                label=f"{f.celeb_match} @ {f.celeb_similarity:.2f}",
                nsfw_score=nsfw_score, nsfw_top_class=nsfw_class,
                faces=faces, timing_ms=timing,
            )

    return Decision(
        action="allow",
        nsfw_score=nsfw_score,
        nsfw_top_class=nsfw_class,
        faces=faces,
        timing_ms=timing,
    )
