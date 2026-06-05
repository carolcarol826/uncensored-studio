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

RUN ls -la /comfyui/custom_nodes/ && \
    echo "SDXL+ControlNet worker ready"
