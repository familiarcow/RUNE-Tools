/**
 * THORNode API Client
 *
 * Provider Strategy:
 * - Liquify (thornode.thorchain.liquify.com): Updates every 6 seconds (per block)
 *   Use for real-time data like prices, block status, live feeds
 *
 * - Nine Realms (thornode.ninerealms.com): Updates ~once per minute
 *   More stable, use as fallback after Liquify failures
 *
 * - Archive (thornode-archive.ninerealms.com): For historical queries
 *   Use when fetching data at specific block heights
 */

import { fromBaseUnit } from '../utils/blockchain.js';

/**
 * API Provider configurations
 */
export const PROVIDERS = {
  liquify: {
    name: 'liquify',
    base: 'https://thornode.thorchain.liquify.com',
    updateFrequency: 6000, // 6 seconds
    priority: 1
  },
  ninerealms: {
    name: 'ninerealms',
    base: 'https://thornode.ninerealms.com',
    headers: { 'x-client-id': 'RuneTools' },
    updateFrequency: 60000, // ~1 minute
    priority: 2
  },
  archive: {
    name: 'archive',
    base: 'https://thornode-archive.ninerealms.com',
    headers: { 'x-client-id': 'RuneTools' },
    supportsBlockHeight: true,
    priority: 3
  }
};

/**
 * THORNode API Client class
 */
class ThorNodeClient {
  constructor() {
    this.failureCount = {
      liquify: 0,
      ninerealms: 0
    };
    this.maxFailures = 3;
    this.cache = new Map();
    this.cacheTTL = 5000; // 5 seconds default cache
  }

  /**
   * Select the appropriate provider based on options
   * @param {Object} options - Request options
   * @returns {Object} Selected provider config
   */
  selectProvider(options = {}) {
    const { blockHeight, realtime = true, preferNinerealms = false } = options;

    // Archive required for historical queries with block height
    if (blockHeight) {
      return PROVIDERS.archive;
    }

    // If explicitly preferring Nine Realms (for less frequent updates)
    if (preferNinerealms) {
      return PROVIDERS.ninerealms;
    }

    // For real-time data, prefer Liquify unless it's been failing
    if (realtime && this.failureCount.liquify < this.maxFailures) {
      return PROVIDERS.liquify;
    }

    // Fall back to Nine Realms
    return PROVIDERS.ninerealms;
  }

  /**
   * Clear the cache (useful when you want fresh data)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Reset failure counters (useful after a successful request)
   */
  resetFailures() {
    this.failureCount.liquify = 0;
    this.failureCount.ninerealms = 0;
  }

  /**
   * Fetch from THORNode with automatic failover
   * @param {string} path - API endpoint path (e.g., '/thorchain/network')
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async fetch(path, options = {}) {
    const {
      cache = true,
      blockHeight,
      parseJson = true,
      realtime = true,
      preferNinerealms = false,
      ...fetchOptions
    } = options;

    // Build cache key
    const cacheKey = `${path}:${blockHeight || 'latest'}`;

    // Check cache first
    if (cache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
      // Cache expired, remove it
      this.cache.delete(cacheKey);
    }

    // Determine providers to try (in order)
    const providers = blockHeight
      ? [PROVIDERS.archive]
      : preferNinerealms
        ? [PROVIDERS.ninerealms, PROVIDERS.liquify]
        : [PROVIDERS.liquify, PROVIDERS.ninerealms];

    let lastError = null;

    for (const provider of providers) {
      try {
        let url = `${provider.base}${path}`;

        // Add block height for archive queries
        if (blockHeight && provider.supportsBlockHeight) {
          const separator = url.includes('?') ? '&' : '?';
          url += `${separator}height=${blockHeight}`;
        }

        const response = await fetch(url, {
          headers: { ...(provider.headers || {}), ...fetchOptions.headers },
          ...fetchOptions
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = parseJson ? await response.json() : await response.text();

        // Cache successful response
        if (cache) {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        // Reset failure count on success
        if (provider.name === 'liquify') {
          this.failureCount.liquify = 0;
        } else if (provider.name === 'ninerealms') {
          this.failureCount.ninerealms = 0;
        }

        return data;
      } catch (error) {
        lastError = error;
        console.warn(`THORNode fetch failed for ${provider.name}${path}:`, error.message);

        // Increment failure count
        if (provider.name === 'liquify') {
          this.failureCount.liquify++;
        } else if (provider.name === 'ninerealms') {
          this.failureCount.ninerealms++;
        }
      }
    }

    // All providers failed
    throw new Error(`All THORNode providers failed for ${path}: ${lastError?.message}`);
  }

  // ============================================
  // Convenience methods for common endpoints
  // ============================================

  /**
   * Get network data (includes RUNE price)
   * @param {Object} options - Fetch options
   */
  async getNetwork(options = {}) {
    return this.fetch('/thorchain/network', options);
  }

  /**
   * Get RUNE price in USD
   * @param {Object} options - Fetch options
   * @returns {Promise<number>} RUNE price
   */
  async getRunePrice(options = {}) {
    const network = await this.getNetwork(options);
    return fromBaseUnit(network.rune_price_in_tor);
  }

  /**
   * Get all pools
   * @param {Object} options - Fetch options
   */
  async getPools(options = {}) {
    return this.fetch('/thorchain/pools', options);
  }

  /**
   * Get a specific pool
   * @param {string} asset - Asset identifier
   * @param {Object} options - Fetch options
   */
  async getPool(asset, options = {}) {
    return this.fetch(`/thorchain/pool/${encodeURIComponent(asset)}`, options);
  }

  /**
   * Get all nodes
   * @param {Object} options - Fetch options
   */
  async getNodes(options = {}) {
    return this.fetch('/thorchain/nodes', options);
  }

  /**
   * Get a Mimir value
   * @param {string} key - Mimir key name
   * @param {Object} options - Fetch options
   */
  async getMimir(key, options = {}) {
    const data = await this.fetch(`/thorchain/mimir/key/${key}`, {
      parseJson: false,
      ...options
    });
    return data;
  }

  /**
   * Get all Mimir values
   * @param {Object} options - Fetch options
   */
  async getAllMimir(options = {}) {
    return this.fetch('/thorchain/mimir', options);
  }

  /**
   * Get balance for an address
   * @param {string} address - THORChain address
   * @param {Object} options - Fetch options
   */
  async getBalance(address, options = {}) {
    return this.fetch(`/cosmos/bank/v1beta1/balances/${address}`, options);
  }

  /**
   * Get liquidity provider data
   * @param {string} pool - Pool asset identifier
   * @param {string} address - LP address
   * @param {Object} options - Fetch options (can include blockHeight for historical)
   */
  async getLiquidityProvider(pool, address, options = {}) {
    return this.fetch(
      `/thorchain/pool/${encodeURIComponent(pool)}/liquidity_provider/${address}`,
      options
    );
  }

  /**
   * Get Asgard vaults
   * @param {Object} options - Fetch options
   */
  async getVaults(options = {}) {
    return this.fetch('/thorchain/vaults/asgard', options);
  }

  /**
   * Get inbound addresses
   * @param {Object} options - Fetch options
   */
  async getInboundAddresses(options = {}) {
    return this.fetch('/thorchain/inbound_addresses', options);
  }

  /**
   * Get constants
   * @param {Object} options - Fetch options
   */
  async getConstants(options = {}) {
    return this.fetch('/thorchain/constants', options);
  }

  /**
   * Get current block status
   * @param {Object} options - Fetch options
   */
  async getStatus(options = {}) {
    return this.fetch('/status', options);
  }

  /**
   * Get swap quote
   * @param {Object} params - Quote parameters
   * @param {Object} options - Fetch options
   */
  async getSwapQuote(params, options = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`/thorchain/quote/swap?${query}`, options);
  }
}

// Export singleton instance
export const thornode = new ThorNodeClient();

// Export class for testing or custom instances
export { ThorNodeClient };

// Export provider endpoints for direct use if needed
export const THORNODE_ENDPOINTS = {
  liquify: PROVIDERS.liquify.base,
  ninerealms: PROVIDERS.ninerealms.base,
  archive: PROVIDERS.archive.base
};
