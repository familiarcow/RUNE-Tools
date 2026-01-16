/**
 * Wallet Balance Utilities for THORChain
 *
 * Centralized utilities for fetching and processing wallet balances
 * from THORChain addresses. Handles denom-to-asset conversion and
 * provides convenient methods for common balance operations.
 *
 * @module utils/wallet
 *
 * @example
 * // Basic usage - fetch all balances for an address
 * import { getWalletBalances } from '$lib/utils/wallet';
 *
 * const balances = await getWalletBalances('thor1abc...');
 * // => [{ denom: 'rune', asset: 'THOR.RUNE', amount: 1234.56, rawAmount: '123456000000' }, ...]
 *
 * @example
 * // Get just the RUNE balance
 * import { getRuneBalance } from '$lib/utils/wallet';
 *
 * const runeBalance = await getRuneBalance('thor1abc...');
 * // => 1234.56
 *
 * @example
 * // Calculate total wallet value in USD
 * import { getWalletBalances, calculateWalletValue } from '$lib/utils/wallet';
 *
 * const balances = await getWalletBalances('thor1abc...');
 * const totalUSD = calculateWalletValue(balances, assetPrices, runePrice);
 */

import { thornode } from '../api/thornode.js';
import { fromBaseUnit } from './blockchain.js';

// ============================================
// Denom Mapping
// ============================================

/**
 * Known THORChain denominations mapped to full asset identifiers
 * @constant {Object}
 */
export const DENOM_TO_ASSET = {
  rune: 'THOR.RUNE',
  tcy: 'THOR.TCY',
  ruji: 'THOR.RUJI'
};

/**
 * Convert a THORChain denom string to a full asset identifier
 *
 * The Cosmos bank module returns balances with short denom strings
 * (e.g., 'rune', 'tcy'). This function converts them to full THORChain
 * asset identifiers (e.g., 'THOR.RUNE', 'THOR.TCY').
 *
 * @param {string} denom - The denom string from Cosmos bank API
 * @returns {string} Full asset identifier (e.g., 'THOR.RUNE')
 *
 * @example
 * denomToAsset('rune')  // => 'THOR.RUNE'
 * denomToAsset('tcy')   // => 'THOR.TCY'
 * denomToAsset('ruji')  // => 'THOR.RUJI'
 * denomToAsset('OTHER') // => 'THOR.OTHER'
 */
export function denomToAsset(denom) {
  if (!denom) return '';

  const lowerDenom = denom.toLowerCase();

  // Check known mappings first
  if (DENOM_TO_ASSET[lowerDenom]) {
    return DENOM_TO_ASSET[lowerDenom];
  }

  // Default: uppercase with THOR chain prefix
  return `THOR.${denom.toUpperCase()}`;
}

/**
 * Convert a full asset identifier back to a denom string
 *
 * @param {string} asset - Full asset identifier (e.g., 'THOR.RUNE')
 * @returns {string} Denom string (e.g., 'rune')
 *
 * @example
 * assetToDenom('THOR.RUNE') // => 'rune'
 * assetToDenom('THOR.TCY')  // => 'tcy'
 */
export function assetToDenom(asset) {
  if (!asset) return '';

  // Extract the symbol part after the chain prefix
  const parts = asset.split('.');
  if (parts.length < 2) return asset.toLowerCase();

  return parts[1].toLowerCase();
}

// ============================================
// Balance Fetching
// ============================================

/**
 * Fetch all wallet balances for a THORChain address
 *
 * Returns an array of balance objects with both raw and human-readable amounts.
 * Uses the THORNode API client which handles provider failover automatically.
 *
 * @param {string} address - THORChain address (thor1...)
 * @param {Object} [options={}] - Fetch options passed to thornode client
 * @param {boolean} [options.cache=true] - Whether to use cached data
 * @param {boolean} [options.realtime=true] - Use realtime provider
 * @returns {Promise<Array<Object>>} Array of balance objects
 *
 * @example
 * const balances = await getWalletBalances('thor1abc...');
 * // Returns:
 * // [
 * //   {
 * //     denom: 'rune',
 * //     asset: 'THOR.RUNE',
 * //     rawAmount: '123456000000',
 * //     amount: 1234.56
 * //   },
 * //   {
 * //     denom: 'tcy',
 * //     asset: 'THOR.TCY',
 * //     rawAmount: '98765432100',
 * //     amount: 987.654321
 * //   }
 * // ]
 */
export async function getWalletBalances(address, options = {}) {
  if (!address) {
    throw new Error('Address is required');
  }

  const data = await thornode.getBalance(address, options);
  const balances = data.balances || [];

  return balances.map((balance) => ({
    denom: balance.denom,
    asset: denomToAsset(balance.denom),
    rawAmount: balance.amount,
    amount: fromBaseUnit(balance.amount)
  }));
}

/**
 * Fetch a specific token balance for an address
 *
 * @param {string} address - THORChain address
 * @param {string} denom - Token denom to look for (e.g., 'rune', 'tcy')
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object|null>} Balance object or null if not found
 *
 * @example
 * const tcyBalance = await getTokenBalance('thor1abc...', 'tcy');
 * if (tcyBalance) {
 *   console.log(`TCY balance: ${tcyBalance.amount}`);
 * }
 */
export async function getTokenBalance(address, denom, options = {}) {
  const balances = await getWalletBalances(address, options);
  return balances.find((b) => b.denom.toLowerCase() === denom.toLowerCase()) || null;
}

/**
 * Fetch RUNE balance for an address
 *
 * Convenience function that returns just the RUNE amount.
 *
 * @param {string} address - THORChain address
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<number>} RUNE balance in human-readable units
 *
 * @example
 * const runeBalance = await getRuneBalance('thor1abc...');
 * console.log(`RUNE: ${runeBalance.toLocaleString()}`);
 */
export async function getRuneBalance(address, options = {}) {
  const balance = await getTokenBalance(address, 'rune', options);
  return balance?.amount || 0;
}

/**
 * Fetch TCY balance for an address
 *
 * Convenience function that returns just the TCY amount.
 *
 * @param {string} address - THORChain address
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<number>} TCY balance in human-readable units
 *
 * @example
 * const tcyBalance = await getTcyBalance('thor1abc...');
 */
export async function getTcyBalance(address, options = {}) {
  const balance = await getTokenBalance(address, 'tcy', options);
  return balance?.amount || 0;
}

/**
 * Fetch multiple wallet balances in parallel
 *
 * Efficiently fetches balances for multiple addresses concurrently.
 * Returns a Map for easy lookup by address.
 *
 * @param {Array<string>} addresses - Array of THORChain addresses
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Map<string, Object>>} Map of address to result object
 *
 * @example
 * const addresses = ['thor1abc...', 'thor1def...', 'thor1ghi...'];
 * const results = await getMultipleWalletBalances(addresses);
 *
 * for (const [address, result] of results) {
 *   if (result.error) {
 *     console.log(`${address}: Error - ${result.error}`);
 *   } else {
 *     console.log(`${address}: ${result.balances.length} tokens`);
 *   }
 * }
 */
export async function getMultipleWalletBalances(addresses, options = {}) {
  if (!addresses || addresses.length === 0) {
    return new Map();
  }

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        const balances = await getWalletBalances(address, options);
        return { address, balances, error: null };
      } catch (error) {
        return { address, balances: [], error: error.message };
      }
    })
  );

  return new Map(results.map((r) => [r.address, r]));
}

// ============================================
// Value Calculations
// ============================================

/**
 * Calculate total USD value of wallet balances
 *
 * @param {Array<Object>} balances - Array of balance objects from getWalletBalances
 * @param {Object} assetPrices - Map of asset identifier to USD price
 * @param {number} runePrice - Current RUNE price in USD
 * @returns {number} Total USD value
 *
 * @example
 * const balances = await getWalletBalances('thor1abc...');
 * const assetPrices = { 'THOR.TCY': 0.15 }; // TCY price from external source
 * const runePrice = 0.67;
 *
 * const totalValue = calculateWalletValue(balances, assetPrices, runePrice);
 * console.log(`Total value: $${totalValue.toFixed(2)}`);
 */
export function calculateWalletValue(balances, assetPrices = {}, runePrice = 0) {
  if (!balances || balances.length === 0) return 0;

  return balances.reduce((total, balance) => {
    // RUNE uses runePrice
    if (balance.denom.toLowerCase() === 'rune') {
      return total + balance.amount * runePrice;
    }

    // Other assets use assetPrices map
    const price = assetPrices[balance.asset];
    if (price) {
      return total + balance.amount * price;
    }

    return total;
  }, 0);
}

/**
 * Filter balances to only include those above a minimum value
 *
 * Useful for filtering out dust balances that are too small to display.
 *
 * @param {Array<Object>} balances - Array of balance objects
 * @param {number} [minAmount=0.01] - Minimum amount threshold
 * @returns {Array<Object>} Filtered balances
 *
 * @example
 * const balances = await getWalletBalances('thor1abc...');
 * const significantBalances = filterDustBalances(balances, 1); // > 1 unit
 */
export function filterDustBalances(balances, minAmount = 0.01) {
  if (!balances) return [];
  return balances.filter((b) => b.amount >= minAmount);
}

/**
 * Get a summary of wallet balances
 *
 * Returns a simplified object with just the essential information.
 *
 * @param {Array<Object>} balances - Array of balance objects
 * @param {Object} assetPrices - Map of asset identifier to USD price
 * @param {number} runePrice - Current RUNE price in USD
 * @returns {Object} Wallet summary
 *
 * @example
 * const balances = await getWalletBalances('thor1abc...');
 * const summary = getWalletSummary(balances, prices, runePrice);
 * // => {
 * //   totalTokens: 3,
 * //   runeBalance: 1234.56,
 * //   totalValueUSD: 5678.90,
 * //   tokens: { 'THOR.RUNE': 1234.56, 'THOR.TCY': 9876.54, ... }
 * // }
 */
export function getWalletSummary(balances, assetPrices = {}, runePrice = 0) {
  if (!balances || balances.length === 0) {
    return {
      totalTokens: 0,
      runeBalance: 0,
      totalValueUSD: 0,
      tokens: {}
    };
  }

  const runeBalance =
    balances.find((b) => b.denom.toLowerCase() === 'rune')?.amount || 0;

  const tokens = balances.reduce((acc, b) => {
    acc[b.asset] = b.amount;
    return acc;
  }, {});

  return {
    totalTokens: balances.length,
    runeBalance,
    totalValueUSD: calculateWalletValue(balances, assetPrices, runePrice),
    tokens
  };
}
