begin;

create index if not exists idx_nodeop_job_runs_job_status_started
  on public.nodeop_job_runs (job_name, status, started_at desc);

create index if not exists idx_nodeop_performance_samples_node_hour
  on public.nodeop_performance_samples (node_address, sample_hour desc);

create index if not exists idx_nodeop_performance_samples_hour
  on public.nodeop_performance_samples (sample_hour desc);

create index if not exists idx_nodeop_churn_events_time
  on public.nodeop_churn_events (churn_time desc);

create index if not exists idx_nodeop_boundary_snapshots_node_height
  on public.nodeop_boundary_snapshots (node_address, height desc);

create index if not exists idx_nodeop_leaderboard_latest_rank
  on public.nodeop_leaderboard_latest (rank asc);

create or replace function public.nodeop_prune_old_data(
  retention_days integer default 30,
  keep_churn_count integer default 11
)
returns void
language plpgsql
as $$
declare
  cutoff timestamptz := now() - make_interval(days => retention_days);
begin
  delete from public.nodeop_job_runs
  where started_at < cutoff;

  delete from public.nodeop_performance_samples
  where sample_hour < date_trunc('hour', cutoff);

  delete from public.nodeop_boundary_snapshots bs
  where not exists (
    select 1
    from (
      select height
      from public.nodeop_churn_events
      order by height desc
      limit keep_churn_count
    ) keep
    where keep.height = bs.height
  );

  delete from public.nodeop_churn_events ce
  where not exists (
    select 1
    from (
      select height
      from public.nodeop_churn_events
      order by height desc
      limit keep_churn_count
    ) keep
    where keep.height = ce.height
  );
end;
$$;

commit;
