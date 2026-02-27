const THORNODE_PRIMARY = 'https://thornode.thorchain.liquify.com';
const THORNODE_FALLBACK = 'https://thornode.ninerealms.com';
const MIDGARD_CHURNS = 'https://midgard.ninerealms.com/v2/churns';

type ResponseType = 'json' | 'text';

function isChallengeResponse(response: Response): boolean {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const cfMitigated = response.headers.get('cf-mitigated');
  return contentType.includes('text/html') || Boolean(cfMitigated);
}

async function parseResponse(response: Response, responseType: ResponseType): Promise<any> {
  if (responseType === 'text') {
    return response.text();
  }
  return response.json();
}

async function fetchFromBase(baseUrl: string, endpoint: string, responseType: ResponseType): Promise<any> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Accept: responseType === 'text' ? 'text/plain' : 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${endpoint}`);
  }

  if (isChallengeResponse(response)) {
    throw new Error(`Challenge response for ${endpoint}`);
  }

  return parseResponse(response, responseType);
}

export async function fetchThorchain(
  endpoint: string,
  options: { historical?: boolean; responseType?: ResponseType } = {}
): Promise<any> {
  const responseType = options.responseType || 'json';

  try {
    return await fetchFromBase(THORNODE_PRIMARY, endpoint, responseType);
  } catch (primaryError) {
    if (options.historical) {
      throw primaryError;
    }

    return fetchFromBase(THORNODE_FALLBACK, endpoint, responseType);
  }
}

export async function fetchNodes(): Promise<any[]> {
  const payload = await fetchThorchain('/thorchain/nodes');
  if (!Array.isArray(payload)) {
    throw new Error('Invalid /thorchain/nodes response');
  }
  return payload;
}

export async function fetchNodeAtHeight(height: number): Promise<any[]> {
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(`Invalid height: ${height}`);
  }

  const payload = await fetchThorchain(`/thorchain/nodes?height=${Math.trunc(height)}`, {
    historical: true
  });

  if (!Array.isArray(payload)) {
    throw new Error(`Invalid historical node response for height ${height}`);
  }

  return payload;
}

export async function fetchLastblock(): Promise<any[]> {
  const payload = await fetchThorchain('/thorchain/lastblock');
  if (!Array.isArray(payload)) {
    throw new Error('Invalid /thorchain/lastblock response');
  }
  return payload;
}

export async function fetchChurns(): Promise<any[]> {
  const response = await fetch(MIDGARD_CHURNS, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch churns (${response.status})`);
  }

  if (isChallengeResponse(response)) {
    throw new Error('Midgard returned challenge response');
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Invalid Midgard churn response');
  }

  return payload;
}

export function extractThorHeight(lastblockRows: any[]): number {
  if (!Array.isArray(lastblockRows)) {
    return 0;
  }

  const thorRow = lastblockRows.find((row) => (row?.chain || '').toUpperCase() === 'THOR');
  if (thorRow?.thorchain && Number.isFinite(Number(thorRow.thorchain))) {
    return Number(thorRow.thorchain);
  }

  let maxThorchain = 0;
  for (const row of lastblockRows) {
    const height = Number(row?.thorchain);
    if (Number.isFinite(height) && height > maxThorchain) {
      maxThorchain = height;
    }
  }

  if (maxThorchain > 0) {
    return maxThorchain;
  }

  return Number(lastblockRows[0]?.thorchain || 0);
}

export function computeMajorityVersion(nodes: any[]): string {
  const activeNodes = (nodes || []).filter((node) => node?.status === 'Active' && node?.version);
  if (activeNodes.length === 0) {
    return '';
  }

  const counts = new Map<string, number>();
  for (const node of activeNodes) {
    const version = String(node.version);
    counts.set(version, (counts.get(version) || 0) + 1);
  }

  let majority = '';
  let majorityCount = 0;

  for (const [version, count] of counts.entries()) {
    if (count > majorityCount) {
      majority = version;
      majorityCount = count;
    }
  }

  return majority;
}

function buildNetworkMaxByChain(nodes: any[]): Map<string, number> {
  const activeNodes = (nodes || []).filter((node) => node?.status === 'Active');
  const maxByChain = new Map<string, number>();

  for (const node of activeNodes) {
    for (const chain of node?.observe_chains || []) {
      const chainName = String(chain?.chain || '');
      if (!chainName) continue;

      const height = Number(chain?.height) || 0;
      const previous = maxByChain.get(chainName) || 0;
      if (height > previous) {
        maxByChain.set(chainName, height);
      }
    }
  }

  return maxByChain;
}

export function buildChainSyncRows(node: any, allNodes: any[]): Array<{ chain: string; node_height: number; network_max: number; lag: number }> {
  if (!node || !Array.isArray(node.observe_chains)) {
    return [];
  }

  const maxByChain = buildNetworkMaxByChain(allNodes);

  return (node.observe_chains || [])
    .map((chain: any) => {
      const chainName = String(chain?.chain || '');
      const nodeHeight = Number(chain?.height) || 0;
      const networkMax = maxByChain.get(chainName) || nodeHeight;

      return {
        chain: chainName,
        node_height: nodeHeight,
        network_max: networkMax,
        lag: Math.max(0, networkMax - nodeHeight)
      };
    })
    .sort((a, b) => b.lag - a.lag);
}

export { THORNODE_PRIMARY, THORNODE_FALLBACK, MIDGARD_CHURNS };
