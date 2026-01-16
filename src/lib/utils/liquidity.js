/**
 * Liquidity Provider Utilities for THORChain
 *
 * Centralized utilities for fetching and processing LP (Liquidity Provider)
 * position data from THORChain. Handles position lookups, value calculations,
 * and profit/loss analysis.
 *
 * @module utils/liquidity
 *
 * @example
 * // Fetch a single LP position
 * import { getLPPosition } from '$lib/utils/liquidity';
 *
 * const position = await getLPPosition('BTC.BTC', 'thor1abc...');
 * if (position) {
 *   console.log(`RUNE in pool: ${position.runeRedeemValue}`);
 *   console.log(`Asset in pool: ${position.assetRedeemValue}`);
 * }
 *
 * @example
 * // Calculate LP position value and profit
 * import { getLPPosition, calculateLPValue } from '$lib/utils/liquidity';
 *
 * const position = await getLPPosition('ETH.ETH', 'thor1abc...');
 * const runePrice = 0.67;
 * const ethPrice = 3200;
 *
 * const value = calculateLPValue(position, runePrice, ethPrice);
 * console.log(`Total value: $${value.totalValue.toFixed(2)}`);
 * console.log(`Profit: ${value.profitPercentage.toFixed(2)}%`);
 */

import { thornode } from '../api/thornode.js';
import { fromBaseUnit, parseAsset } from './blockchain.js';

// ============================================
// LP Position Fetching
// ============================================

/**
 * Fetch LP position for a specific pool and address
 *
 * Returns a processed LP position object with human-readable values.
 * Returns null if no position exists (address has no LP in this pool).
 *
 * @param {string} pool - Pool asset identifier (e.g., 'BTC.BTC', 'ETH.ETH')
 * @param {string} address - LP address (thor1... for RUNE side, or asset address)
 * @param {Object} [options={}] - Fetch options
 * @param {number} [options.blockHeight] - Query at specific block height (uses archive node)
 * @returns {Promise<Object|null>} Processed LP position or null if not found
 *
 * @example
 * // Current position
 * const position = await getLPPosition('BTC.BTC', 'thor1abc...');
 *
 * // Historical position at specific block
 * const historicalPosition = await getLPPosition('BTC.BTC', 'thor1abc...', {
 *   blockHeight: 12345678
 * });
 */
export async function getLPPosition(pool, address, options = {}) {
  if (!pool || !address) {
    throw new Error('Pool and address are required');
  }

  try {
    const data = await thornode.getLiquidityProvider(pool, address, options);

    // Return null if no actual position exists
    if (!data.units || Number(data.units) === 0) {
      return null;
    }

    const parsed = parseAsset(data.asset);

    return {
      // Pool identification
      pool: data.asset,
      poolShortName: parsed.symbol,
      chain: parsed.chain,

      // Addresses
      runeAddress: data.rune_address || null,
      assetAddress: data.asset_address || null,

      // Position size
      units: Number(data.units),

      // Deposit values (what was put in)
      runeDepositValue: fromBaseUnit(data.rune_deposit_value),
      assetDepositValue: fromBaseUnit(data.asset_deposit_value),

      // Current redeem values (what can be withdrawn)
      runeRedeemValue: fromBaseUnit(data.rune_redeem_value),
      assetRedeemValue: fromBaseUnit(data.asset_redeem_value),

      // Activity tracking
      lastAddHeight: Number(data.last_add_height || 0),
      lastWithdrawHeight: Number(data.last_withdraw_height || 0),

      // Pending amounts
      pendingRune: fromBaseUnit(data.pending_rune || 0),
      pendingAsset: fromBaseUnit(data.pending_asset || 0),

      // LUVI (Liquidity Unit Value Index) tracking
      luviDepositValue: data.luvi_deposit_value || null,
      luviRedeemValue: data.luvi_redeem_value || null,
      luviGrowthPct: Number(data.luvi_growth_pct || 0),

      // Raw data for advanced use cases
      raw: data
    };
  } catch (error) {
    // 404 means no position exists - this is not an error condition
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch all LP positions for an address across specified pools
 *
 * Checks each pool sequentially to find all positions for an address.
 * Use getAvailablePools() to get the list of active pools.
 *
 * @param {string} address - LP address
 * @param {Array<string>} pools - Array of pool asset identifiers to check
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of LP position objects
 *
 * @example
 * import { getAllLPPositions, getAvailablePools } from '$lib/utils/liquidity';
 *
 * const pools = await getAvailablePools();
 * const positions = await getAllLPPositions('thor1abc...', pools);
 *
 * console.log(`Found ${positions.length} LP positions`);
 * positions.forEach(p => {
 *   console.log(`${p.poolShortName}: ${p.runeRedeemValue} RUNE`);
 * });
 */
export async function getAllLPPositions(address, pools, options = {}) {
  if (!address) {
    throw new Error('Address is required');
  }

  if (!pools || pools.length === 0) {
    return [];
  }

  const positions = [];

  for (const pool of pools) {
    try {
      const position = await getLPPosition(pool, address, options);
      if (position) {
        positions.push(position);
      }
    } catch (error) {
      // Log but continue checking other pools
      console.warn(`Failed to fetch LP position for ${pool}:`, error.message);
    }
  }

  return positions;
}

/**
 * Fetch LP positions in parallel (faster but more API calls at once)
 *
 * Use this when you need to check many pools quickly.
 * Be mindful of rate limits.
 *
 * @param {string} address - LP address
 * @param {Array<string>} pools - Array of pool asset identifiers
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of LP position objects
 */
export async function getAllLPPositionsParallel(address, pools, options = {}) {
  if (!address || !pools || pools.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    pools.map((pool) => getLPPosition(pool, address, options))
  );

  return results
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

// ============================================
// Value Calculations
// ============================================

/**
 * Calculate LP position USD value and profit/loss
 *
 * Computes the current value, deposit value, and profit/loss
 * for an LP position given current prices.
 *
 * @param {Object} position - LP position object from getLPPosition
 * @param {number} runePrice - Current RUNE price in USD
 * @param {number} assetPrice - Current asset price in USD
 * @returns {Object} Value breakdown with profit/loss
 *
 * @example
 * const position = await getLPPosition('ETH.ETH', 'thor1abc...');
 * const value = calculateLPValue(position, 0.67, 3200);
 *
 * console.log(`Current value: $${value.totalValue.toFixed(2)}`);
 * console.log(`Deposited: $${value.totalDepositUSD.toFixed(2)}`);
 * console.log(`Profit: $${value.profitUSD.toFixed(2)} (${value.profitPercentage.toFixed(2)}%)`);
 */
export function calculateLPValue(position, runePrice, assetPrice) {
  if (!position) {
    return {
      runeValue: 0,
      assetValue: 0,
      totalValue: 0,
      runeDepositUSD: 0,
      assetDepositUSD: 0,
      totalDepositUSD: 0,
      profitUSD: 0,
      profitPercentage: 0,
      isProfit: true
    };
  }

  // Current redeemable value
  const runeValue = position.runeRedeemValue * runePrice;
  const assetValue = position.assetRedeemValue * assetPrice;
  const totalValue = runeValue + assetValue;

  // Original deposit value at current prices
  // Note: This is an approximation since we don't know the prices at deposit time
  const runeDepositUSD = position.runeDepositValue * runePrice;
  const assetDepositUSD = position.assetDepositValue * assetPrice;
  const totalDepositUSD = runeDepositUSD + assetDepositUSD;

  // Profit/loss calculation
  const profitUSD = totalValue - totalDepositUSD;
  const profitPercentage = totalDepositUSD > 0 ? (profitUSD / totalDepositUSD) * 100 : 0;

  return {
    runeValue,
    assetValue,
    totalValue,
    runeDepositUSD,
    assetDepositUSD,
    totalDepositUSD,
    profitUSD,
    profitPercentage,
    isProfit: profitUSD >= 0
  };
}

/**
 * Calculate total value of multiple LP positions
 *
 * @param {Array<Object>} positions - Array of LP position objects
 * @param {number} runePrice - Current RUNE price in USD
 * @param {Object} assetPrices - Map of pool asset to USD price
 * @returns {Object} Aggregated value summary
 *
 * @example
 * const positions = await getAllLPPositions('thor1abc...', pools);
 * const assetPrices = {
 *   'BTC.BTC': 95000,
 *   'ETH.ETH': 3200,
 *   'DOGE.DOGE': 0.35
 * };
 *
 * const total = calculateTotalLPValue(positions, 0.67, assetPrices);
 * console.log(`Total LP value: $${total.totalValue.toFixed(2)}`);
 */
export function calculateTotalLPValue(positions, runePrice, assetPrices = {}) {
  if (!positions || positions.length === 0) {
    return {
      totalValue: 0,
      totalRuneValue: 0,
      totalAssetValue: 0,
      positionCount: 0
    };
  }

  let totalValue = 0;
  let totalRuneValue = 0;
  let totalAssetValue = 0;

  for (const position of positions) {
    const assetPrice = assetPrices[position.pool] || 0;
    const value = calculateLPValue(position, runePrice, assetPrice);

    totalValue += value.totalValue;
    totalRuneValue += value.runeValue;
    totalAssetValue += value.assetValue;
  }

  return {
    totalValue,
    totalRuneValue,
    totalAssetValue,
    positionCount: positions.length
  };
}

// ============================================
// Pool Utilities
// ============================================

/**
 * Get list of available (active) pools from THORNode
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<string>>} Array of available pool asset identifiers
 *
 * @example
 * const availablePools = await getAvailablePools();
 * console.log(`${availablePools.length} active pools`);
 * // => ['BTC.BTC', 'ETH.ETH', 'DOGE.DOGE', ...]
 */
export async function getAvailablePools(options = {}) {
  const pools = await thornode.getPools(options);
  return pools
    .filter((pool) => pool.status === 'Available')
    .map((pool) => pool.asset);
}

/**
 * Get all pools (including staged and suspended)
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<string>>} Array of all pool asset identifiers
 */
export async function getAllPools(options = {}) {
  const pools = await thornode.getPools(options);
  return pools.map((pool) => pool.asset);
}

/**
 * Get pool information with status
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of pool info objects
 *
 * @example
 * const pools = await getPoolsWithStatus();
 * const availablePools = pools.filter(p => p.status === 'Available');
 * const stagedPools = pools.filter(p => p.status === 'Staged');
 */
export async function getPoolsWithStatus(options = {}) {
  const pools = await thornode.getPools(options);
  return pools.map((pool) => {
    const parsed = parseAsset(pool.asset);
    return {
      asset: pool.asset,
      shortName: parsed.symbol,
      chain: parsed.chain,
      status: pool.status,
      runeDepth: fromBaseUnit(pool.balance_rune),
      assetDepth: fromBaseUnit(pool.balance_asset),
      assetPrice: fromBaseUnit(pool.asset_tor_price)
    };
  });
}

// ============================================
// Position Filtering
// ============================================

/**
 * Filter LP positions by minimum USD value
 *
 * Useful for hiding dust positions that have negligible value.
 *
 * @param {Array<Object>} positions - Array of LP position objects
 * @param {number} runePrice - Current RUNE price in USD
 * @param {Object} assetPrices - Map of pool asset to USD price
 * @param {number} [minValueUSD=1] - Minimum position value in USD
 * @returns {Array<Object>} Filtered positions
 *
 * @example
 * const positions = await getAllLPPositions('thor1abc...', pools);
 * const significantPositions = filterPositionsByValue(
 *   positions, runePrice, assetPrices, 10 // > $10
 * );
 */
export function filterPositionsByValue(positions, runePrice, assetPrices, minValueUSD = 1) {
  if (!positions) return [];

  return positions.filter((position) => {
    const assetPrice = assetPrices[position.pool] || 0;
    const value = calculateLPValue(position, runePrice, assetPrice);
    return value.totalValue >= minValueUSD;
  });
}

/**
 * Sort LP positions by total USD value (descending)
 *
 * @param {Array<Object>} positions - Array of LP position objects
 * @param {number} runePrice - Current RUNE price in USD
 * @param {Object} assetPrices - Map of pool asset to USD price
 * @returns {Array<Object>} Sorted positions (highest value first)
 */
export function sortPositionsByValue(positions, runePrice, assetPrices) {
  if (!positions) return [];

  return [...positions].sort((a, b) => {
    const valueA = calculateLPValue(a, runePrice, assetPrices[a.pool] || 0).totalValue;
    const valueB = calculateLPValue(b, runePrice, assetPrices[b.pool] || 0).totalValue;
    return valueB - valueA;
  });
}

// ============================================
// Pool Price Utilities
// ============================================

/**
 * Get the RUNE/Asset price ratio from a pool
 *
 * @param {Object} pool - Pool object from THORNode
 * @returns {number} Asset price in RUNE (how many RUNE per 1 asset)
 *
 * @example
 * const pool = await thornode.getPool('BTC.BTC');
 * const btcPriceInRune = getPoolAssetPriceInRune(pool);
 * // => 100000 (1 BTC = 100,000 RUNE)
 */
export function getPoolAssetPriceInRune(pool) {
  if (!pool || !pool.balance_rune || !pool.balance_asset) return 0;

  const runeDepth = fromBaseUnit(pool.balance_rune);
  const assetDepth = fromBaseUnit(pool.balance_asset);

  if (assetDepth === 0) return 0;

  return runeDepth / assetDepth;
}

/**
 * Get asset price in USD from a pool using RUNE price
 *
 * @param {Object} pool - Pool object from THORNode
 * @param {number} runePriceUSD - Current RUNE price in USD
 * @returns {number} Asset price in USD
 *
 * @example
 * const pool = await thornode.getPool('BTC.BTC');
 * const btcPriceUSD = getPoolAssetPriceUSD(pool, 0.67);
 * // => 67000 (BTC price in USD)
 */
export function getPoolAssetPriceUSD(pool, runePriceUSD) {
  const priceInRune = getPoolAssetPriceInRune(pool);
  return priceInRune * runePriceUSD;
}

/**
 * Convert RUNE amount to equivalent asset amount using pool ratio
 *
 * @param {number} runeAmount - Amount of RUNE
 * @param {Object} pool - Pool object from THORNode
 * @returns {number} Equivalent asset amount
 *
 * @example
 * const btcAmount = convertRuneToAsset(10000, btcPool);
 * // => 0.1 BTC (if 1 BTC = 100,000 RUNE)
 */
export function convertRuneToAsset(runeAmount, pool) {
  if (!runeAmount || !pool) return 0;

  const runeDepth = fromBaseUnit(pool.balance_rune);
  const assetDepth = fromBaseUnit(pool.balance_asset);

  if (runeDepth === 0) return 0;

  return (runeAmount / runeDepth) * assetDepth;
}

/**
 * Convert asset amount to equivalent RUNE amount using pool ratio
 *
 * @param {number} assetAmount - Amount of asset
 * @param {Object} pool - Pool object from THORNode
 * @returns {number} Equivalent RUNE amount
 *
 * @example
 * const runeAmount = convertAssetToRune(0.1, btcPool);
 * // => 10000 RUNE (if 1 BTC = 100,000 RUNE)
 */
export function convertAssetToRune(assetAmount, pool) {
  if (!assetAmount || !pool) return 0;

  const runeDepth = fromBaseUnit(pool.balance_rune);
  const assetDepth = fromBaseUnit(pool.balance_asset);

  if (assetDepth === 0) return 0;

  return (assetAmount / assetDepth) * runeDepth;
}

/**
 * Get BTC value for a RUNE amount
 *
 * Common pattern used in BondTracker and other components.
 *
 * @param {number} runeAmount - Amount of RUNE
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<number>} Equivalent BTC amount
 *
 * @example
 * const btcValue = await getRuneValueInBTC(10000);
 * console.log(`10,000 RUNE = ${btcValue.toFixed(8)} BTC`);
 */
export async function getRuneValueInBTC(runeAmount, options = {}) {
  const pool = await thornode.getPool('BTC.BTC', options);
  return convertRuneToAsset(runeAmount, pool);
}

/**
 * Build a price map for multiple pools
 *
 * Fetches all pools and builds a map of asset to USD price.
 * Useful for calculating total portfolio value.
 *
 * @param {number} runePriceUSD - Current RUNE price in USD
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object>} Map of pool asset identifier to USD price
 *
 * @example
 * const prices = await buildPoolPriceMap(0.67);
 * // => {
 * //   'BTC.BTC': 67000,
 * //   'ETH.ETH': 3200,
 * //   'DOGE.DOGE': 0.35,
 * //   ...
 * // }
 */
export async function buildPoolPriceMap(runePriceUSD, options = {}) {
  const pools = await thornode.getPools(options);
  const priceMap = {};

  for (const pool of pools) {
    if (pool.status === 'Available') {
      priceMap[pool.asset] = getPoolAssetPriceUSD(pool, runePriceUSD);
    }
  }

  return priceMap;
}

/**
 * Get pool depth information
 *
 * @param {Object} pool - Pool object from THORNode
 * @returns {Object} Depth information
 *
 * @example
 * const depth = getPoolDepth(btcPool);
 * console.log(`RUNE depth: ${depth.runeDepth.toLocaleString()}`);
 * console.log(`Asset depth: ${depth.assetDepth.toFixed(8)}`);
 */
export function getPoolDepth(pool) {
  if (!pool) {
    return { runeDepth: 0, assetDepth: 0, totalDepthRune: 0 };
  }

  const runeDepth = fromBaseUnit(pool.balance_rune);
  const assetDepth = fromBaseUnit(pool.balance_asset);

  return {
    runeDepth,
    assetDepth,
    totalDepthRune: runeDepth * 2 // Symmetric pools have equal value on both sides
  };
}

// ============================================
// LP Type Utilities
// ============================================

/**
 * LP position types
 */
export const LP_TYPES = {
  SYMMETRIC: 'Sym',
  RUNE_ASYMMETRIC: 'RUNE Asym',
  ASSET_ASYMMETRIC: 'Asset Asym'
};

/**
 * Determine the type of LP position based on addresses
 *
 * @param {string|null} runeAddress - RUNE side address (thor1...)
 * @param {string|null} assetAddress - Asset side address (chain-specific)
 * @returns {string} LP type: 'Sym', 'RUNE Asym', or 'Asset Asym'
 *
 * @example
 * // Symmetric LP (both sides deposited)
 * getLPType('thor1abc...', 'bc1xyz...');
 * // => 'Sym'
 *
 * // RUNE-only asymmetric
 * getLPType('thor1abc...', null);
 * // => 'RUNE Asym'
 *
 * // Asset-only asymmetric
 * getLPType(null, 'bc1xyz...');
 * // => 'Asset Asym'
 */
export function getLPType(runeAddress, assetAddress) {
  if (runeAddress && assetAddress) {
    return LP_TYPES.SYMMETRIC;
  }
  if (runeAddress) {
    return LP_TYPES.RUNE_ASYMMETRIC;
  }
  return LP_TYPES.ASSET_ASYMMETRIC;
}

/**
 * Determine LP type from a position object
 *
 * @param {Object} position - LP position object (from API or getLPPosition)
 * @returns {string} LP type: 'Sym', 'RUNE Asym', or 'Asset Asym'
 *
 * @example
 * const position = await getLPPosition('BTC.BTC', 'thor1abc...');
 * const type = getLPTypeFromPosition(position);
 * // => 'RUNE Asym' or 'Sym' depending on position
 */
export function getLPTypeFromPosition(position) {
  if (!position) return LP_TYPES.ASSET_ASYMMETRIC;

  // Handle both raw API response and processed position
  const runeAddress = position.runeAddress || position.rune_address;
  const assetAddress = position.assetAddress || position.asset_address;

  return getLPType(runeAddress, assetAddress);
}

/**
 * Check if LP position is symmetric (both RUNE and asset deposited)
 *
 * @param {Object} position - LP position object
 * @returns {boolean} True if symmetric position
 */
export function isSymmetricLP(position) {
  return getLPTypeFromPosition(position) === LP_TYPES.SYMMETRIC;
}

/**
 * Check if LP position is asymmetric
 *
 * @param {Object} position - LP position object
 * @returns {boolean} True if asymmetric position (either RUNE-only or asset-only)
 */
export function isAsymmetricLP(position) {
  return getLPTypeFromPosition(position) !== LP_TYPES.SYMMETRIC;
}
