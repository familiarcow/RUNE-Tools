/**
 * Pools Store
 *
 * Provides shared pool data across all components.
 * Includes derived stores for common calculations.
 */

import { writable, derived, get } from 'svelte/store';
import { thornode } from '../api/thornode.js';
import { fromBaseUnit } from '../utils/blockchain.js';

// Private state for lifecycle management
let updateInterval = null;
let subscriberCount = 0;

/**
 * Core pools store (raw pool data from THORNode)
 */
export const pools = writable([]);

/**
 * Loading state
 */
export const poolsLoading = writable(true);

/**
 * Error state
 */
export const poolsError = writable(null);

/**
 * Last update timestamp
 */
export const poolsLastUpdate = writable(null);

// ============================================
// Derived stores
// ============================================

/**
 * Pools indexed by asset identifier for quick lookup
 */
export const poolsByAsset = derived(pools, ($pools) => {
  const map = new Map();
  $pools.forEach((pool) => map.set(pool.asset, pool));
  return map;
});

/**
 * Only available (active) pools
 */
export const availablePools = derived(pools, ($pools) =>
  $pools.filter((pool) => pool.status === 'Available')
);

/**
 * Total RUNE pooled across all pools
 */
export const totalPooledRune = derived(pools, ($pools) =>
  $pools.reduce((sum, pool) => sum + fromBaseUnit(pool.balance_rune), 0)
);

/**
 * Total value locked (in RUNE terms, multiply by 2 for both sides)
 */
export const totalValueLockedRune = derived(totalPooledRune, ($total) => $total * 2);

/**
 * Pool count by status
 */
export const poolCounts = derived(pools, ($pools) => {
  const counts = { available: 0, staged: 0, suspended: 0, total: $pools.length };
  $pools.forEach((pool) => {
    if (pool.status === 'Available') counts.available++;
    else if (pool.status === 'Staged') counts.staged++;
    else if (pool.status === 'Suspended') counts.suspended++;
  });
  return counts;
});

/**
 * Pools with calculated USD prices and depths
 */
export const poolsWithPrices = derived(pools, ($pools) =>
  $pools.map((pool) => ({
    ...pool,
    usdPrice: fromBaseUnit(pool.asset_tor_price),
    runeDepth: fromBaseUnit(pool.balance_rune),
    assetDepth: fromBaseUnit(pool.balance_asset),
    // APY is stored as basis points, convert to percentage
    apr: pool.pool_apr ? Number(pool.pool_apr) / 100 : 0
  }))
);

// ============================================
// Core functions
// ============================================

/**
 * Fetch and update pool data
 */
async function fetchPools() {
  try {
    const data = await thornode.getPools({ realtime: false, preferNinerealms: true });

    pools.set(data);
    poolsLastUpdate.set(new Date());
    poolsError.set(null);
    poolsLoading.set(false);
  } catch (error) {
    poolsError.set(error.message);
    console.error('Failed to fetch pools:', error);
  }
}

/**
 * Start automatic pool updates
 * Uses reference counting to manage lifecycle
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPools() {
  subscriberCount++;

  if (subscriberCount === 1) {
    // First subscriber - start fetching
    poolsLoading.set(true);
    fetchPools();
    // Pools update less frequently, use 60 second interval
    updateInterval = setInterval(fetchPools, 60000);
  }

  // Return unsubscribe function
  return () => {
    subscriberCount--;
    if (subscriberCount === 0 && updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  };
}

/**
 * Force refresh pools
 * @returns {Promise<void>}
 */
export function refreshPools() {
  return fetchPools();
}

/**
 * Get pool by asset identifier
 * @param {string} asset - Asset identifier
 * @returns {Object|null} Pool data or null
 */
export function getPoolByAsset(asset) {
  const $poolsByAsset = get(poolsByAsset);
  return $poolsByAsset.get(asset) || null;
}

/**
 * Get asset price from pool data
 * @param {string} asset - Asset identifier
 * @returns {number} USD price or 0
 */
export function getAssetPrice(asset) {
  const pool = getPoolByAsset(asset);
  return pool ? fromBaseUnit(pool.asset_tor_price) : 0;
}

/**
 * Check if pools store is currently active
 * @returns {boolean}
 */
export function isPoolsActive() {
  return subscriberCount > 0;
}
