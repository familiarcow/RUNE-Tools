/**
 * Constants index - re-exports all constants
 *
 * Usage:
 *   import { ASSET_LOGOS, getAssetLogo, COINGECKO_IDS } from '$lib/constants';
 */

export {
  ASSET_LOGOS,
  getAssetLogo,
  CHAIN_LOGOS,
  getChainLogo,
  COINGECKO_IDS,
  getCoinGeckoId,
  ASSET_DISPLAY_NAMES,
  getAssetDisplayName
} from './assets.js';

export {
  KNOWN_ADDRESSES,
  THORCHAIN_MODULES,
  EXCHANGE_ADDRESSES,
  PROTOCOL_ADDRESSES,
  getAddressLabel,
  isKnownAddress,
  isModuleAddress,
  isExchangeAddress,
  formatAddressWithLabel
} from './addresses.js';

export {
  AFFILIATE_INFO,
  getAffiliateInfo,
  getAffiliateName,
  getAffiliateLogo,
  isKnownAffiliate
} from './affiliates.js';
