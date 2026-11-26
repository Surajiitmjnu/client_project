param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ProjectId
)

$ErrorActionPreference = "Stop"
$gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCommand) {
  throw "Google Cloud CLI (gcloud) is required. Install it and authenticate before running this script."
}
$script:GcloudExecutable = $gcloudCommand.Source

function Invoke-Gcloud {
  param([string[]]$Arguments)

  $output = & $script:GcloudExecutable @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
  }
  return $output
}

$databaseId = "(default)"
$databaseJson = Invoke-Gcloud -Arguments @(
  "firestore", "databases", "describe",
  "--database=$databaseId", "--project=$ProjectId", "--format=json"
)
$database = ($databaseJson -join [Environment]::NewLine) | ConvertFrom-Json
if (-not $database.locationId) {
  throw "Firestore database $databaseId was not found or has no location."
}

$null = Invoke-Gcloud -Arguments @(
  "firestore", "databases", "update",
  "--database=$databaseId", "--project=$ProjectId", "--enable-pitr", "--quiet"
)

$scheduleJson = Invoke-Gcloud -Arguments @(
  "firestore", "backups", "schedules", "list",
  "--database=$databaseId", "--project=$ProjectId", "--format=json"
)
$scheduleOutput = $scheduleJson -join [Environment]::NewLine
$schedules = if ([string]::IsNullOrWhiteSpace($scheduleOutput)) {
  @()
} else {
  @($scheduleOutput | ConvertFrom-Json)
}
$dailySchedule = $schedules |
  Where-Object { $_.dailyRecurrence -ne $null } |
  Select-Object -First 1

if ($dailySchedule) {
  $scheduleId = ([string]$dailySchedule.name -split "/")[-1]
  $null = Invoke-Gcloud -Arguments @(
    "firestore", "backups", "schedules", "update",
    "--database=$databaseId", "--backup-schedule=$scheduleId",
    "--retention=35d", "--project=$ProjectId", "--quiet"
  )
} else {
  $null = Invoke-Gcloud -Arguments @(
    "firestore", "backups", "schedules", "create",
    "--database=$databaseId", "--recurrence=daily",
    "--retention=35d", "--project=$ProjectId", "--quiet"
  )
}

$databaseJson = Invoke-Gcloud -Arguments @(
  "firestore", "databases", "describe",
  "--database=$databaseId", "--project=$ProjectId", "--format=json"
)
$database = ($databaseJson -join [Environment]::NewLine) | ConvertFrom-Json
if ($database.pointInTimeRecoveryEnable -ne $true) {
  throw "Firestore point-in-time recovery could not be verified as enabled."
}

$scheduleJson = Invoke-Gcloud -Arguments @(
  "firestore", "backups", "schedules", "list",
  "--database=$databaseId", "--project=$ProjectId", "--format=json"
)
$schedules = @(($scheduleJson -join [Environment]::NewLine) | ConvertFrom-Json)
$dailySchedule = $schedules |
  Where-Object { $_.dailyRecurrence -ne $null } |
  Select-Object -First 1
if (-not $dailySchedule) {
  throw "A daily Firestore backup schedule could not be verified."
}

$retention = [string]$dailySchedule.retention
if ($retention -match "^(?<seconds>\d+(?:\.\d+)?)s$") {
  $retentionSeconds = [double]$Matches.seconds
} elseif ($retention -match "^(?<days>\d+)d$") {
  $retentionSeconds = [double]$Matches.days * 86400
} else {
  throw "Could not verify the backup retention value '$retention'."
}
if ($retentionSeconds -lt (30 * 24 * 60 * 60)) {
  throw "Daily backup retention is less than the required 30 days."
}

Write-Output "Verified Firestore point-in-time recovery is enabled."
Write-Output "Verified daily backup retention: $retention."
Write-Output "Database location: $($database.locationId)."
Write-Output "Backup history will show the first scheduled snapshot after the schedule runs."
