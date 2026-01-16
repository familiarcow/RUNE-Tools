/**
 * Midgard API Client
 *
 * Midgard provides aggregated and historical data for THORChain.
 * It's better suited for analytics, historical queries, and member data.
 *
 * Endpoint: https://midgard.ninerealms.com/v2
 */

/**
 * Midgard API base URL
 */
export const MIDGARD_BASE = 'https://midgard.ninerealms.com/v2';

/**
 * Midgard API Client class
 */
class MidgardClient {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 seconds (Midgard updates less frequently)
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetch from Midgard API
   * @param {string} path - API endpoint path (e.g., '/stats')
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async fetch(path, options = {}) {
    const { cache = true, ...fetchOptions } = options;

    const cacheKey = path;

    // Check cache first
    if (cache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const response = await fetch(`${MIDGARD_BASE}${path}`, {
        headers: {
          'x-client-id': 'RuneTools',
          ...fetchOptions.headers
        },
        ...fetchOptions
      });

      if (!response.ok) {
        throw new Error(`Midgard error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      if (cache) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      console.error(`Midgard fetch failed for ${path}:`, error);
      throw error;
    }
  }

  // ============================================
  // Convenience methods for common endpoints
  // ============================================

  /**
   * Get overall network stats
   * @param {Object} options - Fetch options
   */
  async getStats(options = {}) {
    return this.fetch('/stats', options);
  }

  /**
   * Get pool statistics
   * @param {string} pool - Pool asset identifier
   * @param {Object} options - Fetch options
   */
  async getPoolStats(pool, options = {}) {
    return this.fetch(`/pool/${encodeURIComponent(pool)}/stats`, options);
  }

  /**
   * Get all pools
   * @param {Object} options - Fetch options
   */
  async getPools(options = {}) {
    return this.fetch('/pools', options);
  }

  /**
   * Get pool depth/price history
   * @param {string} pool - Pool asset identifier
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} options - Fetch options
   */
  async getPoolHistory(pool, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/depths/${encodeURIComponent(pool)}?${query}` : `/history/depths/${encodeURIComponent(pool)}`;
    return this.fetch(path, options);
  }

  /**
   * Get swap history
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} options - Fetch options
   */
  async getSwapHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/swaps?${query}` : '/history/swaps';
    return this.fetch(path, options);
  }

  /**
   * Get earnings history
   * @param {Object} params - Query parameters (pool, interval, count, from, to)
   * @param {Object} options - Fetch options
   */
  async getEarningsHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/earnings?${query}` : '/history/earnings';
    return this.fetch(path, options);
  }

  /**
   * Get RUNE price history
   * @param {Object} params - Query parameters (interval, count, from, to)
   * @param {Object} options - Fetch options
   */
  async getRuneHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/rune?${query}` : '/history/rune';
    return this.fetch(path, options);
  }

  /**
   * Get liquidity history
   * @param {Object} params - Query parameters (pool, interval, count, from, to)
   * @param {Object} options - Fetch options
   */
  async getLiquidityHistory(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/history/liquidity_changes?${query}` : '/history/liquidity_changes';
    return this.fetch(path, options);
  }

  /**
   * Get member (LP) data
   * @param {string} address - Member address
   * @param {Object} options - Fetch options
   */
  async getMember(address, options = {}) {
    return this.fetch(`/member/${address}`, options);
  }

  /**
   * Get all members for a pool
   * @param {string} pool - Pool asset identifier
   * @param {Object} options - Fetch options
   */
  async getPoolMembers(pool, options = {}) {
    return this.fetch(`/members?pool=${encodeURIComponent(pool)}`, options);
  }

  /**
   * Get actions (transactions)
   * @param {Object} params - Query parameters (txid, address, type, limit, offset)
   * @param {Object} options - Fetch options
   */
  async getActions(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query ? `/actions?${query}` : '/actions';
    return this.fetch(path, options);
  }

  /**
   * Get action by transaction ID
   * @param {string} txid - Transaction ID
   * @param {Object} options - Fetch options
   */
  async getAction(txid, options = {}) {
    return this.fetch(`/actions?txid=${txid}`, options);
  }

  /**
   * Get churn history
   * @param {Object} options - Fetch options
   */
  async getChurns(options = {}) {
    return this.fetch('/churns', options);
  }

  /**
   * Get network health
   * @param {Object} options - Fetch options
   */
  async getHealth(options = {}) {
    return this.fetch('/health', options);
  }

  /**
   * Get TCY distribution for an address
   * @param {string} address - Address to check
   * @param {Object} options - Fetch options
   */
  async getTCYDistribution(address, options = {}) {
    return this.fetch(`/tcy/distribution/${address}`, options);
  }
}

// Export singleton instance
export const midgard = new MidgardClient();

// Export class for testing or custom instances
export { MidgardClient };
