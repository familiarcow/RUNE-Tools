/**
 * Utils index - re-exports all utility functions
 *
 * Usage:
 *   import { formatNumber, formatUSD, fromBaseUnit } from '$lib/utils';
 */

// Formatting utilities
export {
  formatNumber,
  formatUSD,
  formatUSDWithDecimals,
  formatPercentage,
  formatPercentageNoSign,
  simplifyNumber,
  formatPrice,
  formatCryptoAmount,
  formatTime,
  formatDate,
  formatDateTime
} from './formatting.js';

// Blockchain utilities
export {
  THOR_BASE,
  fromBaseUnit,
  toBaseUnit,
  parseAsset,
  getAssetShortName,
  getChainFromAsset,
  isNativeAsset,
  isStablecoin,
  normalizeAddress,
  isValidAssetFormat,
  CHAINS,
  isEVMChain
} from './blockchain.js';
