import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CORS_HEADERS,
  errorResponse,
  isValidThorAddress,
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

function normalizeChainSyncRows(payload: unknown): Array<{ chain: string; node_height: number; network_max: number; lag: number }> {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((row) => typeof row === 'object' && row !== null)
    .map((row: any) => ({
      chain: String(row.chain || ''),
      node_height: Number(row.node_height) || 0,
      network_max: Number(row.network_max) || 0,
      lag: Number(row.lag) || 0
    }));
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
    const nodeAddress = (url.searchParams.get('node_address') || '').trim();

    if (!isValidThorAddress(nodeAddress)) {
      return errorResponse('Invalid node_address query param', 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('nodeop_performance_samples')
      .select([
        'as_of',
        'node_address',
        'source_height',
        'status',
        'slash_points',
        'missing_blocks',
        'current_award_base',
        'jail_jailed',
        'jail_release_height',
        'jail_blocks_remaining',
        'jail_reason',
        'node_version',
        'majority_version',
        'version_compliant',
        'preflight_status',
        'preflight_reason',
        'preflight_code',
        'chain_sync_json'
      ].join(','))
      .eq('node_address', nodeAddress)
      .order('sample_hour', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return errorResponse('No performance sample found for this node yet', 404);
    }

    const payload = {
      as_of: data.as_of,
      node_address: data.node_address,
      source_height: Number(data.source_height) || 0,
      status: data.status || '',
      slash_points: Number(data.slash_points) || 0,
      missing_blocks: Number(data.missing_blocks) || 0,
      current_award_rune: (Number(data.current_award_base) || 0) / 1e8,
      jail: {
        jailed: Boolean(data.jail_jailed),
        release_height: Number(data.jail_release_height) || 0,
        blocks_remaining: Number(data.jail_blocks_remaining) || 0,
        reason: data.jail_reason || ''
      },
      version: {
        node: data.node_version || '',
        majority: data.majority_version || '',
        compliant: typeof data.version_compliant === 'boolean' ? data.version_compliant : null
      },
      preflight: {
        status: data.preflight_status || '',
        reason: data.preflight_reason || '',
        code: Number(data.preflight_code) || 0
      },
      chain_sync: normalizeChainSyncRows(data.chain_sync_json)
    };

    return jsonResponse(payload, 200, {
      'Cache-Control': 'public, max-age=6'
    });
  } catch (error) {
    console.error('nodeop-performance failed:', error);
    return errorResponse((error as Error).message || 'Failed to load node performance', 500);
  }
});
