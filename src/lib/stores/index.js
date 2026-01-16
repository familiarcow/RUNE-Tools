/**
 * Stores index - re-exports all stores
 *
 * Usage:
 *   import { runePrice, pools, subscribeToRunePrice } from '$lib/stores';
 */

// Audio store (existing)
export { audioPlaying } from './audioStore.js';

// RUNE price store
export {
  runePrice,
  runePriceHistory,
  runePriceLoading,
  runePriceError,
  runePriceLastUpdate,
  runePriceFormatted,
  runePriceChange,
  subscribeToRunePrice,
  refreshRunePrice,
  getRunePriceNow,
  isRunePriceActive
} from './runePrice.js';

// Pools store
export {
  pools,
  poolsLoading,
  poolsError,
  poolsLastUpdate,
  poolsByAsset,
  availablePools,
  totalPooledRune,
  totalValueLockedRune,
  poolCounts,
  poolsWithPrices,
  subscribeToPools,
  refreshPools,
  getPoolByAsset,
  getAssetPrice,
  isPoolsActive
} from './pools.js';

// Currency store (multi-currency support)
export {
  currencies,
  currencySymbols,
  currentCurrency,
  exchangeRates,
  fetchExchangeRates,
  switchCurrency,
  initCurrency,
  formatCurrency,
  formatCurrencyWithDecimals
} from './currency.js';
