begin;

create extension if not exists pgcrypto;

create table if not exists public.nodeop_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  error text,
  stats_json jsonb not null default '{}'::jsonb
);

create table if not exists public.nodeop_performance_samples (
  sample_hour timestamptz not null,
  node_address text not null,
  slash_points bigint not null default 0,
  missing_blocks bigint not null default 0,
  current_award_base bigint not null default 0,
  status text not null default '',
  jail_jailed boolean not null default false,
  jail_release_height bigint not null default 0,
  jail_blocks_remaining bigint not null default 0,
  jail_reason text not null default '',
  preflight_status text not null default '',
  preflight_reason text not null default '',
  preflight_code bigint not null default 0,
  node_version text not null default '',
  majority_version text not null default '',
  version_compliant boolean,
  source_height bigint not null default 0,
  chain_sync_json jsonb not null default '[]'::jsonb,
  as_of timestamptz not null default now(),
  primary key (sample_hour, node_address)
);

create table if not exists public.nodeop_churn_events (
  height bigint primary key,
  churn_time timestamptz not null
);

create table if not exists public.nodeop_boundary_snapshots (
  height bigint not null references public.nodeop_churn_events(height) on delete cascade,
  node_address text not null,
  slash_points bigint not null default 0,
  status text not null default '',
  primary key (height, node_address)
);

create table if not exists public.nodeop_leaderboard_latest (
  node_address text primary key,
  as_of timestamptz not null,
  requested_windows integer not null,
  computed_windows integer not null,
  per_window integer[] not null,
  total integer not null,
  avg_per_churn numeric(20, 8) not null,
  participation integer not null,
  rank integer not null,
  constraint nodeop_leaderboard_latest_per_window_len_chk check (coalesce(array_length(per_window, 1), 0) = 10)
);

commit;
