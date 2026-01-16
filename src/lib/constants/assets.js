/**
 * Centralized asset constants for RUNE Tools
 * Consolidates duplicate asset logo maps from 11+ components
 */

/**
 * Asset logo mappings
 * Maps full asset identifiers to their logo paths
 */
export const ASSET_LOGOS = {
  // Native chain assets
  'BTC.BTC': '/assets/coins/bitcoin-btc-logo.svg',
  'ETH.ETH': '/assets/coins/ethereum-eth-logo.svg',
  'BSC.BNB': '/assets/coins/binance-coin-bnb-logo.svg',
  'BCH.BCH': '/assets/coins/bitcoin-cash-bch-logo.svg',
  'LTC.LTC': '/assets/coins/litecoin-ltc-logo.svg',
  'AVAX.AVAX': '/assets/coins/avalanche-avax-logo.svg',
  'GAIA.ATOM': '/assets/coins/cosmos-atom-logo.svg',
  'DOGE.DOGE': '/assets/coins/dogecoin-doge-logo.svg',
  'THOR.RUNE': '/assets/coins/RUNE-ICON.svg',
  'BASE.ETH': '/assets/coins/ethereum-eth-logo.svg',

  // Stablecoins - Ethereum
  'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': '/assets/coins/usd-coin-usdc-logo.svg',
  'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': '/assets/coins/tether-usdt-logo.svg',
  'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': '/assets/coins/multi-collateral-dai-dai-logo.svg',
  'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': '/assets/coins/gemini-dollar-gusd-logo.svg',
  'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': '/assets/coins/liquity-usd-logo.svg',
  'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': '/assets/coins/paxos-standard-usdp-logo.svg',

  // Stablecoins - Avalanche
  'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': '/assets/coins/usd-coin-usdc-logo.svg',
  'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': '/assets/coins/tether-usdt-logo.svg',

  // Stablecoins - BSC
  'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': '/assets/coins/usd-coin-usdc-logo.svg',
  'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': '/assets/coins/tether-usdt-logo.svg',

  // Stablecoins - Base
  'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': '/assets/coins/usd-coin-usdc-logo.svg',

  // Wrapped assets
  'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': '/assets/coins/wrapped-bitcoin-wbtc-logo.svg',
  'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': '/assets/coins/coinbase-wrapped-btc-logo.svg',
  'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C': '/assets/coins/wrapped-bitcoin-wbtc-logo.svg',
  'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8': '/assets/coins/ethereum-eth-logo.svg',

  // DeFi tokens - Ethereum
  'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': '/assets/coins/aave-aave-logo.svg',
  'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': '/assets/coins/chainlink-link-logo.svg',
  'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': '/assets/coins/synthetix-snx-logo.svg',
  'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': '/assets/coins/fox-token-fox-logo.svg',
  'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': '/assets/coins/dpi-logo.png',
  'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': '/assets/coins/yearn-finance-yfi-logo.svg',

  // THORSwap ecosystem
  'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': '/assets/coins/thorswap-logo.png',
  'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': '/assets/coins/thorswap-logo.png',
  'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': '/assets/coins/xrune-logo.png',
  'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': '/assets/coins/tgt-logo.png',

  // Other tokens
  'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': '/assets/coins/twt-logo.png',
  'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': '/assets/coins/solana-sol-logo.svg',

  // THORChain native
  'THOR.TCY': '/assets/coins/TCY.svg',
  'THOR.RUJI': '/assets/coins/ruji-logo.svg'
};

/**
 * Get asset logo path with fallback
 * @param {string} asset - Full asset identifier
 * @returns {string} Logo path or empty string if not found
 */
export function getAssetLogo(asset) {
  if (!asset) return '';

  // Direct lookup
  if (ASSET_LOGOS[asset]) {
    return ASSET_LOGOS[asset];
  }

  // Try uppercase version (some components pass lowercase)
  const upperAsset = asset.toUpperCase();
  if (ASSET_LOGOS[upperAsset]) {
    return ASSET_LOGOS[upperAsset];
  }

  // Fallback: try to match by symbol
  const symbol = asset.split('.')[1]?.split('-')[0];
  if (symbol) {
    const symbolMatch = Object.entries(ASSET_LOGOS).find(([key]) => {
      const keySymbol = key.split('.')[1]?.split('-')[0];
      return keySymbol === symbol;
    });
    if (symbolMatch) {
      return symbolMatch[1];
    }
  }

  return '';
}

/**
 * Chain logo mappings
 */
export const CHAIN_LOGOS = {
  'BTC': '/assets/chains/BTC.svg',
  'ETH': '/assets/chains/ETH.svg',
  'BSC': '/assets/chains/BSC.svg',
  'BCH': '/assets/chains/BCH.svg',
  'LTC': '/assets/chains/LTC.svg',
  'AVAX': '/assets/chains/AVAX.svg',
  'GAIA': '/assets/chains/GAIA.svg',
  'DOGE': '/assets/chains/DOGE.svg',
  'THOR': '/assets/chains/THOR.svg',
  'BASE': '/assets/chains/BASE.svg',
  'TRON': '/assets/chains/TRON.svg',
  'XRP': '/assets/chains/XRP.svg',
  'SOL': '/assets/chains/SOL.svg'
};

/**
 * Get chain logo path
 * @param {string} chain - Chain identifier
 * @returns {string} Chain logo path or empty string
 */
export function getChainLogo(chain) {
  if (!chain) return '';
  return CHAIN_LOGOS[chain.toUpperCase()] || '';
}

/**
 * CoinGecko ID mappings for external price fetching
 */
export const COINGECKO_IDS = {
  // Native assets
  'BTC.BTC': 'bitcoin',
  'ETH.ETH': 'ethereum',
  'BSC.BNB': 'binancecoin',
  'BCH.BCH': 'bitcoin-cash',
  'LTC.LTC': 'litecoin',
  'AVAX.AVAX': 'avalanche-2',
  'GAIA.ATOM': 'cosmos',
  'DOGE.DOGE': 'dogecoin',
  'THOR.RUNE': 'thorchain',
  'BASE.ETH': 'ethereum',

  // Wrapped assets
  'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'wrapped-bitcoin',
  'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'coinbase-wrapped-btc',

  // Stablecoins (mostly pegged to 1 USD)
  'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'usd-coin',
  'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'tether',
  'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'dai',

  // DeFi tokens
  'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'aave',
  'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'chainlink',
  'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': 'havven',
  'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': 'yearn-finance',
  'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'thorswap',
  'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'shapeshift-fox-token'
};

/**
 * Get CoinGecko ID for an asset
 * @param {string} asset - Full asset identifier
 * @returns {string|null} CoinGecko ID or null if not found
 */
export function getCoinGeckoId(asset) {
  if (!asset) return null;
  return COINGECKO_IDS[asset] || COINGECKO_IDS[asset.toUpperCase()] || null;
}

/**
 * Asset display names (short names for UI)
 */
export const ASSET_DISPLAY_NAMES = {
  'BTC.BTC': 'BTC',
  'ETH.ETH': 'ETH',
  'BSC.BNB': 'BNB',
  'BCH.BCH': 'BCH',
  'LTC.LTC': 'LTC',
  'AVAX.AVAX': 'AVAX',
  'GAIA.ATOM': 'ATOM',
  'DOGE.DOGE': 'DOGE',
  'THOR.RUNE': 'RUNE',
  'THOR.TCY': 'TCY',
  'THOR.RUJI': 'RUJI',
  'BASE.ETH': 'ETH (Base)',
  'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'USDC',
  'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'USDT',
  'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'WBTC',
  'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'cbBTC'
};

/**
 * Get display name for an asset
 * @param {string} asset - Full asset identifier
 * @returns {string} Display name
 */
export function getAssetDisplayName(asset) {
  if (!asset) return '';

  // Check known display names first
  if (ASSET_DISPLAY_NAMES[asset]) {
    return ASSET_DISPLAY_NAMES[asset];
  }

  // Parse the asset to get a reasonable name
  const parts = asset.split('.');
  if (parts.length < 2) return asset;

  const [chain, assetPart] = parts;
  const symbol = assetPart.split('-')[0];

  // For native assets, just return the symbol
  if (!assetPart.includes('-')) {
    return symbol;
  }

  // For tokens, show symbol with chain
  return `${symbol} (${chain})`;
}
