# PRD — Personal Character LoRA Training (P6-#3)

## 1. Why we're building this

myhim.love 已有 5 大生成模式（t2i / i2i / inpaint / controlnet / video）和 PuLID 角色一致性，但每次都是"快速近似"，**没有真正属于用户的角色资产**。

LoRA 训练让用户**永久拥有**自己 / 伴侣 / 自定义角色的"AI 替身"——一个 50-200MB 的文件，叠加到任何 SDXL checkpoint 上都能精确复刻面孔。

**核心价值**：
- 客单价从 $5 充值 → **$10-20/LoRA**（毛利 95%+，成本 ~$0.50/训练）
- 留存：LoRA 是**持久资产**，用户为它反复回来用（vs 单次出图是一次性消费）
- 网络效应：每张用户用 LoRA 生成的图，对外炫耀都是"我的 AI 形象"，带新用户
- 对标数据：PhotoAI.com 月 $100K+，Tryleap.ai $20/model 月入 7 位数

---

## 2. 用户故事

### MVP 必须支持
1. **个人写真**：上传自己 10 张照片 → 训练个人 LoRA → 用 prompt 生成自己各种穿搭 / 场景 / 风格
2. **伴侣 / 偶像同人**：训练男友 / 偶像 LoRA → 生成"和他的二次元约会"
3. **OC 设定固定**：训练自己设计的虚拟角色 → 永远长得一样

### MVP 不支持（后期再加）
- 多 LoRA 同图叠加（两人合影）
- LoRA 风格控制（仅训风格不训脸）
- 动作 / 服装 LoRA 训练（非肖像类）

---

## 3. 技术选型（决策表）

### 3.1 训练引擎

| 候选 | 优点 | 缺点 | 决策 |
|---|---|---|---|
| **kohya_ss** | SDXL LoRA 最成熟、社区配方丰富、稳定 | 配置参数复杂 | ✅ **首选** |
| ai-toolkit (ostris) | 现代、配置简单、Flux 优先 | SDXL 不是主战场 | 备选 |
| SimpleTuner | 新、纯 Flux | 不支持 SDXL LoRA | ❌ |
| Diffusers 自带 | HF 官方、可控 | 要自己写 1000 行 trainer | ❌ |

**决策：kohya_ss + sd-scripts** —— 用 [bmaltais/kohya_ss](https://github.com/bmaltais/kohya_ss) 这套已经 docker 化的版本，单条命令训练。

### 3.2 训练 GPU 编排

| 候选 | 优点 | 缺点 | 决策 |
|---|---|---|---|
| **RunPod On-Demand Pod** | 已有账号、稳定、可定时销毁、$0.34-0.69/hr | 需 API 编排创建+销毁 | ✅ |
| RunPod Serverless | 复用现有 endpoint | 单 job 最长 1h，但 LoRA 训练偶尔 > 1h；scaling 复杂 | ❌ |
| Vast.ai | 便宜 ~50% | 不稳定，host 偶尔下线 | ❌ |
| Modal | DX 最好 | 严禁 NSFW，账号会被封 | ❌ |

**决策：RunPod On-Demand GPU Pod**（4090，单次训练 ~30min + 模型上传 5min = $0.50 总成本）

### 3.3 人脸合规验证（**法律必备**）

法律风险：用户上传**他人**面孔训练 + 生成 NSFW = 美国 TAKE IT DOWN Act（2025）直接刑事 + 民事。**必须**强制"训练对象 = 上传者"验证。

| 方案 | 准确率 | 成本 | 决策 |
|---|---|---|---|
| **DeepFace（开源）+ 自托管 in-pod** | 90%+ | 免费（pod 已付费）| ✅ |
| AWS Rekognition CompareFaces | 95%+ | $0.001/call | 备选（要额外 AWS 账号）|
| Face++ API | 95%+ | $0.003/call | ❌ 国内供应商，海外业务避免 |
| FaceIO 浏览器端 | 80% | 免费 | ❌ 易被欺骗（截屏伪造）|

**决策：DeepFace** —— 在训练 pod 里安装 + 跑（Python `pip install deepface`），用 facenet512 模型，threshold 0.4，要求所有训练图与"现场自拍"匹配。免账号 + 同一 GPU。

### 3.4 未成年人检测

| 方案 | 决策 |
|---|---|
| **DeepFace `analyze(actions=['age'])` + threshold ≥ 25** | ✅ 主防线 |
| Microsoft Florence-2 age classifier | 备选（更准但要额外 model）|
| 名人脸库匹配 | ❌ MVP 跳过（false-positive 高，需要专门数据库） |

**决策：DeepFace 年龄估算，阈值 25 岁**（保守，因为年龄估算误差 ±5 岁）。

### 3.5 训练参数（kohya 配方）

**基线配方**（30 min @ RTX 4090，对人脸效果最好）：
```bash
accelerate launch --num_cpu_threads_per_process 8 sdxl_train_network.py \
  --pretrained_model_name_or_path="/runpod-volume/models/checkpoints/sd_xl_base_1.0.safetensors" \
  --train_data_dir=/workspace/data \
  --output_dir=/workspace/output \
  --output_name=user_lora \
  --network_module=networks.lora \
  --network_dim=32 \
  --network_alpha=16 \
  --learning_rate=1e-4 \
  --train_batch_size=1 \
  --max_train_steps=1500 \
  --mixed_precision=fp16 \
  --save_precision=fp16 \
  --save_model_as=safetensors \
  --resolution=1024,1024 \
  --enable_bucket \
  --xformers \
  --cache_latents \
  --gradient_checkpointing \
  --optimizer_type=AdamW8bit
```

**输出**：~150MB `.safetensors`，叠加到任意 SDXL checkpoint 即可用。

### 3.6 存储

- **训练图**：上传到 R2 `/lora-input/{userId}/{loraId}/*.jpg` → 训练完成 **24h 后删除**（隐私 + 成本）
- **LoRA 文件**：永久存 R2 `/lora-output/{userId}/{loraId}.safetensors`（~150MB × 用户数）
- **训练日志**：DB 表 `LoraTrainingLog`，保留 5 年（应 TAKE IT DOWN Act 调查）

成本测算：1000 个 LoRA 用户 = 150GB R2 = **$10.5/月**

---

## 4. 数据模型（Schema 变更）

```prisma
enum LoraStatus {
  UPLOADING        // 用户在上传图
  VERIFYING        // DeepFace 验证中
  REJECTED         // 验证失败（未成年 / 多人脸 / 与自拍不匹配）
  QUEUED           // 等待训练 pod 启动
  TRAINING         // 训练中
  READY            // 训完，可用
  FAILED           // 训练失败
  DELETED          // 用户已删
}

model Lora {
  id                String      @id @default(cuid())
  userId            String
  name              String      // 用户起的名字 "我的角色"
  status            LoraStatus  @default(UPLOADING)
  triggerWord       String      // 唯一触发词 "ohwx_user_abc"
  loraKey           String?     // R2 key（status=READY 后才有）
  podId             String?     // RunPod pod id（training 中）
  imageCount        Int         @default(0)
  costCredits       Int         // 500（$10 套餐）/ 1000（$20 加快）
  rejectionReason   String?
  trainingStepsRemote String?  // RunPod training job 输出日志
  createdAt         DateTime    @default(now())
  startedAt         DateTime?
  completedAt       DateTime?
  deletedAt         DateTime?

  user              User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainingImages    LoraTrainingImage[]
  trainingLogs      LoraTrainingLog[]

  @@index([userId, status])
}

model LoraTrainingImage {
  id        String   @id @default(cuid())
  loraId    String
  r2Key     String   // 训练完后删除
  faceVerified Boolean
  estimatedAge Int?
  faceCount Int?
  rejectionReason String?
  uploadedAt DateTime @default(now())

  lora      Lora     @relation(fields: [loraId], references: [id], onDelete: Cascade)
}

// 应法律调查用，5 年保留
model LoraTrainingLog {
  id            String   @id @default(cuid())
  loraId        String
  userId        String
  userEmail     String   // 冗余，便于调查
  userIp        String   // 训练时 IP
  consentText   String   @db.Text  // 用户勾选的同意文本
  consentAt     DateTime
  imageCount    Int
  rejectedCount Int
  trainingPodId String?
  status        String

  lora          Lora     @relation(fields: [loraId], references: [id])

  @@index([userId])
  @@index([createdAt])
}
```

`User` 加 `loras Lora[]`、`Generation` 加 `loraId String?`（可选叠加）。

---

## 5. API 路由

| 路径 | 用途 |
|---|---|
| `POST /api/lora` | 创建 LoRA 记录（name, costCredits）→ 扣积分 |
| `POST /api/lora/:id/upload` | 上传训练图（multipart, 5-20 张 + 1 张 consent 自拍）→ DeepFace 验证 → 状态 → QUEUED |
| `POST /api/lora/:id/start` | 起 RunPod pod 跑训练 |
| `GET /api/lora` | 列出用户所有 LoRA |
| `GET /api/lora/:id` | 单个 LoRA 状态 |
| `DELETE /api/lora/:id` | 软删（保留训练日志，删 R2 文件）|
| `POST /api/lora/webhook` | RunPod pod 训练完成回调（带 secret 验签）|

### 训练 pod 内部脚本（伪代码）
```bash
# kohya 镜像启动脚本
1. 从 R2 下载训练图到 /workspace/data/
2. 运行 deepface 验证（同 frontend 已做的，作为冗余防御）
3. 跑 kohya accelerate launch
4. 上传输出 .safetensors 到 R2
5. POST webhook 到 myhim.love/api/lora/webhook (Bearer LORA_WEBHOOK_SECRET)
6. self-terminate pod
```

---

## 6. 前端页面

| 路径 | 内容 |
|---|---|
| `/lora` | 我的 LoRA 列表 + "+ 新建训练" 按钮，状态展示（训练中 → 进度条；ready → 显示 trigger word） |
| `/lora/new` | 4 步引导：起名 → 阅读同意书 → 上传自拍 + 5-20 张训练图 → 选 $10 / $20 套餐 → 提交 |
| `/lora/:id` | 训练详情：状态 / 进度 / 训练日志摘要 / 删除按钮 |
| 在 `/text2img` `/inpaint` 等生成页 | "叠加我的 LoRA" 下拉框（仅显示 READY 的）+ 强度滑块 |

---

## 7. 用户流程图

```
用户 → /lora/new → 起名 → 阅读 ToS（必须勾选"我只训自己 / 获明确同意"）
                          ↓
                  传 1 张当场自拍（活体校验 → 摄像头截屏 OR 上传）
                          ↓
                  传 5-20 张训练图
                          ↓
                 前端 DeepFace.js 即时校验（每张图必须有 1 张脸 + age ≥ 25 + 与自拍匹配 ≥ 0.6）
                          ↓
                  选 $10 标准（30 min）/ $20 加快（10 min H100）
                          ↓
                  确认 → 扣积分 → 状态 QUEUED
                          ↓
                  后端起 RunPod 4090 pod → TRAINING（前端轮询，UI 显示进度条）
                          ↓
                  pod 完成 → upload LoRA → webhook → 状态 READY
                          ↓
                  邮件通知用户 "你的 LoRA 已就绪"
                          ↓
                  用户去 /text2img 选 LoRA + 输入 prompt
                          ↓
                  生成图含训练的角色 ✓
```

---

## 8. 法律 / 合规栈（必须先于功能上线）

### 8.1 强制条款
ToS 加专章：
```
LoRA Training Service — Acceptable Use:
1. You may ONLY upload photos of yourself, or persons who have given
   you explicit written consent.
2. Photos of minors (under 18) are strictly prohibited; we use AI face-
   age detection to reject such images.
3. Photos of public figures / celebrities are prohibited.
4. Generated content combining a personal LoRA with NSFW prompts is
   YOUR sole responsibility; we do not screen all outputs.
5. Violations result in account ban + reporting to relevant authorities
   per TAKE IT DOWN Act (US) / Online Safety Act (UK) / etc.

[Checkbox] I acknowledge and accept the above terms.
```

### 8.2 地理屏蔽（在中间件加）
- **UK**：Online Safety Act 严，先屏蔽
- **South Korea**：Deepfake Sex Crime Act 持有/制作均刑事
- **Japan**：改正特定网络行为规制法民事赔
- **India**：IT Rules 2021 严
- **China**：暂不开放（与本站定位一致）

只放行：US / EU（除 UK）/ Canada / Australia / 东南亚 / 中东 / 拉美

### 8.3 输出强制 C2PA 水印
每张用 personal LoRA 生成的图 → ImageMagick 加 metadata `ContentCredentials` → 标记 "AI-generated, source LoRA: {loraId}" → 应 EU AI Act 2026 强制

### 8.4 训练日志保留
- `LoraTrainingLog` 表 5 年内不删
- 用户 IP / consent 文本 / 图片 hash 留底
- 收到 NCII 投诉时能查到原始训练数据

### 8.5 主动监控
- 每月跑一次脚本：抽查 1% 的 LoRA，让 DeepFace 重新分析 → 检测有没有用户绕过校验
- 收到投诉 24h 内删 LoRA + 通知用户

---

## 9. 成本 / 定价模型

### 单次训练成本
| 项 | 数字 |
|---|---|
| RunPod 4090 30 min | $0.345 |
| RunPod 4090 启动开销（拉镜像 + 模型）5 min | $0.058 |
| R2 上传/存储 | $0.001 |
| DeepFace 计算（在 pod 内）| 已含 |
| **总成本** | **~$0.40** |

### 定价
| 套餐 | 售价 | GPU | 时长 | 毛利 |
|---|---|---|---|---|
| **标准** | $10 (500 积分) | RTX 4090 | ~35 min | $9.60 / 96% |
| **加快** | $20 (1000 积分) | H100 | ~12 min | $19.20 / 96% |

### LoRA 月存储费
- 每用户 LoRA ~150MB
- 1000 LoRA = 150GB R2 = **$10.5/月**（可忽略 vs 单 LoRA 收入）

### 使用 LoRA 生图加价
- 普通 t2i = 1 积分
- 带 LoRA t2i = **2 积分**（+1 用于 LoRA loader 开销 + 维持 LoRA 长期存储）

---

## 10. 实施路线（5 阶段，总 1-2 周）

### Phase 1 — 训练 Docker 镜像（2-3 天）
1. 写 `docker/worker-lora-trainer/Dockerfile` —— FROM pytorch + kohya_ss + deepface
2. 写 `docker/worker-lora-trainer/train.sh` —— 完整训练流水（download → verify → train → upload → webhook → terminate）
3. GitHub Actions 构建 + push 到 ghcr.io
4. RunPod 模板 + 手动测试一次（不接 API，纯命令行验证训练能完成 + 输出 LoRA 可加载）

### Phase 2 — 后端 API + 队列（2-3 天）
1. Prisma schema 迁移（Lora、LoraTrainingImage、LoraTrainingLog 表）
2. /api/lora CRUD
3. /api/lora/:id/upload + DeepFace 校验（在主进程跑 OR fire 临时 pod？决策：**主进程**用 deepface python 子进程，避免起 pod 慢）
4. /api/lora/:id/start —— RunPod API 创建 pod，传 LORA_ID + R2 prefix + WEBHOOK_SECRET 为 env
5. /api/lora/webhook —— 验签 + 更新状态
6. 失败重试：训练 pod 5 min 没启动 → 用户全额退款

### Phase 3 — 前端 UI（3-4 天）
1. /lora 列表页
2. /lora/new 4 步引导（含浏览器端 DeepFace.js 即时反馈）
3. /lora/:id 详情 + 轮询状态
4. /text2img 等生成页加 "我的 LoRA" 下拉框
5. 计费集成（buildT2IWorkflow 等加 LoRA 节点）

### Phase 4 — 合规 stack（2-3 天，**并行 Phase 1-3**）
1. 地理屏蔽 middleware
2. ToS 章节 + 强制 checkbox
3. C2PA 水印（在 /api/status 落 R2 前加 metadata）
4. LoraTrainingLog 写入

### Phase 5 — 端到端测试 + 上线（1 天）
1. 真实用户流程：注册 → 充值 → 训练 → 等 30 min → 使用 LoRA → 验证生成图含训练角色
2. 故障测试：训练失败 → 退款；用户删 LoRA → R2 文件删；监控 alert
3. 灰度发布：先开 10 个用户 beta，看 1 周再公开

---

## 11. 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| DeepFace 把训练对象识别为名人 → 误拒 | 默认信任用户，仅拦截年龄 + 人脸数；celeb 检测推迟 |
| RunPod 突然不接受 LoRA 训练 pod（NSFW 训练）| Phase 2 备份方案：用 Vast.ai 同样跑 kohya |
| 用户上传他人 NSFW → 民事/刑事 | 5 年日志 + 报警时能 100% 追溯到上传者 IP/email |
| 训练 pod 30 min 烧钱失败 → 用户损失 $10 | 训练前 60s 内必须报启动成功，否则全额退；训练失败原因记录 + 退款 |
| LoRA 文件被用户从 R2 公开 URL 盗下 | LoRA 文件用 signed URL（10 min 有效）；不暴露 R2 public path |
| ComfyUI LoraLoader 节点对 NoobAI checkpoint 兼容性 | Phase 1 训完第一个 LoRA 立刻在 NoobAI 上验证 |

---

## 12. 不做的事（明确划界，避免范围蔓延）

- 多 LoRA 同图叠加（最多 1 个 LoRA + 1 个 checkpoint）
- 训练自己的 checkpoint（base model，太大太慢）
- 风格 LoRA（仅训风格不训角色）—— 用户上传 50+ 同风格图，复杂度高
- 视频 LoRA（Wan 2.2 LoRA 训练完全不同栈）
- 实时训练进度可视化（loss curve 等）—— 显示百分比就够
- LoRA 市场 / 分享（C2C）—— 法律 minefield，永远不做

---

## 13. 验收标准

- 普通用户 30 min 内能完成：选套餐 → 上传 → 训练 → 用 LoRA 出图 → 看到自己的脸
- 出图准确度：训练用户的面部特征 ≥ 80% 还原（主观评分，10 个用户测试）
- 训练失败率 < 5%
- 法律事件 0（前 3 个月）
- 客单价 vs MAU：每月 LoRA 销售收入 > 普通生图收入

---

## 14. 我的下一步建议

写完 PRD = 共识已建立。建议立刻进入 **Phase 1**（训练 Docker 镜像）+ **Phase 4**（合规 stack）并行：
- Phase 1 跑通技术可行性
- Phase 4 是没有它就不能上线的硬阻挡

不要先做 Phase 2 / 3 —— 万一 Phase 1 发现 kohya 在我们的 RunPod 配置下跑不动，那 Phase 2/3 都是无用功。
