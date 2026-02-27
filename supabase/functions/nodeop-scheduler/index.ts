import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildChainSyncRows,
  computeMajorityVersion,
  extractThorHeight,
  fetchChurns,
  fetchLastblock,
  fetchNodeAtHeight,
  fetchNodes
} from '../_shared/thornode.ts';
import {
  computeLeaderboardRows,
  normalizeBoundarySnapshot,
  type BoundarySnapshotRow
} from '../_shared/leaderboard.ts';
import {
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  parseAuthToken,
  requireMethod
} from '../_shared/validation.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

type PerformanceSampleRow = {
  sample_hour: string;
  node_address: string;
  slash_points: number;
  missing_blocks: number;
  current_award_base: number;
  status: string;
  jail_jailed: boolean;
  jail_release_height: number;
  jail_blocks_remaining: number;
  jail_reason: string;
  preflight_status: string;
  preflight_reason: string;
  preflight_code: number;
  node_version: string;
  majority_version: string;
  version_compliant: boolean | null;
  source_height: number;
  chain_sync_json: Array<{ chain: string; node_height: number; network_max: number; lag: number }>;
  as_of: string;
};

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function toSampleHourIso(now = new Date()): string {
  const date = new Date(now);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function parseChurnRows(churns: any[]): Array<{ height: number; churn_time: string }> {
  if (!Array.isArray(churns)) {
    return [];
  }

  return churns
    .slice(0, 11)
    .map((churn) => {
      const parsedDate = new Date(churn?.date || Date.now());
      const churnTime = Number.isFinite(parsedDate.getTime())
        ? parsedDate.toISOString()
        : new Date().toISOString();

      return {
        height: Number(churn?.height) || 0,
        churn_time: churnTime
      };
    })
    .filter((row) => Number.isFinite(row.height) && row.height > 0);
}

function chunkArray<T>(items: T[], chunkSize = 250): T[][] {
  if (items.length <= chunkSize) {
    return [items];
  }

  const output: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    output.push(items.slice(i, i + chunkSize));
  }
  return output;
}

async function insertOrUpdateJobRun(
  supabase: SupabaseAdmin,
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase
    .from('nodeop_job_runs')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to insert nodeop_job_runs row: ${error.message}`);
  }

  return String(data.id);
}

async function completeJobRun(
  supabase: SupabaseAdmin,
  jobId: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!jobId) {
    return;
  }

  const { error } = await supabase
    .from('nodeop_job_runs')
    .update(payload)
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update nodeop_job_runs row: ${error.message}`);
  }
}

async function upsertPerformanceSamples(
  supabase: SupabaseAdmin,
  rows: PerformanceSampleRow[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  for (const chunk of chunkArray(rows, 250)) {
    const { error } = await supabase
      .from('nodeop_performance_samples')
      .upsert(chunk, { onConflict: 'sample_hour,node_address' });

    if (error) {
      throw new Error(`Failed to upsert performance samples: ${error.message}`);
    }
  }
}

async function replaceBoundarySnapshot(
  supabase: SupabaseAdmin,
  height: number,
  snapshot: BoundarySnapshotRow[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('nodeop_boundary_snapshots')
    .delete()
    .eq('height', height);

  if (deleteError) {
    throw new Error(`Failed to clear boundary snapshot ${height}: ${deleteError.message}`);
  }

  if (snapshot.length === 0) {
    return;
  }

  const rows = snapshot.map((row) => ({
    height,
    node_address: row.node_address,
    slash_points: row.slash_points,
    status: row.status
  }));

  for (const chunk of chunkArray(rows, 250)) {
    const { error: insertError } = await supabase
      .from('nodeop_boundary_snapshots')
      .insert(chunk);

    if (insertError) {
      throw new Error(`Failed to insert boundary snapshot ${height}: ${insertError.message}`);
    }
  }
}

async function getStoredBoundarySnapshot(
  supabase: SupabaseAdmin,
  height: number
): Promise<BoundarySnapshotRow[]> {
  const { data, error } = await supabase
    .from('nodeop_boundary_snapshots')
    .select('node_address,slash_points,status')
    .eq('height', height);

  if (error) {
    throw new Error(`Failed to read stored boundary snapshot ${height}: ${error.message}`);
  }

  return normalizeBoundarySnapshot(data || []);
}

function assertSchedulerAuth(request: Request): void {
  const token = parseAuthToken(request);

  if (!token) {
    throw new Error('Forbidden');
  }

  // Function is deployed with verify_jwt=true, so this payload can be trusted once decoded.
  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    throw new Error('Forbidden');
  }

  let role = '';
  try {
    const payloadJson = atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    role = String(payload?.role || '');
  } catch (_) {
    throw new Error('Forbidden');
  }

  if (role !== 'service_role') {
    throw new Error('Forbidden');
  }

  const optionalSecret = Deno.env.get('NODEOP_SCHEDULER_SECRET') || '';
  if (optionalSecret) {
    const provided = request.headers.get('x-nodeop-secret') || '';
    if (provided !== optionalSecret) {
      throw new Error('Forbidden');
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const methodError = requireMethod(request, 'POST');
  if (methodError) {
    return errorResponse(methodError, 405);
  }

  let supabase: SupabaseAdmin | null = null;
  let jobId = '';

  try {
    assertSchedulerAuth(request);

    supabase = createAdminClient();
    const startedAt = new Date().toISOString();

    jobId = await insertOrUpdateJobRun(supabase, {
      job_name: 'nodeop-hourly',
      started_at: startedAt,
      status: 'running',
      stats_json: {}
    });

    const [existingChurnResult, existingLeaderboardResult] = await Promise.all([
      supabase
        .from('nodeop_churn_events')
        .select('height')
        .order('height', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('nodeop_leaderboard_latest')
        .select('as_of')
        .order('as_of', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (existingChurnResult.error) {
      throw new Error(existingChurnResult.error.message);
    }

    if (existingLeaderboardResult.error) {
      throw new Error(existingLeaderboardResult.error.message);
    }

    const previousTopChurn = Number(existingChurnResult.data?.height) || 0;
    const previousLeaderboardAsOf = existingLeaderboardResult.data?.as_of || null;

    const [nodes, lastblockRows, churns] = await Promise.all([
      fetchNodes(),
      fetchLastblock(),
      fetchChurns()
    ]);

    const now = new Date();
    const asOf = now.toISOString();
    const sampleHour = toSampleHourIso(now);
    const sourceHeight = extractThorHeight(lastblockRows);
    const majorityVersion = computeMajorityVersion(nodes);

    const performanceRows = (nodes || [])
      .filter((node) => Boolean(node?.node_address))
      .map((node): PerformanceSampleRow => {
        const slashPoints = Number(node?.slash_points) || 0;
        const missingBlocks = Number(node?.missing_blocks) || 0;
        const currentAwardBase = Number(node?.current_award) || 0;

        const jailReleaseHeight = Number(node?.jail?.release_height) || 0;
        const jailReason = String(node?.jail?.reason || node?.preflight_status?.reason || '');
        const jailJailed = jailReleaseHeight > sourceHeight;

        const preflightStatus = String(node?.preflight_status?.status || '');
        const preflightReason = String(node?.preflight_status?.reason || '');
        const preflightCode = Number(node?.preflight_status?.code) || 0;
        const nodeVersion = String(node?.version || '');

        return {
          sample_hour: sampleHour,
          node_address: String(node.node_address),
          slash_points: slashPoints,
          missing_blocks: missingBlocks,
          current_award_base: currentAwardBase,
          status: String(node?.status || ''),
          jail_jailed: jailJailed,
          jail_release_height: jailReleaseHeight,
          jail_blocks_remaining: jailJailed ? Math.max(0, jailReleaseHeight - sourceHeight) : 0,
          jail_reason: jailReason,
          preflight_status: preflightStatus,
          preflight_reason: preflightReason,
          preflight_code: preflightCode,
          node_version: nodeVersion,
          majority_version: majorityVersion,
          version_compliant: majorityVersion ? nodeVersion === majorityVersion : null,
          source_height: sourceHeight,
          chain_sync_json: buildChainSyncRows(node, nodes),
          as_of: asOf
        };
      });

    await upsertPerformanceSamples(supabase, performanceRows);

    const churnRows = parseChurnRows(churns);
    const churnHeights = churnRows.map((row) => row.height);
    const latestChurnHeight = churnHeights[0] || 0;

    if (churnRows.length > 0) {
      const { error: churnUpsertError } = await supabase
        .from('nodeop_churn_events')
        .upsert(churnRows, { onConflict: 'height' });

      if (churnUpsertError) {
        throw new Error(`Failed to upsert churn events: ${churnUpsertError.message}`);
      }
    }

    const churnChanged = latestChurnHeight > 0 && latestChurnHeight !== previousTopChurn;

    const leaderboardStale = !previousLeaderboardAsOf ||
      (Date.now() - Date.parse(previousLeaderboardAsOf)) > 60 * 60 * 1000;

    const shouldRecomputeLeaderboard = churnChanged || leaderboardStale;

    let requestedWindows = Math.min(10, Math.max(0, churnHeights.length - 1));
    let computedWindows = 0;
    let leaderboardRowCount = 0;
    let historicalFetchFailures = 0;
    let historicalCacheHits = 0;

    if (shouldRecomputeLeaderboard && churnHeights.length >= 2) {
      const snapshotsByHeight: Record<number, BoundarySnapshotRow[]> = {};

      for (const height of churnHeights) {
        try {
          const historicalNodes = await fetchNodeAtHeight(height);
          const snapshot = normalizeBoundarySnapshot(historicalNodes);

          await replaceBoundarySnapshot(supabase, height, snapshot);
          snapshotsByHeight[height] = snapshot;
        } catch (error) {
          historicalFetchFailures += 1;

          const snapshot = await getStoredBoundarySnapshot(supabase, height);
          if (snapshot.length > 0) {
            historicalCacheHits += 1;
            snapshotsByHeight[height] = snapshot;
          }
        }
      }

      const computed = computeLeaderboardRows({
        churnHeights,
        snapshotsByHeight,
        minParticipation: 3,
        maxWindows: 10
      });

      requestedWindows = computed.requestedWindows;
      computedWindows = computed.computedWindows;
      leaderboardRowCount = computed.rows.length;

      const leaderboardAsOf = new Date().toISOString();

      const { error: clearError } = await supabase
        .from('nodeop_leaderboard_latest')
        .delete()
        .neq('node_address', '');

      if (clearError) {
        throw new Error(`Failed to clear leaderboard table: ${clearError.message}`);
      }

      if (computed.rows.length > 0) {
        const rows = computed.rows.map((row) => ({
          node_address: row.node_address,
          as_of: leaderboardAsOf,
          requested_windows: computed.requestedWindows,
          computed_windows: computed.computedWindows,
          per_window: row.perWindow,
          total: row.total,
          avg_per_churn: row.avgPerChurn,
          participation: row.participation,
          rank: row.rank
        }));

        for (const chunk of chunkArray(rows, 250)) {
          const { error: insertError } = await supabase
            .from('nodeop_leaderboard_latest')
            .insert(chunk);

          if (insertError) {
            throw new Error(`Failed to insert leaderboard rows: ${insertError.message}`);
          }
        }
      }
    }

    const { error: pruneError } = await supabase
      .rpc('nodeop_prune_old_data', {
        retention_days: 30,
        keep_churn_count: 11
      });

    if (pruneError) {
      throw new Error(`Failed to prune node operator tables: ${pruneError.message}`);
    }

    const stats = {
      nodes_seen: performanceRows.length,
      source_height: sourceHeight,
      latest_churn_height: latestChurnHeight,
      churn_changed: churnChanged,
      leaderboard_stale: leaderboardStale,
      leaderboard_recomputed: shouldRecomputeLeaderboard,
      requested_windows: requestedWindows,
      computed_windows: computedWindows,
      leaderboard_rows: leaderboardRowCount,
      historical_fetch_failures: historicalFetchFailures,
      historical_cache_hits: historicalCacheHits
    };

    await completeJobRun(supabase, jobId, {
      finished_at: new Date().toISOString(),
      status: 'success',
      error: null,
      stats_json: stats
    });

    return jsonResponse({ ok: true, stats }, 200, {
      'Cache-Control': 'no-store'
    });
  } catch (error) {
    const message = (error as Error).message || 'Node Operator scheduler failed';
    console.error('nodeop-scheduler failed:', error);

    if (supabase && jobId) {
      try {
        await completeJobRun(supabase, jobId, {
          finished_at: new Date().toISOString(),
          status: 'error',
          error: message,
          stats_json: {}
        });
      } catch (updateError) {
        console.error('Failed to mark job as errored:', updateError);
      }
    }

    if (message === 'Forbidden') {
      return errorResponse(message, 403);
    }

    return errorResponse(message, 500);
  }
});
