#requires -version 5.1
<#
.SYNOPSIS
  Uncensored Studio - ComfyUI 一键安装脚本（Windows）

.DESCRIPTION
  - 下载 ComfyUI Portable (Windows 预构建包，自带 Python 3.12 + CUDA 12.x)
  - 安装 ComfyUI-Manager（custom_nodes 一键管理器）
  - 安装必备自定义节点（GGUF / WanVideoWrapper / VideoHelperSuite / PuLID-Flux2）
  - 不下载模型（用 download-models.ps1）

.NOTES
  默认安装路径：%USERPROFILE%\ComfyUI
  默认 ComfyUI 端口：8188
  Uncensored Studio 会自动连接 http://127.0.0.1:8188
#>

[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:USERPROFILE 'ComfyUI'),
    [switch]$SkipPortableDownload,
    [switch]$ForceReinstall
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

# ----- 颜色输出 helpers -----
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERR] $msg" -ForegroundColor Red }

Write-Host @"

  ____ ____  _____ ____   __  __     ____ _____ _   _ ____ ___ ___
 / ___/ ___|| ____|  _ \ |  \/  |   / ___|_   _| | | |  _ \_ _/ _ \
| |   \___ \|  _| | | | || |\/| |   \___ \ | | | | | | | | | | | | |
| |___ ___) | |___| |_| || |  | |    ___) || | | |_| | |_| | | |_| |
 \____|____/|_____|____(_)_|  |_|   |____/ |_|  \___/|____/___\___/

  ComfyUI Installer for Uncensored Studio
  Install dir: $InstallDir
"@ -ForegroundColor Magenta

# ----- 1. 环境检查 -----
Write-Step '检查环境'

$nvSmi = Get-Command 'nvidia-smi' -ErrorAction SilentlyContinue
if (-not $nvSmi) {
    Write-Err '未检测到 nvidia-smi。请先安装 NVIDIA 驱动（>= 535）。'
    exit 1
}
$gpuInfo = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>$null
Write-Ok "GPU: $gpuInfo"

$git = Get-Command 'git' -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Err 'Git 未安装。请下载 https://git-scm.com/download/win 并加入 PATH。'
    exit 1
}
Write-Ok "Git: $((& git --version))"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

# ----- 2. 下载 ComfyUI Portable -----
$comfyExe = Join-Path $InstallDir 'ComfyUI_windows_portable\python_embeded\python.exe'
if ((Test-Path $comfyExe) -and -not $ForceReinstall) {
    Write-Ok "ComfyUI Portable 已存在：$InstallDir\ComfyUI_windows_portable"
}
elseif (-not $SkipPortableDownload) {
    Write-Step '下载 ComfyUI Portable（约 1.5 GB，请耐心等待）'

    $apiUrl = 'https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest'
    try {
        $rel = Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'ust-installer' } -TimeoutSec 30
    } catch {
        Write-Err "无法获取最新版本信息：$($_.Exception.Message)"
        Write-Warn '请手动从 https://github.com/comfyanonymous/ComfyUI/releases 下载 *_windows_portable_nvidia.7z 并解压到 $InstallDir'
        exit 1
    }
    $asset = $rel.assets | Where-Object { $_.name -match 'windows_portable.*nvidia.*\.7z$' } | Select-Object -First 1
    if (-not $asset) {
        Write-Err '未在 release 中找到 windows_portable_nvidia.7z'
        exit 1
    }
    $archive = Join-Path $InstallDir $asset.name
    Write-Host "  下载: $($asset.browser_download_url)"
    try {
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -UseBasicParsing
    } catch {
        Write-Err "下载失败：$($_.Exception.Message)"
        exit 1
    }
    Write-Ok "已下载 $($asset.name) ($([math]::Round($asset.size/1MB)) MB)"

    Write-Step '解压（需要 7-Zip）'
    $sevenZip = Get-Command '7z' -ErrorAction SilentlyContinue
    if (-not $sevenZip) {
        $sevenZip = Get-ChildItem 'C:\Program Files\7-Zip\7z.exe' -ErrorAction SilentlyContinue
    }
    if (-not $sevenZip) {
        Write-Err '未找到 7-Zip。请安装 https://www.7-zip.org 或手动解压 ' + $archive
        exit 1
    }
    & $sevenZip x $archive "-o$InstallDir" -y | Out-Null
    Remove-Item $archive
    Write-Ok '解压完成'
}

$portableRoot = Join-Path $InstallDir 'ComfyUI_windows_portable'
$comfyRoot = Join-Path $portableRoot 'ComfyUI'
$pyEmbed = Join-Path $portableRoot 'python_embeded\python.exe'

if (-not (Test-Path $pyEmbed)) {
    Write-Err "找不到内嵌 Python：$pyEmbed"
    exit 1
}

# ----- 3. 安装 ComfyUI-Manager -----
Write-Step '安装 ComfyUI-Manager'
$customNodes = Join-Path $comfyRoot 'custom_nodes'
$managerDir = Join-Path $customNodes 'ComfyUI-Manager'
if (-not (Test-Path $managerDir)) {
    & git clone --depth 1 'https://github.com/Comfy-Org/ComfyUI-Manager' $managerDir 2>&1 | Out-Null
    Write-Ok 'Manager 已安装'
} else {
    Write-Ok 'Manager 已存在，跳过'
}

# ----- 4. 安装常用自定义节点 -----
$nodes = @(
    @{ name = 'ComfyUI-GGUF';              url = 'https://github.com/city96/ComfyUI-GGUF' },
    @{ name = 'ComfyUI-WanVideoWrapper';   url = 'https://github.com/kijai/ComfyUI-WanVideoWrapper' },
    @{ name = 'ComfyUI-VideoHelperSuite';  url = 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite' },
    @{ name = 'comfyui_controlnet_aux';    url = 'https://github.com/Fannovel16/comfyui_controlnet_aux' },
    @{ name = 'ComfyUI-PuLID-Flux-Enhanced'; url = 'https://github.com/sipie800/ComfyUI-PuLID-Flux-Enhanced' },
    @{ name = 'ComfyUI_essentials';        url = 'https://github.com/cubiq/ComfyUI_essentials' }
)

Write-Step '安装自定义节点'
foreach ($n in $nodes) {
    $dst = Join-Path $customNodes $n.name
    if (Test-Path $dst) {
        Write-Ok "$($n.name) 已存在"
        continue
    }
    Write-Host "  克隆 $($n.name) ..."
    try {
        & git clone --depth 1 $n.url $dst 2>&1 | Out-Null
        Write-Ok $n.name

        $req = Join-Path $dst 'requirements.txt'
        if (Test-Path $req) {
            Write-Host "    安装依赖..."
            & $pyEmbed -m pip install -r $req --no-warn-script-location 2>&1 |
                Where-Object { $_ -match 'Successfully|already' } |
                ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
    } catch {
        Write-Warn "$($n.name) 安装失败：$($_.Exception.Message)"
    }
}

# ----- 5. 创建启动脚本（监听 127.0.0.1） -----
Write-Step '创建启动脚本'
$launcher = Join-Path $InstallDir 'start-comfyui.ps1'
@"
#requires -version 5.1
# Uncensored Studio - ComfyUI 启动器
`$ErrorActionPreference = 'Continue'
Set-Location '$comfyRoot'
& '$pyEmbed' main.py --listen 127.0.0.1 --port 8188 --use-pytorch-cross-attention
"@ | Set-Content -Path $launcher -Encoding UTF8
Write-Ok "已生成 $launcher"

# ----- 6. 提示下一步 -----
Write-Step '完成'

Write-Host @"

  下一步：

  1. 下载模型（必做）
     在 PowerShell 中运行：
       .\scripts\download-models.ps1

  2. 启动 ComfyUI
     双击 $launcher
     或在 PowerShell 中：
       & '$launcher'

  3. 启动 Uncensored Studio
     回到 uncensored-studio 目录：
       npm run dev
     浏览器打开：http://localhost:6677

  ComfyUI 模型放置目录：
    Checkpoint:   $comfyRoot\models\checkpoints\
    LoRA:         $comfyRoot\models\loras\
    Flux UNet:    $comfyRoot\models\unet\
    VAE:          $comfyRoot\models\vae\
    CLIP:         $comfyRoot\models\clip\
    Video DiT:    $comfyRoot\models\diffusion_models\
    PuLID:        $comfyRoot\models\pulid\

"@ -ForegroundColor Green
