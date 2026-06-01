#requires -version 5.1
<#
.SYNOPSIS
  把 staging 目录里的模型移动/硬链接到 ComfyUI 的 models 目录
#>

[CmdletBinding()]
param(
    [string]$ComfyRoot = 'E:/AI-Tools/ComfyUI/ComfyUI_windows_portable/ComfyUI',
    [string]$StagingDir = 'E:/AI-Tools/models-staging'
)

$ErrorActionPreference = 'Continue'

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }

if (-not (Test-Path $ComfyRoot)) {
    Write-Host "ERROR: ComfyUI not found at $ComfyRoot" -ForegroundColor Red
    exit 1
}

$mapping = @(
    @{ src = 'noobai-xl-vpred-1.0.safetensors'; dst = 'models/checkpoints' },
    @{ src = 'wan22-ti2v-5b-q4.gguf';            dst = 'models/diffusion_models' },
    @{ src = 'umt5_xxl_fp8.safetensors';          dst = 'models/text_encoders' },
    @{ src = 'wan_2.1_vae.safetensors';           dst = 'models/vae' }
)

Step "Linking models from $StagingDir to $ComfyRoot"

foreach ($m in $mapping) {
    $srcPath = Join-Path $StagingDir $m.src
    $dstDir = Join-Path $ComfyRoot $m.dst
    $dstPath = Join-Path $dstDir $m.src

    if (-not (Test-Path $srcPath)) {
        Warn "$($m.src) not in staging (yet)"
        continue
    }
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }
    if (Test-Path $dstPath) {
        Ok "$($m.src) already at destination"
        continue
    }

    # Hard link if same volume, else move
    try {
        cmd /c mklink /H "$dstPath" "$srcPath" 2>&1 | Out-Null
        if (Test-Path $dstPath) {
            Ok "Hard-linked $($m.src) -> $($m.dst)"
        } else {
            Move-Item -Path $srcPath -Destination $dstPath
            Ok "Moved $($m.src) -> $($m.dst)"
        }
    } catch {
        Move-Item -Path $srcPath -Destination $dstPath
        Ok "Moved (fallback) $($m.src) -> $($m.dst)"
    }
}

Step 'Done. Reset extra_model_paths.yaml if needed.'
