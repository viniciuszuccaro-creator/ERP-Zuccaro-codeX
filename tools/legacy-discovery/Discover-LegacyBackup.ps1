[CmdletBinding()]
param([string]$ConfigPath = 'config/legacy-backup.example.json', [string]$ReportPath = '')
$ErrorActionPreference = 'Stop'
$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
if (-not $config.readOnly -or $config.allowFixedDriveLetter) { throw 'Configuracao insegura: somente leitura sem letra fixa e obrigatoria.' }
$volumes = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3 }
$candidates = foreach ($volume in $volumes) {
  $path = Join-Path $volume.DeviceID $config.folderName
  if (Test-Path -LiteralPath $path -PathType Container) {
    $files = Get-ChildItem -LiteralPath $path -File -Recurse -Force -ErrorAction Stop
    $byExtension = $files | Group-Object { if ($_.Extension) { $_.Extension.ToLowerInvariant() } else { '[none]' } } | ForEach-Object { [pscustomobject]@{ extension=$_.Name; count=$_.Count; bytes=[int64](($_.Group | Measure-Object Length -Sum).Sum) } }
    [pscustomobject]@{ volume=$volume.DeviceID; volumeName=$volume.VolumeName; fileSystem=$volume.FileSystem; driveType=$volume.DriveType; totalBytes=[int64]$volume.Size; freeBytes=[int64]$volume.FreeSpace; discoveredAt=(Get-Date).ToUniversalTime().ToString('o'); fileCount=$files.Count; extensions=$byExtension }
  }
}
$report = [pscustomobject]@{ schemaVersion=1; folderName=$config.folderName; candidates=@($candidates); notes=@('Relatorio agregado: nao inclui caminhos internos, nomes de arquivos, conteudo, PII ou hashes de arquivos reais.') }
$json = $report | ConvertTo-Json -Depth 6
if ($ReportPath) { $parent=Split-Path -Parent $ReportPath; if($parent){New-Item -ItemType Directory -Force $parent|Out-Null}; Set-Content -LiteralPath $ReportPath -Value $json -Encoding utf8 } else { $json }
