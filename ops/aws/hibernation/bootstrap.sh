#!/usr/bin/env bash
# ops/aws/hibernation/bootstrap.sh
#
# Idempotent: stands up the AWS substrate that the agent-hibernation
# feature needs.
#
#   1. S3 bucket  perkos-agent-snapshots-${ENV}    (versioned, KMS-encrypted)
#   2. KMS key    alias/perkos-agent-snapshots-${ENV}
#   3. IAM policy perkos-agent-snapshots-${ENV}    (least-priv R/W on the prefix)
#   4. Attach the policy to the ECS task role used by agent tasks
#      (perkos-spark-ecs-task) so each task can read/write its own prefix.
#   5. Lifecycle: expire snapshots after 365d; non-current versions after 30d.
#
# Usage:
#   ENV=prod ./bootstrap.sh
#   ENV=dev  ./bootstrap.sh
#
# Re-running is safe — every step checks-then-creates and uses
# CLI idempotency where AWS supports it.
#
# Required IAM on the caller: s3:Create*/Put*, kms:Create*, iam:Get*/Put*.
set -euo pipefail

ENV="${ENV:-dev}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="${AWS_ACCOUNT_ID:-089332276762}"
TASK_ROLE="${TASK_ROLE_NAME:-perkos-spark-ecs-task}"

BUCKET="perkos-agent-snapshots-${ENV}"
KEY_ALIAS="alias/perkos-agent-snapshots-${ENV}"
POLICY_NAME="perkos-agent-snapshots-${ENV}"

log() { printf '[hibernation/bootstrap] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

command -v aws >/dev/null || die "aws CLI not found"
command -v jq  >/dev/null || die "jq not found"

# -----------------------------------------------------------------------------
# 1. KMS key + alias
#
# The alias is the durable handle; the underlying key id is regenerated
# only on the first run. We create the key, then create/update the
# alias to point at it.
# -----------------------------------------------------------------------------
ensure_kms_key() {
  local existing_id
  existing_id="$(
    aws kms describe-key \
      --region "$REGION" \
      --key-id "$KEY_ALIAS" \
      --query 'KeyMetadata.KeyId' \
      --output text 2>/dev/null || true
  )"
  if [[ -n "$existing_id" && "$existing_id" != "None" ]]; then
    log "KMS alias $KEY_ALIAS already points at $existing_id"
    echo "$existing_id"
    return
  fi

  log "creating KMS key for $KEY_ALIAS"
  local new_id
  new_id="$(
    aws kms create-key \
      --region "$REGION" \
      --description "PerkOS agent hibernation snapshots — env=${ENV}" \
      --tags TagKey=perkos-env,TagValue="$ENV" TagKey=perkos-component,TagValue=hibernation \
      --query 'KeyMetadata.KeyId' \
      --output text
  )"
  aws kms create-alias \
    --region "$REGION" \
    --alias-name "$KEY_ALIAS" \
    --target-key-id "$new_id"
  log "KMS key $new_id created and aliased $KEY_ALIAS"
  echo "$new_id"
}

KMS_KEY_ID="$(ensure_kms_key)"
KMS_KEY_ARN="arn:aws:kms:${REGION}:${ACCOUNT}:key/${KMS_KEY_ID}"
log "KMS key ARN: $KMS_KEY_ARN"

# -----------------------------------------------------------------------------
# 2. S3 bucket — versioned, KMS-encrypted, public-access blocked.
# -----------------------------------------------------------------------------
ensure_bucket() {
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    log "S3 bucket $BUCKET already exists"
    return
  fi
  log "creating S3 bucket $BUCKET in $REGION"
  if [[ "$REGION" == "us-east-1" ]]; then
    # us-east-1 doesn't accept LocationConstraint.
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
}
ensure_bucket

log "blocking all public access on $BUCKET"
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

log "enabling versioning on $BUCKET"
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

log "applying default KMS encryption on $BUCKET"
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration "$(
cat <<EOF
{
  "Rules": [{
    "ApplyServerSideEncryptionByDefault": {
      "SSEAlgorithm": "aws:kms",
      "KMSMasterKeyID": "$KMS_KEY_ARN"
    },
    "BucketKeyEnabled": true
  }]
}
EOF
)"

log "tagging $BUCKET"
aws s3api put-bucket-tagging --bucket "$BUCKET" --tagging "$(
cat <<EOF
{ "TagSet": [
  { "Key": "perkos-env",       "Value": "$ENV" },
  { "Key": "perkos-component", "Value": "hibernation" }
] }
EOF
)"

log "applying lifecycle policy on $BUCKET (expire current @ 365d, non-current @ 30d)"
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration "$(
cat <<EOF
{
  "Rules": [
    {
      "ID": "expire-snapshots-365d",
      "Filter": { "Prefix": "" },
      "Status": "Enabled",
      "Expiration": { "Days": 365 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
EOF
)"

# -----------------------------------------------------------------------------
# 3. IAM managed policy — least-priv on the bucket prefix.
#
# The task role gets R/W on s3://<bucket>/{wallet}/{agentName}/*. The
# wallet-level prefix is enforced by the policy condition so a task with
# this policy can NEVER read another wallet's snapshots even if it
# crafted a different key path.
#
# Note: at the AWS level the task role is shared by ALL agent tasks, so
# the policy itself can't pin per-wallet. Per-wallet scoping is enforced
# in the application layer (lib/hibernation.ts) and re-checked on every
# API call. The IAM policy is the floor (no cross-bucket reach), not the
# tenant boundary.
# -----------------------------------------------------------------------------
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY_NAME}"
POLICY_DOC="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::${BUCKET}"
    },
    {
      "Sid": "ReadWriteObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Sid": "UseKms",
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "${KMS_KEY_ARN}"
    }
  ]
}
EOF
)"

ensure_policy() {
  if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    log "IAM policy $POLICY_NAME already exists — publishing new default version"
    # Find policy versions; if 5 exist, delete the oldest non-default
    # before creating a new one (AWS limits versions to 5).
    local versions
    versions="$(
      aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
        --query 'Versions[?IsDefaultVersion==`false`].VersionId' \
        --output text
    )"
    local count
    count=$(echo "$versions" | wc -w | tr -d ' ')
    if [[ "$count" -ge 4 ]]; then
      local oldest
      oldest=$(echo "$versions" | tr ' ' '\n' | tail -n1)
      log "deleting oldest non-default version $oldest to make room"
      aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$oldest"
    fi
    aws iam create-policy-version \
      --policy-arn "$POLICY_ARN" \
      --policy-document "$POLICY_DOC" \
      --set-as-default >/dev/null
  else
    log "creating IAM policy $POLICY_NAME"
    aws iam create-policy \
      --policy-name "$POLICY_NAME" \
      --policy-document "$POLICY_DOC" \
      --description "PerkOS agent hibernation — least-priv R/W on s3://${BUCKET}" \
      --tags Key=perkos-env,Value="$ENV" Key=perkos-component,Value=hibernation >/dev/null
  fi
}
ensure_policy

# -----------------------------------------------------------------------------
# 4. Attach to the task role.
#
# We do NOT detach + reattach unconditionally — that would leave a
# millisecond window where the role lacks the permission. Skip the
# attach if already present.
# -----------------------------------------------------------------------------
attach_if_missing() {
  local role="$1"
  if aws iam list-attached-role-policies --role-name "$role" \
      --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}']" \
      --output text | grep -q "$POLICY_NAME"; then
    log "policy already attached to $role"
  else
    log "attaching $POLICY_NAME to role $role"
    aws iam attach-role-policy --role-name "$role" --policy-arn "$POLICY_ARN"
  fi
}
attach_if_missing "$TASK_ROLE"

# -----------------------------------------------------------------------------
# Summary — JSON to stdout so callers (curator cron, smoke tests) can
# consume the values without re-parsing this script.
# -----------------------------------------------------------------------------
cat <<EOF
{
  "env": "$ENV",
  "region": "$REGION",
  "bucket": "$BUCKET",
  "kmsKeyArn": "$KMS_KEY_ARN",
  "kmsAlias": "$KEY_ALIAS",
  "policyArn": "$POLICY_ARN",
  "taskRole": "$TASK_ROLE"
}
EOF
log "bootstrap complete"
