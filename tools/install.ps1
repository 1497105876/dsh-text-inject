# @gw/dsh-text-inject installer (Windows / PowerShell).
# Picks the plugin git tag that matches the local dsh version, then copies it into
# the chosen profile's node_modules/@gw/.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools/install.ps1            # web profile
#   powershell -ExecutionPolicy Bypass -File tools/install.ps1 desktop    # desktop profile

param(
  [string]$Profile = "web"
)

$ErrorActionPreference = "Stop"
$Repo   = "https://github.com/1497105876/dsh-text-inject.git"
$Pkg    = "@gw/dsh-text-inject"

function Get-DshVersion {
  $v = ""
  try { $v = (dsh --version 2>$null | Select-Object -First 1).Trim() } catch {}
  if (-not $v) {
    try {
      $g = (npm ls -g @deepseek-ai/dsh 2>$null) -join "`n"
      if ($g -match '(\d+\.\d+\.\d+(-(rc|alpha)\.\d+)?)') { $v = $matches[1] }
    } catch {}
  }
  return $v
}

function Select-Tag($ver) {
  if ($ver -like "0.2.0*" -or $ver -like "0.2.*") { return "dsh-0.2.0-rc.2" }
  if ($ver -like "0.1.*" -or $ver -eq "")        { return "dsh-0.1.x" }
  return "dsh-0.2.0-rc.2"   # unknown -> latest locked
}

$V   = Get-DshVersion
$Tag = Select-Tag $V
Write-Host "Detected dsh version: $($V -or 'unknown')  ->  plugin tag: $Tag"

# Resolve source
$root = Resolve-Path "." -ErrorAction SilentlyContinue
$inRepo = Test-Path (Join-Path $root "package.json")
if ($inRepo -and ((Get-Content (Join-Path $root "package.json") -Raw) -match '"@gw/dsh-text-inject"')) {
  Write-Host "Inside the repo: installing your current checked-out version (confirm it is $Tag)."
  $Src = $root.Path
} else {
  Write-Host "Cloning $Tag ..."
  $tmp = Join-Path $env:TEMP ("dsh-text-inject-" + [guid]::NewGuid().ToString("N"))
  git clone --depth 1 --branch $Tag $Repo $tmp 2>$null
  if (-not (Test-Path $tmp)) { git clone --branch $Tag $Repo $tmp }
  $Src = $tmp
}

# Copy into profile
$Target = Join-Path $HOME ".dsh/profiles/$Profile/node_modules/@gw/dsh-text-inject"
New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null
if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
Copy-Item $Src $Target -Recurse -Force
Remove-Item (Join-Path $Target ".git") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Target "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Installed to: $Target"

# Ensure cordis.patch.yml has the insert entry
$Patch = Join-Path $HOME ".dsh/profiles/$Profile/cordis.patch.yml"
$needsEntry = $true
if (Test-Path $Patch) {
  $p = Get-Content $Patch -Raw
  if ($p -match "gw-text-inject") { $needsEntry = $false }
}
if ($needsEntry) {
  Write-Host ""
  Write-Host "Add this entry to $Patch (restart dsh to apply):"
  Write-Host "  - insert:"
  Write-Host "      - id: gw-text-inject"
  Write-Host "        name: '@gw/dsh-text-inject'"
} else {
  Write-Host "cordis.patch.yml already references gw-text-inject."
}

Write-Host ""
Write-Host "Done. Restart dsh ($Profile), open Settings -> left sidebar '文字注入'."
