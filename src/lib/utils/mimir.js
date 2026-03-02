/**
 * Shared Mimir Cache Module
 *
 * Fetches ALL mimir values once via /thorchain/mimir, caches for 5 minutes,
 * and serves individual key lookups from memory. Reduces redundant mimir
 * requests across components from ~28+/min to ~0.2/min.
 *
 * Key lookups are case-insensitive to match the behavior of the individual
 * /thorchain/mimir/key/X endpoint (which accepts any case), since the full
 * /thorchain/mimir endpoint returns uppercase keys.
 *
 * @module utils/mimir
 *
 * @example
 * import { getMimirValue, getAllMimir } from '$lib/utils/mimir';
 *
 * const churnInterval = await getMimirValue('CHURNINTERVAL');
 * const maxSupply = await getMimirValue('MaxRuneSupply'); // case-insensitive
 * const allValues = await getAllMimir();
 */

import { thornode } from '../api/thornode.js';

let cache = null;
let cacheUpperMap = null; // uppercase key -> original key mapping
let cacheTimestamp = 0;
const CACHE_TTL = 300_000; // 5 minutes

/**
 * Get all mimir values (cached 5 min)
 *
 * @returns {Promise<Object>} Full mimir key-value object
 */
export async function getAllMimir() {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL) return cache;
  cache = await thornode.getAllMimir();
  // Build uppercase lookup index for case-insensitive getMimirValue
  cacheUpperMap = {};
  for (const key of Object.keys(cache)) {
    cacheUpperMap[key.toUpperCase()] = key;
  }
  cacheTimestamp = now;
  return cache;
}

/**
 * Get a single mimir value by key (cached 5 min)
 *
 * Lookup is case-insensitive: 'MaxRuneSupply' and 'MAXRUNESUPPLY' both work.
 * Values are numbers from the JSON response (no Number() conversion needed).
 *
 * @param {string} key - Mimir key (e.g., 'CHURNINTERVAL', 'MaxRuneSupply')
 * @returns {Promise<number|null>} Mimir value or null if not set
 */
export async function getMimirValue(key) {
  const mimir = await getAllMimir();
  // Try exact match first, then case-insensitive
  if (key in mimir) return mimir[key];
  const originalKey = cacheUpperMap[key.toUpperCase()];
  return originalKey ? mimir[originalKey] : null;
}

/**
 * Get multiple mimir values (cached 5 min)
 *
 * Lookup is case-insensitive for each key.
 *
 * @param {string[]} keys - Array of mimir keys
 * @returns {Promise<Object>} Object mapping keys to values (null if not set)
 */
export async function getMimirValues(keys) {
  const mimir = await getAllMimir();
  return Object.fromEntries(keys.map(k => {
    if (k in mimir) return [k, mimir[k]];
    const originalKey = cacheUpperMap[k.toUpperCase()];
    return [k, originalKey ? mimir[originalKey] : null];
  }));
}
