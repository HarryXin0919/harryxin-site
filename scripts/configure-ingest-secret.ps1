param(
    [Parameter(Mandatory = $true)]
    [string]$PublisherRoot,

    [string]$Endpoint = "https://pending.invalid/api/rlcard/status",

    [switch]$ReuseExisting
)

$ErrorActionPreference = "Stop"
$EnvFile = Join-Path $PublisherRoot ".env.telemetry"

function Get-ExistingToken {
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        throw "Cannot reuse a token because $EnvFile does not exist."
    }

    $TokenLine = Get-Content -LiteralPath $EnvFile |
        Where-Object { $_ -like "RLCARD_INGEST_TOKEN=*" } |
        Select-Object -First 1
    if (-not $TokenLine) {
        throw "Cannot reuse a token because RLCARD_INGEST_TOKEN is missing."
    }

    return $TokenLine.Substring("RLCARD_INGEST_TOKEN=".Length)
}

if ($ReuseExisting) {
    $Token = Get-ExistingToken
} else {
    $Bytes = New-Object byte[] 32
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Rng.GetBytes($Bytes)
    } finally {
        $Rng.Dispose()
    }
    $Token = [Convert]::ToBase64String($Bytes)
    $Token = $Token.TrimEnd("=").Replace("+", "-").Replace("/", "_")

    $ProjectFile = Join-Path $PSScriptRoot "..\.vercel\project.json"
    if (-not (Test-Path -LiteralPath $ProjectFile)) {
        throw "Run 'vercel link' before configuring the ingest secret."
    }
    $Project = Get-Content -LiteralPath $ProjectFile -Raw | ConvertFrom-Json

    $AuthFile = Join-Path $env:APPDATA "xdg.data\com.vercel.cli\auth.json"
    if (-not (Test-Path -LiteralPath $AuthFile)) {
        throw "Vercel CLI authentication was not found. Run 'vercel login'."
    }
    $VercelAuth = Get-Content -LiteralPath $AuthFile -Raw | ConvertFrom-Json

    $Headers = @{
        Authorization = "Bearer $($VercelAuth.token)"
        "Content-Type" = "application/json"
    }
    $Body = @{
        key = "RLCARD_INGEST_TOKEN"
        value = $Token
        type = "sensitive"
        target = @("preview", "production")
        comment = "Bearer token used by the local RLCard telemetry publisher."
    } | ConvertTo-Json
    $TeamId = [Uri]::EscapeDataString($Project.orgId)
    $ProjectId = [Uri]::EscapeDataString($Project.projectId)
    $Uri = "https://api.vercel.com/v10/projects/$ProjectId/env?upsert=true&teamId=$TeamId"

    Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -Body $Body | Out-Null
}

$Contents = @(
    "RLCARD_STATUS_ENDPOINT=$Endpoint"
    "RLCARD_INGEST_TOKEN=$Token"
) -join [Environment]::NewLine

[IO.File]::WriteAllText(
    $EnvFile,
    $Contents + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false)
)

Write-Output "Publisher configuration updated without displaying the secret."
