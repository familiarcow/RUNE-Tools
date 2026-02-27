import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  requireMethod
} from '../_shared/validation.ts';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const methodError = requireMethod(request, 'GET');
  if (methodError) {
    return errorResponse(methodError, 405);
  }

  try {
    const supabase = createAdminClient();

    const [hourlyRunResult, churnResult, leaderboardResult] = await Promise.all([
      supabase
        .from('nodeop_job_runs')
        .select('finished_at')
        .eq('job_name', 'nodeop-hourly')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
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

    if (hourlyRunResult.error) {
      throw new Error(hourlyRunResult.error.message);
    }

    if (churnResult.error) {
      throw new Error(churnResult.error.message);
    }

    if (leaderboardResult.error) {
      throw new Error(leaderboardResult.error.message);
    }

    const lastHourlyRunAt = hourlyRunResult.data?.finished_at || null;
    const lastChurnHeight = Number(churnResult.data?.height) || 0;
    const lastLeaderboardComputeAt = leaderboardResult.data?.as_of || null;

    const freshnessSeconds = lastHourlyRunAt
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lastHourlyRunAt)) / 1000))
      : -1;

    const status = freshnessSeconds >= 0 && freshnessSeconds <= 5400
      ? 'healthy'
      : 'stale';

    return jsonResponse(
      {
        last_hourly_run_at: lastHourlyRunAt,
        last_churn_height: lastChurnHeight,
        last_leaderboard_compute_at: lastLeaderboardComputeAt,
        data_freshness_seconds: freshnessSeconds,
        status
      },
      200,
      {
        'Cache-Control': 'public, max-age=30'
      }
    );
  } catch (error) {
    console.error('nodeop-meta failed:', error);
    return errorResponse((error as Error).message || 'Failed to load backend metadata', 500);
  }
});
