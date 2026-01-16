/**
 * Financial Calculation Utilities for THORChain
 *
 * Provides APY/APR calculations, yield estimations, and other
 * financial calculations commonly used across RUNE Tools components.
 *
 * @module utils/calculations
 *
 * @example
 * // Calculate APY from bond rewards
 * import { calculateAPY, calculateAPR } from '$lib/utils/calculations';
 *
 * const apr = calculateAPR(reward, principal, daysSinceLastChurn);
 * const apy = calculateAPY(apr);
 * console.log(`APR: ${(apr * 100).toFixed(2)}%, APY: ${(apy * 100).toFixed(2)}%`);
 */

import { TIME_CONSTANTS } from './blockchain.js';

// ============================================
// APR/APY Calculations
// ============================================

/**
 * Calculate Annual Percentage Rate (APR) from rewards and principal
 *
 * APR represents simple interest - the rate without compounding.
 *
 * @param {number} reward - Reward amount earned
 * @param {number} principal - Principal amount (what's earning the reward)
 * @param {number} timePeriodSeconds - Time period over which reward was earned (in seconds)
 * @returns {number} APR as a decimal (0.10 = 10%)
 *
 * @example
 * // Earned 100 RUNE on 10,000 RUNE over 30 days
 * const reward = 100;
 * const principal = 10000;
 * const thirtyDaysInSeconds = 30 * 24 * 3600;
 *
 * const apr = calculateAPR(reward, principal, thirtyDaysInSeconds);
 * // => 0.1217 (12.17% APR)
 */
export function calculateAPR(reward, principal, timePeriodSeconds) {
  if (!reward || !principal || principal === 0 || !timePeriodSeconds || timePeriodSeconds === 0) {
    return 0;
  }

  // Convert time period to years
  const timePeriodYears = timePeriodSeconds / TIME_CONSTANTS.YEAR;

  // Calculate rate over the period
  const rateForPeriod = reward / principal;

  // Annualize the rate
  const apr = rateForPeriod / timePeriodYears;

  return apr;
}

/**
 * Calculate Annual Percentage Yield (APY) from APR
 *
 * APY accounts for compound interest. Uses daily compounding by default.
 * Formula: APY = (1 + APR/n)^n - 1, where n = compounding periods per year
 *
 * @param {number} apr - Annual Percentage Rate as a decimal
 * @param {number} [compoundingPeriods=365] - Compounding periods per year (365 = daily)
 * @returns {number} APY as a decimal (0.1047 = 10.47%)
 *
 * @example
 * const apr = 0.10; // 10% APR
 * const apy = calculateAPY(apr);
 * // => 0.1052 (10.52% APY with daily compounding)
 *
 * const apyMonthly = calculateAPY(apr, 12);
 * // => 0.1047 (10.47% APY with monthly compounding)
 */
export function calculateAPY(apr, compoundingPeriods = 365) {
  if (!apr || apr === 0) return 0;

  const apy = Math.pow(1 + apr / compoundingPeriods, compoundingPeriods) - 1;
  return apy;
}

/**
 * Calculate APR directly from reward and principal with time in days
 *
 * Convenience function for the common case of knowing days elapsed.
 *
 * @param {number} reward - Reward amount earned
 * @param {number} principal - Principal amount
 * @param {number} days - Number of days over which reward was earned
 * @returns {number} APR as a decimal
 *
 * @example
 * const apr = calculateAPRFromDays(100, 10000, 30);
 * // => 0.1217 (12.17% APR)
 */
export function calculateAPRFromDays(reward, principal, days) {
  const timePeriodSeconds = days * TIME_CONSTANTS.DAY;
  return calculateAPR(reward, principal, timePeriodSeconds);
}

/**
 * Calculate both APR and APY in one call
 *
 * @param {number} reward - Reward amount earned
 * @param {number} principal - Principal amount
 * @param {number} timePeriodSeconds - Time period in seconds
 * @param {number} [compoundingPeriods=365] - Compounding periods for APY
 * @returns {Object} Object with apr and apy values
 *
 * @example
 * const { apr, apy } = calculateYields(100, 10000, 30 * 86400);
 * console.log(`APR: ${(apr * 100).toFixed(2)}%, APY: ${(apy * 100).toFixed(2)}%`);
 */
export function calculateYields(reward, principal, timePeriodSeconds, compoundingPeriods = 365) {
  const apr = calculateAPR(reward, principal, timePeriodSeconds);
  const apy = calculateAPY(apr, compoundingPeriods);

  return { apr, apy };
}

/**
 * Calculate weighted average APY across multiple positions
 *
 * Useful when displaying aggregate APY for multiple bonds or LP positions.
 *
 * @param {Array<Object>} positions - Array of { principal, apy } objects
 * @returns {number} Weighted average APY
 *
 * @example
 * const positions = [
 *   { principal: 10000, apy: 0.12 },
 *   { principal: 5000, apy: 0.08 }
 * ];
 * const avgAPY = calculateWeightedAPY(positions);
 * // => 0.1067 (weighted average: (10000*0.12 + 5000*0.08) / 15000)
 */
export function calculateWeightedAPY(positions) {
  if (!positions || positions.length === 0) return 0;

  let totalPrincipal = 0;
  let weightedSum = 0;

  for (const position of positions) {
    if (position.principal && position.apy) {
      totalPrincipal += position.principal;
      weightedSum += position.principal * position.apy;
    }
  }

  if (totalPrincipal === 0) return 0;

  return weightedSum / totalPrincipal;
}

// ============================================
// Reward Projections
// ============================================

/**
 * Project future rewards based on current APY
 *
 * @param {number} principal - Principal amount
 * @param {number} apy - Annual Percentage Yield as a decimal
 * @param {number} days - Number of days to project
 * @returns {Object} Projected values
 *
 * @example
 * const projection = projectRewards(10000, 0.12, 365);
 * // => {
 * //   futureValue: 11200,
 * //   reward: 1200,
 * //   dailyReward: 3.29
 * // }
 */
export function projectRewards(principal, apy, days) {
  if (!principal || !apy || !days) {
    return { futureValue: principal || 0, reward: 0, dailyReward: 0 };
  }

  // Simple projection (linear, not compounded)
  const yearFraction = days / 365;
  const reward = principal * apy * yearFraction;
  const futureValue = principal + reward;
  const dailyReward = reward / days;

  return {
    futureValue,
    reward,
    dailyReward
  };
}

/**
 * Calculate rewards earned per time period
 *
 * @param {number} principal - Principal amount
 * @param {number} apy - Annual Percentage Yield as a decimal
 * @returns {Object} Rewards per various time periods
 *
 * @example
 * const rewards = calculateRewardsPer(10000, 0.12);
 * // => {
 * //   hourly: 0.137,
 * //   daily: 3.29,
 * //   weekly: 23.01,
 * //   monthly: 100,
 * //   yearly: 1200
 * // }
 */
export function calculateRewardsPer(principal, apy) {
  if (!principal || !apy) {
    return { hourly: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0 };
  }

  const yearly = principal * apy;

  return {
    hourly: yearly / 8760, // 365 * 24
    daily: yearly / 365,
    weekly: yearly / 52,
    monthly: yearly / 12,
    yearly
  };
}

// ============================================
// Pool/Price Ratio Calculations
// ============================================

/**
 * Calculate asset price from pool balances
 *
 * In a THORChain pool, price is determined by the ratio of balances.
 * Asset price in RUNE = runeBalance / assetBalance
 *
 * @param {number} runeBalance - RUNE depth in pool (in base units or human-readable)
 * @param {number} assetBalance - Asset depth in pool (in base units or human-readable)
 * @returns {number} Asset price in RUNE
 *
 * @example
 * // BTC pool with 1000 RUNE and 0.01 BTC
 * const btcPriceInRune = calculatePoolPrice(1000, 0.01);
 * // => 100000 RUNE per BTC
 */
export function calculatePoolPrice(runeBalance, assetBalance) {
  if (!runeBalance || !assetBalance || assetBalance === 0) return 0;

  return runeBalance / assetBalance;
}

/**
 * Calculate asset price in USD using pool ratio and RUNE price
 *
 * @param {number} runeBalance - RUNE depth in pool
 * @param {number} assetBalance - Asset depth in pool
 * @param {number} runePriceUSD - Current RUNE price in USD
 * @returns {number} Asset price in USD
 *
 * @example
 * // BTC pool with 100M RUNE and 1000 BTC, RUNE at $0.67
 * const btcPriceUSD = calculateAssetPriceUSD(100000000, 1000, 0.67);
 * // => $67,000 per BTC
 */
export function calculateAssetPriceUSD(runeBalance, assetBalance, runePriceUSD) {
  const priceInRune = calculatePoolPrice(runeBalance, assetBalance);
  return priceInRune * runePriceUSD;
}

/**
 * Convert RUNE amount to asset amount using pool ratio
 *
 * @param {number} runeAmount - Amount of RUNE to convert
 * @param {number} runeBalance - RUNE depth in pool
 * @param {number} assetBalance - Asset depth in pool
 * @returns {number} Equivalent asset amount
 *
 * @example
 * // Convert 1000 RUNE to BTC using pool ratio
 * const btcAmount = runeToAsset(1000, 100000000, 1000);
 * // => 0.01 BTC
 */
export function runeToAsset(runeAmount, runeBalance, assetBalance) {
  if (!runeAmount || !runeBalance || runeBalance === 0) return 0;

  return (runeAmount / runeBalance) * assetBalance;
}

/**
 * Convert asset amount to RUNE amount using pool ratio
 *
 * @param {number} assetAmount - Amount of asset to convert
 * @param {number} runeBalance - RUNE depth in pool
 * @param {number} assetBalance - Asset depth in pool
 * @returns {number} Equivalent RUNE amount
 *
 * @example
 * // Convert 0.01 BTC to RUNE using pool ratio
 * const runeAmount = assetToRune(0.01, 100000000, 1000);
 * // => 1000 RUNE
 */
export function assetToRune(assetAmount, runeBalance, assetBalance) {
  if (!assetAmount || !assetBalance || assetBalance === 0) return 0;

  return (assetAmount / assetBalance) * runeBalance;
}

// ============================================
// Percentage Calculations
// ============================================

/**
 * Calculate percentage change between two values
 *
 * @param {number} oldValue - Previous value
 * @param {number} newValue - Current value
 * @returns {number} Percentage change as a decimal (-0.10 = -10%, 0.25 = +25%)
 *
 * @example
 * percentageChange(100, 125) // => 0.25 (25% increase)
 * percentageChange(100, 80)  // => -0.20 (20% decrease)
 */
export function percentageChange(oldValue, newValue) {
  if (!oldValue || oldValue === 0) return 0;

  return (newValue - oldValue) / oldValue;
}

/**
 * Calculate what percentage a part is of a whole
 *
 * @param {number} part - The part value
 * @param {number} whole - The whole value
 * @returns {number} Percentage as a decimal (0.25 = 25%)
 *
 * @example
 * percentageOf(25, 100) // => 0.25 (25%)
 */
export function percentageOf(part, whole) {
  if (!whole || whole === 0) return 0;

  return part / whole;
}
