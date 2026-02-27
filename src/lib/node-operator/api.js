const API_ENDPOINTS = {
  primary: 'https://thornode.thorchain.liquify.com',
  fallback: 'https://thornode.ninerealms.com',
  midgard: 'https://midgard.ninerealms.com'
};

const NODEOP_API = {
  base: (import.meta.env.VITE_NODEOP_API_BASE || '').replace(/\/$/, ''),
  key: import.meta.env.VITE_NODEOP_API_KEY || ''
};

function isChallengeResponse(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const cfMitigated = response.headers.get('cf-mitigated');
  return contentType.includes('text/html') || Boolean(cfMitigated);
}

async function parseResponse(response, responseType) {
  if (responseType === 'text') {
    return response.text();
  }
  return response.json();
}

async function fetchFromBase(baseUrl, endpoint, options) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Accept: options.responseType === 'text' ? 'text/plain' : 'application/json',
      ...(options.fetchOptions?.headers || {})
    },
    ...options.fetchOptions
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${endpoint}`);
  }

  if (isChallengeResponse(response)) {
    throw new Error(`Challenge response for ${endpoint}`);
  }

  return parseResponse(response, options.responseType);
}

async function fetchThorchain(endpoint, options = {}) {
  const mergedOptions = {
    responseType: options.responseType || 'json',
    fetchOptions: options.fetchOptions || {},
    historical: Boolean(options.historical)
  };

  try {
    return await fetchFromBase(API_ENDPOINTS.primary, endpoint, mergedOptions);
  } catch (primaryError) {
    if (mergedOptions.historical) {
      throw primaryError;
    }

    return fetchFromBase(API_ENDPOINTS.fallback, endpoint, mergedOptions);
  }
}

function getNodeOpApiConfigError() {
  if (!NODEOP_API.base && !NODEOP_API.key) {
    return 'Node Operator backend is not configured. Set VITE_NODEOP_API_BASE and VITE_NODEOP_API_KEY.';
  }

  if (!NODEOP_API.base) {
    return 'Node Operator backend is not configured. Missing VITE_NODEOP_API_BASE.';
  }

  if (!NODEOP_API.key) {
    return 'Node Operator backend is not configured. Missing VITE_NODEOP_API_KEY.';
  }

  return '';
}

function toQueryString(query) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

async function fetchNodeOp(endpoint, options = {}) {
  const configError = getNodeOpApiConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const queryString = toQueryString(options.query);
  const url = `${NODEOP_API.base}/${endpoint}${queryString}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      apikey: NODEOP_API.key,
      Authorization: `Bearer ${NODEOP_API.key}`,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Node Operator backend request failed (${response.status})`;

    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch (_) {
      // Ignore JSON parse errors for error payloads.
    }

    throw new Error(message);
  }

  if (isChallengeResponse(response)) {
    throw new Error('Node Operator backend returned challenge response');
  }

  return response.json();
}

export function isValidThorAddress(address) {
  if (!address) return false;
  const normalized = address.trim().toLowerCase();
  return normalized.startsWith('thor') && normalized.length === 43;
}

export function toBaseAmount(amountRune) {
  const parsed = Number(amountRune);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 1e8);
}

export function fromBaseAmount(amountBase) {
  const parsed = Number(amountBase);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / 1e8;
}

export function formatRune(amountRune, fractionDigits = 2) {
  const parsed = Number(amountRune);
  if (!Number.isFinite(parsed)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(parsed);
}

export async function fetchNode(nodeAddress) {
  return fetchThorchain(`/thorchain/node/${nodeAddress}`);
}

export async function fetchNodes(options = {}) {
  if (options.height) {
    const height = Number(options.height);
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error(`Invalid height: ${options.height}`);
    }

    return fetchThorchain(`/thorchain/nodes?height=${height}`, { historical: true });
  }

  return fetchThorchain('/thorchain/nodes');
}

export async function fetchLastblock() {
  return fetchThorchain('/thorchain/lastblock');
}

export async function fetchMimirKey(key) {
  const value = await fetchThorchain(`/thorchain/mimir/key/${key}`, { responseType: 'text' });
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid mimir value for ${key}`);
  }
  return parsed;
}

export async function fetchWalletBalances(address) {
  return fetchThorchain(`/cosmos/bank/v1beta1/balances/${address}`);
}

export async function fetchNodeOperatorPerformance(nodeAddress) {
  return fetchNodeOp('nodeop-performance', {
    query: { node_address: nodeAddress }
  });
}

export async function fetchNodeOperatorLeaderboard(options = {}) {
  const query = {
    windows: options.windows ?? 10,
    min_participation: options.minParticipation ?? 3
  };

  if (options.forceRefresh) {
    query.ts = Date.now();
  }

  return fetchNodeOp('nodeop-leaderboard', { query });
}

export async function fetchNodeOperatorMeta() {
  return fetchNodeOp('nodeop-meta');
}

export function extractThorHeight(lastblockRows) {
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

export function getRuneBalanceFromBankResponse(bankResponse) {
  const balances = bankResponse?.balances || [];
  const runeEntry = balances.find((item) => (item?.denom || '').toLowerCase() === 'rune');
  return runeEntry ? fromBaseAmount(runeEntry.amount) : 0;
}

export { API_ENDPOINTS };
