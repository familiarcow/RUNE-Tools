# Node Operator Backend (Supabase)

## Scope
This backend powers only `Performance` and `Leaderboard` for the Node Operator dashboard.
`Management` remains client-side wallet signing and direct THORNode reads.

## Deployed Functions
- `nodeop-performance` (public GET)
- `nodeop-leaderboard` (public GET)
- `nodeop-meta` (public GET)
- `nodeop-scheduler` (internal POST, service-role guarded)

## Required Environment Variables
Set these in Supabase Function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODEOP_SCHEDULER_SECRET` (optional extra guard)

Set these in frontend runtime/build env:
- `VITE_NODEOP_API_BASE=https://<project>.supabase.co/functions/v1`
- `VITE_NODEOP_API_KEY=<anon-key>`

## Database Setup
Run migrations in order:
1. `supabase/migrations/001_nodeop_schema.sql`
2. `supabase/migrations/002_nodeop_indexes_retention.sql`

The retention helper function `public.nodeop_prune_old_data` is called by scheduler runs.

## Local Development
```bash
supabase start
supabase db reset
supabase functions serve nodeop-performance --no-verify-jwt
supabase functions serve nodeop-leaderboard --no-verify-jwt
supabase functions serve nodeop-meta --no-verify-jwt
supabase functions serve nodeop-scheduler
```

## Deploy
```bash
supabase db push
supabase functions deploy nodeop-performance --no-verify-jwt
supabase functions deploy nodeop-leaderboard --no-verify-jwt
supabase functions deploy nodeop-meta --no-verify-jwt
supabase functions deploy nodeop-scheduler
```

Or run the bundled deploy script:
```bash
SUPABASE_ACCESS_TOKEN=... \
SUPABASE_PROJECT_REF=... \
SUPABASE_DB_PASSWORD=... \
NODEOP_SCHEDULER_SECRET=... \
npm run nodeop:deploy:backend
```

## Scheduler Trigger (Hourly)
Use any scheduler (Supabase cron, GitHub Actions, or external cron) to call:
- `POST https://<project>.supabase.co/functions/v1/nodeop-scheduler`

Headers:
- `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- `x-nodeop-secret: <NODEOP_SCHEDULER_SECRET>` (if configured)

Suggested cadence:
- Hourly
- Plus an on-demand/manual trigger after churn events if needed

### GitHub Actions scheduler (included)
This repo now includes:
- `.github/workflows/nodeop-scheduler.yml`

Set these repository secrets:
- `NODEOP_SCHEDULER_URL` = `https://<project>.supabase.co/functions/v1/nodeop-scheduler`
- `SUPABASE_SERVICE_ROLE_KEY` = service role key from Supabase
- `NODEOP_SCHEDULER_SECRET` (optional, if set in function env)

## API Contracts
### GET /nodeop-performance?node_address=thor...
Returns:
- `as_of`
- `node_address`
- `source_height`
- `status`
- `slash_points`
- `missing_blocks`
- `current_award_rune`
- `jail`
- `version`
- `preflight`
- `chain_sync`

### GET /nodeop-leaderboard?windows=10&min_participation=3
Returns:
- `as_of`
- `requested_windows`
- `computed_windows`
- `rows[]`

Scoring rule:
- `delta = max(0, endSlash - startSlash)`

### GET /nodeop-meta
Returns:
- `last_hourly_run_at`
- `last_churn_height`
- `last_leaderboard_compute_at`
- `data_freshness_seconds`
- `status`

## Notes
- Non-historical THORNode reads: Liquify primary, Nine Realms fallback.
- Historical snapshots (`/thorchain/nodes?height=`): Liquify only.
- HTML/challenge responses are treated as failures.
- Leaderboard recompute tolerates partial historical failures by reusing stored boundary snapshots when available.
