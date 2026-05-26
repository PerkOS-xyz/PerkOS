#!/usr/bin/env bash
# ops/runbooks/scripts/firestore-export.sh
#
# Daily Firestore export to GCS. Designed to run as a cron on the
# app VPS (or anywhere with gcloud + a Firebase service account that
# has datastore.databases.export). See ops/runbooks/DR.md for the
# import procedure that consumes these exports.
#
# Layout in the bucket:
#   gs://perkos-firestore-backups/<UTC-YYYYMMDD-HHMM>/
#     metadata.json
#     all_namespaces/
#       kind_*/
#         output-0
#         ...
#
# The bucket's own lifecycle policy keeps:
#   - all exports forever (cheap; ~5 MB / day)
#   - per-object versioning OFF (exports are append-only by timestamp)
#
# Run as:
#   FIREBASE_PROJECT_ID=perkos-app \
#   GOOGLE_APPLICATION_CREDENTIALS=/etc/perkos/firebase-admin.json \
#   /opt/perkos-miniapp/ops/runbooks/scripts/firestore-export.sh
#
# Cron line (UTC) — daily 03:00:
#   0 3 * * * FIREBASE_PROJECT_ID=perkos-app GOOGLE_APPLICATION_CREDENTIALS=/etc/perkos/firebase-admin.json /opt/perkos-miniapp/ops/runbooks/scripts/firestore-export.sh >> /var/log/perkos-firestore-export.log 2>&1
set -euo pipefail

: "${FIREBASE_PROJECT_ID:?required}"
: "${GOOGLE_APPLICATION_CREDENTIALS:?required (path to a Firebase Admin service account JSON)}"

BUCKET="${PERKOS_FIRESTORE_BACKUP_BUCKET:-perkos-firestore-backups}"
TS="$(date -u +%Y%m%d-%H%M)"
URI="gs://${BUCKET}/${TS}/"

log() { printf '[%s] [firestore-export] %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

command -v gcloud >/dev/null || die "gcloud CLI not found on PATH"

log "exporting project=$FIREBASE_PROJECT_ID → $URI"

# `gcloud firestore export` is async: the API returns the operation
# id; the actual job runs on Google's side. --async would let us
# fire-and-forget, but we want to know if it failed, so we don't pass
# --async and let gcloud poll for completion.
gcloud firestore export "$URI" \
  --project="$FIREBASE_PROJECT_ID" \
  --quiet

log "export complete: $URI"

# Optional sanity check: list the metadata file. Exit non-zero if
# the export didn't actually produce one — saves us from "looked
# successful but the backup is empty" failure mode.
if ! gcloud storage ls "${URI}metadata.json" --project="$FIREBASE_PROJECT_ID" >/dev/null 2>&1; then
  die "export reported success but metadata.json is missing at $URI"
fi

log "metadata.json present — backup verified"
