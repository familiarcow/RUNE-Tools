/**
 * THORChain Affiliate/Interface Information
 *
 * Maps affiliate codes to their display names and logos.
 * Used in Feed, WhaleWatching, and other transaction-display components.
 *
 * @module constants/affiliates
 */

/**
 * Affiliate code to info mapping
 * Key: affiliate code from memo
 * Value: { name: display name, logo: path to logo }
 */
export const AFFILIATE_INFO = {
  // Trust Wallet variants
  'ti': {
    name: 'Trust Wallet',
    logo: '/assets/services/trustwallet.svg'
  },
  'te': {
    name: 'Trust Wallet',
    logo: '/assets/services/trustwallet.svg'
  },
  'tb': {
    name: 'Trust Wallet',
    logo: '/assets/services/trustwallet.svg'
  },
  'td': {
    name: 'Trust Wallet',
    logo: '/assets/services/trustwallet.svg'
  },

  // THORSwap
  't': {
    name: 'THORSwap',
    logo: '/assets/services/thorswap.png'
  },

  // ASGARDEX
  'dx': {
    name: 'ASGARDEX',
    logo: '/assets/services/asgardex.png'
  },

  // Ledger Live
  'll': {
    name: 'Ledger Live',
    logo: '/assets/services/ledger.svg'
  },

  // Li.Fi
  'lifi': {
    name: 'Li.Fi',
    logo: '/assets/services/lifi.svg'
  },

  // ShapeShift
  'ss': {
    name: 'ShapeShift',
    logo: '/assets/services/shapeshift.svg'
  },

  // OKX Wallet
  'okw': {
    name: 'OKX Wallet',
    logo: '/assets/services/okx.svg'
  },

  // CTRL (formerly xDefi)
  'xdf': {
    name: 'CTRL',
    logo: '/assets/services/CTRL.svg'
  },

  // SwapKit variants
  '-_': {
    name: 'SwapKit',
    logo: '/assets/services/swapkit.svg'
  },
  '_': {
    name: 'SwapKit',
    logo: '/assets/services/swapkit.svg'
  },

  // Bitget
  'bgw': {
    name: 'Bitget',
    logo: '/assets/services/bitget.svg'
  },

  // Edge Wallet
  'ej': {
    name: 'Edge',
    logo: '/assets/services/edge.svg'
  },

  // Rango
  'rg': {
    name: 'Rango',
    logo: '/assets/services/rango.svg'
  },

  // THORWallet
  'tw': {
    name: 'THORWallet',
    logo: '/assets/services/thorwallet.svg'
  }
};

/**
 * Get affiliate info by code
 * @param {string} code - Affiliate code from memo
 * @returns {Object|null} Affiliate info or null if not found
 *
 * @example
 * const info = getAffiliateInfo('ti');
 * // => { name: 'Trust Wallet', logo: '/assets/services/trustwallet.svg' }
 */
export function getAffiliateInfo(code) {
  if (!code) return null;
  return AFFILIATE_INFO[code] || null;
}

/**
 * Get affiliate name by code
 * @param {string} code - Affiliate code
 * @returns {string} Affiliate name or the code itself if unknown
 */
export function getAffiliateName(code) {
  if (!code) return '';
  return AFFILIATE_INFO[code]?.name || code;
}

/**
 * Get affiliate logo path by code
 * @param {string} code - Affiliate code
 * @returns {string} Logo path or empty string if unknown
 */
export function getAffiliateLogo(code) {
  if (!code) return '';
  return AFFILIATE_INFO[code]?.logo || '';
}

/**
 * Check if an affiliate code is known
 * @param {string} code - Affiliate code
 * @returns {boolean} True if affiliate is known
 */
export function isKnownAffiliate(code) {
  return code && AFFILIATE_INFO.hasOwnProperty(code);
}
