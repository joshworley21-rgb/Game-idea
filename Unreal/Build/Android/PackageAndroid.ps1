param(
    [ValidateSet("Development", "Shipping")]
    [string]$Configuration = "Development",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

if (-not $env:UE_ROOT) {
    throw "Set UE_ROOT to the installed Unreal Engine directory, for example C:\Program Files\Epic Games\UE_5.4"
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$ProjectFile = Join-Path $ProjectRoot "PresidentSimulator.uproject"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $ProjectRoot "Releases/Android"
}

$RunUAT = Join-Path $env:UE_ROOT "Engine/Build/BatchFiles/RunUAT.bat"
if (-not (Test-Path $RunUAT)) {
    throw "RunUAT.bat was not found under UE_ROOT: $RunUAT"
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

& $RunUAT BuildCookRun `
    "-project=$ProjectFile" `
    -noP4 `
    -platform=Android `
    "-clientconfig=$Configuration" `
    -build `
    -cook `
    -stage `
    -pak `
    -package `
    -archive `
    "-archivedirectory=$OutputDirectory" `
    -utf8output

if ($LASTEXITCODE -ne 0) {
    throw "Unreal Android packaging failed with exit code $LASTEXITCODE"
}

Write-Host "Android package written to $OutputDirectory"
