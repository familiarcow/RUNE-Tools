/**
 * THORChain API Utilities
 *
 * Provides centralized API endpoint management and fetch utilities
 * with automatic failover between primary and fallback endpoints.
 *
 * @module utils/api
 *
 * @example
 * import { fetchWithFallback, THORNODE_ENDPOINTS } from '$lib/utils/api';
 *
 * const response = await fetchWithFallback('/thorchain/nodes');
 * const data = await response.json();
 */

// ============================================
// API Endpoint Configuration
// ============================================

/**
 * THORNode API endpoints with fallback
 */
export const THORNODE_ENDPOINTS = {
  primary: 'https://thornode.thorchain.liquify.com',
  fallback: 'https://thornode.ninerealms.com'
};

/**
 * Midgard API endpoints
 */
export const MIDGARD_ENDPOINTS = {
  primary: 'https://midgard.ninerealms.com',
  fallback: 'https://midgard.thorchain.info'
};

// ============================================
// Fetch Utilities
// ============================================

/**
 * Fetch data from THORNode API with automatic fallback
 *
 * Tries the primary endpoint first, and falls back to the secondary
 * endpoint if the primary fails or returns an error.
 *
 * @param {string} endpoint - API endpoint path (e.g., '/thorchain/nodes')
 * @param {Object} [options={}] - Fetch options (method, headers, body, etc.)
 * @param {Object} [endpoints=THORNODE_ENDPOINTS] - Endpoint configuration
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} If both endpoints fail
 *
 * @example
 * // Simple GET request
 * const response = await fetchWithFallback('/thorchain/nodes');
 * const nodes = await response.json();
 *
 * @example
 * // With custom options
 * const response = await fetchWithFallback('/thorchain/quote/swap', {
 *   method: 'GET',
 *   headers: { 'Accept': 'application/json' }
 * });
 */
export async function fetchWithFallback(endpoint, options = {}, endpoints = THORNODE_ENDPOINTS) {
  const primaryUrl = `${endpoints.primary}${endpoint}`;
  const fallbackUrl = `${endpoints.fallback}${endpoint}`;

  try {
    // Try primary endpoint first
    const response = await fetch(primaryUrl, options);
    if (response.ok) {
      return response;
    }
    throw new Error(`Primary endpoint failed: ${response.status}`);
  } catch (error) {
    console.warn(`Primary endpoint failed, trying fallback: ${error.message}`);

    try {
      // Try fallback endpoint
      const fallbackResponse = await fetch(fallbackUrl, options);
      if (fallbackResponse.ok) {
        console.log(`Using fallback endpoint for: ${endpoint}`);
        return fallbackResponse;
      }
      throw new Error(`Fallback endpoint failed: ${fallbackResponse.status}`);
    } catch (fallbackError) {
      console.error(`Both endpoints failed for ${endpoint}:`, fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Fetch JSON data from THORNode API with automatic fallback
 *
 * Convenience wrapper that parses JSON response automatically.
 *
 * @param {string} endpoint - API endpoint path
 * @param {Object} [options={}] - Fetch options
 * @param {Object} [endpoints=THORNODE_ENDPOINTS] - Endpoint configuration
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If both endpoints fail or JSON parsing fails
 *
 * @example
 * const nodes = await fetchJSONWithFallback('/thorchain/nodes');
 * console.log(nodes.length);
 */
export async function fetchJSONWithFallback(endpoint, options = {}, endpoints = THORNODE_ENDPOINTS) {
  const response = await fetchWithFallback(endpoint, options, endpoints);
  return response.json();
}

/**
 * Fetch text data from THORNode API with automatic fallback
 *
 * Useful for endpoints that return plain text (like mimir values).
 *
 * @param {string} endpoint - API endpoint path
 * @param {Object} [options={}] - Fetch options
 * @param {Object} [endpoints=THORNODE_ENDPOINTS] - Endpoint configuration
 * @returns {Promise<string>} Response text
 * @throws {Error} If both endpoints fail
 *
 * @example
 * const minBond = await fetchTextWithFallback('/thorchain/mimir/key/MinimumBondInRune');
 * console.log(Number(minBond) / 1e8);
 */
export async function fetchTextWithFallback(endpoint, options = {}, endpoints = THORNODE_ENDPOINTS) {
  const response = await fetchWithFallback(endpoint, options, endpoints);
  return response.text();
}

/**
 * Fetch from Midgard API with automatic fallback
 *
 * @param {string} endpoint - API endpoint path (e.g., '/v2/pools')
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Response>} Fetch response object
 *
 * @example
 * const response = await fetchMidgard('/v2/pools');
 * const pools = await response.json();
 */
export async function fetchMidgard(endpoint, options = {}) {
  return fetchWithFallback(endpoint, options, MIDGARD_ENDPOINTS);
}

/**
 * Fetch JSON from Midgard API with automatic fallback
 *
 * @param {string} endpoint - API endpoint path
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 *
 * @example
 * const pools = await fetchMidgardJSON('/v2/pools');
 */
export async function fetchMidgardJSON(endpoint, options = {}) {
  return fetchJSONWithFallback(endpoint, options, MIDGARD_ENDPOINTS);
}

// ============================================
// Common API Helpers
// ============================================

/**
 * Fetch current block height from THORNode
 *
 * @returns {Promise<number>} Current THORChain block height
 *
 * @example
 * const blockHeight = await fetchCurrentBlockHeight();
 * console.log(`Current block: ${blockHeight}`);
 */
export async function fetchCurrentBlockHeight() {
  try {
    const data = await fetchJSONWithFallback('/thorchain/lastblock');
    // Find THORChain block from the response (use any chain as reference)
    const block = data.find(item => item.thorchain)?.thorchain || 0;
    return block;
  } catch (error) {
    console.error('Error fetching current block height:', error);
    return 0;
  }
}

/**
 * Fetch a single mimir value by key
 *
 * @param {string} key - Mimir key (e.g., 'CHURNINTERVAL', 'MinimumBondInRune')
 * @returns {Promise<number>} Mimir value as number
 *
 * @example
 * const churnInterval = await fetchMimirValue('CHURNINTERVAL');
 * console.log(`Churn interval: ${churnInterval} blocks`);
 */
export async function fetchMimirValue(key) {
  try {
    const text = await fetchTextWithFallback(`/thorchain/mimir/key/${key}`);
    return Number(text) || 0;
  } catch (error) {
    console.error(`Error fetching mimir value ${key}:`, error);
    return 0;
  }
}

/**
 * Fetch multiple mimir values at once
 *
 * @param {string[]} keys - Array of mimir keys
 * @returns {Promise<Object>} Object mapping keys to values
 *
 * @example
 * const values = await fetchMimirValues(['CHURNINTERVAL', 'MinimumBondInRune']);
 * console.log(values.CHURNINTERVAL, values.MinimumBondInRune);
 */
export async function fetchMimirValues(keys) {
  const results = await Promise.all(
    keys.map(async (key) => {
      const value = await fetchMimirValue(key);
      return [key, value];
    })
  );

  return Object.fromEntries(results);
}
