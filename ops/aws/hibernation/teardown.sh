#!/usr/bin/env bash
# ops/aws/hibernation/teardown.sh
#
# DESTROYS the AWS substrate the bootstrap created. Idempotent on
# missing resources. Refuses to run against ENV=prod without an explicit
# I_KNOW_WHAT_IM_DOING=yes guardrail.
#
# Order matters: detach the IAM policy → delete policy → empty + delete
# bucket (including all object versions) → schedule KMS key deletion.
#
# Usage:
#   ENV=dev                         ./teardown.sh                 # OK
#   ENV=prod I_KNOW_WHAT_IM_DOING=yes ./teardown.sh               # nuclear
set -euo pipefail

ENV="${ENV:-dev}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="${AWS_ACCOUNT_ID:-089332276762}"
TASK_ROLE="${TASK_ROLE_NAME:-perkos-spark-ecs-task}"

if [[ "$ENV" == "prod" && "${I_KNOW_WHAT_IM_DOING:-}" != "yes" ]]; then
  echo "Refusing to teardown ENV=prod without I_KNOW_WHAT_IM_DOING=yes" >&2
  exit 2
fi

BUCKET="perkos-agent-snapshots-${ENV}"
KEY_ALIAS="alias/perkos-agent-snapshots-${ENV}"
POLICY_NAME="perkos-agent-snapshots-${ENV}"
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY_NAME}"

log() { printf '[hibernation/teardown] %s\n' "$*" >&2; }

# Detach from role (no-op if not attached).
if aws iam list-attached-role-policies --role-name "$TASK_ROLE" \
    --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}']" \
    --output text 2>/dev/null | grep -q "$POLICY_NAME"; then
  log "detaching $POLICY_NAME from $TASK_ROLE"
  aws iam detach-role-policy --role-name "$TASK_ROLE" --policy-arn "$POLICY_ARN"
fi

# Delete all non-default policy versions, then the policy itself.
if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  for v in $(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
      --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text); do
    log "deleting non-default policy version $v"
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v"
  done
  log "deleting policy $POLICY_NAME"
  aws iam delete-policy --policy-arn "$POLICY_ARN"
fi

# Empty + delete bucket (versioned, so delete-markers too).
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  log "emptying versioned bucket $BUCKET"
  python3 - "$BUCKET" "$REGION" <<'PY'
import json, subprocess, sys
bucket, region = sys.argv[1], sys.argv[2]

def run(*args):
    return subprocess.check_output(["aws", "--region", region, *args])

token = None
while True:
    args = ["s3api", "list-object-versions", "--bucket", bucket, "--max-keys", "1000"]
    if token:
        args += ["--key-marker", token]
    out = json.loads(run(*args) or b"{}")
    payload = {"Objects": []}
    for k in out.get("Versions") or []:
        payload["Objects"].append({"Key": k["Key"], "VersionId": k["VersionId"]})
    for k in out.get("DeleteMarkers") or []:
        payload["Objects"].append({"Key": k["Key"], "VersionId": k["VersionId"]})
    if payload["Objects"]:
        run("s3api", "delete-objects", "--bucket", bucket, "--delete", json.dumps(payload))
    if not out.get("IsTruncated"):
        break
    token = out.get("NextKeyMarker")
PY
  log "deleting bucket $BUCKET"
  aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION"
fi

# Schedule KMS key deletion (7-30d pending window required by AWS).
if KMS_KEY_ID="$(aws kms describe-key --region "$REGION" --key-id "$KEY_ALIAS" \
    --query 'KeyMetadata.KeyId' --output text 2>/dev/null)"; then
  if [[ -n "$KMS_KEY_ID" && "$KMS_KEY_ID" != "None" ]]; then
    log "deleting alias $KEY_ALIAS"
    aws kms delete-alias --region "$REGION" --alias-name "$KEY_ALIAS" || true
    log "scheduling KMS key $KMS_KEY_ID for deletion (7-day pending window)"
    aws kms schedule-key-deletion --region "$REGION" --key-id "$KMS_KEY_ID" --pending-window-in-days 7 >/dev/null
  fi
fi

log "teardown complete"
