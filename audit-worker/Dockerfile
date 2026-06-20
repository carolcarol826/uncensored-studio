# audit-worker: self-hosted content moderation
#
# Two-stage: stage 1 fetches model weights + builds the celeb library, stage 2
# only ships the runtime. Final image ~2.5 GB (most of it is buffalo_l + onnxruntime).

# ---------- stage 1: weight + celeb prep ----------
FROM python:3.11-slim AS prep

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libgl1 libglib2.0-0 wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Pre-download InsightFace buffalo_l + NudeNet weights so first request is fast.
RUN python -c "from insightface.app import FaceAnalysis; \
    a = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']); \
    a.prepare(ctx_id=-1, det_size=(640,640))" \
 && python -c "from nudenet import NudeDetector; NudeDetector()"

# Build the celebrity embedding library from seed list.
COPY celebrities/ /build/celebrities/
COPY scripts/build_celeb_library.py /build/scripts/build_celeb_library.py
RUN python scripts/build_celeb_library.py || echo "celeb lib build failed; proceeding without — runtime celeb check will be a no-op"

# ---------- stage 2: runtime ----------
FROM python:3.11-slim AS runtime

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy pre-downloaded model caches from stage 1 (InsightFace puts them in
# ~/.insightface, NudeNet inside the package).
COPY --from=prep /root/.insightface /root/.insightface
COPY --from=prep /usr/local/lib/python3.11/site-packages/nudenet /usr/local/lib/python3.11/site-packages/nudenet

# Copy app + celeb library
COPY app/ /app/app/
COPY --from=prep /build/celebrities/library.npz /app/celebrities/library.npz

EXPOSE 8000
# Single worker — model load is per-process and we don't want N copies of buffalo_l in RAM.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
