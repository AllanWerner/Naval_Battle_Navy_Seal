param(
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$EnvFile = ".env",
  [string]$Service = "api",
  [string]$Url = "http://api:4000/travail",
  [int]$Requests = 300,
  [int]$Concurrency = 20,
  [string[]]$Scales = @("1", "3"),
  [int]$WarmupSeconds = 20
)

$ErrorActionPreference = "Stop"

function Invoke-Compose {
  param([string[]]$ComposeArgs)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & docker compose -f $ComposeFile --env-file $EnvFile @ComposeArgs *> $null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "docker compose failed: $($ComposeArgs -join ' ')"
  }
}

$nodeCode = @'
const [url, totalArg, concurrencyArg] = process.argv.slice(1);
const total = Number(totalArg || 300);
const concurrency = Number(concurrencyArg || 20);
let next = 0;
let ok = 0;
let failed = 0;

async function worker() {
  while (true) {
    const current = next++;
    if (current >= total) return;

    try {
      const response = await fetch(url);
      if (response.ok) ok++;
      else failed++;
    } catch {
      failed++;
    }
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const seconds = (performance.now() - started) / 1000;

console.log(JSON.stringify({
  url,
  total,
  concurrency,
  ok,
  failed,
  seconds: Number(seconds.toFixed(3)),
  ok_per_second: Number((ok / seconds).toFixed(2))
}, null, 2));
'@

$parsedScales = @(
  $Scales |
    ForEach-Object { $_ -split "[,\s]+" } |
    Where-Object { $_ } |
    ForEach-Object { [int]$_ }
)

if (-not $parsedScales) {
  throw "No scale value provided. Example: -Scales `"1,3`""
}

$results = foreach ($scale in $parsedScales) {
  Write-Host "Scaling $Service=$scale..."
  Invoke-Compose @("up", "-d", "--scale", "$Service=$scale")
  Start-Sleep -Seconds $WarmupSeconds

  $json = & docker compose -f $ComposeFile --env-file $EnvFile exec -T front node -e $nodeCode $Url $Requests $Concurrency
  if ($LASTEXITCODE -ne 0) {
    throw "measurement failed for scale $scale"
  }

  $result = ($json -join "`n") | ConvertFrom-Json
  [PSCustomObject]@{
    Scale = $scale
    Total = $result.total
    Ok = $result.ok
    Failed = $result.failed
    Seconds = $result.seconds
    OkPerSecond = $result.ok_per_second
  }
}

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "Markdown a reporter dans docs/CARNET_FLOTTE.md:"
Write-Host "| scale | total | ok | failed | seconds | ok/s |"
Write-Host "|---:|---:|---:|---:|---:|---:|"
foreach ($result in $results) {
  Write-Host "| $($result.Scale) | $($result.Total) | $($result.Ok) | $($result.Failed) | $($result.Seconds) | $($result.OkPerSecond) |"
}
