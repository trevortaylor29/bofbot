# Sync worker runtime files to a droplet (requires OpenSSH scp in PATH).
# Usage: .\deploy\push-worker-to-droplet.ps1 user@146.x.x.x

param(
    [Parameter(Mandatory = $true)]
    [string] $Destination
)

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root
Write-Host "Syncing from $Root to ${Destination}:/opt/bofbot/ ..."

ssh $Destination "mkdir -p /opt/bofbot/worker /opt/bofbot/fonts /opt/bofbot/deploy/systemd"

$files = @("tiktoked.py", "requirements.txt", "requirements-worker.txt", "config.json")
foreach ($f in $files) {
    scp $f "${Destination}:/opt/bofbot/"
}
scp -r worker "${Destination}:/opt/bofbot/"
scp -r fonts "${Destination}:/opt/bofbot/"
if (Test-Path emoji) {
    scp -r emoji "${Destination}:/opt/bofbot/"
}
scp deploy\systemd\bofbot-worker.service "${Destination}:/opt/bofbot/deploy/systemd/"

Write-Host ""
Write-Host "On the droplet: .env from deploy/env.worker.example, then:"
Write-Host "  sudo cp /opt/bofbot/deploy/systemd/bofbot-worker.service /etc/systemd/system/"
Write-Host "  sudo systemctl daemon-reload && sudo systemctl enable --now bofbot-worker"
