/**
 * THORChain Network Utilities
 *
 * Centralized utilities for fetching and processing THORChain network
 * infrastructure data including inbound addresses, routers, gas rates,
 * outbound fees, and chain-related constants.
 *
 * @module utils/network
 *
 * @example
 * import {
 *   getInboundAddresses,
 *   getInboundAddress,
 *   getRouterAddress,
 *   getOutboundFee,
 *   CHAIN_EXPLORERS,
 *   getExplorerUrl
 * } from '$lib/utils/network';
 *
 * // Get all inbound addresses
 * const inboundData = await getInboundAddresses();
 *
 * // Get specific chain data
 * const btcInbound = await getInboundAddress('BTC');
 * const ethRouter = await getRouterAddress('ETH');
 *
 * // Get explorer link
 * const explorerUrl = getExplorerUrl('BTC', 'bc1q...');
 */

import { fetchJSONWithFallback } from './api.js';
import { fromBaseUnit } from './blockchain.js';

// ============================================
// Constants
// ============================================

/**
 * Block explorer URLs for each supported chain
 * @type {Object.<string, string>}
 */
export const CHAIN_EXPLORERS = {
  THOR: 'https://runescan.io/address/',
  BTC: 'https://mempool.space/address/',
  ETH: 'https://etherscan.io/address/',
  BCH: 'https://blockchair.com/bitcoin-cash/address/',
  LTC: 'https://blockchair.com/litecoin/address/',
  DOGE: 'https://blockchair.com/dogecoin/address/',
  AVAX: 'https://snowtrace.io/address/',
  GAIA: 'https://www.mintscan.io/cosmos/address/',
  BSC: 'https://bscscan.com/address/',
  BASE: 'https://basescan.org/address/',
  XRP: 'https://xrpscan.com/account/',
  TRON: 'https://tronscan.org/#/address/'
};

/**
 * Mapping of chain identifiers to their native token symbols
 * @type {Object.<string, string>}
 */
export const CHAIN_NATIVE_TOKENS = {
  THOR: 'RUNE',
  BTC: 'BTC',
  ETH: 'ETH',
  BCH: 'BCH',
  LTC: 'LTC',
  DOGE: 'DOGE',
  AVAX: 'AVAX',
  GAIA: 'ATOM',
  BSC: 'BNB',
  BASE: 'ETH',
  XRP: 'XRP',
  TRON: 'TRX'
};

/**
 * Chain icon paths (relative to /assets/chains/)
 * @type {Object.<string, string>}
 */
export const CHAIN_ICONS = {
  BTC: '/assets/chains/BTC.svg',
  ETH: '/assets/chains/ETH.svg',
  BCH: '/assets/chains/BCH.svg',
  LTC: '/assets/chains/LTC.svg',
  DOGE: '/assets/chains/DOGE.svg',
  AVAX: '/assets/chains/AVAX.svg',
  BSC: '/assets/chains/BSC.svg',
  GAIA: '/assets/chains/GAIA.svg',
  THOR: '/assets/chains/THOR.svg',
  BASE: '/assets/chains/BASE.svg',
  XRP: '/assets/chains/XRP.svg',
  TRON: '/assets/chains/TRON.svg'
};

// ============================================
// Cache for inbound addresses
// ============================================

let inboundAddressesCache = null;
let inboundAddressesCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Clear the inbound addresses cache
 */
export function clearInboundCache() {
  inboundAddressesCache = null;
  inboundAddressesCacheTime = 0;
}

// ============================================
// Inbound Address Functions
// ============================================

/**
 * Fetch all inbound addresses from THORNode
 * Results are cached for 1 minute to reduce API calls
 *
 * @param {Object} options - Options
 * @param {boolean} [options.bypassCache=false] - Skip cache and fetch fresh data
 * @returns {Promise<Array>} Array of inbound address objects
 *
 * @example
 * const addresses = await getInboundAddresses();
 * // Returns: [{ chain: 'BTC', address: 'bc1q...', router: '', gas_rate: '10', ... }, ...]
 */
export async function getInboundAddresses(options = {}) {
  const { bypassCache = false } = options;
  const now = Date.now();

  // Return cached data if valid
  if (!bypassCache && inboundAddressesCache && now - inboundAddressesCacheTime < CACHE_TTL_MS) {
    return inboundAddressesCache;
  }

  const data = await fetchJSONWithFallback('/thorchain/inbound_addresses');
  inboundAddressesCache = data;
  inboundAddressesCacheTime = now;

  return data;
}

/**
 * Get inbound address data for a specific chain
 *
 * @param {string} chain - Chain identifier (e.g., 'BTC', 'ETH')
 * @returns {Promise<Object|null>} Inbound address object or null if not found
 *
 * @example
 * const btc = await getInboundAddress('BTC');
 * // Returns: { chain: 'BTC', address: 'bc1q...', gas_rate: '10', ... }
 */
export async function getInboundAddress(chain) {
  const addresses = await getInboundAddresses();
  return addresses.find((a) => a.chain === chain) || null;
}

/**
 * Get the vault/inbound address for a specific chain
 *
 * @param {string} chain - Chain identifier
 * @returns {Promise<string|null>} Vault address or null
 *
 * @example
 * const btcVault = await getVaultAddress('BTC');
 * // Returns: 'bc1q...'
 */
export async function getVaultAddress(chain) {
  const inbound = await getInboundAddress(chain);
  return inbound?.address || null;
}

/**
 * Get the router address for a specific chain (EVM chains only)
 *
 * @param {string} chain - Chain identifier (ETH, AVAX, BSC, BASE)
 * @returns {Promise<string|null>} Router address or null
 *
 * @example
 * const ethRouter = await getRouterAddress('ETH');
 * // Returns: '0x...'
 */
export async function getRouterAddress(chain) {
  const inbound = await getInboundAddress(chain);
  return inbound?.router || null;
}

/**
 * Get the gas rate for a specific chain
 *
 * @param {string} chain - Chain identifier
 * @returns {Promise<Object|null>} Gas rate object with rate and units
 *
 * @example
 * const gasInfo = await getGasRate('BTC');
 * // Returns: { rate: '10', units: 'satsperbyte' }
 */
export async function getGasRate(chain) {
  const inbound = await getInboundAddress(chain);
  if (!inbound) return null;

  return {
    rate: inbound.gas_rate,
    units: inbound.gas_rate_units
  };
}

/**
 * Check if a chain is halted
 *
 * @param {string} chain - Chain identifier
 * @returns {Promise<boolean>} True if chain is halted
 */
export async function isChainHalted(chain) {
  const inbound = await getInboundAddress(chain);
  return inbound?.halted === true;
}

/**
 * Get all active (non-halted) chains
 *
 * @returns {Promise<Array>} Array of active inbound address objects
 */
export async function getActiveChains() {
  const addresses = await getInboundAddresses();
  return addresses.filter((a) => !a.halted);
}

// ============================================
// Outbound Fee Functions
// ============================================

/**
 * Fetch all outbound fees from THORNode
 *
 * @returns {Promise<Array>} Array of outbound fee objects
 *
 * @example
 * const fees = await getOutboundFees();
 * // Returns: [{ asset: 'BTC.BTC', outbound_fee: '30000', ... }, ...]
 */
export async function getOutboundFees() {
  return fetchJSONWithFallback('/thorchain/outbound_fees');
}

/**
 * Get outbound fee for a specific asset
 *
 * @param {string} asset - Asset identifier (e.g., 'BTC.BTC', 'ETH.ETH')
 * @returns {Promise<Object|null>} Outbound fee object or null
 */
export async function getOutboundFee(asset) {
  const fees = await getOutboundFees();
  return fees.find((f) => f.asset === asset) || null;
}

/**
 * Get the basic outbound fee for a chain from inbound addresses
 * This is the fee in the chain's native token
 *
 * @param {string} chain - Chain identifier
 * @returns {Promise<Object|null>} Fee object with raw and formatted values
 *
 * @example
 * const fee = await getChainOutboundFee('BTC');
 * // Returns: { raw: '30000', amount: 0.0003, token: 'BTC' }
 */
export async function getChainOutboundFee(chain) {
  const inbound = await getInboundAddress(chain);
  if (!inbound?.outbound_fee) return null;

  const token = CHAIN_NATIVE_TOKENS[chain] || chain;

  return {
    raw: inbound.outbound_fee,
    amount: fromBaseUnit(inbound.outbound_fee),
    token
  };
}

/**
 * Format an outbound fee amount with token symbol
 *
 * @param {string|number} fee - Fee in base units
 * @param {string} chain - Chain identifier
 * @returns {Object} Formatted fee object
 *
 * @example
 * const formatted = formatOutboundFee('30000', 'BTC');
 * // Returns: { amount: 0.0003, formatted: '0.0003', token: 'BTC', display: '0.0003 BTC' }
 */
export function formatOutboundFee(fee, chain) {
  const amount = fromBaseUnit(fee);
  const token = CHAIN_NATIVE_TOKENS[chain] || chain;

  // Smart formatting based on amount size
  let formatted;
  if (amount >= 0.001) {
    formatted = amount.toFixed(3);
  } else {
    const decimalPlaces = Math.abs(Math.floor(Math.log10(amount))) + 1;
    formatted = amount.toFixed(Math.max(decimalPlaces, 8));
  }

  // Remove trailing zeros
  formatted = formatted.replace(/\.?0+$/, '');

  return {
    amount,
    formatted,
    token,
    display: `${formatted} ${token}`
  };
}

/**
 * Calculate outbound fee in USD
 *
 * @param {string|number} fee - Fee in base units
 * @param {string} chain - Chain identifier
 * @param {Map|Object} assetPrices - Map or object of asset prices in USD
 * @returns {Object} Fee with USD value
 *
 * @example
 * const feeWithUSD = formatOutboundFeeWithUSD('30000', 'BTC', priceMap);
 * // Returns: { ...formatOutboundFee(), usd: 25.50, usdDisplay: '$25.50' }
 */
export function formatOutboundFeeWithUSD(fee, chain, assetPrices) {
  const formatted = formatOutboundFee(fee, chain);
  const token = CHAIN_NATIVE_TOKENS[chain] || chain;
  const assetKey = `${chain}.${token}`;

  // Handle both Map and plain object
  const price = assetPrices instanceof Map ? assetPrices.get(assetKey) : assetPrices[assetKey];

  if (price) {
    const usd = formatted.amount * price;
    return {
      ...formatted,
      usd,
      usdDisplay: `$${usd.toFixed(2)}`
    };
  }

  return {
    ...formatted,
    usd: null,
    usdDisplay: null
  };
}

// ============================================
// Explorer URL Helpers
// ============================================

/**
 * Get the block explorer URL for an address on a specific chain
 *
 * @param {string} chain - Chain identifier
 * @param {string} address - Address to link to
 * @returns {string|null} Full explorer URL or null if chain not supported
 *
 * @example
 * const url = getExplorerUrl('BTC', 'bc1q...');
 * // Returns: 'https://mempool.space/address/bc1q...'
 */
export function getExplorerUrl(chain, address) {
  const baseUrl = CHAIN_EXPLORERS[chain];
  if (!baseUrl || !address) return null;
  return `${baseUrl}${address}`;
}

/**
 * Get the block explorer URL for a transaction on a specific chain
 *
 * @param {string} chain - Chain identifier
 * @param {string} txHash - Transaction hash
 * @returns {string|null} Full explorer URL or null if chain not supported
 */
export function getExplorerTxUrl(chain, txHash) {
  const txExplorers = {
    THOR: 'https://runescan.io/tx/',
    BTC: 'https://mempool.space/tx/',
    ETH: 'https://etherscan.io/tx/',
    BCH: 'https://blockchair.com/bitcoin-cash/transaction/',
    LTC: 'https://blockchair.com/litecoin/transaction/',
    DOGE: 'https://blockchair.com/dogecoin/transaction/',
    AVAX: 'https://snowtrace.io/tx/',
    GAIA: 'https://www.mintscan.io/cosmos/tx/',
    BSC: 'https://bscscan.com/tx/',
    BASE: 'https://basescan.org/tx/',
    XRP: 'https://xrpscan.com/tx/',
    TRON: 'https://tronscan.org/#/transaction/'
  };

  const baseUrl = txExplorers[chain];
  if (!baseUrl || !txHash) return null;
  return `${baseUrl}${txHash}`;
}

// ============================================
// Chain Utility Helpers
// ============================================

/**
 * Get the native token symbol for a chain
 *
 * @param {string} chain - Chain identifier
 * @returns {string} Native token symbol
 *
 * @example
 * getNativeToken('BSC'); // Returns: 'BNB'
 * getNativeToken('GAIA'); // Returns: 'ATOM'
 */
export function getNativeToken(chain) {
  return CHAIN_NATIVE_TOKENS[chain] || chain;
}

/**
 * Get the chain icon path
 *
 * @param {string} chain - Chain identifier
 * @returns {string|null} Icon path or null
 */
export function getChainIcon(chain) {
  return CHAIN_ICONS[chain] || null;
}

/**
 * Check if a chain has a router (EVM chains)
 *
 * @param {string} chain - Chain identifier
 * @returns {boolean} True if chain uses a router
 */
export function chainHasRouter(chain) {
  return ['ETH', 'AVAX', 'BSC', 'BASE'].includes(chain);
}

// ============================================
// Vault Utilities
// ============================================

/**
 * Vault status constants
 * @constant {Object}
 */
export const VAULT_STATUS = {
  ACTIVE: 'ActiveVault',
  RETIRING: 'RetiringVault'
};

/**
 * Fetch Asgard vaults from THORNode
 *
 * @returns {Promise<Array>} Array of vault objects
 *
 * @example
 * const vaults = await getAsgardVaults();
 * console.log(`Found ${vaults.length} vaults`);
 */
export async function getAsgardVaults() {
  return fetchJSONWithFallback('/thorchain/vaults/asgard');
}

/**
 * Sort vaults by status (Active first, then Retiring)
 *
 * @param {Array} vaults - Array of vault objects
 * @returns {Array} Sorted vaults array
 *
 * @example
 * const sorted = sortVaultsByStatus(vaults);
 */
export function sortVaultsByStatus(vaults) {
  if (!vaults) return [];

  return [...vaults].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === VAULT_STATUS.ACTIVE ? -1 : 1;
  });
}

/**
 * Format vault public key to short display name
 *
 * @param {string} pubKey - Vault public key
 * @returns {string} Short vault name (last 4 chars uppercase)
 *
 * @example
 * formatVaultName('thorpub1...abc123'); // Returns: 'C123'
 */
export function formatVaultName(pubKey) {
  if (!pubKey) return '';
  return pubKey.slice(-4).toUpperCase();
}

/**
 * Calculate total bond for a vault based on its membership
 *
 * Sums the total_bond of all nodes that are members of the vault.
 *
 * @param {Object} vault - Vault object with membership array
 * @param {Array} nodes - Array of node objects from getNodes()
 * @returns {number} Total bond in RUNE (already converted from base units)
 *
 * @example
 * const nodes = await getNodes();
 * const vaults = await getAsgardVaults();
 * const bond = calculateVaultBond(vaults[0], nodes);
 * console.log(`Vault bond: ${bond.toLocaleString()} RUNE`);
 */
export function calculateVaultBond(vault, nodes) {
  if (!vault || !vault.membership || !nodes || !nodes.length) return 0;

  const totalBond = vault.membership.reduce((sum, pubkey) => {
    const node = nodes.find((n) => n.pub_key_set?.secp256k1 === pubkey);
    if (node) {
      return sum + Number(node.total_bond);
    }
    return sum;
  }, 0);

  return fromBaseUnit(totalBond);
}

/**
 * Calculate total USD value of assets in a vault
 *
 * @param {Array} coins - Array of coin objects from vault.coins
 * @param {Object|Map} prices - Map or object of asset prices in USD
 * @returns {number} Total USD value
 *
 * @example
 * const value = calculateVaultAssetValue(vault.coins, priceMap);
 * console.log(`Total vault value: $${value.toLocaleString()}`);
 */
export function calculateVaultAssetValue(coins, prices) {
  if (!coins || !prices) return 0;

  return coins.reduce((sum, coin) => {
    const price = prices instanceof Map ? prices.get(coin.asset) : prices[coin.asset];
    if (price) {
      const amount = fromBaseUnit(coin.amount);
      return sum + amount * price;
    }
    return sum;
  }, 0);
}

/**
 * Get vault summary with computed values
 *
 * @param {Object} vault - Vault object
 * @param {Array} nodes - Array of node objects
 * @param {Object} prices - Asset prices map
 * @param {number} runePrice - RUNE price in USD
 * @returns {Object} Vault summary with computed values
 *
 * @example
 * const summary = getVaultSummary(vault, nodes, prices, runePrice);
 * console.log(`Bond: ${summary.bondRune} RUNE ($${summary.bondUSD})`);
 */
export function getVaultSummary(vault, nodes, prices, runePrice) {
  if (!vault) return null;

  const bondRune = calculateVaultBond(vault, nodes);
  const bondUSD = bondRune * (runePrice || 0);
  const assetValueUSD = calculateVaultAssetValue(vault.coins, prices);

  return {
    pubKey: vault.pub_key,
    name: formatVaultName(vault.pub_key),
    status: vault.status,
    isActive: vault.status === VAULT_STATUS.ACTIVE,
    isRetiring: vault.status === VAULT_STATUS.RETIRING,
    memberCount: vault.membership?.length || 0,
    bondRune,
    bondUSD,
    assetValueUSD,
    totalValueUSD: bondUSD + assetValueUSD,
    inboundTxCount: vault.inbound_tx_count || 0,
    outboundTxCount: vault.outbound_tx_count || 0,
    addresses: vault.addresses || [],
    coins: vault.coins || []
  };
}
