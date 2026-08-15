# MyHim Studio · SDXL worker with ControlNet support
#
# Extends runpod/worker-comfyui (sdxl base, comes with sd_xl_base_1.0 preloaded)
# with the ComfyUI custom nodes needed for ControlNet:
#   - ComfyUI-Advanced-ControlNet (Kosinkadink) — advanced ControlNet apply nodes
#   - ComfyUI_controlnet_aux (Fannovel16) — pose/depth/canny/softedge preprocessors
#
# ControlNet model files are NOT baked in — they live on the Network Volume
# at /runpod-volume/models/controlnet/ so we keep the image small.
#
# Auxiliary preprocessor weights (DWPose etc.) are auto-downloaded on first
# call by ComfyUI_controlnet_aux; flashboot caches them so cold-start penalty
# is one-time per worker.

FROM runpod/worker-comfyui:5.5.0-sdxl

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

# worker-comfyui's extra_model_paths.yaml maps the stock folder types only, so
# PuLID's own two would be invisible on the network volume. HF_HOME moves the
# EVA-CLIP download onto the volume as well — otherwise every cold start pulls
# it again, since the container filesystem does not survive.
ENV HF_HOME=/runpod-volume/hf
RUN CFG=$(find / -maxdepth 3 -name extra_model_paths.yaml -not -path '*/node_modules/*' | head -1) && \
    test -n "$CFG" && \
    printf '  pulid: models/pulid/\n  insightface: models/insightface/\n' >> "$CFG" && \
    echo "--- $CFG ---" && cat "$CFG"

# PulidInsightFaceLoader builds its path from folder_paths.models_dir directly
# instead of going through folder_names_and_paths, so the yaml entry above never
# reaches it and it only ever looks locally. Point the local directory at the
# volume; the target appears when the volume mounts at run time.
RUN rm -rf /comfyui/models/insightface && \
    ln -s /runpod-volume/models/insightface /comfyui/models/insightface && \
    ls -la /comfyui/models/ | grep insightface

RUN ls -la /comfyui/custom_nodes/ && \
    echo "SDXL + ControlNet + PuLID worker ready"
