/**
 * Midgard API Client
 *
 * Midgard provides aggregated and historical data for THORChain.
 * It's better suited for analytics, historical queries, and member data.
 *
 * Provider Strategy:
 * - Liquify (gateway.liquify.com/chain/thorchain_midgard): Primary provider
 *   Use for all midgard queries with automatic failover
 *
 * - Nine Realms (midgard.ninerealms.com): Fallback after Liquify failures
 *   NOTE: Nine Realms endpoints will eventually be deprecated
 */

/**
 * Midgard API Provider configurations
 */
export const MIDGARD_PROVIDERS = {
  liquify: {
    name: 'liquify',
    base: 'https://gateway.liquify.com/chain/thorchain_midgard/v2',
    priority: 1
  },
  ninerealms: {
    name: 'ninerealms',
    // NOTE: Nine Realms midgard will eventually be deprecated
    base: 'https://midgard.ninerealms.com/v2',
    headers: { 'x-client-id': 'RuneTools' },
    priority: 2
  }
};

/**
 * Midgard API base URL (primary provider)
 */
export const MIDGARD_BASE = MIDGARD_PROVIDERS.liquify.base;

/**
 * Midgard API Client class
 */
class MidgardClient {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 seconds (Midgard updates less frequently)
    this.failureCount = {
      liquify: 0,
      ninerealms: 0
    };
    this.maxFailures = 3;
    this.rateLimitedUntil = {
      liquify: 0,
      ninerealms: 0
    };
    this.rateLimitCooldown = 60000; // Skip rate-limited provider for 60s
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Reset failure counters
   */
  resetFailures() {
    this.failureCount.liquify = 0;
    this.failureCount.ninerealms = 0;
  }

  /**
   * Fetch from Midgard API with automatic failover
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

    // Determine providers to try (in order)
    const now = Date.now();
    const allProviders = [MIDGARD_PROVIDERS.liquify, MIDGARD_PROVIDERS.ninerealms];

    // Skip rate-limited providers (but keep them as last resort)
    const available = allProviders.filter(p => {
      const until = this.rateLimitedUntil[p.name];
      return !until || now >= until;
    });
    const providers = available.length > 0 ? available : allProviders;

    let lastError = null;

    for (const provider of providers) {
      try {
        const url = `${provider.base}${path}`;

        const response = await fetch(url, {
          headers: { ...(provider.headers || {}), ...fetchOptions.headers },
          ...fetchOptions
        });

        if (!response.ok) {
          // Rate limited — set cooldown so we skip this provider immediately
          if (response.status === 429 && provider.name in this.rateLimitedUntil) {
            this.rateLimitedUntil[provider.name] = Date.now() + this.rateLimitCooldown;
            console.warn(`Midgard ${provider.name} rate limited (429), switching away for ${this.rateLimitCooldown / 1000}s`);
          }
          throw new Error(`Midgard HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache successful response
        if (cache) {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        // Reset failure count and rate limit on success
        if (provider.name in this.failureCount) {
          this.failureCount[provider.name] = 0;
          this.rateLimitedUntil[provider.name] = 0;
        }

        return data;
      } catch (error) {
        lastError = error;
        console.warn(`Midgard fetch failed for ${provider.name}${path}:`, error.message);

        // Increment failure count and apply cooldown on repeated failures
        // (CORS-blocked 429s show up as "Failed to fetch" in the catch block)
        if (provider.name in this.failureCount) {
          this.failureCount[provider.name]++;
          if (this.failureCount[provider.name] >= this.maxFailures) {
            this.rateLimitedUntil[provider.name] = Date.now() + this.rateLimitCooldown;
            console.warn(`Midgard ${provider.name} failed ${this.failureCount[provider.name]} times, switching away for ${this.rateLimitCooldown / 1000}s`);
          }
        }
      }
    }

    // All providers failed
    throw new Error(`All Midgard providers failed for ${path}: ${lastError?.message}`);
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

// Export provider endpoints for direct use if needed
export const MIDGARD_ENDPOINTS = {
  liquify: MIDGARD_PROVIDERS.liquify.base,
  ninerealms: MIDGARD_PROVIDERS.ninerealms.base
};
