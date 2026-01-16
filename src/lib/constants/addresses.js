/**
 * Known THORChain Addresses
 *
 * Maps well-known THORChain addresses to human-readable labels.
 * Used for displaying friendly names in transaction feeds, LP listings, etc.
 *
 * @module constants/addresses
 */

/**
 * THORChain module and protocol addresses
 */
export const THORCHAIN_MODULES = {
  'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt': 'Reserve',
  'thor1g98cy3n9mmjrpn0sxmn63lztelera37n8n67c0': 'Pool Module',
  'thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv': 'Bond Module',
  'thor1v8ppstuf6e3x0r4glqc68d5jqcs2tf38cg2q6y': 'Synth Module',
  'thor1d8c0wv4y72kmlytegjmgx825xwumt9qt5xe07k': 'Dev Fund'
};

/**
 * Known exchange addresses
 */
export const EXCHANGE_ADDRESSES = {
  'thor1cqg8pyxnq03d88cl3xfn5wzjkguw5kh9enwte4': 'Binance Cold',
  'thor1t60f02r8jvzjrhtnjgfj4ne6rs5wjnejwmj7fh': 'Binance Hot',
  'thor1nm0rrq86ucezaf8uj35pq9fpwr5r82clphp95t': 'Kraken Hot',
  'thor1t2hav42urasnsvwa6x6fyezaex9f953plh72pq': 'Kraken Cold',
  'thor1mtqtupwgjwn397w3dx9fqmqgzrfzq3240frash': 'Bybit'
};

/**
 * THORChain protocol addresses (RUNEPool, etc.)
 */
export const PROTOCOL_ADDRESSES = {
  'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt': 'RUNEPool'
};

/**
 * Combined mapping of all known addresses
 * Includes modules, exchanges, and protocol addresses
 */
export const KNOWN_ADDRESSES = {
  ...THORCHAIN_MODULES,
  ...EXCHANGE_ADDRESSES,
  ...PROTOCOL_ADDRESSES
};

/**
 * Get the human-readable label for an address
 * @param {string} address - THORChain address
 * @returns {string|null} Label or null if not known
 *
 * @example
 * const label = getAddressLabel('thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt');
 * // => 'Reserve'
 */
export function getAddressLabel(address) {
  if (!address) return null;
  return KNOWN_ADDRESSES[address] || null;
}

/**
 * Check if an address is a known/labeled address
 * @param {string} address - THORChain address
 * @returns {boolean} True if address is known
 */
export function isKnownAddress(address) {
  return address && KNOWN_ADDRESSES.hasOwnProperty(address);
}

/**
 * Check if an address is a THORChain module
 * @param {string} address - THORChain address
 * @returns {boolean} True if address is a module
 */
export function isModuleAddress(address) {
  return address && THORCHAIN_MODULES.hasOwnProperty(address);
}

/**
 * Check if an address is a known exchange
 * @param {string} address - THORChain address
 * @returns {boolean} True if address is an exchange
 */
export function isExchangeAddress(address) {
  return address && EXCHANGE_ADDRESSES.hasOwnProperty(address);
}

/**
 * Format an address with its label if known
 * @param {string} address - THORChain address
 * @param {Function} [shortenFn] - Optional function to shorten unknown addresses
 * @returns {string} Label if known, or shortened/original address
 *
 * @example
 * import { shortenAddress } from '$lib/utils/formatting';
 *
 * formatAddressWithLabel('thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt');
 * // => 'Reserve'
 *
 * formatAddressWithLabel('thor1xyz...', (addr) => shortenAddress(addr, 6, 4));
 * // => 'thor1x...xyz'
 */
export function formatAddressWithLabel(address, shortenFn = null) {
  if (!address) return '';

  const label = getAddressLabel(address);
  if (label) return label;

  return shortenFn ? shortenFn(address) : address;
}
