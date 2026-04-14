/**
 * THORNode API Client
 */

import { fromBaseUnit } from '../utils/blockchain.js';

/**
 * THORNode API provider list -- in order of preference
 *
 * @typedef {Object} ApiProvider
 * @property {string} base - THORNode API base URL (no trailing slash)
 * @property {Record<string, string>} [headers] - HTTP client headers (e.g. x-client-id)
 * @property {boolean} [supportsBlockHeight] - When true, `?height=` is appended for historical queries
 */

export const THORNODE_PROVIDERS = Object.freeze([
  {
    base: 'https://gateway.liquify.com/chain/thorchain_api',
    // Liquify doesn't accept x-client-id through their CORS configuration
    // (unlike the deprecated Nine Realms endpoints)
    supportsBlockHeight: true,
  },
  // Additional fallback providers append here. Failover, rate-limit tracking,
  // and historical-query routing are all keyed off this array — no other
  // changes needed when a new backup thornode comes online.
]);

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
const DEFAULT_CACHE_TTL = 15_000; // 15 seconds

/**
 * THORNode API Client class
 */
class ThorNodeClient {
  /**
   * Fetch from THORNode (private)
   *
   * Caching is handled by #fetchJSON / #fetchText wrappers so parsed bodies
   * are cached once and returned directly on hits (no re-parse, no Response
   * clone consumption hazards).
   *
   * @param {string} path - API endpoint path (e.g. '/thorchain/network')
   * @param {Object} [options={}] - Combined options object:
   *        - Behavior modifiers: blockHeight (cache, cacheTTL handled by wrappers)
   *        - Anything else gets passed into fetch() directly
   * @param {number|null} [options.blockHeight=null] - Query historical state at specific block height
   * @returns {Promise<Response>} Raw `Response` object from the successful provider
   */
  async #fetch(path, options = {}) {
    const {
      cache: _cache,
      cacheTTL: _cacheTTL,
      blockHeight = null,
      ...fetchInit
    } = options;
    const now = Date.now();

    let effectivePath = path;
    if (blockHeight != null) {
      const separator = path.includes('?') ? '&' : '?';
      const e_blockHeight = encodeURIComponent(blockHeight);
      effectivePath += `${separator}height=${e_blockHeight}`;
    }

    const available = THORNODE_PROVIDERS.filter(p => {
      const until = rateLimitedUntil.get(p.base) || 0;
      return until <= now;
    });
    const rateLimited = THORNODE_PROVIDERS.filter(p => {
      const until = rateLimitedUntil.get(p.base) || 0;
      return until > now;
    });
    const order = [...available, ...rateLimited];

    let lastError = null;

    for (const provider of order) {
      try {
        const requestPath = (blockHeight != null && provider.supportsBlockHeight)
          ? effectivePath
          : path;
        const url = `${provider.base}${requestPath}`;
        const fetchOpts = {
          ...fetchInit,
          headers: {
            ...(provider.headers || {}),
            ...(fetchInit.headers || {})
          }
        };

        const response = await fetch(url, fetchOpts);
        if (response.ok) {
          // Clear rate limit and failure count on success
          rateLimitedUntil.delete(provider.base);
          failureCounts.delete(provider.base);
          return response;
        }
        if (response.status === 429) {
          rateLimitedUntil.set(provider.base, Date.now() + RATE_LIMIT_COOLDOWN);
          console.warn(`Rate limited (429) on ${provider.base}, switching away for ${RATE_LIMIT_COOLDOWN / 1000}s`);
        }
        lastError = new Error(`${provider.base} failed: ${response.status}`);
        console.warn(`Endpoint failed for ${path}: ${lastError.message}`);
      } catch (error) {
        // CORS-blocked 429s show up as "Failed to fetch" here
        const count = (failureCounts.get(provider.base) || 0) + 1;
        failureCounts.set(provider.base, count);
        if (count >= 2) {
          rateLimitedUntil.set(provider.base, Date.now() + RATE_LIMIT_COOLDOWN);
          console.warn(`${provider.base} failed ${count} times, switching away for ${RATE_LIMIT_COOLDOWN / 1000}s`);
        }
        lastError = error;
        console.warn(`Endpoint failed for ${path}: ${error.message}`);
      }
    }

    console.error(`All providers failed for ${path}:`, lastError);
    throw lastError;
  }

  // ============================================
  // Wrapper methods
  // ============================================

  /**
   * Build the cache key used by #fetchJSON / #fetchText.
   * Includes format so json/text for the same path don't collide.
   */
  #cacheKey(path, options, format) {
    const { blockHeight = null } = options;
    let effectivePath = path;
    if (blockHeight != null) {
      const separator = path.includes('?') ? '&' : '?';
      effectivePath += `${separator}height=${encodeURIComponent(blockHeight)}`;
    }
    return `${format}:${effectivePath}`;
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
    const key = this.#cacheKey(path, options, 'json');
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
    const key = this.#cacheKey(path, options, 'text');
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
   * Get network data (includes RUNE price, current block height, etc.)
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getNetwork(options = {}) {
    return this.#fetchJSON('/thorchain/network', options);
  }

  /**
   * Get current upgrade proposals
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getUpgradeProposals(options = {}) {
    return this.#fetchJSON('/thorchain/upgrade_proposals', options);
  }

  /**
   * Get upgrade proposal for the provided name
   *
   * @param {string} name - name parameter
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getUpgradeProposal(name, options = {}) {
    const e_name = encodeURIComponent(name);
    return this.#fetchJSON(`/thorchain/upgrade_proposal/${e_name}`, options);
  }

  /**
   * Get last block info for all chains
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLastBlocks(options = {}) {
    return this.#fetchJSON('/thorchain/lastblock', options);
  }

  /**
   * Get last block info for all chains
   *
   * @param {string} chain - Chain identifier
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLastBlock(chain, options = {}) {
    const e_chain = encodeURIComponent(chain);
    return this.#fetchJSON(`/thorchain/lastblock/${e_chain}`, options);
  }

  /**
   * Get all pools
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getPools(options = {}) {
    return this.#fetchJSON('/thorchain/pools', options);
  }

  /**
   * Get a specific pool
   *
   * @param {string} asset - Asset identifier
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getPool(asset, options = {}) {
    const e_asset = encodeURIComponent(asset);
    return this.#fetchJSON(`/thorchain/pool/${e_asset}`, options);
  }

  /**
   * Get all nodes
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getNodes(options = {}) {
    return this.#fetchJSON('/thorchain/nodes', options);
  }

  /**
   * Get node information via address
   *
   * @param {string} address - THORChain node address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getNode(address, options = {}) {
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(`/thorchain/node/${e_address}`, options);
  }

  /**
   * Get a Mimir value
   *
   * @param {string} key - Mimir key name
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getMimir(key, options = {}) {
    const e_key = encodeURIComponent(key);
    return this.#fetchText(`/thorchain/mimir/key/${e_key}`, options);
  }

  /**
   * Get all Mimir values
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getAllMimir(options = {}) {
    return this.#fetchJSON('/thorchain/mimir', options);
  }

  /**
   * Get all current node Mimir votes
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getMimirAllNodeVotes(options = {}) {
    return this.#fetchJSON('/thorchain/mimir/nodes_all', options);
  }

  /**
   * Get balance for an address
   *
   * @param {string} address - THORChain address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getBalance(address, options = {}) {
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(
      `/cosmos/bank/v1beta1/balances/${e_address}`,
       options
    );
  }

  /**
   * Get all liquidity providers for a pool
   *
   * @param {string} pool - Pool asset identifier
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLiquidityProviders(pool, options = {}) {
    const e_pool = encodeURIComponent(pool);
    return this.#fetchJSON(
      `/thorchain/pool/${e_pool}/liquidity_providers`,
      options
    );
  }

  /**
   * Get liquidity provider data via pool and address
   *
   * @param {string} pool - Pool asset identifier
   * @param {string} address - LP address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLiquidityProvider(pool, address, options = {}) {
    const e_pool = encodeURIComponent(pool);
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(
      `/thorchain/pool/${e_pool}/liquidity_provider/${e_address}`,
      options
    );
  }

  /**
   * Get Asgard vaults
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getVaults(options = {}) {
    return this.#fetchJSON('/thorchain/vaults/asgard', options);
  }

  /**
   * Get inbound addresses
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getInboundAddresses(options = {}) {
    return this.#fetchJSON('/thorchain/inbound_addresses', options);
  }

  /**
   * Get constants
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getConstants(options = {}) {
    return this.#fetchJSON('/thorchain/constants', options);
  }

  /**
   * Get current block status
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getStatus(options = {}) {
    return this.#fetchJSON('/status', options);
  }

  /**
   * Get swap quote
   *
   * @param {Object} params - Quote parameters
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSwapQuote(params, options = {}) {
    const query = new URLSearchParams(params).toString();
    return this.#fetchJSON(`/thorchain/quote/swap?${query}`, options);
  }

  /**
   * Get saver data for a specific asset and address
   *
   * @param {string} asset - Asset identifier
   * @param {string} address - Saver address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSaver(asset, address, options = {}) {
    const e_asset = encodeURIComponent(asset);
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(
      `/thorchain/pool/${e_asset}/saver/${e_address}`,
      options
    );
  }

  /**
   * Get saver withdraw quote
   *
   * @param {Object} params - Quote parameters (asset, address, withdraw_bps)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSaverWithdrawQuote(params, options = {}) {
    const query = new URLSearchParams(params).toString();
    return this.#fetchJSON(`/thorchain/quote/saver/withdraw?${query}`, options);
  }

  /**
   * Get THORName data
   *
   * @param {string} name - THORName to look up
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getThorname(name, options = {}) {
    const e_name = encodeURIComponent(name);
    return this.#fetchJSON(`/thorchain/thorname/${e_name}`, options);
  }

  /**
   * Get all RUNE Pool information
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getRunePool(options = {}) {
    return this.#fetchJSON('/thorchain/runepool', options);
  }

  /**
   * Get all RUNE providers
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getRuneProviders(options = {}) {
    return this.#fetchJSON('/thorchain/rune_providers', options);
  }

  /**
   * Get information for RUNE provider via address
   *
   * @param {string} address - THORChain wallet address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getRuneProvider(address, options = {}) {
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(`/thorchain/rune_provider/${e_address}`, options);
  }

  /**
   * Get transaction status
   *
   * @param {string} txid - Transaction ID
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTxStatus(txid, options = {}) {
    const e_txid = encodeURIComponent(txid);
    return this.#fetchJSON(`/thorchain/tx/status/${e_txid}`, options);
  }

  /**
   * Get loan open quote
   *
   * @param {Object} params - Quote parameters (from_asset, amount, to_asset, destination)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLoanQuote(params, options = {}) {
    const query = new URLSearchParams(params).toString();
    return this.#fetchJSON(`/thorchain/quote/loan/open?${query}`, options);
  }

  /**
   * Get limit swaps summary
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLimitSwapsSummary(options = {}) {
    return this.#fetchJSON('/thorchain/queue/limit_swaps/summary', options);
  }

  /**
   * Get limit swaps
   *
   * @param {Object} params - Query parameters (offset, limit, source_asset, target_asset, sort_by, sort_order)
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getLimitSwaps(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const path = query
      ? `/thorchain/queue/limit_swaps?${query}`
      : '/thorchain/queue/limit_swaps';
    return this.#fetchJSON(path, options);
  }

  /**
   * Get all outbound fees
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getOutboundFees(options = {}) {
    return this.#fetchJSON('/thorchain/outbound_fees', options);
  }

  /**
   * Get all TCY stakers
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTcyStakers(options = {}) {
    return this.#fetchJSON('/thorchain/tcy_stakers', options);
  }

  /**
   * Get TCY staker position details
   *
   * @param {string} address - THORChain wallet address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTcyStaker(address, options = {}) {
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(`/thorchain/tcy_staker/${e_address}`, options);
  }

  /**
   * Get TCY stake module balance (accrued RUNE for distribution)
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTcyStakeModuleBalance(options = {}) {
    return this.#fetchJSON('/thorchain/balance/module/tcy_stake', options);
  }

  /**
   * Get all pending TCY claimants (those who have unclaimed TCY)
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTcyClaimers(options = {}) {
    return this.#fetchJSON('/thorchain/tcy_claimers', options);
  }

  /**
   * Get total TCY supply via CMC data
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTcyTotalSupply(options = {}) {
    return this.#fetchText('/thorchain/supply/cmc?asset=tcy&type=total', options);
  }

  /**
   * Get total supply by asset denomination
   *
   * @param {string} denom - asset denomination in lowercase (e.g. "rune")
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSupplyByDenomination(denom, options = {}) {
    const e_denom = encodeURIComponent(denom);
    return this.#fetchJSON(
      `/cosmos/bank/v1beta1/supply/by_denom?denom=${e_denom}`,
      options
    );
  }

  /**
   * Get block details from Cosmos SDK/RPC layer (GetBlockByHeight)
   *
   * @param {string} height - block height
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getCosmosBlockByHeight(height, options = {}) {
    const e_height = encodeURIComponent(height);
    return this.#fetchJSON(
      `/cosmos/base/tendermint/v1beta1/blocks/${e_height}`,
      options
    );
  }

  /**
   * Get all available oracle prices
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getOraclePrices(options = {}) {
    return this.#fetchJSON('/thorchain/oracle/prices', options);
  }

  /**
   * Get total size and ratio of all secured assets
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSecuredAssets(options = {}) {
    return this.#fetchJSON('/thorchain/securedassets', options);
  }

  /**
   * Get the clout score of an address
   *
   * @param {string} address - wallet address
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getSwapperClout(address, options = {}) {
    const e_address = encodeURIComponent(address);
    return this.#fetchJSON(
      `/thorchain/clout/swap/${e_address}`,
      options
    );
  }

  /**
   * Get total units and depth for all Trade Assets
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTradeUnits(options = {}) {
    return this.#fetchJSON('/thorchain/trade/units', options);
  }

  /**
   * Get Treasury module address and assets/balances
   *
   * @param {Object} [options={}] - Same options as #fetch
   * @returns {Promise<Object>} Parsed network data
   */
  async getTreasuryInfo(options = {}) {
    return this.#fetchJSON('/thorchain/balance/module/treasury', options);
  }
}

// Export singleton instance
export const thornode = new ThorNodeClient();

// Export class for testing or custom instances
export { ThorNodeClient };
