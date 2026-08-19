# MyHim Studio · SDXL worker with ControlNet support
#
# Extends runpod/worker-comfyui (sdxl base, comes with sd_xl_base_1.0 preloaded)
# with the ComfyUI custom nodes needed for ControlNet:
#   - ComfyUI-Advanced-ControlNet (Kosinkadink) — advanced ControlNet apply nodes
#   - ComfyUI_controlnet_aux (Fannovel16) — pose/depth/canny/softedge preprocessors
#
# Frequently used weights are baked in (see the download step below); the
# occasional ones — noobai, ControlNet, PuLID, Wan — stay on the Network Volume.
#
# Auxiliary preprocessor weights (DWPose etc.) are auto-downloaded on first
# call by ComfyUI_controlnet_aux; flashboot caches them so cold-start penalty
# is one-time per worker.

# 5.5.0 was built in Oct 2025 and predates Qwen-Image-Edit 2511 — it loaded the
# weights and sampled pure noise, because that ComfyUI does not know the
# architecture. Track a build new enough to contain the Qwen edit nodes.
FROM runpod/worker-comfyui:5.8.6-sdxl

RUN comfy-node-install \
      comfyui-advanced-controlnet \
      comfyui_controlnet_aux

# PuLID (character consistency) — not in the comfy registry, install from source.
# InsightFace needs a compiler for its native extension, and onnxruntime-gpu
# runs the face detector; both are absent from the base image.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir insightface onnxruntime-gpu facexlib

RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/cubiq/PuLID_ComfyUI.git && \
    pip install --no-cache-dir -r PuLID_ComfyUI/requirements.txt

# IP-Adapter — carries a garment image into the sampler as a visual reference,
# which is what makes try-on possible: the masked region is repainted as the
# uploaded garment rather than as whatever the prompt words happen to describe.
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/cubiq/ComfyUI_IPAdapter_plus.git

# worker-comfyui's extra_model_paths.yaml maps the stock folder types only, so
# PuLID's own two would be invisible on the network volume. HF_HOME moves the
# EVA-CLIP download onto the volume as well — otherwise every cold start pulls
# it again, since the container filesystem does not survive.
ENV HF_HOME=/runpod-volume/hf
RUN CFG=$(find / -maxdepth 3 -name extra_model_paths.yaml -not -path '*/node_modules/*' | head -1) && \
    test -n "$CFG" && \
    printf '  pulid: models/pulid/\n  insightface: models/insightface/\n  ipadapter: models/ipadapter/\n' >> "$CFG" && \
    echo "--- $CFG ---" && cat "$CFG"

# PulidInsightFaceLoader builds its path from folder_paths.models_dir directly
# instead of going through folder_names_and_paths, so the yaml entry above never
# reaches it and it only ever looks locally. Point the local directory at the
# volume; the target appears when the volume mounts at run time.
RUN rm -rf /comfyui/models/insightface && \
    ln -s /runpod-volume/models/insightface /comfyui/models/insightface && \
    ls -la /comfyui/models/ | grep insightface

# Weights that every job touches are baked in rather than read from the network
# volume. A volume read is documented as slow — around three minutes to pull a
# 7GB checkpoint — and that whole wait is billed GPU time on each cold start.
# Image layers are cached on the host, so the same files cost seconds instead.
# The occasional ones (noobai, ControlNet, PuLID, Wan) stay on the volume: they
# would add tens of gigabytes here to save a cold start hardly anyone pays.
RUN mkdir -p /comfyui/models/checkpoints /comfyui/models/loras \
             /comfyui/models/ipadapter /comfyui/models/clip_vision && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/checkpoints/lustify-v2.0.safetensors \
      https://huggingface.co/shootstuff/LUSTIFY-v2.0/resolve/main/lustifySDXLNSFWSFW_v20.safetensors && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/loras/sdxl_lightning_8step_lora.safetensors \
      https://huggingface.co/ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_8step_lora.safetensors && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/ipadapter/ip-adapter-plus_sdxl_vit-h.safetensors \
      https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors \
      https://huggingface.co/h94/IP-Adapter/resolve/main/models/image_encoder/model.safetensors && \
    du -sh /comfyui/models/*

# Chroma1-HD, plus the T5 encoder and VAE it needs.
#
# Baked rather than parked on the network volume because five attempts to pull
# it there cost hours and real money without finishing: HuggingFace to that
# region ran at 2.5 MB/s and stalled repeatedly. A GitHub runner fetches the
# same files in minutes, and a baked layer is cached on the RunPod host, so cold
# starts get faster rather than slower.
#
# Why this model at all: SDXL has no dependable prior for explicit male anatomy
# — it stretched a penis to the floor and omitted testicles, and no prompt fixed
# it. Chroma was retrained from FLUX.1-schnell with those concepts restored, and
# is Apache 2.0.
# One RUN per file. The first attempt fetched all three in a single layer, and
# when the last URL turned out to be gated the failure threw away the 14GB that
# had already downloaded. Separate layers are cached separately.
RUN mkdir -p /comfyui/models/diffusion_models && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/diffusion_models/Chroma1-HD-fp8mixed.safetensors \
      https://huggingface.co/Comfy-Org/Chroma1-HD_repackaged/resolve/main/split_files/diffusion_models/Chroma1-HD-fp8mixed.safetensors

RUN mkdir -p /comfyui/models/text_encoders && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors \
      https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors

# The same 335,304,388-byte FLUX VAE, from Comfy-Org rather than
# black-forest-labs — the latter is gated and wget got an auth failure.
RUN wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/vae/ae.safetensors \
      https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors && \
    du -sh /comfyui/models/*

RUN ls -la /comfyui/custom_nodes/ && \
    echo "SDXL + ControlNet + PuLID + IPAdapter worker ready (weights baked)"
