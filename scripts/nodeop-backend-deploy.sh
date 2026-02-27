#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI is required"
  exit 1
fi

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is required}"

export SUPABASE_ACCESS_TOKEN

echo "Linking project ${SUPABASE_PROJECT_REF}..."
supabase link --project-ref "${SUPABASE_PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}" --yes

echo "Pushing database migrations..."
supabase db push

echo "Deploying edge functions..."
supabase functions deploy nodeop-performance --no-verify-jwt
supabase functions deploy nodeop-leaderboard --no-verify-jwt
supabase functions deploy nodeop-meta --no-verify-jwt
supabase functions deploy nodeop-scheduler

if [[ -n "${NODEOP_SCHEDULER_SECRET:-}" ]]; then
  echo "Setting NODEOP_SCHEDULER_SECRET function secret..."
  supabase secrets set NODEOP_SCHEDULER_SECRET="${NODEOP_SCHEDULER_SECRET}"
fi

echo "Done. Next: set frontend env vars VITE_NODEOP_API_BASE and VITE_NODEOP_API_KEY in your web host."
