<#
.SYNOPSIS
    run-win.ps1 - bootstrap and run the Neon Drone project locally on Windows.

.DESCRIPTION
    1. Verifies Node.js and npm are installed and meet Vite 8's requirements.
    2. Installs npm dependencies if node_modules is missing (or stale).
    3. Starts the Vite dev server (or builds / previews).

.EXAMPLE
    .\run-win.ps1
    Installs dependencies (if needed) and starts the dev server.

.EXAMPLE
    .\run-win.ps1 -Build
    .\run-win.ps1 --build
    Builds the production bundle to dist/

.EXAMPLE
    .\run-win.ps1 -Preview
    .\run-win.ps1 --preview
    Serves the production build locally.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\run-win.ps1
    Recommended if PowerShell script execution is restricted on your system.
#>

[CmdletBinding(DefaultParameterSetName = "Default")]
param(
    [Parameter(Position = 0, ParameterSetName = "Default")]
    [string]$Action,

    [Parameter(ParameterSetName = "Dev")]
    [switch]$Dev,

    [Parameter(ParameterSetName = "Build")]
    [switch]$Build,

    [Parameter(ParameterSetName = "Preview")]
    [switch]$Preview,

    [Parameter(ParameterSetName = "Help")]
    [Alias("h", "?")]
    [switch]$Help
)

$ErrorActionPreference = "Continue"

# Configure console output encoding for clean Unicode symbols
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Ignore if host environment does not permit setting encoding
}

# Always run from the project root, regardless of where the script is invoked from.
Set-Location -LiteralPath $PSScriptRoot

# --- Pretty printing -----------------------------------------------------------
$SYM_INFO = [char]0x203A
$SYM_OK   = [char]0x2713
$SYM_WARN = '!'
$SYM_ERR  = [char]0x2717

function Write-Info([string]$Message) {
    Write-Host "$SYM_INFO " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Ok([string]$Message) {
    Write-Host "$SYM_OK " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn([string]$Message) {
    Write-Host "$SYM_WARN " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Err([string]$Message) {
    Write-Host "$SYM_ERR " -ForegroundColor Red -NoNewline
    Write-Host $Message -ForegroundColor Red
}

function Show-Help {
    Write-Host "Usage: .\run-win.ps1 [-Dev|-Build|-Preview|-Help]"
    Write-Host "       .\run-win.ps1 [--dev|--build|--preview|--help]"
    Write-Host "  (no arg) / -Dev / --dev    Start the Vite dev server (default)"
    Write-Host "  -Build / --build           Build the production bundle to dist/"
    Write-Host "  -Preview / --preview       Serve the production build locally"
    Write-Host "  -Help / --help / -h        Show this help"
    Write-Host ""
    Write-Host "If running scripts is disabled by your Windows PowerShell execution policy:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\run-win.ps1"
}

# --- Action resolution ---------------------------------------------------------
$targetAction = "dev"

if ($Help) {
    $targetAction = "help"
} elseif ($Build) {
    $targetAction = "build"
} elseif ($Preview) {
    $targetAction = "preview"
} elseif ($Dev) {
    $targetAction = "dev"
} elseif (-not [string]::IsNullOrWhiteSpace($Action)) {
    $normalized = $Action.Trim().ToLower()
    switch ($normalized) {
        { $_ -in @("-h", "--help", "help", "-help", "/?", "-?", "/h") } {
            $targetAction = "help"
        }
        { $_ -in @("dev", "--dev", "-dev") } {
            $targetAction = "dev"
        }
        { $_ -in @("build", "--build", "-build") } {
            $targetAction = "build"
        }
        { $_ -in @("preview", "--preview", "-preview") } {
            $targetAction = "preview"
        }
        default {
            $targetAction = "unknown"
        }
    }
}

if ($targetAction -eq "help") {
    Show-Help
    exit 0
}

if ($targetAction -eq "unknown") {
    Write-Err "Unknown action: $Action"
    Write-Host "  Run .\run-win.ps1 --help for usage."
    exit 1
}

# --- Preflight: Node & npm -----------------------------------------------------
Write-Info "Checking prerequisites..."

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js is not installed."
    Write-Host "  Install it via winget:"
    Write-Host "    winget install OpenJS.NodeJS.LTS"
    Write-Host "  Or download from the official site:"
    Write-Host "    https://nodejs.org/"
    Write-Host "  Or use nvm-windows (recommended for version control):"
    Write-Host "    winget install CoreyButler.NVMforWindows"
    exit 1
}

# On Windows, npm.cmd avoids PowerShell ExecutionPolicy restrictions associated with npm.ps1
$npmCmd = $null
$npmExecutable = $null
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    $npmCmd = (Get-Command npm.cmd).Source
    $npmExecutable = "npm.cmd"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmCmd = (Get-Command npm).Source
    $npmExecutable = "npm"
}

if (-not $npmExecutable) {
    Write-Err "npm is not installed (it ships with Node.js). Reinstall Node.js."
    exit 1
}

# Parse `node -v` output (e.g. "v22.14.0") into major/minor.
$nodeRaw = (& node -v 2>$null)
if ($null -eq $nodeRaw) {
    Write-Err "Unable to determine Node.js version."
    exit 1
}
$nodeVersion = $nodeRaw.ToString().Trim().TrimStart('v')
$parts = $nodeVersion.Split('.')
$nodeMajor = 0
$nodeMinor = 0
if ($parts.Length -ge 1) { [int]::TryParse($parts[0], [ref]$nodeMajor) | Out-Null }
if ($parts.Length -ge 2) { [int]::TryParse($parts[1], [ref]$nodeMinor) | Out-Null }

$npmVersionRaw = (& $npmExecutable -v 2>$null)
$npmVersion = if ($null -ne $npmVersionRaw) { $npmVersionRaw.ToString().Trim() } else { "unknown" }

Write-Ok "Node.js v${nodeVersion} found ($($nodeCmd.Source))"
Write-Ok "npm ${npmVersion} found (${npmCmd})"

# Vite 8 requires Node >= 20.19, OR >= 22.12, OR >= 24.
$nodeOk = $false
if ($nodeMajor -gt 24) {
    $nodeOk = $true
} elseif ($nodeMajor -eq 24) {
    $nodeOk = $true
} elseif ($nodeMajor -eq 22 -and $nodeMinor -ge 12) {
    $nodeOk = $true
} elseif ($nodeMajor -eq 20 -and $nodeMinor -ge 19) {
    $nodeOk = $true
}

if (-not $nodeOk) {
    Write-Err "Node.js v${nodeVersion} is too old for Vite 8."
    Write-Host "  Vite 8 requires Node >= 20.19, >= 22.12, or >= 24."
    Write-Host "  Upgrade with nvm-windows:"
    Write-Host "    nvm install 22; nvm use 22"
    Write-Host "  or with winget:"
    Write-Host "    winget upgrade OpenJS.NodeJS.LTS"
    Write-Host "  or download from https://nodejs.org/"
    exit 1
}
Write-Ok "Node version satisfies Vite 8 (>= 20.19 / 22.12 / 24)."

# --- Dependencies --------------------------------------------------------------
Write-Info "Checking dependencies..."

$needsInstall = $false
$nodeModulesDir = Join-Path $PSScriptRoot "node_modules"
$installedLock = Join-Path $nodeModulesDir ".package-lock.json"
$projectLock = Join-Path $PSScriptRoot "package-lock.json"

if (-not (Test-Path -LiteralPath $nodeModulesDir -PathType Container)) {
    $needsInstall = $true
} elseif (-not (Test-Path -LiteralPath $installedLock -PathType Leaf)) {
    $needsInstall = $true
} elseif (Test-Path -LiteralPath $projectLock -PathType Leaf) {
    $projLockItem = Get-Item -LiteralPath $projectLock
    $instLockItem = Get-Item -LiteralPath $installedLock
    if ($projLockItem.LastWriteTimeUtc -gt $instLockItem.LastWriteTimeUtc) {
        Write-Warn "package-lock.json is newer than installed deps."
        $needsInstall = $true
    }
}

if ($needsInstall) {
    # Use `npm install` (not `npm ci`) so an out-of-sync lock file self-heals.
    Write-Info "Installing dependencies via npm install..."
    & $npmExecutable install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed with exit code $LASTEXITCODE."
        exit $LASTEXITCODE
    }
    Write-Ok "Dependencies installed."
} else {
    Write-Ok "Dependencies up to date (node_modules present)."
}

# --- Run the selected action ---------------------------------------------------
switch ($targetAction) {
    "dev" {
        Write-Host ""
        Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
        Write-Host "  Default URL: " -NoNewline
        Write-Host "http://localhost:5173" -ForegroundColor Yellow
        Write-Host "  (If 5173 is busy, Vite picks the next free port - check the output below.)"
        Write-Host "  Press Ctrl+C to stop."
        Write-Host ""
        & $npmExecutable run dev
        exit $LASTEXITCODE
    }
    "build" {
        Write-Host ""
        Write-Host "Building production bundle..." -ForegroundColor Cyan
        & $npmExecutable run build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Build failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Ok "Build complete -> dist/"
        exit 0
    }
    "preview" {
        Write-Host ""
        Write-Host "Previewing production build..." -ForegroundColor Cyan
        Write-Host "  Default URL: " -NoNewline
        Write-Host "http://localhost:4173" -ForegroundColor Yellow
        Write-Host ""
        & $npmExecutable run preview
        exit $LASTEXITCODE
    }
}
