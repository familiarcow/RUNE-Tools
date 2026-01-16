/**
 * THORChain blockchain utilities
 * Handles base unit conversions and asset parsing
 */

/**
 * THORChain base unit (8 decimals like satoshis)
 */
export const THOR_BASE = 1e8;

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
