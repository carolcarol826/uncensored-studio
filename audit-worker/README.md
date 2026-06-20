# audit-worker

Self-hosted content moderation for myhim.love (and any sister project that wants the same protection).

**Three checks, all open-source, all under our control** — no Tencent IMS / AWS / Hive in the loop:
| Check | Model | What it catches |
|---|---|---|
| NSFW classification | NudeNet | Sketchy / Hentai / Porn vs Safe |
| Age estimation | InsightFace `buffalo_l` | Faces that look under 18 on NSFW images (virtual CSAM risk) |
| Celebrity face match | InsightFace embeddings + shipped library | Deepfake-porn risk (Taylor Swift / politicians / etc) |

Decision policy is "permissive by default" — ordinary AI NSFW art passes. We only **block** on:
- `underage_nsfw`: NSFW + any face age < 18
- `celebrity_nsfw`: NSFW + face matches a celebrity (≥ similarity threshold)

## Run locally

```bash
cd audit-worker
docker build -t audit-worker .
docker run -p 8000:8000 -e AUDIT_TOKEN=dev-token audit-worker
curl -s -X POST http://localhost:8000/moderate \
  -H 'X-Audit-Token: dev-token' \
  -H 'Content-Type: application/json' \
  -d "{\"image_url\":\"https://example.com/some-image.jpg\"}"
```

## Deploy

The image is built and pushed to GHCR on every push to `main` (see `.github/workflows/build.yml`). Pull on any VPS:

```bash
docker run -d --restart=unless-stopped \
  -p 8000:8000 \
  -e AUDIT_TOKEN="$AUDIT_TOKEN" \
  ghcr.io/<owner>/audit-worker:latest
```

Front the container with nginx/caddy + TLS, then point myhim.love at the URL via
`AUDIT_WORKER_URL` / `AUDIT_WORKER_TOKEN` in Vercel env.

## Add more celebrities

1. Edit `celebrities/seed.txt` (format: `Name|wikimedia-image-url`)
2. `python scripts/build_celeb_library.py` to regenerate `celebrities/library.npz`
3. Commit → CI rebuilds the image with the new library baked in

Only ship Wikimedia-Commons URLs (public domain / CC) so the image stays redistributable.

## Tunable thresholds (env vars)

| Var | Default | Meaning |
|---|---|---|
| `AUDIT_NSFW_THRESHOLD` | `0.70` | Above this we treat the image as porn-class |
| `AUDIT_AGE_BLOCK`     | `18`   | Faces younger than this on NSFW = block |
| `AUDIT_CELEB_THRESHOLD` | `0.55` | Cosine similarity for a celeb match |
| `AUDIT_TOKEN` | (empty) | Required bearer token; empty = open (dev only) |
| `AUDIT_CELEB_LIB` | `/app/celebrities/library.npz` | Override library path |
