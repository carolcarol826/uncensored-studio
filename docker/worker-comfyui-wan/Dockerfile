# MyHim Studio · Wan 2.2 video worker (extends runpod/worker-comfyui)
#
# Adds the custom ComfyUI nodes needed for Wan 2.2 video generation:
#   - ComfyUI-WanVideoWrapper (kijai) — wraps Wan 2.1 / 2.2 inference
#   - ComfyUI-VideoHelperSuite (Kosinkadink) — VHS_VideoCombine for mp4 output
#   - ComfyUI-KJNodes (kijai) — utility nodes used by many Wan workflows
#
# Models are NOT baked in — they live on the Network Volume at
# /runpod-volume/models/{diffusion_models,vae,text_encoders,clip_vision}/
# so we keep the image at ~13 GB instead of 25+ GB.
#
# Build + push via GitHub Actions (see .github/workflows/build-wan-worker.yml).

FROM runpod/worker-comfyui:5.5.0-base

# comfy-node-install is provided by worker-comfyui — it wraps comfy-cli
# but surfaces install errors that comfy-cli silently swallows.
RUN comfy-node-install \
      comfyui-videohelpersuite \
      comfyui-kjnodes

# WanVideoWrapper isn't in the comfy registry, install directly:
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    cd ComfyUI-WanVideoWrapper && \
    pip install --no-cache-dir -r requirements.txt

# Sanity: list installed nodes
RUN ls -la /comfyui/custom_nodes/ && \
    echo "Wan worker ready"
