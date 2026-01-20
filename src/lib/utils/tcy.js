/**
 * TCY (THORChain Yield) Utilities
 *
 * Provides centralized data fetching and calculations for TCY-related functionality.
 * Used by both TCY.svelte (yield tracker) and TCYClaims.svelte (claims tracker).
 *
 * @module utils/tcy
 *
 * @example
 * import { getTCYPrice, getTCYStaker, TCY_TOTAL_SUPPLY } from '$lib/utils/tcy';
 *
 * const price = await getTCYPrice();
 * const staker = await getTCYStaker('thor1...');
 */

import { fetchJSONWithFallback, THORNODE_ENDPOINTS, MIDGARD_ENDPOINTS } from './api.js';
import { fromBaseUnit } from './blockchain.js';
// Import general network functions and re-export for backwards compatibility
import { getRunePrice, getCurrentBlock } from './network.js';
export { getRunePrice, getCurrentBlock };

// ============================================
// Constants
// ============================================

/**
 * Total TCY supply (210 million)
 * @constant {number}
 */
export const TCY_TOTAL_SUPPLY = 210_000_000;

/**
 * TCY distribution interval in blocks (every ~24 hours)
 * @constant {number}
 */
export const TCY_DISTRIBUTION_INTERVAL = 14400;

/**
 * TCY asset identifier
 * @constant {string}
 */
export const TCY_ASSET = 'THOR.TCY';

/**
 * TCY-related mimir keys
 * @constant {string[]}
 */
export const TCY_MIMIR_KEYS = [
  'TCYCLAIMINGHALT',
  'TCYCLAIMINGSWAPHALT',
  'TCYSTAKEDISTRIBUTIONHALT',
  'TCYSTAKINGHALT',
  'TCYUNSTAKINGHALT',
  'HALTTCYTRADING'
];

/**
 * TCY-related constant keys
 * @constant {string[]}
 */
export const TCY_CONSTANT_KEYS = [
  'MinRuneForTCYStakeDistribution',
  'MinTCYForTCYStakeDistribution',
  'TCYStakeSystemIncomeBps'
];

// ============================================
// Price Fetching
// ============================================

/**
 * Fetch TCY price in USD from THORNode pools
 *
 * @returns {Promise<number>} TCY price in USD
 *
 * @example
 * const tcyPrice = await getTCYPrice();
 * console.log(`TCY Price: $${tcyPrice.toFixed(2)}`);
 */
export async function getTCYPrice() {
  try {
    const poolsData = await fetchJSONWithFallback('/thorchain/pools');
    const tcyPool = poolsData.find(pool => pool.asset === TCY_ASSET);
    if (tcyPool) {
      return fromBaseUnit(tcyPool.asset_tor_price);
    }
    return 0;
  } catch (error) {
    console.error('Error fetching TCY price:', error);
    return 0;
  }
}

// getRunePrice is now imported from network.js and re-exported above

/**
 * Fetch both TCY and RUNE prices at once
 *
 * @returns {Promise<{tcyPriceUSD: number, runePriceUSD: number}>} Price data
 *
 * @example
 * const { tcyPriceUSD, runePriceUSD } = await getPrices();
 */
export async function getPrices() {
  const [tcyPriceUSD, runePriceUSD] = await Promise.all([
    getTCYPrice(),
    getRunePrice()
  ]);
  return { tcyPriceUSD, runePriceUSD };
}

// ============================================
// TCY Pool Data
// ============================================

/**
 * Fetch TCY pool data including depth and liquidity
 *
 * @returns {Promise<Object|null>} Pool data object or null if not found
 *
 * @example
 * const pool = await getTCYPool();
 * if (pool) {
 *   console.log(`TCY Depth: ${pool.balanceAsset} TCY`);
 * }
 */
export async function getTCYPool() {
  try {
    const poolsData = await fetchJSONWithFallback('/thorchain/pools');
    const tcyPool = poolsData.find(pool => pool.asset === TCY_ASSET);

    if (!tcyPool) return null;

    return {
      balanceRune: fromBaseUnit(tcyPool.balance_rune),
      balanceAsset: fromBaseUnit(tcyPool.balance_asset),
      assetPrice: fromBaseUnit(tcyPool.asset_tor_price),
      runeDepth: fromBaseUnit(tcyPool.balance_rune) * 2, // Total pool depth in RUNE
      liquidity: fromBaseUnit(tcyPool.balance_asset) * fromBaseUnit(tcyPool.asset_tor_price) * 2
    };
  } catch (error) {
    console.error('Error fetching TCY pool:', error);
    return null;
  }
}

/**
 * Calculate TCY pool liquidity in USD
 *
 * @returns {Promise<number>} Total liquidity in USD
 *
 * @example
 * const liquidity = await getTCYLiquidity();
 * console.log(`TCY Pool Liquidity: $${liquidity.toLocaleString()}`);
 */
export async function getTCYLiquidity() {
  const pool = await getTCYPool();
  return pool?.liquidity || 0;
}

// ============================================
// Staker Data
// ============================================

/**
 * Fetch all TCY stakers
 *
 * @returns {Promise<Array<{address: string, amount: number}>>} Array of staker objects
 *
 * @example
 * const stakers = await getTCYStakers();
 * console.log(`Total stakers: ${stakers.length}`);
 */
export async function getTCYStakers() {
  try {
    const data = await fetchJSONWithFallback('/thorchain/tcy_stakers');
    if (!data.tcy_stakers) return [];

    return data.tcy_stakers.map(staker => ({
      address: staker.address,
      amount: fromBaseUnit(staker.amount)
    }));
  } catch (error) {
    console.error('Error fetching TCY stakers:', error);
    return [];
  }
}

/**
 * Fetch a specific TCY staker's data
 *
 * @param {string} address - THORChain address
 * @returns {Promise<{address: string, amount: number}|null>} Staker data or null
 *
 * @example
 * const staker = await getTCYStaker('thor1abc...');
 * if (staker) {
 *   console.log(`Staked: ${staker.amount} TCY`);
 * }
 */
export async function getTCYStaker(address) {
  if (!address) return null;

  try {
    const data = await fetchJSONWithFallback(`/thorchain/tcy_staker/${address}`);
    return {
      address: data.address || address,
      amount: fromBaseUnit(data.amount)
    };
  } catch (error) {
    console.error('Error fetching TCY staker:', error);
    return null;
  }
}

/**
 * Get a random TCY staker address (useful for demo/testing)
 *
 * @returns {Promise<string|null>} Random staker address or null
 *
 * @example
 * const randomAddress = await getRandomTCYStaker();
 * if (randomAddress) {
 *   console.log(`Random staker: ${randomAddress}`);
 * }
 */
export async function getRandomTCYStaker() {
  try {
    const stakers = await getTCYStakers();
    if (stakers.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * stakers.length);
    return stakers[randomIndex].address;
  } catch (error) {
    console.error('Error getting random TCY staker:', error);
    return null;
  }
}

/**
 * Calculate total staked TCY across all stakers
 *
 * @returns {Promise<number>} Total staked TCY amount
 *
 * @example
 * const totalStaked = await getTotalStakedTCY();
 * console.log(`Total staked: ${totalStaked.toLocaleString()} TCY`);
 */
export async function getTotalStakedTCY() {
  try {
    const stakers = await getTCYStakers();
    return stakers.reduce((sum, staker) => sum + staker.amount, 0);
  } catch (error) {
    console.error('Error calculating total staked TCY:', error);
    return 0;
  }
}

// ============================================
// Mimir & Constants
// ============================================

/**
 * Fetch TCY-related mimir values
 *
 * @returns {Promise<Object>} Object with mimir key-value pairs
 *
 * @example
 * const mimir = await getTCYMimir();
 * if (mimir.TCYSTAKINGHALT === 1) {
 *   console.log('TCY staking is halted');
 * }
 */
export async function getTCYMimir() {
  try {
    const mimirData = await fetchJSONWithFallback('/thorchain/mimir');

    const result = {};
    for (const key of TCY_MIMIR_KEYS) {
      result[key] = mimirData[key] ?? null;
    }

    return result;
  } catch (error) {
    console.error('Error fetching TCY mimir:', error);
    return {};
  }
}

/**
 * Fetch TCY-related constants
 *
 * @returns {Promise<Object>} Object with constant key-value pairs
 *
 * @example
 * const constants = await getTCYConstants();
 * console.log(`Min RUNE for distribution: ${constants.MinRuneForTCYStakeDistribution}`);
 */
export async function getTCYConstants() {
  try {
    const constantsData = await fetchJSONWithFallback('/thorchain/constants');

    return {
      MinRuneForTCYStakeDistribution: fromBaseUnit(constantsData.int_64_values?.MinRuneForTCYStakeDistribution),
      MinTCYForTCYStakeDistribution: fromBaseUnit(constantsData.int_64_values?.MinTCYForTCYStakeDistribution),
      TCYStakeSystemIncomeBps: Number(constantsData.int_64_values?.TCYStakeSystemIncomeBps) || 0
    };
  } catch (error) {
    console.error('Error fetching TCY constants:', error);
    return {
      MinRuneForTCYStakeDistribution: 0,
      MinTCYForTCYStakeDistribution: 0,
      TCYStakeSystemIncomeBps: 0
    };
  }
}

/**
 * Check if any TCY operation is halted
 *
 * @returns {Promise<Object>} Object with halt status for each operation
 *
 * @example
 * const halts = await checkTCYHalts();
 * if (halts.anyHalted) {
 *   console.log('Some TCY operations are halted');
 * }
 */
export async function checkTCYHalts() {
  const mimir = await getTCYMimir();

  return {
    claimingHalted: mimir.TCYCLAIMINGHALT === 1,
    claimingSwapHalted: mimir.TCYCLAIMINGSWAPHALT === 1,
    distributionHalted: mimir.TCYSTAKEDISTRIBUTIONHALT === 1,
    stakingHalted: mimir.TCYSTAKINGHALT === 1,
    unstakingHalted: mimir.TCYUNSTAKINGHALT === 1,
    tradingHalted: mimir.HALTTCYTRADING === 1,
    anyHalted: Object.values(mimir).some(v => v === 1)
  };
}

// ============================================
// Distribution Data
// ============================================

/**
 * Fetch distribution history for a staker from Midgard
 *
 * @param {string} address - THORChain address
 * @returns {Promise<{distributions: Array, total: number}>} Distribution data
 *
 * @example
 * const history = await getTCYDistributionHistory('thor1abc...');
 * console.log(`Total distributed: ${history.total} RUNE`);
 */
export async function getTCYDistributionHistory(address) {
  if (!address) return { distributions: [], total: 0 };

  try {
    const data = await fetchJSONWithFallback(
      `/v2/tcy/distribution/${address}`,
      {},
      MIDGARD_ENDPOINTS
    );

    const distributions = (data.distributions || [])
      .map(d => ({
        date: Number(d.date),
        amount: fromBaseUnit(d.amount)
      }))
      .sort((a, b) => b.date - a.date);

    return {
      distributions,
      total: fromBaseUnit(data.total)
    };
  } catch (error) {
    console.error('Error fetching TCY distribution history:', error);
    return { distributions: [], total: 0 };
  }
}

/**
 * Fetch TCY stake module balance (accrued RUNE for distribution)
 *
 * @returns {Promise<{rune: number, tcy: number}>} Module balances
 *
 * @example
 * const balance = await getTCYStakeModuleBalance();
 * console.log(`Accrued RUNE: ${balance.rune}`);
 */
export async function getTCYStakeModuleBalance() {
  try {
    const data = await fetchJSONWithFallback('/thorchain/balance/module/tcy_stake');

    const runeBalance = data.coins?.find(c => c.denom === 'rune');
    const tcyBalance = data.coins?.find(c => c.denom === 'tcy');

    return {
      rune: fromBaseUnit(runeBalance?.amount || 0),
      tcy: fromBaseUnit(tcyBalance?.amount || 0)
    };
  } catch (error) {
    console.error('Error fetching TCY stake module balance:', error);
    return { rune: 0, tcy: 0 };
  }
}

// ============================================
// Claims Data
// ============================================

/**
 * Fetch all TCY claimers (those who still have unclaimed TCY)
 *
 * @returns {Promise<Array<{address: string, amount: number}>>} Array of claimer objects
 *
 * @example
 * const claimers = await getTCYClaimers();
 * console.log(`Remaining claimers: ${claimers.length}`);
 */
export async function getTCYClaimers() {
  try {
    const data = await fetchJSONWithFallback('/thorchain/tcy_claimers');
    if (!data.tcy_claimers) return [];

    return data.tcy_claimers.map(claimer => ({
      address: claimer.l1_address,
      amount: fromBaseUnit(claimer.amount)
    }));
  } catch (error) {
    console.error('Error fetching TCY claimers:', error);
    return [];
  }
}

/**
 * Get set of addresses that still have unclaimed TCY
 *
 * @returns {Promise<Set<string>>} Set of addresses with remaining claims
 *
 * @example
 * const remaining = await getRemainingClaimAddresses();
 * if (remaining.has('thor1abc...')) {
 *   console.log('Address has unclaimed TCY');
 * }
 */
export async function getRemainingClaimAddresses() {
  const claimers = await getTCYClaimers();
  return new Set(claimers.map(c => c.address));
}

// ============================================
// Market Cap & Supply
// ============================================

/**
 * Fetch TCY total supply from Nine Realms API
 *
 * @returns {Promise<number>} Total TCY supply
 *
 * @example
 * const supply = await getTCYTotalSupply();
 * console.log(`Total supply: ${supply.toLocaleString()} TCY`);
 */
export async function getTCYTotalSupply() {
  try {
    const response = await fetch('https://api.ninerealms.com/thorchain/supply/cmc?asset=tcy&type=total');
    const supply = await response.json();
    return Number(supply) || TCY_TOTAL_SUPPLY;
  } catch (error) {
    console.error('Error fetching TCY total supply:', error);
    return TCY_TOTAL_SUPPLY;
  }
}

/**
 * Calculate TCY market cap
 *
 * @returns {Promise<number>} Market cap in USD
 *
 * @example
 * const marketCap = await getTCYMarketCap();
 * console.log(`TCY Market Cap: $${marketCap.toLocaleString()}`);
 */
export async function getTCYMarketCap() {
  try {
    const [supply, price] = await Promise.all([
      getTCYTotalSupply(),
      getTCYPrice()
    ]);
    return supply * price;
  } catch (error) {
    console.error('Error calculating TCY market cap:', error);
    return 0;
  }
}

/**
 * Fetch RUNE total supply and calculate market cap
 *
 * @returns {Promise<{supply: number, marketCap: number}>} RUNE supply and market cap
 *
 * @example
 * const rune = await getRuneSupplyAndMarketCap();
 * console.log(`RUNE Market Cap: $${rune.marketCap.toLocaleString()}`);
 */
export async function getRuneSupplyAndMarketCap() {
  try {
    const [data, price] = await Promise.all([
      fetchJSONWithFallback('/cosmos/bank/v1beta1/supply/by_denom?denom=rune'),
      getRunePrice()
    ]);

    const supply = fromBaseUnit(data.amount?.amount || 0);
    const marketCap = supply * price;

    return { supply, marketCap };
  } catch (error) {
    console.error('Error fetching RUNE supply and market cap:', error);
    return { supply: 0, marketCap: 0 };
  }
}

// ============================================
// Current Block & Distribution Timing
// ============================================

/**
 * Fetch current block height from THORChain
 *
 * Uses multiple fallback endpoints for reliability:
 * 1. RPC status endpoint (fastest)
 * 2. Cosmos tendermint endpoint
 * 3. THORNode lastblock endpoint
 *
 * @returns {Promise<number>} Current block height
 *
 * @example
 * const block = await getCurrentBlock();
 * console.log(`Current block: ${block}`);
 */
// getCurrentBlock is now imported from network.js and re-exported above

/**
 * Calculate next distribution block
 *
 * @param {number} currentBlock - Current block height
 * @returns {{nextBlock: number, blocksRemaining: number}} Distribution block info
 *
 * @example
 * const current = await getCurrentBlock();
 * const { nextBlock, blocksRemaining } = getNextDistributionBlock(current);
 */
export function getNextDistributionBlock(currentBlock) {
  const nextBlock = TCY_DISTRIBUTION_INTERVAL * Math.ceil(currentBlock / TCY_DISTRIBUTION_INTERVAL);
  const blocksRemaining = nextBlock - currentBlock;

  return { nextBlock, blocksRemaining };
}

/**
 * Calculate user's share of next TCY distribution
 *
 * @param {number} stakedAmount - User's staked TCY amount
 * @param {number} totalEstimatedRune - Total estimated RUNE to be distributed
 * @returns {number} User's estimated share in RUNE
 *
 * @example
 * const share = calculateUserDistributionShare(1000000, 500);
 * console.log(`Your share: ${share} RUNE`);
 */
export function calculateUserDistributionShare(stakedAmount, totalEstimatedRune) {
  if (!stakedAmount || stakedAmount <= 0) return 0;

  const userShare = stakedAmount / TCY_TOTAL_SUPPLY;
  return totalEstimatedRune * userShare;
}

// ============================================
// Historical Price Data
// ============================================

/**
 * Fetch historical RUNE prices from Midgard
 *
 * @param {number} count - Number of intervals to fetch
 * @returns {Promise<Array>} Array of price intervals
 *
 * @example
 * const prices = await getHistoricalRunePrices(30);
 * console.log(`Got ${prices.length} price intervals`);
 */
export async function getHistoricalRunePrices(count = 30) {
  try {
    const data = await fetchJSONWithFallback(
      `/v2/history/rune?interval=day&count=${count}`,
      {},
      MIDGARD_ENDPOINTS
    );
    return data.intervals || [];
  } catch (error) {
    console.error('Error fetching historical RUNE prices:', error);
    return [];
  }
}

/**
 * Get RUNE price for a specific timestamp from historical data
 *
 * @param {Array} priceIntervals - Historical price intervals
 * @param {number} timestamp - Unix timestamp (seconds)
 * @param {number} fallbackPrice - Price to use if no historical data found
 * @returns {number} RUNE price in USD
 *
 * @example
 * const prices = await getHistoricalRunePrices(30);
 * const historicPrice = getHistoricalPriceForTimestamp(prices, 1699900000, 1.50);
 */
export function getHistoricalPriceForTimestamp(priceIntervals, timestamp, fallbackPrice = 0) {
  if (!priceIntervals || priceIntervals.length === 0) return fallbackPrice;

  const interval = priceIntervals.find(i => {
    const startTime = Number(i.startTime);
    const endTime = Number(i.endTime);
    return timestamp >= startTime && timestamp <= endTime;
  });

  if (interval) {
    return Number(interval.runePriceUSD);
  }

  return fallbackPrice;
}
