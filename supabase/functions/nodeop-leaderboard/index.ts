import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  parseIntegerParam,
  requireMethod
} from '../_shared/validation.ts';

type MaterializedRow = {
  node_address: string;
  as_of: string;
  requested_windows: number;
  computed_windows: number;
  per_window: Array<number | null>;
  total: number;
  avg_per_churn: number;
  participation: number;
  rank: number;
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

function normalizePerWindow(row: MaterializedRow, windows: number): Array<number | null> {
  const input = Array.isArray(row.per_window) ? row.per_window : [];
  const output = Array(10).fill(null) as Array<number | null>;

  for (let i = 0; i < Math.min(windows, 10); i += 1) {
    const value = input[i];
    if (value == null) {
      output[i] = null;
      continue;
    }

    const parsed = Number(value);
    output[i] = Number.isFinite(parsed) ? parsed : null;
  }

  return output;
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
    const url = new URL(request.url);
    const windows = parseIntegerParam(url.searchParams.get('windows'), 10, { min: 1, max: 10 });
    const minParticipation = parseIntegerParam(url.searchParams.get('min_participation'), 3, {
      min: 1,
      max: 10
    });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('nodeop_leaderboard_latest')
      .select([
        'node_address',
        'as_of',
        'requested_windows',
        'computed_windows',
        'per_window',
        'total',
        'avg_per_churn',
        'participation',
        'rank'
      ].join(','))
      .order('rank', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const materializedRows = (data || []) as MaterializedRow[];
    const asOf = materializedRows[0]?.as_of || null;

    const rows = materializedRows
      .map((row) => {
        const perWindow = normalizePerWindow(row, windows);
        const participation = perWindow.reduce((acc, value) => (value == null ? acc : acc + 1), 0);
        const total = perWindow.reduce((acc, value) => (value == null ? acc : acc + value), 0);
        const avgPerChurn = participation > 0 ? total / participation : 0;

        return {
          node_address: row.node_address,
          per_window: perWindow,
          total,
          avg_per_churn: avgPerChurn,
          participation
        };
      })
      .filter((row) => row.participation >= minParticipation)
      .sort((a, b) => {
        if (a.total !== b.total) return a.total - b.total;
        if (a.avg_per_churn !== b.avg_per_churn) return a.avg_per_churn - b.avg_per_churn;
        return a.node_address.localeCompare(b.node_address);
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1
      }));

    const maxComputedWindows = materializedRows.reduce((acc, row) => {
      const parsed = Number(row.computed_windows) || 0;
      return Math.max(acc, parsed);
    }, 0);

    return jsonResponse(
      {
        as_of: asOf,
        requested_windows: windows,
        computed_windows: Math.min(windows, maxComputedWindows),
        rows
      },
      200,
      {
        'Cache-Control': 'public, max-age=300'
      }
    );
  } catch (error) {
    console.error('nodeop-leaderboard failed:', error);
    return errorResponse((error as Error).message || 'Failed to load leaderboard', 500);
  }
});
