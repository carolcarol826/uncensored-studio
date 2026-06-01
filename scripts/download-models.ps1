#requires -version 5.1
<#
.SYNOPSIS
  Uncensored Studio - 模型下载助手（Windows）

.DESCRIPTION
  交互式选择并下载 ComfyUI 所需模型到正确目录。
  默认 ComfyUI 路径：%USERPROFILE%\ComfyUI\ComfyUI_windows_portable\ComfyUI

.NOTES
  - HuggingFace 大文件下载推荐先安装 huggingface_hub:
      pip install -U "huggingface_hub[cli]"
  - CivitAI 需要 API key（免费注册）:
      https://civitai.com/user/account#api-keys
#>

[CmdletBinding()]
param(
    [string]$ComfyRoot = (Join-Path $env:USERPROFILE 'ComfyUI\ComfyUI_windows_portable\ComfyUI'),
    [string]$CivitaiToken = $env:CIVITAI_TOKEN,
    [string]$HfToken = $env:HF_TOKEN
)

$ErrorActionPreference = 'Continue'

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  [ERR] $m" -ForegroundColor Red }

if (-not (Test-Path $ComfyRoot)) {
    Write-Err "找不到 ComfyUI 目录：$ComfyRoot"
    Write-Warn '请先运行 install-comfyui.ps1，或用 -ComfyRoot 指定路径'
    exit 1
}

$dirs = @{
    checkpoints       = 'models\checkpoints'
    loras             = 'models\loras'
    unet              = 'models\unet'
    diffusion_models  = 'models\diffusion_models'
    vae               = 'models\vae'
    clip              = 'models\clip'
    pulid             = 'models\pulid'
    text_encoders     = 'models\text_encoders'
    insightface       = 'models\insightface'
}
foreach ($d in $dirs.Values) {
    $p = Join-Path $ComfyRoot $d
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

# ----- 模型清单 -----
# 每条：{ id, name, size, dir(对应 $dirs key), url, sha?, requires_token, notes }
$catalog = @(
    # ---- SDXL 系（8GB VRAM 完美） ----
    @{
        id      = 'illustrious-xl-v3'
        name    = 'Illustrious XL v3.0 (动漫 SOTA, OpenRAIL++)'
        dir     = 'checkpoints'
        url     = 'https://civitai.com/api/download/models/889818'
        size    = '7 GB'
        requires_token = $true
        notes   = 'CivitAI 主流动漫 base'
    },
    @{
        id      = 'noobai-xl-vpred'
        name    = 'NoobAI XL v-pred (动漫 NSFW)'
        dir     = 'checkpoints'
        url     = 'https://huggingface.co/Laxhar/noobai-XL-Vpred-1.0/resolve/main/NoobAI-XL-Vpred-v1.0.safetensors'
        size    = '6.6 GB'
        requires_token = $false
        notes   = 'V-pred 版本，色彩饱和度更好'
    },
    @{
        id      = 'pony-v6'
        name    = 'Pony Diffusion V6 XL (动漫 NSFW，老牌)'
        dir     = 'checkpoints'
        url     = 'https://civitai.com/api/download/models/290640'
        size    = '6.5 GB'
        requires_token = $true
        notes   = 'tag 风格，无审查'
    },

    # ---- Flux schnell GGUF (8GB 友好) ----
    @{
        id      = 'flux1-schnell-q4'
        name    = 'FLUX.1-schnell Q4_K_M GGUF (4-step, 8GB 友好)'
        dir     = 'unet'
        url     = 'https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_K_M.gguf'
        size    = '7 GB'
        requires_token = $false
    },
    @{
        id      = 'flux-ae'
        name    = 'FLUX VAE (ae.safetensors)'
        dir     = 'vae'
        url     = 'https://huggingface.co/Comfy-Org/Lumina_Image_2.0_Repackaged/resolve/main/split_files/vae/ae.safetensors'
        size    = '335 MB'
        requires_token = $false
        notes   = 'Flux 所有版本通用'
    },
    @{
        id      = 'flux-clip-l'
        name    = 'CLIP-L (clip_l.safetensors)'
        dir     = 'clip'
        url     = 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors'
        size    = '246 MB'
        requires_token = $false
    },
    @{
        id      = 'flux-t5xxl-fp8'
        name    = 'T5-XXL FP8 (Flux 文本编码器)'
        dir     = 'clip'
        url     = 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors'
        size    = '4.9 GB'
        requires_token = $false
    },

    # ---- PuLID-Flux 角色一致性 ----
    @{
        id      = 'pulid-flux-v0.9.1'
        name    = 'PuLID-Flux v0.9.1 (角色一致性)'
        dir     = 'pulid'
        url     = 'https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors'
        size    = '1.1 GB'
        requires_token = $false
    },

    # ---- Wan 2.2 视频（5B 量化版可跑 8GB） ----
    @{
        id      = 'wan22-ti2v-5b-q4'
        name    = 'Wan 2.2 TI2V-5B Q4 GGUF (文/图生视频，8GB 紧凑)'
        dir     = 'diffusion_models'
        url     = 'https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q4_K_M.gguf'
        size    = '4.5 GB'
        requires_token = $false
        notes   = 'Apache 2.0；需要 ComfyUI-GGUF 节点'
    },
    @{
        id      = 'umt5-xxl-fp8'
        name    = 'umT5-XXL FP8 (Wan 视频文本编码器)'
        dir     = 'text_encoders'
        url     = 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors'
        size    = '5.5 GB'
        requires_token = $false
    },
    @{
        id      = 'wan22-vae'
        name    = 'Wan 2.2 VAE'
        dir     = 'vae'
        url     = 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors'
        size    = '254 MB'
        requires_token = $false
    }
)

# 推荐组合
$presets = @{
    '1' = @{
        name   = '最小可用（仅 SDXL 文生图）'
        ids    = @('illustrious-xl-v3')
        totalGB = 7
    }
    '2' = @{
        name   = '完整 SDXL（动漫 + NSFW 双模型）'
        ids    = @('illustrious-xl-v3', 'noobai-xl-vpred', 'pony-v6')
        totalGB = 20
    }
    '3' = @{
        name   = 'SDXL + Flux schnell（推荐 8GB）'
        ids    = @('illustrious-xl-v3', 'flux1-schnell-q4', 'flux-ae', 'flux-clip-l', 'flux-t5xxl-fp8')
        totalGB = 19
    }
    '4' = @{
        name   = '完整套装（SDXL + Flux + Wan 视频 + PuLID）'
        ids    = @('illustrious-xl-v3', 'noobai-xl-vpred', 'flux1-schnell-q4', 'flux-ae', 'flux-clip-l', 'flux-t5xxl-fp8', 'pulid-flux-v0.9.1', 'wan22-ti2v-5b-q4', 'umt5-xxl-fp8', 'wan22-vae')
        totalGB = 38
    }
}

# ----- 选择 -----
Write-Host @"

  模型清单（按 8GB VRAM 友好程度排序）

  推荐组合：
"@ -ForegroundColor Magenta

foreach ($k in ($presets.Keys | Sort-Object)) {
    $p = $presets[$k]
    Write-Host ("  [{0}] {1}  (~{2} GB)" -f $k, $p.name, $p.totalGB) -ForegroundColor White
}
Write-Host "  [c] 自定义选择"
Write-Host "  [q] 退出"

$choice = Read-Host "`n输入选项"
if ($choice -eq 'q') { exit 0 }

$selectedIds = @()
if ($presets.ContainsKey($choice)) {
    $selectedIds = $presets[$choice].ids
} elseif ($choice -eq 'c') {
    Write-Host "`n可下载项：" -ForegroundColor Magenta
    for ($i = 0; $i -lt $catalog.Count; $i++) {
        $c = $catalog[$i]
        Write-Host ("  [{0,2}] {1}  ({2})" -f ($i+1), $c.name, $c.size)
    }
    $sel = Read-Host "`n输入序号（逗号分隔，如 1,3,5）"
    $indices = $sel -split ',' | ForEach-Object { ([int]$_.Trim() - 1) }
    $selectedIds = $indices | ForEach-Object { $catalog[$_].id }
} else {
    Write-Err '无效选项'
    exit 1
}

# ----- 下载 -----
foreach ($id in $selectedIds) {
    $m = $catalog | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if (-not $m) { continue }

    $outDir = Join-Path $ComfyRoot $dirs[$m.dir]
    $filename = Split-Path $m.url -Leaf
    if ($filename -match '^\d+$') {
        # CivitAI API 链接，文件名要后处理
        $filename = "$($m.id).safetensors"
    }
    $outPath = Join-Path $outDir $filename

    if (Test-Path $outPath) {
        Write-Ok "$($m.name) 已存在，跳过"
        continue
    }

    Write-Step "下载 $($m.name)  ($($m.size))"
    Write-Host "  → $outPath"

    $headers = @{ 'User-Agent' = 'ust-installer/1.0' }
    if ($m.url -match 'civitai\.com' -and $CivitaiToken) {
        $headers['Authorization'] = "Bearer $CivitaiToken"
    }
    if ($m.url -match 'huggingface\.co' -and $HfToken) {
        $headers['Authorization'] = "Bearer $HfToken"
    }

    try {
        # 使用 BITS 或 Invoke-WebRequest 流式下载
        $tmp = "$outPath.tmp"
        Invoke-WebRequest -Uri $m.url -Headers $headers -OutFile $tmp -UseBasicParsing -MaximumRedirection 10
        Move-Item -Path $tmp -Destination $outPath -Force
        Write-Ok "完成：$filename"
    } catch {
        Write-Err "下载失败：$($_.Exception.Message)"
        if ($m.url -match 'civitai\.com') {
            Write-Warn 'CivitAI 下载需要 API Token：'
            Write-Warn '  1. 注册 https://civitai.com，到 Account → API Keys 创建'
            Write-Warn '  2. 设置环境变量：$env:CIVITAI_TOKEN="你的token"'
            Write-Warn '  3. 重跑本脚本'
        }
    }
}

Write-Step '全部完成'
Write-Ok "请重启 ComfyUI 让新模型生效"
