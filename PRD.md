# Uncensored Studio — PRD（产品需求文档）

> 本地无审查 AI 图片 + 视频生成工具 · MVP 版本

---

## 1. 产品定位

**Uncensored Studio** 是一个**面向个人本地使用**的开源 AI 生成桌面网页，统一封装 SDXL / Flux / Wan 2.2 等当前最先进的开源生成模型，提供**零审查、零云端依赖**的图片与视频生成体验。

### 1.1 核心定位

| 维度 | 说明 |
|---|---|
| 目标用户 | 拥有本地 GPU（≥6GB VRAM）的创作者、研究者、设计师 |
| 部署形式 | 本地 Web 应用，浏览器访问 `http://localhost:6677` |
| 推理后端 | 复用本地 **ComfyUI**（HTTP API @ `localhost:8188`） |
| 数据归属 | 全部 prompt / 输出 / 配置存于本地磁盘，绝不上传 |
| 内容政策 | 无内容过滤（个人本地使用，由用户自负其责） |
| 商业模型 | 开源 MIT License，非托管 SaaS |

### 1.2 与现有方案的差异

| 对比对象 | Uncensored Studio 的差异 |
|---|---|
| ComfyUI 原生 | 节点图过于复杂；本工具用**任务化简洁 UI**降低门槛 |
| A1111 / Forge | 不再维护或 AGPL 传染；本工具用 MIT，UI 现代化 |
| Civitai / TensorArt | 那是云端 SaaS，本工具是本地零依赖 |
| SwarmUI | SwarmUI 更偏多用户；本工具偏单人快速出图 |

---

## 2. 硬件约束（当前测试环境）

本 PRD 基于以下实测环境制定：

| 组件 | 规格 |
|---|---|
| GPU | NVIDIA RTX 4060 (**8 GB VRAM**) |
| OS | Windows 11 Pro |
| Node | v24.13.0 |
| Python | 3.14.2 |

**8GB VRAM 决定了模型可用范围**：

| 模型档位 | 可跑 | 备注 |
|---|---|---|
| **SDXL 全家**（Illustrious XL / NoobAI / Pony V6） | ✅ FP16 紧凑可跑 | 推荐 1024×1024，单图 8-15s |
| **Flux.1-schnell GGUF Q4_K_M** | ✅ | 4 step 出图，~12s |
| **Flux.1-dev GGUF Q4** | ⚠️ 边缘 | 需 CPU offload，~30s |
| **Flux.2 [klein] 4B GGUF Q4** | ✅ | 待社区量化版 |
| **Wan 2.2 TI2V-5B GGUF Q4** | ✅ | 5s 视频 ~3-5 分钟 |
| **Wan 2.2 14B** | ❌ | 显存不足 |
| **HunyuanVideo 1.5 (8.3B)** | ⚠️ FP8 边缘 | EU/UK/KR 禁用，不推荐 |
| **FramePack**（lllyasviel）| ✅ | 6GB 设计目标，60s 视频 |

---

## 3. 功能范围（MVP）

### 3.1 必做（P0）

| 模块 | 功能 |
|---|---|
| **文生图** | Prompt + Negative + 模型选择 + 步数/CFG/尺寸 + 出图（4 张） |
| **图生图** | 上传图 + Prompt + Denoise 强度 + 出图 |
| **图生视频**（I2V）| 上传图 + Prompt + 帧数 + 出视频（mp4） |
| **本地图库** | 所有生成结果时间倒序展示，点击放大，下载、删除、复制 prompt |
| **设置中心** | ComfyUI 地址、输出目录、默认模型、默认参数 |
| **任务队列** | 内存队列，单任务串行（避免 OOM），实时进度条 |
| **健康检查** | 启动时检测 ComfyUI 连通性，提示用户配置 |

### 3.2 选做（P1，时间允许）

- 文生视频（T2V，Wan 2.2 TI2V-5B）
- 角色一致性（PuLID-Flux2 工作流）
- Prompt 历史
- 一键 LoRA 切换
- 内嵌 ComfyUI 工作流上传（自定义 JSON）

### 3.3 不做（Out of Scope）

- ❌ 用户认证 / 多用户（本地单人）
- ❌ 付费 / 计费
- ❌ 内容审核（本地个人用途）
- ❌ 云端部署 / SaaS（属于阶段二）
- ❌ 模型训练 / LoRA 微调（用 Kohya / Musubi-Tuner）
- ❌ 自动下载模型（用户从 CivitAI/HF 手动放入）

---

## 4. 技术架构

### 4.1 总体架构

```
┌──────────────────────────────────────────────────┐
│ 浏览器（http://localhost:6677）                  │
│ - Next.js App Router + React + Tailwind         │
└────────────────────┬─────────────────────────────┘
                     │ HTTP/SSE
┌────────────────────▼─────────────────────────────┐
│ Next.js Server（端口 6677）                       │
│ - /api/generate   提交任务                        │
│ - /api/status     轮询状态（或 SSE）              │
│ - /api/gallery    列出本地输出                    │
│ - /api/upload     接收上传图                      │
│ - lib/comfy.ts    ComfyUI 客户端                  │
│ - lib/workflows/  预置工作流模板                  │
└────────────────────┬─────────────────────────────┘
                     │ HTTP @ 8188（用户自起 ComfyUI）
┌────────────────────▼─────────────────────────────┐
│ ComfyUI（端口 8188）                              │
│ - 用户自行安装（README 提供脚本）                  │
│ - 模型放在 models/checkpoints/                    │
│ - 输出到 output/ → Studio 直接读                  │
└──────────────────────────────────────────────────┘
```

### 4.2 技术栈

| 层 | 技术 | 理由 |
|---|---|---|
| 框架 | Next.js 15 (App Router) | 全栈一体、SSR + API Routes，部署最简 |
| 语言 | TypeScript | 类型安全 |
| 样式 | TailwindCSS v4 | 快速、现代 |
| UI 组件 | 自建 + Radix 原语 | 不引入重型组件库 |
| 状态管理 | React useState/useContext | MVP 无需 Redux |
| 文件上传 | Next.js Route Handler + busboy/formidable | 标准 |
| 进度推送 | Server-Sent Events (SSE) | 比 WebSocket 简单，适合单向推送 |
| ComfyUI 通讯 | fetch + JSON-RPC 风格 HTTP | ComfyUI 原生 `/prompt` `/history` `/view` |
| 包管理 | npm | 默认 |

### 4.3 关键接口

#### 4.3.1 内部 API

| 路径 | 方法 | 用途 |
|---|---|---|
| `/api/generate` | POST | 提交生成任务，返回 `{ promptId }` |
| `/api/status?promptId=` | GET (SSE) | 推送进度与结果 URL |
| `/api/gallery` | GET | 列出 `output/` 下的图片/视频 |
| `/api/upload` | POST | 上传参考图，返回临时路径 |
| `/api/settings` | GET/PUT | 读写本地配置 |
| `/api/health` | GET | ComfyUI 连通性 |
| `/api/workflows` | GET | 列出 `lib/workflows/*.json` |

#### 4.3.2 ComfyUI 接口（外部依赖）

| 路径 | 方法 | 用途 |
|---|---|---|
| `/prompt` | POST | 提交工作流，返回 `prompt_id` |
| `/history/{prompt_id}` | GET | 查询历史记录 |
| `/view?filename=` | GET | 读取输出图/视频 |
| `/system_stats` | GET | GPU 信息 |

### 4.4 工作流模板（`lib/workflows/`）

| 文件 | 用途 | 推荐模型 |
|---|---|---|
| `sdxl-t2i.json` | SDXL 文生图 | Illustrious-XL-v3 / NoobAI / Pony-V6 |
| `sdxl-i2i.json` | SDXL 图生图 | 同上 |
| `flux-schnell-t2i.json` | Flux schnell 文生图 | flux1-schnell.gguf |
| `wan22-i2v.json` | Wan 2.2 图生视频 | Wan2.2-I2V-A14B (GGUF Q4) |
| `wan22-ti2v-5b.json` | Wan 2.2 文生视频 | Wan2.2-TI2V-5B (GGUF) |

**每个 JSON 是一个完整的 ComfyUI workflow**，由 Next.js 加载后做参数替换（prompt / seed / 尺寸）再 POST 给 ComfyUI。

### 4.5 目录结构

```
uncensored-studio/
├── PRD.md                    # 本文档
├── README.md                 # 用户安装/使用说明
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── app/
│   ├── layout.tsx            # 全局布局 + 导航
│   ├── page.tsx              # 首页 / Dashboard
│   ├── text2img/page.tsx
│   ├── img2img/page.tsx
│   ├── img2video/page.tsx
│   ├── text2video/page.tsx
│   ├── gallery/page.tsx
│   ├── settings/page.tsx
│   ├── globals.css
│   └── api/
│       ├── generate/route.ts
│       ├── status/route.ts
│       ├── gallery/route.ts
│       ├── upload/route.ts
│       ├── settings/route.ts
│       ├── health/route.ts
│       └── workflows/route.ts
├── components/
│   ├── Nav.tsx
│   ├── PromptForm.tsx
│   ├── ImageCard.tsx
│   ├── VideoCard.tsx
│   ├── ProgressBar.tsx
│   ├── ModelSelector.tsx
│   └── ImageUploader.tsx
├── lib/
│   ├── comfy.ts              # ComfyUI HTTP 客户端
│   ├── workflows.ts          # 加载并参数化工作流
│   ├── settings.ts           # 读写 settings.json
│   ├── storage.ts            # 输出目录管理
│   ├── queue.ts              # 内存任务队列
│   └── workflows/
│       ├── sdxl-t2i.json
│       ├── sdxl-i2i.json
│       ├── flux-schnell-t2i.json
│       ├── wan22-i2v.json
│       └── wan22-ti2v-5b.json
├── data/
│   ├── settings.json         # 用户配置（首次运行生成）
│   └── outputs/              # 软链接到 ComfyUI output（或独立目录）
└── scripts/
    ├── install-comfyui.ps1   # Windows 一键安装脚本
    └── download-models.ps1   # 模型下载提示
```

---

## 5. 用户旅程（关键流程）

### 5.1 首次启动

1. 用户运行 `npm run dev` → 浏览器打开 `http://localhost:6677`
2. 首页检测 ComfyUI 是否在 `localhost:8188` 运行
3. 若未运行，弹出 onboarding：
   - 显示 ComfyUI 安装链接
   - 提供 PowerShell 安装脚本
   - 推荐模型下载列表（CivitAI / HF 链接）
4. 用户启动 ComfyUI 后回来，自动检测成功 → 进入主界面

### 5.2 文生图（核心流程）

1. 点击导航"文生图"
2. 选择模型（下拉，从 ComfyUI `/object_info` 获取已安装的 checkpoints）
3. 输入 Prompt + Negative Prompt
4. 调整：步数（默认 25）、CFG（默认 7）、尺寸（默认 1024×1024）、批次（默认 4）
5. 点击"生成"
6. 进度条实时更新（百分比 + 当前节点）
7. 完成后 4 张图渲染在右侧，可点击放大、下载、用作图生图、复制 prompt
8. 自动写入本地图库

### 5.3 图生视频（核心流程）

1. 点击"图生视频"
2. 上传一张图（拖拽或选择）
3. 输入 Prompt（描述运动）
4. 选择模型（Wan 2.2 I2V 或 FramePack）
5. 选择时长（3s/5s/10s）、分辨率（512×512 / 720×480）
6. 点击"生成"
7. 进度条（视频生成慢，可能 3-10 分钟）
8. 完成后 mp4 在线播放，可下载

---

## 6. 设计原则

1. **极简优先**：每页一件事，不堆功能
2. **暗色主题默认**：长时间使用护眼，配色：`#0a0a0a` 背景 / `#fafafa` 前景 / `#3b82f6` 强调
3. **响应式**：桌面优先，但 768px 及以上保持可用（手机不优化）
4. **零外部 CDN**：所有资源本地化（隐私）
5. **可访问**：键盘操作、ARIA 标签
6. **错误友好**：ComfyUI 报错时显示具体节点名 + 建议（如"内存不足，请用 Q4 量化"）

---

## 7. MVP 交付清单

### 必须可工作的功能

- [x] PRD 文档（本文件）
- [ ] Next.js 项目初始化，TS + Tailwind + App Router
- [ ] 6677 端口启动
- [ ] 主页 Dashboard：ComfyUI 健康检查 + GPU 信息
- [ ] 文生图页面 + API + ComfyUI 工作流
- [ ] 图生视频页面（基础版，工作流模板）
- [ ] 本地图库页面（读取 ComfyUI output/）
- [ ] 设置页面（ComfyUI URL 配置）
- [ ] README（包含 ComfyUI 安装步骤、模型下载链接）

### 验收标准

1. 在 Windows 11 + Node 24 上执行 `npm install && npm run dev` 即可启动
2. 浏览器 `http://localhost:6677` 能打开
3. 当 ComfyUI 未运行时，首页明确提示并给安装指引
4. 当 ComfyUI 运行且有 SDXL 模型时，文生图能成功出图（前提：用户已安装 ComfyUI）
5. 图库页面能列出所有历史输出
6. 所有页面在暗色主题下视觉一致

---

## 8. 后续路线图（非 MVP）

| 版本 | 目标 |
|---|---|
| v0.2 | 角色一致性（PuLID-Flux2 工作流集成） |
| v0.3 | LoRA 管理 UI（启用/禁用/权重调节） |
| v0.4 | ComfyUI 自动安装 + 模型自动下载 |
| v0.5 | 多设备访问（局域网 + 简单密码） |
| v1.0 | 云 GPU 一键切换（接 RunPod Serverless） |

---

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 用户没安装 ComfyUI | onboarding + 安装脚本 + 详细 README |
| 8GB VRAM 跑大模型 OOM | 默认推荐 SDXL/GGUF 模型，警告大模型可能失败 |
| ComfyUI API 变化 | 锁定 ComfyUI 版本号；workflows JSON 可独立更新 |
| Next.js 端口冲突 | `next dev -p 6677` 配置，README 说明改端口方法 |
| 文件路径中文 + Windows 转义 | 使用 `path.join` + Node 原生 fs，全程用 absolute path |
| 视频生成慢用户误以为卡死 | 进度条 + 预估剩余时间 + 节点名提示 |
