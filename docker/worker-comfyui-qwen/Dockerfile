# MyHim Studio · Qwen-Image-Edit worker
#
# A dedicated image, separate from the SDXL/Chroma one, because the two cannot
# share: SDXL + Chroma is already ~37GB and Qwen's stack is another ~32GB, which
# is more than a GitHub runner can build.
#
# The point of baking these at all is billing. Serverless charges for the
# worker's whole life, not just sampling, and Qwen was being read from the
# network volume — 32GB across a link that benchmarks at 2.5 MB/s, all of it on
# the clock before a single step runs. The billing explorer showed serverless
# costing about seven times what execution time alone predicted, and this is
# the largest identified reason. Image layers are cached on the RunPod host, so
# the same weights arrive far faster and only once per machine.
#
# Base is 5.8.6: Qwen-Image-Edit 2511 shipped in November and a ComfyUI older
# than that loads the weights and samples pure noise, which cost two rounds of
# debugging to discover. The `-base` tag omits the SDXL checkpoint this worker
# has no use for.
FROM runpod/worker-comfyui:5.8.6-base

# One RUN per file. When three downloads shared a layer and the last URL turned
# out to be gated, the failure discarded the 14GB that had already arrived.
RUN mkdir -p /comfyui/models/diffusion_models && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors \
      https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors

RUN mkdir -p /comfyui/models/text_encoders && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors \
      https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors

RUN mkdir -p /comfyui/models/vae && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/vae/qwen_image_vae.safetensors \
      https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors

# Four steps instead of forty. Its step count and CFG are not adjustable — the
# graphs are marked self-contained so the form cannot override them.
RUN mkdir -p /comfyui/models/loras && \
    wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors \
      https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors

# The anatomy adapter. Without it, an edit that has to repaint an explicit
# region returns a stub — the base model is trained on safe data and has no
# prior to draw on. Apache-adjacent: OpenRAIL++, commercial use permitted.
RUN wget -q --show-progress --progress=dot:giga \
      -O /comfyui/models/loras/qwen-edit-nsfw-mcnl-v1.safetensors \
      https://huggingface.co/ScottzillaSystems/qwen-image-edit-plus-nsfw-lora/resolve/main/qwen-image-edit-plus-nsfw-lora.safetensors && \
    du -sh /comfyui/models/*

RUN ls -la /comfyui/models/diffusion_models /comfyui/models/loras && \
    echo "Qwen-Image-Edit worker ready (weights baked)"
