# sync-web-to-cloud.ps1
# -----------------------------------------------------------------------------
# Mirror tested changes from web/ (local-iteration variant) into web-cloud/
# (container-shipped variant). Preserves cloud-only files.
#
# Iterate locally in web/ → run this → npm run build in web-cloud/ → ship.
# -----------------------------------------------------------------------------

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo  = Split-Path -Parent $PSScriptRoot
$src   = Join-Path $repo 'web'
$dst   = Join-Path $repo 'web-cloud'

if (-not (Test-Path $src)) { throw "Missing source: $src" }
if (-not (Test-Path $dst)) { throw "Missing destination: $dst" }

# Files/dirs that must NEVER be overwritten in web-cloud — these are the
# cloud-only deltas that define the variant's identity.
$cloudOnly = @(
    'src\app\api\image\[...path]\route.ts',  # MI-auth blob proxy
    'src\lib\imageUrl.ts',                   # different default behaviour
    'src\components\Footer.tsx',             # "· cloud" marker
    '.env.example',                          # cloud env template
    'next.config.mjs',                       # cloud-specific config
    'package.json',                          # different name + deps (@azure/*)
    'package-lock.json',
    'README.md',
    'public\images'                          # cloud uses storage, not bundled
)

# Folders to mirror wholesale (excluding cloud-only carve-outs).
$mirrorRoots = @('src', 'public')

# Top-level files to mirror as-is.
$mirrorFiles = @(
    'tsconfig.json',
    'tailwind.config.mjs',
    'postcss.config.mjs',
    'next-env.d.ts'
)

$xfArgs = @()
foreach ($rel in $cloudOnly) {
    $abs = Join-Path $dst $rel
    if (Test-Path $abs -PathType Leaf) {
        $xfArgs += '/XF'
        $xfArgs += $abs
    }
}
$xdArgs = @()
foreach ($rel in $cloudOnly) {
    $abs = Join-Path $dst $rel
    if (Test-Path $abs -PathType Container) {
        $xdArgs += '/XD'
        $xdArgs += $abs
    }
}
# Always exclude build artifacts and deps from mirroring.
$xdArgs += '/XD'; $xdArgs += (Join-Path $src 'node_modules')
$xdArgs += '/XD'; $xdArgs += (Join-Path $src '.next')

$mode = if ($DryRun) { '/L' } else { $null }

Write-Host "==> Mirroring web/ → web-cloud/" -ForegroundColor Cyan
foreach ($root in $mirrorRoots) {
    $from = Join-Path $src $root
    $to   = Join-Path $dst $root
    Write-Host "  - $root/" -ForegroundColor DarkCyan
    $args = @($from, $to, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP') + $xfArgs + $xdArgs
    if ($mode) { $args = @($mode) + $args }
    & robocopy @args | Out-Null
    # robocopy exit codes 0-7 are success; 8+ are real errors
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $root (code $LASTEXITCODE)" }
}

Write-Host "==> Mirroring shared root files" -ForegroundColor Cyan
foreach ($f in $mirrorFiles) {
    $from = Join-Path $src $f
    $to   = Join-Path $dst $f
    if (-not (Test-Path $from)) { continue }
    if ($DryRun) {
        Write-Host "  - would copy $f"
    } else {
        Copy-Item -Force -LiteralPath $from -Destination $to
        Write-Host "  - $f"
    }
}

Write-Host ""
Write-Host "Preserved cloud-only files:" -ForegroundColor Yellow
foreach ($rel in $cloudOnly) { Write-Host "  · $rel" }

Write-Host ""
if ($DryRun) {
    Write-Host "Dry run complete. Re-run without -DryRun to apply." -ForegroundColor Green
} else {
    Write-Host "Done. Next steps:" -ForegroundColor Green
    Write-Host "  cd web-cloud"
    Write-Host "  npm run build     # validate cloud variant"
    Write-Host "  git diff --stat   # review the mirror"
}
