# Uncensored Studio

> 本地无审查 AI 图片 + 视频生成工具 · 端口 6677
>
> 注：原计划 6666 端口，但该端口属于 IRC 保留段，Chrome/Firefox 默认拒绝加载，且 Next.js 16 拒绝绑定。改用 6677（数字相似、未被浏览器屏蔽）。

一个基于 Next.js + ComfyUI 的本地 Web 桌面，用极简 UI 封装当下最强的开源生成模型：SDXL（Illustrious / NoobAI / Pony）+ Flux + Wan 2.2。

完整产品需求见 [PRD.md](./PRD.md)。

---

## 快速开始

### 0. 一键安装（推荐）

在本目录下运行：

```powershell
# 一键安装 ComfyUI Portable + ComfyUI-Manager + 必备自定义节点
powershell -ExecutionPolicy Bypass -File .\scripts\install-comfyui.ps1

# 交互式下载模型（推荐选项 3 = SDXL + Flux schnell，8GB 友好）
powershell -ExecutionPolicy Bypass -File .\scripts\download-models.ps1

# 启动 ComfyUI（脚本会生成 start-comfyui.ps1）
~\ComfyUI\start-comfyui.ps1
```

脚本会自动完成：
- 下载 ComfyUI Portable Windows 预构建包（自带 Python 3.12 + CUDA）
- 安装 ComfyUI-Manager
- 安装 6 个必备自定义节点（GGUF / WanVideoWrapper / VideoHelperSuite / controlnet_aux / PuLID-Flux-Enhanced / essentials）
- 创建标准化启动脚本（监听 127.0.0.1:8188）

### 1. 启动本工具

```powershell
npm install
npm run dev    # http://localhost:6677
```

### 2. 手动安装 ComfyUI（如不用脚本）

下载 [ComfyUI Portable](https://github.com/comfyanonymous/ComfyUI/releases) 解压后双击 `run_nvidia_gpu.bat`，或源码：

```powershell
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py --listen 127.0.0.1 --port 8188
```

ComfyUI 默认运行在 `http://127.0.0.1:8188`。Uncensored Studio 会自动检测。

### 3. 模型下载清单（如不用 download-models.ps1）

按 8GB VRAM 推荐：

| 用途 | 模型 | 放置目录 |
|---|---|---|
| SDXL 文生图（必装）| [Illustrious XL v3](https://civitai.com/models/795765) | `models/checkpoints/` |
| SDXL NSFW 动漫 | [NoobAI-XL V-pred](https://huggingface.co/Laxhar/noobai-XL-Vpred-1.0) | 同上 |
| SDXL NSFW 动漫 | [Pony Diffusion V6](https://civitai.com/models/257749) | 同上 |
| Flux 快速 | [flux1-schnell Q4 GGUF](https://huggingface.co/city96/FLUX.1-schnell-gguf) | `models/unet/` |
| Flux VAE | [ae.safetensors](https://huggingface.co/Comfy-Org) | `models/vae/` |
| Flux CLIP | [clip_l + t5xxl_fp8](https://huggingface.co/comfyanonymous/flux_text_encoders) | `models/clip/` |
| **角色一致性** | [PuLID-Flux v0.9.1](https://huggingface.co/guozinan/PuLID) | `models/pulid/` |
| Wan 2.2 视频（5B GGUF Q4）| [Wan2.2-TI2V-5B-Q4](https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF) | `models/diffusion_models/` |
| Wan 文本编码器 | [umT5-XXL FP8](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged) | `models/text_encoders/` |

---

## 项目结构

```
uncensored-studio/
├── PRD.md                    # 产品需求文档
├── README.md                 # 本文件
├── app/
│   ├── layout.tsx            # 全局布局 + 导航
│   ├── page.tsx              # 主面板（健康检查 + 入口）
│   ├── text2img/             # 文生图
│   ├── img2img/              # 图生图
│   ├── img2video/            # 图生视频
│   ├── text2video/           # 文生视频
│   ├── gallery/              # 本地图库
│   ├── settings/             # 设置
│   └── api/                  # Next.js API Routes
│       ├── health/           #   ComfyUI 健康检查
│       ├── settings/         #   读写配置
│       ├── generate/         #   提交生成任务
│       ├── status/           #   查询任务状态
│       ├── upload/           #   上传参考图
│       ├── gallery/          #   列出历史输出
│       └── workflows/        #   工作流元数据
├── components/
│   ├── Nav.tsx               # 侧边栏导航
│   ├── HealthBadge.tsx       # 健康检查徽章
│   └── GeneratorForm.tsx     # 通用生成器表单
├── lib/
│   ├── comfy.ts              # ComfyUI HTTP 客户端
│   ├── settings.ts           # 配置读写
│   ├── workflows.ts          # 工作流加载与参数化
│   └── workflows/            # 预置工作流 JSON
│       ├── sdxl-t2i.json
│       ├── sdxl-i2i.json
│       ├── flux-schnell-t2i.json
│       ├── wan22-i2v.json
│       └── wan22-ti2v-5b.json
└── data/
    └── settings.json         # 用户配置（首次运行自动创建）
```

---

## 使用须知

- 本工具**不做任何内容过滤**，由用户对生成内容负责
- 所有 prompt 和输出**仅保存在本地**，不上传任何服务器
- 不得用于：CSAM、非自愿真人换脸（deepfake porn）、欺诈、骚扰等违法用途
- 美国用户请注意 TAKE IT DOWN Act（2025）；欧盟用户注意 AI Act Article 50（2026-08 起强制水印）

---

## 许可

MIT
