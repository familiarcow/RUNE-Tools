/**
 * Midgard API Client
 *
 * Midgard provides aggregated and historical data for THORChain.
 * It's better suited for analytics, historical queries, and member data.
 *
 * Failover behavior:
 * - Each request tries providers in order; if one fails the next is tried
 *   within the same call so the caller sees a single promise.
 * - Per-provider 8s timeout — a hung primary aborts and we move to the
 *   fallback rather than hanging the user.
 */

/**
 * Midgard API provider list -- in order of preference
 *
 * @typedef {Object} ApiProvider
 * @property {string} base - Midgard API base URL (no trailing slash)
 * @property {Record<string, string>} [headers] - HTTP client headers (e.g. x-client-id)
 */

export const MIDGARD_PROVIDERS = Object.freeze([
  {
    base: 'https://gateway.liquify.com/chain/thorchain_midgard/v2',
    // Liquify doesn't accept x-client-id through their CORS configuration
    // (unlike the deprecated Nine Realms endpoints)
  },
  {
    // Official thorchain.network midgard.
    base: 'https://midgard.thorchain.network/v2',
  },
  // Additional fallback providers append here. Failover and rate-limit
  // tracking are all keyed off this array — no other changes needed when
  // a new backup midgard comes online.
]);

// ============================================
// Request timeout
// ============================================

/**
 * Per-provider request timeout. A hung primary aborts at this deadline so the
 * fallback gets attempted within the same call instead of users waiting on the
 * browser's default fetch timeout.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * fetch() wrapper that aborts after timeoutMs.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Rate Limit Tracking
// ============================================

/**
 * Track rate-limited endpoints so we skip them on subsequent requests.
 * Key: base URL, Value: timestamp when cooldown expires
 */
const rateLimitedUntil = new Map();
const failureCounts = new Map();
const RATE_LIMIT_COOLDOWN = 60_000; // 60 seconds

// ============================================
// Caching
// ============================================

const apiCache = new Map();
const DEFAULT_CACHE_TTL = 30_000; // 30 seconds (Midgard updates less frequently)

/**
 * Midgard API Client class
 */
class MidgardClient {
  /**
   * Fetch from Midgard (private)
   *
   * Caching is handled by #fetchJSON / #fetchText wrappers so parsed bodies
   * are cached once and returned directly on hits (no re-parse, no Response
   * clone consumption hazards).
   *
   * @param {string} path - API endpoint path (e.g. '/stats')
   * @param {Object} [options={}] - Combined options object:
   *        - Behavior modifiers: None (cache, cacheTTL handled by wrappers)
   *        - Anything else gets passed into fetch() directly
   * @returns {Promise<Response>} Raw `Response` object from the successful provider
   */
  async #fetch(path, options = {}) {
    const {
      cache: _cache,
      cacheTTL: _cacheTTL,
      ...fetchInit
    } = options;
    const now = Date.now();

    const available = MIDGARD_PROVIDERS.filter(p => {
      const until = rateLimitedUntil.get(p.base) || 0;
      return until <= now;
    });
    const rateLimited = MIDGARD_PROVIDERS.filter(p => {
      const until = rateLimitedUntil.get(p.base) || 0;
      return until > now;
    });
    const order = [...available, ...rateLimited];

    let lastError = null;

    for (const provider of order) {
      try {
        const url = `${provider.base}${path}`;
        const fetchOpts = {
          ...fetchInit,
          headers: {
            ...(provider.headers || {}),
            ...(fetchInit.headers || {})
          }
        };

        const response = await fetchWithTimeout(url, fetchOpts, REQUEST_TIMEOUT_MS);
        if (response.ok) {
          // Clear rate limit and failure count on success
          rateLimitedUntil.delete(provider.base);
          failureCounts.delete(provider.base);
          return response;
        }
        if (response.status === 429) {
          rateLimitedUntil.set(provider.base, Date.now() + RATE_LIMIT_COOLDOWN);
          console.warn(`Midgard rate limited (429) on ${provider.base}, switching away for ${RATE_LIMIT_COOLDOWN / 1000}s`);
        }
        lastError = new Error(`${provider.base} failed: ${response.status}`);
        console.warn(`Midgard endpoint failed for ${path}: ${lastError.message}`);
      } catch (error) {
        // CORS-blocked 429s and timeouts (AbortError) land here
        const count = (failureCounts.get(provider.base) || 0) + 1;
        failureCounts.set(provider.base, count);
        if (count >= 2) {
          rateLimitedUntil.set(provider.base, Date.now() + RATE_LIMIT_COOLDOWN);
          console.warn(`Midgard ${provider.base} failed ${count} times, switching away for ${RATE_LIMIT_COOLDOWN / 1000}s`);
        }
        lastError = error;
        const reason = error.name === 'AbortError' ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : error.message;
        console.warn(`Midgard endpoint failed for ${path}: ${reason}`);
      }
    }

    console.error(`All Midgard providers failed for ${path}:`, lastError);
    throw lastError;
  }

  // ============================================
  // Wrapper methods
  // ============================================

  /**
   * Build the cache key used by #fetchJSON / #fetchText.
   * Includes format so json/text for the same path don't collide.
   */
  #cacheKey(path, format) {
    return `${format}:${path}`;
  }

  /**
   * Look up a fresh cached body. Returns undefined on miss.
   */
  #cacheGet(key, cacheTTL) {
    const entry = apiCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp >= cacheTTL) {
      apiCache.delete(key);
      return undefined;
    }
    return entry.body;
  }

  /**
   * Fetch and parse JSON response (cached)
   *
   * @param {string} path - API endpoint path
   * @param {Object} [options={}] - Same options as #fetch, plus cache controls
   * @param {boolean} [options.cache=true] - Enable/disable response caching
   * @param {number} [options.cacheTTL] - Cache duration (milliseconds)
   * @returns {Promise<Object>}
   */
  async #fetchJSON(path, options = {}) {
    const { cache = true, cacheTTL = DEFAULT_CACHE_TTL } = options;
    const key = this.#cacheKey(path, 'json');
    if (cache) {
      const hit = this.#cacheGet(key, cacheTTL);
      if (hit !== undefined) return hit;
    }
    const response = await this.#fetch(path, options);
    const body = await response.json();
    if (cache) {
      apiCache.set(key, { timestamp: Date.now(), body });
    }
    return body;
  }

  /**
   * Fetch and return the response body as plain text (cached)
   *
   * @param {string} path - API endpoint path
   * @param {Object} [options={}] - Same options as #fetch, plus cache controls
   * @param {boolean} [options.cache=true] - Enable/disable response caching
   * @param {number} [options.cacheTTL] - Cache duration (milliseconds)
   * @returns {Promise<string>}
   */
  async #fetchText(path, options = {}) {
    const { cache = true, cacheTTL = DEFAULT_CACHE_TTL } = options;
    const key = this.#cacheKey(path, 'text');
    if (cache) {
      const hit = this.#cacheGet(key, cacheTTL);
      if (hit !== undefined) return hit;
    }
    const response = await this.#fetch(path, options);
    const body = await response.text();
    if (cache) {
      apiCache.set(key, { timestamp: Date.now(), body });
    }
    return body;
  }

  // ============================================
  // Cache methods
  // ============================================

  /**
   * Clear cache
   */
  clearCache() {
    apiCache.clear();
  }

  // ============================================
  // Convenience methods for common endpoints
  // ============================================

  /**
   * Get overall network stats
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getStats(options = {}) {
    return this.#fetchJSON('/stats', options);
  }

  /**
   * Get pool statistics
   *
   * @param {string} pool - Pool asset identifier
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getPoolStats(pool, options = {}) {
    return this.#fetchJSON(`/pool/${encodeURIComponent(pool)}/stats`, options);
  }

  /**
   * Get all pools
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getPools(options = {}) {
    return this.#fetchJSON('/pools', options);
  }

  /**
   * Get pool depth/price history
   *
   * @param {string} pool - Pool asset identifier
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getPoolHistory(pool, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/depths/${encodeURIComponent(pool)}?${query}` : `/history/depths/${encodeURIComponent(pool)}`;
    return this.#fetchJSON(path, options);
  }

  /**
   * Get swap history
   *
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getSwapHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/swaps?${query}` : '/history/swaps';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get earnings history
   *
   * @param {Object} params - Query parameters (pool, interval, count, from, to)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getEarningsHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/earnings?${query}` : '/history/earnings';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get RUNE price history
   *
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getRuneHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/rune?${query}` : '/history/rune';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get liquidity history
   *
   * @param {Object} params - Query parameters (pool, interval, count, from, to)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getLiquidityHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/liquidity_changes?${query}` : '/history/liquidity_changes';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get member (LP) data
   *
   * @param {string} address - Member address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getMember(address, options = {}) {
    return this.#fetchJSON(`/member/${address}`, options);
  }

  /**
   * Get all members for a pool
   *
   * @param {string} pool - Pool asset identifier
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getPoolMembers(pool, options = {}) {
    return this.#fetchJSON(`/members?pool=${encodeURIComponent(pool)}`, options);
  }

  /**
   * Get actions (transactions)
   *
   * @param {Object} params - Query parameters (txid, address, type, limit, offset)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getActions(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/actions?${query}` : '/actions';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get action by transaction ID
   *
   * @param {string} txid - Transaction ID
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getAction(txid, options = {}) {
    return this.#fetchJSON(`/actions?txid=${txid}`, options);
  }

  /**
   * Get churn history
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getChurns(options = {}) {
    return this.#fetchJSON('/churns', options);
  }

  /**
   * Get network health
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getHealth(options = {}) {
    return this.#fetchJSON('/health', options);
  }

  /**
   * Get TCY distribution for an address
   *
   * @param {string} address - Address to check
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getTCYDistribution(address, options = {}) {
    return this.#fetchJSON(`/tcy/distribution/${address}`, options);
  }

  /**
   * Get bond details for a given address
   *
   * @param {string} address - Address to check
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>}
   */
  async getBonderDetails(address, options = {}) {
    return this.#fetchJSON(`/bonds/${address}`, options);
  }
}

// Export singleton instance
export const midgard = new MidgardClient();

// Export class for testing or custom instances
export { MidgardClient };
