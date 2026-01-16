/**
 * Utils index - re-exports all utility functions
 *
 * Centralized exports for all RUNE Tools utility modules.
 * Import from here for cleaner imports throughout the application.
 *
 * @module utils
 *
 * @example
 * // Import multiple utilities
 * import {
 *   formatNumber,
 *   formatUSD,
 *   formatCountdown,
 *   fromBaseUnit,
 *   blocksToSeconds,
 *   getWalletBalances,
 *   getLPPosition,
 *   calculateAPY
 * } from '$lib/utils';
 *
 * @example
 * // Import specific module for documentation
 * import * as walletUtils from '$lib/utils/wallet';
 */

// ============================================
// Formatting utilities
// ============================================
export {
  // Number formatting
  formatNumber,
  formatUSD,
  formatUSDWithDecimals,
  formatPercentage,
  formatPercentageNoSign,
  simplifyNumber,
  formatPrice,
  formatCryptoAmount,

  // Time/date formatting
  formatTime,
  formatDate,
  formatDateTime,

  // Address formatting
  shortenAddress,
  getAddressSuffix,

  // RUNE-specific formatting
  formatRuneAmount,
  formatThorAmount,

  // Countdown/duration formatting
  formatCountdown,
  formatDuration,
  formatBlocksCountdown
} from './formatting.js';

// ============================================
// Blockchain utilities
// ============================================
export {
  // Constants
  THOR_BASE,
  BLOCK_TIME_SECONDS,
  TIME_CONSTANTS,
  CHAINS,

  // Unit conversion
  fromBaseUnit,
  toBaseUnit,

  // Asset parsing
  parseAsset,
  getAssetShortName,
  getChainFromAsset,

  // Asset validation
  isNativeAsset,
  isStablecoin,
  isValidAssetFormat,

  // Address utilities
  normalizeAddress,
  isEVMChain,

  // Block time utilities
  blocksToSeconds,
  secondsToBlocks,
  blocksToTimeBreakdown,
  estimateBlockAtTime,
  estimateTimeAtBlock
} from './blockchain.js';

// ============================================
// Wallet utilities
// ============================================
export {
  // Constants
  DENOM_TO_ASSET,

  // Denom conversion
  denomToAsset,
  assetToDenom,

  // Balance fetching
  getWalletBalances,
  getTokenBalance,
  getRuneBalance,
  getTcyBalance,
  getMultipleWalletBalances,

  // Value calculations
  calculateWalletValue,
  filterDustBalances,
  getWalletSummary
} from './wallet.js';

// ============================================
// Liquidity Provider utilities
// ============================================
export {
  // Position fetching
  getLPPosition,
  getAllLPPositions,
  getAllLPPositionsParallel,

  // Value calculations
  calculateLPValue,
  calculateTotalLPValue,

  // Pool utilities
  getAvailablePools,
  getAllPools,
  getPoolsWithStatus,

  // Position filtering/sorting
  filterPositionsByValue,
  sortPositionsByValue,

  // Pool price utilities
  getPoolAssetPriceInRune,
  getPoolAssetPriceUSD,
  convertRuneToAsset,
  convertAssetToRune,
  getRuneValueInBTC,
  buildPoolPriceMap,
  getPoolDepth
} from './liquidity.js';

// ============================================
// Node & Bond utilities
// ============================================
export {
  // Constants
  NODE_STATUS,

  // Node/bond fetching
  getNodes,
  getBondsForAddresses,
  getBondsForAddress,
  getNodeBondInfo,
  fetchNodesWithMetadata,

  // Value calculations
  calculateTotalBondValue,
  calculateTotalBondAmount,
  getBondSummary,

  // Node filtering/grouping
  filterNodesByStatus,
  getActiveNodes,
  getActiveNodeAddresses,
  groupNodesByOperator,
  calculateConsensusThreshold,

  // Bond filtering/sorting
  filterBondsByStatus,
  sortBondsByAmount,
  groupBondsByNode,

  // Network statistics
  getNetworkBondStats,

  // Churn utilities
  calculateNextChurnTime,
  getSecondsUntilChurn,
  getChurnInfo,
  getTimeSinceChurn
} from './nodes.js';

// ============================================
// Financial calculation utilities
// ============================================
export {
  // APR/APY calculations
  calculateAPR,
  calculateAPY,
  calculateAPRFromDays,
  calculateYields,
  calculateWeightedAPY,

  // Reward projections
  projectRewards,
  calculateRewardsPer,

  // Pool/price ratio calculations
  calculatePoolPrice,
  calculateAssetPriceUSD,
  runeToAsset,
  assetToRune,

  // Percentage calculations
  percentageChange,
  percentageOf
} from './calculations.js';

// ============================================
// Network infrastructure utilities
// ============================================
export {
  // Constants
  CHAIN_EXPLORERS,
  CHAIN_NATIVE_TOKENS,
  CHAIN_ICONS,

  // Inbound address fetching
  getInboundAddresses,
  getInboundAddress,
  getVaultAddress,
  getRouterAddress,
  getGasRate,
  isChainHalted,
  getActiveChains,
  clearInboundCache,

  // Outbound fee fetching
  getOutboundFees,
  getOutboundFee,
  getChainOutboundFee,

  // Fee formatting
  formatOutboundFee,
  formatOutboundFeeWithUSD,

  // Explorer URL helpers
  getExplorerUrl,
  getExplorerTxUrl,

  // Chain utilities
  getNativeToken,
  getChainIcon,
  chainHasRouter
} from './network.js';
