# Firestore backups and recovery

Configure the default Firestore database with point-in-time recovery and a daily
backup schedule retained for 35 days (above the 30-day requirement):

```powershell
.\scripts\configure-firestore-backups.ps1 -ProjectId mayoor-cf2e5
```

The script requires the Google Cloud CLI and an authenticated account with
Firestore database and backup-schedule administration permissions. It updates
the specified cloud project; review the target project before running it.

Verify the configuration and backup history:

```powershell
gcloud firestore databases describe --database="(default)" --project=mayoor-cf2e5 --format="value(pointInTimeRecoveryEnable)"
gcloud firestore backups schedules list --database="(default)" --project=mayoor-cf2e5
$location = gcloud firestore databases describe --database="(default)" --project=mayoor-cf2e5 --format="value(locationId)"
gcloud firestore backups list --location=$location --project=mayoor-cf2e5 --format="table(name,database,state,expireTime)"
```

The daily schedule creates backups asynchronously; the history command shows
completed snapshots after the first scheduled run. Backup storage and restores
may incur Google Cloud charges.

See Google's [Firestore backup documentation](https://cloud.google.com/firestore/docs/backups)
and [database update command](https://cloud.google.com/sdk/gcloud/reference/firestore/databases/update).
