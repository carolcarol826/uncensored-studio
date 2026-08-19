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

# Patch /handler.py so VHS_VideoCombine "gifs" outputs are also returned to the
# caller (upstream worker-comfyui drops every key except "images").
COPY patch-handler.py /tmp/patch-handler.py
RUN python3 /tmp/patch-handler.py && rm /tmp/patch-handler.py

# The 4-step distillation adapters. A clip at 20 steps ran past the endpoint's
# 25-minute ceiling and was killed while still costing us the GPU time; at 4
# steps the same clip finishes in a fraction of that, which is what brings the
# 10-second option back and cuts the cost per clip by roughly five.
#
# A14B is a two-expert model and the adapter ships one file per expert —
# attaching only one leaves half the denoise unaccelerated. Apache 2.0.
#
# Baked rather than put on the network volume: pulling large files to that
# region ran at 2.5 MB/s and stalled repeatedly, while a GitHub runner does it
# in minutes and the layer is then cached on the RunPod host.
RUN mkdir -p /comfyui/models/loras && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/loras/wan22-i2v-lightning-high.safetensors \
      https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/high_noise_model.safetensors

RUN wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/loras/wan22-i2v-lightning-low.safetensors \
      https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/low_noise_model.safetensors && \
    du -sh /comfyui/models/loras

# Sanity: list installed nodes
RUN ls -la /comfyui/custom_nodes/ && \
    echo "Wan worker ready"
