/**
 * THORChain blockchain utilities
 * Handles base unit conversions, asset parsing, and block time calculations
 */

/**
 * THORChain base unit (8 decimals like satoshis)
 */
export const THOR_BASE = 1e8;

/**
 * THORChain block time in seconds (~6 seconds per block)
 * @constant {number}
 */
export const BLOCK_TIME_SECONDS = 6;

/**
 * Seconds in various time periods (for calculations)
 * @constant {Object}
 */
export const TIME_CONSTANTS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  YEAR: 31557600 // 365.25 days
};

/**
 * Convert from THORChain base units to human-readable amount
 * @param {number|string} amount - Amount in base units (1e8)
 * @returns {number} Human-readable amount
 */
export function fromBaseUnit(amount) {
  if (amount === null || amount === undefined) return 0;
  return Number(amount) / THOR_BASE;
}

/**
 * Convert to THORChain base units from human-readable amount
 * @param {number} amount - Human-readable amount
 * @returns {number} Amount in base units (1e8)
 */
export function toBaseUnit(amount) {
  if (amount === null || amount === undefined) return 0;
  return Math.round(Number(amount) * THOR_BASE);
}

/**
 * Parse a THORChain asset identifier into its components
 * @param {string} asset - Full asset identifier (e.g., "ETH.USDC-0XA0B86991...")
 * @returns {Object} Parsed asset parts
 */
export function parseAsset(asset) {
  if (!asset || typeof asset !== 'string') {
    return {
      chain: '',
      symbol: '',
      ticker: '',
      contractAddress: null,
      isNative: true,
      isSynth: false,
      fullName: ''
    };
  }

  // Check if it's a synth asset (THOR.BTC, not BTC.BTC)
  const isSynth = asset.startsWith('THOR.') && !asset.includes('RUNE');

  const [chainPart, ...rest] = asset.split('.');
  const assetPart = rest.join('.');

  // Handle contract addresses (e.g., USDC-0XA0B86991...)
  const [symbol, contractAddress] = assetPart.split('-');

  return {
    chain: chainPart,
    symbol: symbol || '',
    ticker: symbol || '',
    contractAddress: contractAddress || null,
    isNative: !contractAddress,
    isSynth,
    fullName: asset
  };
}

/**
 * Get a short display name for an asset
 * @param {string} fullName - Full asset identifier
 * @returns {string} Short display name
 */
export function getAssetShortName(fullName) {
  if (!fullName) return '';

  // Handle known special cases
  const knownNames = {
    'BTC.BTC': 'BTC',
    'ETH.ETH': 'ETH',
    'BSC.BNB': 'BNB',
    'BCH.BCH': 'BCH',
    'LTC.LTC': 'LTC',
    'AVAX.AVAX': 'AVAX',
    'GAIA.ATOM': 'ATOM',
    'DOGE.DOGE': 'DOGE',
    'THOR.RUNE': 'RUNE',
    'BASE.ETH': 'ETH (Base)'
  };

  if (knownNames[fullName]) return knownNames[fullName];

  // Parse the asset
  const parsed = parseAsset(fullName);

  // For contract assets, show symbol with chain
  if (parsed.contractAddress) {
    return `${parsed.symbol} (${parsed.chain})`;
  }

  // For synth assets
  if (parsed.isSynth) {
    return `${parsed.symbol} (Synth)`;
  }

  // Default: just return the symbol
  return parsed.symbol || fullName;
}

/**
 * Get the chain name from an asset identifier
 * @param {string} asset - Full asset identifier
 * @returns {string} Chain name
 */
export function getChainFromAsset(asset) {
  if (!asset) return '';
  return asset.split('.')[0] || '';
}

/**
 * Check if an asset is a native asset (not a token)
 * @param {string} asset - Full asset identifier
 * @returns {boolean} True if native asset
 */
export function isNativeAsset(asset) {
  if (!asset) return false;
  return !asset.includes('-');
}

/**
 * Check if an asset is a stablecoin
 * @param {string} asset - Full asset identifier
 * @returns {boolean} True if stablecoin
 */
export function isStablecoin(asset) {
  if (!asset) return false;

  const stableSymbols = ['USDC', 'USDT', 'DAI', 'GUSD', 'LUSD', 'USDP', 'BUSD'];
  const parsed = parseAsset(asset);

  return stableSymbols.includes(parsed.symbol);
}

/**
 * Normalize a THORChain address format
 * @param {string} address - Address to normalize
 * @returns {string} Normalized address (lowercase for EVM, original for others)
 */
export function normalizeAddress(address) {
  if (!address) return '';

  // EVM addresses (ETH, BSC, AVAX) should be lowercase
  if (address.startsWith('0x') || address.startsWith('0X')) {
    return address.toLowerCase();
  }

  // Other addresses remain as-is
  return address;
}

/**
 * Validate a THORChain asset identifier format
 * @param {string} asset - Asset identifier to validate
 * @returns {boolean} True if valid format
 */
export function isValidAssetFormat(asset) {
  if (!asset || typeof asset !== 'string') return false;

  // Must contain a dot (CHAIN.ASSET)
  if (!asset.includes('.')) return false;

  const [chain, rest] = asset.split('.');

  // Chain must not be empty
  if (!chain || !rest) return false;

  // Basic format validation passed
  return true;
}

/**
 * Common chain identifiers
 */
export const CHAINS = {
  THOR: 'THOR',
  BTC: 'BTC',
  ETH: 'ETH',
  BSC: 'BSC',
  BCH: 'BCH',
  LTC: 'LTC',
  AVAX: 'AVAX',
  GAIA: 'GAIA',
  DOGE: 'DOGE',
  BASE: 'BASE'
};

/**
 * Check if a chain is EVM-compatible
 * @param {string} chain - Chain identifier
 * @returns {boolean} True if EVM chain
 */
export function isEVMChain(chain) {
  const evmChains = ['ETH', 'BSC', 'AVAX', 'BASE'];
  return evmChains.includes(chain);
}

// ============================================
// Block Time Utilities
// ============================================

/**
 * Convert blocks to seconds
 * @param {number} blocks - Number of blocks
 * @param {number} [blockTime=BLOCK_TIME_SECONDS] - Seconds per block
 * @returns {number} Total seconds
 *
 * @example
 * blocksToSeconds(100) // => 600 (100 blocks * 6 seconds)
 */
export function blocksToSeconds(blocks, blockTime = BLOCK_TIME_SECONDS) {
  if (!blocks || blocks < 0) return 0;
  return Math.floor(blocks * blockTime);
}

/**
 * Convert seconds to blocks
 * @param {number} seconds - Number of seconds
 * @param {number} [blockTime=BLOCK_TIME_SECONDS] - Seconds per block
 * @returns {number} Number of blocks
 *
 * @example
 * secondsToBlocks(600) // => 100 (600 seconds / 6 seconds per block)
 */
export function secondsToBlocks(seconds, blockTime = BLOCK_TIME_SECONDS) {
  if (!seconds || seconds < 0) return 0;
  return Math.floor(seconds / blockTime);
}

/**
 * Convert blocks to a time breakdown object
 * @param {number} blocks - Number of blocks
 * @returns {Object} Time breakdown with days, hours, minutes, seconds
 *
 * @example
 * blocksToTimeBreakdown(14400)
 * // => { days: 1, hours: 0, minutes: 0, seconds: 0, totalSeconds: 86400 }
 */
export function blocksToTimeBreakdown(blocks) {
  const totalSeconds = blocksToSeconds(blocks);

  const days = Math.floor(totalSeconds / TIME_CONSTANTS.DAY);
  const hours = Math.floor((totalSeconds % TIME_CONSTANTS.DAY) / TIME_CONSTANTS.HOUR);
  const minutes = Math.floor((totalSeconds % TIME_CONSTANTS.HOUR) / TIME_CONSTANTS.MINUTE);
  const seconds = totalSeconds % TIME_CONSTANTS.MINUTE;

  return { days, hours, minutes, seconds, totalSeconds };
}

/**
 * Estimate block height at a future timestamp
 * @param {number} currentBlock - Current block height
 * @param {number} targetTimestamp - Target Unix timestamp (seconds)
 * @param {number} [blockTime=BLOCK_TIME_SECONDS] - Seconds per block
 * @returns {number} Estimated block height
 *
 * @example
 * const futureBlock = estimateBlockAtTime(1000000, Date.now()/1000 + 3600);
 * // => ~1000600 (current + 600 blocks for 1 hour)
 */
export function estimateBlockAtTime(currentBlock, targetTimestamp, blockTime = BLOCK_TIME_SECONDS) {
  const now = Date.now() / 1000;
  const secondsUntil = targetTimestamp - now;

  if (secondsUntil <= 0) return currentBlock;

  const blocksUntil = secondsToBlocks(secondsUntil, blockTime);
  return currentBlock + blocksUntil;
}

/**
 * Estimate timestamp when a block will be reached
 * @param {number} currentBlock - Current block height
 * @param {number} targetBlock - Target block height
 * @param {number} [blockTime=BLOCK_TIME_SECONDS] - Seconds per block
 * @returns {number} Estimated Unix timestamp (seconds)
 *
 * @example
 * const timestamp = estimateTimeAtBlock(1000000, 1000600);
 * // => current time + 3600 seconds (1 hour)
 */
export function estimateTimeAtBlock(currentBlock, targetBlock, blockTime = BLOCK_TIME_SECONDS) {
  const now = Date.now() / 1000;

  if (targetBlock <= currentBlock) return now;

  const blocksRemaining = targetBlock - currentBlock;
  const secondsRemaining = blocksToSeconds(blocksRemaining, blockTime);

  return now + secondsRemaining;
}
