# Vercel 部署指南

> 目标：把 Uncensored Studio 部署到 Vercel + Neon Postgres + Cloudflare R2 + RunPod Serverless + NowPayments。

---

## 总览

```
┌─────────────────────────────────────────────────────┐
│  浏览器（你的用户）                                 │
└─────────────┬───────────────────────────────────────┘
              │ HTTPS
┌─────────────▼───────────────────────────────────────┐
│  Vercel（前端 + API + Webhooks）                    │
│  https://your-domain.com                            │
└─┬─────┬───────────────┬───────────────┬─────────────┘
  │     │               │               │
  ▼     ▼               ▼               ▼
┌────┐ ┌──────────────┐ ┌──────────┐ ┌─────────────┐
│Neon│ │  R2 (Cloud-  │ │ RunPod   │ │ NowPayments │
│ PG │ │  flare 对象  │ │ Server-  │ │   (IPN)     │
│    │ │  存储 + CDN) │ │ less GPU │ │             │
└────┘ └──────────────┘ └──────────┘ └─────────────┘
```

## 准备工作清单

注册以下账户（如还没）：

| 服务 | 用途 | 注册 |
|---|---|---|
| **Neon** | Postgres 数据库 | https://neon.tech |
| **Cloudflare R2** | 对象存储 | 在已有 Cloudflare dashboard 中开通 |
| **RunPod** | GPU 推理 | https://runpod.io |
| **NowPayments** | 加密支付 | https://nowpayments.io |
| **Resend**（可选）| 邮件发送 | https://resend.com |

---

## Step 1 · 推到 GitHub

```bash
cd uncensored-studio
git init
git add .
git commit -m "Initial commercial-ready commit"
gh repo create uncensored-studio --private --source=. --push
```

或者用 GitHub Web UI 创建仓库后 `git remote add origin ... && git push -u origin main`。

---

## Step 2 · Neon Postgres

1. 登录 https://console.neon.tech → Create Project → 选距用户最近的区域（推荐 `us-east-2`）
2. 创建项目后复制 **Connection string**（形如 `postgresql://user:pwd@ep-xxx.aws.neon.tech/neondb?sslmode=require`）
3. 在本地：

```bash
DATABASE_URL="<paste here>" npx prisma db push
```

这会创建所有表（User / Generation / CreditTx 等）。

---

## Step 3 · Cloudflare R2

1. Cloudflare dashboard → R2 Object Storage → Create bucket，名字如 `uncensored-studio-prod`
2. R2 → Manage R2 API tokens → Create Token：
   - Permissions: **Admin Read & Write** 该 bucket
   - 复制 **Access Key ID** + **Secret Access Key**
   - **Account ID** 在 R2 主页右边栏
3. （可选但强烈推荐）启用 **公开访问**：
   - Bucket → Settings → Public access → Allow
   - 自定义域名：bind 你的子域名（如 `cdn.your-domain.com`）→ 复制 URL
4. 在 Vercel 环境变量准备：
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_URL`（可选，没有的话用 pre-signed URL）

---

## Step 4 · RunPod Serverless

1. https://runpod.io/console → Serverless → Endpoints → New Endpoint
2. Template 选 **"ComfyUI Worker"** 或自己写一个基于 `runpod-workers/worker-comfyui`
3. 配置：
   - GPU: **RTX 4090** 或 **L40S**（开始）
   - Container Image：`runpod/worker-comfyui:latest`（或你自己 build 的镜像）
   - Max workers: 3-5（按预期并发）
   - Idle timeout: 60s（节省费用）
   - **重要**：预下载你需要的模型到 Network Volume，避免冷启动时下载
4. 复制 **Endpoint ID** + **API Key**
5. Vercel 环境变量：
   - `INFERENCE_PROVIDER=runpod`
   - `RUNPOD_API_KEY`
   - `RUNPOD_ENDPOINT_ID`

**示例 RunPod 模型 manifest**（放在 Network Volume）：

```
/runpod-volume/ComfyUI/models/
├── checkpoints/
│   ├── dreamshaper-8.safetensors
│   ├── noobai-xl-vpred.safetensors
│   └── illustrious-xl.safetensors
├── unet/
│   └── flux1-schnell-Q5_K_M.gguf
├── vae/
│   ├── ae.safetensors
│   └── wan_2.1_vae.safetensors
├── text_encoders/
│   └── umt5_xxl_fp8_e4m3fn_scaled.safetensors
├── clip/
│   ├── clip_l.safetensors
│   └── t5xxl_fp8_e4m3fn.safetensors
└── diffusion_models/
    └── wan22-ti2v-5b-q4.gguf
```

---

## Step 5 · NowPayments

1. https://account.nowpayments.io/sign-up
2. 完成基本邮箱认证（KYC 可选，不做也能用，但单笔限额 $1000）
3. **Settings → API keys** → Create new API key → 复制
4. **Settings → IPN** → 设置：
   - IPN URL: `https://your-domain.com/api/webhooks/nowpayments`（域名绑定后再设）
   - IPN Secret: 随机生成一个字符串（如 `openssl rand -hex 32`）→ 复制
5. **Settings → Payment widgets** → 启用 USDT (TRC20) / USDT (ERC20) / BTC / ETH 至少 4 种
6. Vercel 环境变量：
   - `NOWPAYMENTS_API_KEY`
   - `NOWPAYMENTS_IPN_SECRET`
   - `NOWPAYMENTS_SUCCESS_URL=https://your-domain.com/dashboard?payment=success`
   - `NOWPAYMENTS_CANCEL_URL=https://your-domain.com/pricing?payment=cancel`

---

## Step 6 · Resend（可选，发登录邮件）

1. https://resend.com → 注册
2. **Domains** → 添加你的域名 → 按指引设置 DNS（SPF / DKIM / DMARC）
3. **API Keys** → Create → 复制
4. Vercel 环境变量：
   - `RESEND_API_KEY`
   - `AUTH_EMAIL_FROM=login@your-domain.com`
   - `AUTH_DEV_PRINT_LINKS=false`

---

## Step 7 · Vercel 部署

### 7.1 导入项目

1. https://vercel.com/new → Import Git Repository → 选你的 `uncensored-studio` 仓库
2. Framework Preset: **Next.js**
3. Build Command: `prisma generate && next build`（覆盖默认）
4. 暂不点 Deploy，先填环境变量

### 7.2 环境变量（Production + Preview 都填）

复制以下到 Vercel → Settings → Environment Variables：

```bash
# App
NEXT_PUBLIC_APP_NAME=Uncensored Studio
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Auth
AUTH_SECRET=<openssl rand -base64 32 生成>

# Database
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
SKIP_DB=false

# Email
RESEND_API_KEY=re_xxx
AUTH_EMAIL_FROM=login@your-domain.com
AUTH_DEV_PRINT_LINKS=false

# Inference
INFERENCE_PROVIDER=runpod
RUNPOD_API_KEY=xxx
RUNPOD_ENDPOINT_ID=xxx

# Storage
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=uncensored-studio-prod
R2_PUBLIC_URL=https://cdn.your-domain.com

# Payment
NOWPAYMENTS_API_KEY=xxx
NOWPAYMENTS_IPN_SECRET=xxx
NOWPAYMENTS_SUCCESS_URL=https://your-domain.com/dashboard?payment=success
NOWPAYMENTS_CANCEL_URL=https://your-domain.com/pricing?payment=cancel

# Admin
ADMIN_EMAILS=you@your-domain.com
```

### 7.3 Deploy

点 **Deploy** 按钮。第一次构建约 2-3 分钟。

---

## Step 8 · 绑定域名

1. Vercel 项目 → Settings → Domains → Add → 输入域名
2. 按指引在域名注册商处添加 DNS 记录（CNAME 或 A）
3. 等 SSL 自动签发（~1 分钟）

---

## Step 9 · 部署后必做

### 9.1 跑数据库迁移

第一次部署后在 Vercel CLI 或本地：

```bash
DATABASE_URL=<Neon production URL> npx prisma db push
```

### 9.2 把所有 webhook URL 改成 prod 域名

- NowPayments IPN URL → `https://your-domain.com/api/webhooks/nowpayments`

### 9.3 跑端到端冒烟测试

1. 用 incognito 浏览器访问 `https://your-domain.com`
2. 点登录 → 输邮箱 → 收到邮件 → 点链接 → 跳到 dashboard
3. 看到 20 积分
4. 跑一张文生图（消耗 1 积分）
5. 去 /pricing → 充值 $5 → NowPayments hosted page → 用 USDT-TRC20 测试支付（或测试网）
6. 回到 dashboard 检查积分到账

### 9.4 监控

- Vercel → Analytics 看请求量与错误率
- Neon → Monitoring 看数据库连接数
- RunPod → Logs 看 GPU job 成败
- NowPayments → Dashboard 看交易

---

## 后续：接入 Paddle（公司注册后）

公司注册下来后：

1. https://paddle.com → 申请 vendor 账户（需提交公司资料）
2. 审核通过（1-3 天）→ 在 Paddle dashboard 创建商品对应 `lib/plans.ts` 中的订阅 ID
3. 在 Vercel 加环境变量：
   - `PADDLE_API_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_VENDOR_ID`
   - `PADDLE_PUBLIC_KEY_HTML5`
4. 添加 `/api/checkout/paddle/route.ts` 和 `/api/webhooks/paddle/route.ts`（架构已留位，下一阶段实现）

---

## 常见问题

**Q: Vercel 部署后访问超时**
→ 检查 RunPod endpoint 是否在线（`/api/me` 应该返回 200，`/api/generate` 才会调 RunPod）

**Q: 加密支付后积分没到账**
→ NowPayments dashboard 看 IPN 投递记录。检查 IPN URL 是否拼写正确，IPN Secret 是否匹配

**Q: 部署后图片 404**
→ 检查 `R2_PUBLIC_URL` 是否设置且 bucket 公开可访问

**Q: 收不到登录邮件**
→ 检查 Resend domain DNS 是否完成验证，看 Resend dashboard 的日志

**Q: 想本地复现 production 行为**
→ 复制 prod 环境变量到 `.env.local`，但 `STORAGE_PROVIDER` 和 `INFERENCE_PROVIDER` 改回 `local`
