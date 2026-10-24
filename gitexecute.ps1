<#
.SYNOPSIS
    gitexecute.ps1 - safe commit pipeline for Windows:
    lint -> pull (rebase) -> bump version -> build -> audit -> commit -> push

.DESCRIPTION
    1. Validates commit message argument.
    2. Runs eslint (lint).
    3. Pulls latest changes with rebase.
    4. Auto-bumps the display version in index.html (e.g. V_1.22 -> V_1.23)
       and updates the cache version in public/sw.js to prevent browser cache retention.
    5. Runs production build (vite build) to ensure compilation succeeds with new version.
    6. Runs npm security audit.
    7. Stages all changes, commits, and pushes to remote.

.EXAMPLE
    .\gitexecute.ps1 "Your commit message"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$CommitMessage
)

$ErrorActionPreference = "Continue"

# Configure console output encoding for clean Unicode symbols
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# Always run from the project root, regardless of where invoked
Set-Location -LiteralPath $PSScriptRoot

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
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "$SYM_WARN " -ForegroundColor Yellow -NoNewline
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "$SYM_ERR " -ForegroundColor Red -NoNewline
    Write-Host $Message -ForegroundColor Red
}

# --- 1. Require a commit message ----------------------------------------------
if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    Write-Err "Error: commit message is required."
    Write-Host "    Usage: .\gitexecute.ps1 `"your commit message`""
    exit 1
}

# Resolve npm executable (npm.cmd on Windows avoids ExecutionPolicy issues with npm.ps1)
$npmCmd = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

# --- 2. Lint (security + bad-code checks) --------------------------------------
Write-Info "Running lint..."
& $npmCmd run lint
if ($LASTEXITCODE -ne 0) {
    Write-Err "Lint failed. Fix errors before committing."
    exit 1
}
Write-Ok "Lint passed."

# --- 3. Pull latest (rebase to keep history linear) ----------------------------
Write-Info "Pulling latest changes..."
# Stash any working-tree changes so the rebase can proceed cleanly, then restore them afterwards.
git stash --include-untracked --quiet
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Err "git pull --rebase failed. Please resolve merge conflicts."
    git stash pop --quiet 2>$null
    exit 1
}
git stash pop --quiet 2>$null

# --- 4. Auto-bump version in index.html and public/sw.js (cache-busting) -------
Write-Info "Bumping version in index.html..."

$indexPath = Join-Path $PSScriptRoot "index.html"
$newVersion = $null
if (Test-Path -LiteralPath $indexPath) {
    $indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
    if ($indexContent -match 'V_(\d+)\.(\d+)') {
        $currentVersion = $Matches[0]
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        $newMinor = $minor + 1
        $newVersion = "V_${major}.${newMinor}"

        $indexContent = $indexContent.Replace($currentVersion, $newVersion)
        [System.IO.File]::WriteAllText($indexPath, $indexContent, [System.Text.Encoding]::UTF8)
        Write-Ok "Version bumped in index.html: $currentVersion -> $newVersion"

        # Update cache name in public/sw.js to prevent browser cache retention
        $swPath = Join-Path $PSScriptRoot "public\sw.js"
        if (Test-Path -LiteralPath $swPath) {
            $swContent = [System.IO.File]::ReadAllText($swPath, [System.Text.Encoding]::UTF8)
            $newSwContent = [System.Text.RegularExpressions.Regex]::Replace(
                $swContent,
                "const CACHE_NAME = ['`"].*?['`"];",
                "const CACHE_NAME = 'neon-drone-cache-$newVersion';"
            )
            if ($newSwContent -ne $swContent) {
                [System.IO.File]::WriteAllText($swPath, $newSwContent, [System.Text.Encoding]::UTF8)
                Write-Ok "Service worker cache updated in public\sw.js: neon-drone-cache-$newVersion"
            }
        }
    } else {
        Write-Warn "Could not find a V_X.Y version string in index.html - skipping bump."
    }
} else {
    Write-Err "index.html not found!"
    exit 1
}

# --- 5. Production build (catches compile / import errors with new version) -----
Write-Info "Running production build..."
& $npmCmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Err "Build failed. Fix errors before committing."
    exit 1
}
Write-Ok "Build passed."

# --- 6. Security audit (block on high/critical vulnerabilities) ----------------
Write-Info "Running security audit..."
& $npmCmd audit --audit-level high
if ($LASTEXITCODE -ne 0) {
    Write-Err "Security audit found high/critical vulnerabilities. Run 'npm audit fix' first."
    exit 1
}
Write-Ok "Security audit passed."

# --- 7. Stage everything -------------------------------------------------------
Write-Info "Staging all changes..."
git add -A

# Bail out gracefully if there is nothing to commit
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Info "Nothing to commit - working tree is clean."
    exit 0
}

# --- 8. Commit -----------------------------------------------------------------
Write-Info "Committing: $CommitMessage"
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Err "Commit failed."
    exit 1
}

# --- 9. Push -------------------------------------------------------------------
Write-Info "Pushing to remote..."
git push
if ($LASTEXITCODE -ne 0) {
    Write-Err "Push failed."
    exit 1
}

Write-Ok "All done! Version $newVersion successfully committed and pushed."
