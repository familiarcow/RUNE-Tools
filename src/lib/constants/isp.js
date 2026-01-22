/**
 * ISP and Country Constants
 *
 * Mappings for Internet Service Provider logos and country flags
 * used in node displays and geographic visualizations.
 *
 * @module constants/isp
 *
 * @example
 * import { getIspLogo, getCountryEmoji } from '$lib/constants';
 *
 * const logo = getIspLogo('Google LLC');
 * const flag = getCountryEmoji('US');
 */

// ============================================
// Country Code to Emoji Mapping
// ============================================

/**
 * ISO 3166-1 alpha-2 country codes to flag emoji mapping
 * @constant {Object}
 */
export const COUNTRY_EMOJI = {
  AT: '\u{1F1E6}\u{1F1F9}', // Austria
  AU: '\u{1F1E6}\u{1F1FA}', // Australia
  CA: '\u{1F1E8}\u{1F1E6}', // Canada
  DE: '\u{1F1E9}\u{1F1EA}', // Germany
  FI: '\u{1F1EB}\u{1F1EE}', // Finland
  FR: '\u{1F1EB}\u{1F1F7}', // France
  GB: '\u{1F1EC}\u{1F1E7}', // United Kingdom
  IN: '\u{1F1EE}\u{1F1F3}', // India
  JP: '\u{1F1EF}\u{1F1F5}', // Japan
  MX: '\u{1F1F2}\u{1F1FD}', // Mexico
  NL: '\u{1F1F3}\u{1F1F1}', // Netherlands
  PL: '\u{1F1F5}\u{1F1F1}', // Poland
  RO: '\u{1F1F7}\u{1F1F4}', // Romania
  SE: '\u{1F1F8}\u{1F1EA}', // Sweden
  SG: '\u{1F1F8}\u{1F1EC}', // Singapore
  US: '\u{1F1FA}\u{1F1F8}'  // United States
};

/**
 * Get emoji flag for a country code
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string} Flag emoji or the country code if not found
 *
 * @example
 * getCountryEmoji('US');  // => '🇺🇸'
 * getCountryEmoji('XX');  // => 'XX'
 */
export function getCountryEmoji(countryCode) {
  if (!countryCode) return '';
  return COUNTRY_EMOJI[countryCode] || countryCode;
}

// ============================================
// ISP to Logo Mapping
// ============================================

/**
 * ISP name to logo filename mapping
 *
 * Logo files are located in /public/assets/isp/
 * @constant {Object}
 */
export const ISP_LOGOS = {
  // Amazon variants
  'Amazon Technologies Inc.': 'amazon.svg',
  'Amazon.com': 'amazon.svg',
  'Amazon.com, Inc.': 'amazon.svg',

  // Microsoft
  'Microsoft Corporation': 'azure.svg',

  // Cloud providers (generic cloud logo)
  'RouterHosting LLC': 'cloud.svg',
  'TIMEWARP IT Consulting GmbH': 'cloud.svg',
  'IPAX GmbH': 'cloud.svg',
  'DATANET': 'cloud.svg',
  'Aussie Broadband': 'cloud.svg',

  // MEVSPACE (Cloudzy)
  'MEVSPACE sp. z o.o': 'cloudzy.png',
  'MEVSPACE sp. z o.o.': 'cloudzy.png',

  // Specific providers
  'Akamai Technologies, Inc.': 'akamai.svg',
  'Cogent Communications': 'cogent.svg',
  'Comcast Cable Communications, LLC': 'comcast.svg',
  'The Constant Company': 'datacamp.svg',
  'The Constant Company, LLC': 'datacamp.svg',
  'DIGITALOCEAN': 'digitalocean.svg',
  'DigitalOcean, LLC': 'digitalocean.svg',
  'FlokiNET ehf': 'flokinet.svg',
  'Google LLC': 'google.svg',
  'Hetzner Online GmbH': 'hetzner.svg',
  'HOSTINGER': 'hostinger.svg',
  'HOSTINGER FR': 'hostinger.svg',
  'Hostinger International Limited': 'hostinger.svg',
  'Interserver, Inc': 'interserver.svg',
  'Level 3 Communications, Inc.': 'ionos.svg',
  'Leaseweb DE': 'leaseweb.png',
  'Leaseweb UK Limited': 'leaseweb.png',
  'Leaseweb USA, Inc.': 'leaseweb.png',
  'LeaseWeb Netherlands B.V.': 'leaseweb.png',
  'OVH SAS': 'ovh.svg',
  'Online S.A.S.': 'ovh.svg',
  'SGP VULTR': 'vultr.svg',
  'Zenlayer Inc': 'vultr.svg',
  'Choopa': 'vultr.svg'
};

/**
 * Get logo filename for an ISP
 *
 * @param {string} ispName - ISP name as returned by IP lookup
 * @returns {string|null} Logo filename or null if not found
 *
 * @example
 * getIspLogo('Google LLC');     // => 'google.svg'
 * getIspLogo('Unknown ISP');    // => null
 */
export function getIspLogo(ispName) {
  if (!ispName) return null;
  return ISP_LOGOS[ispName] || null;
}

/**
 * Get full path to ISP logo
 *
 * @param {string} ispName - ISP name as returned by IP lookup
 * @returns {string|null} Full path to logo or null if not found
 *
 * @example
 * getIspLogoPath('Google LLC');  // => 'assets/isp/google.svg'
 * getIspLogoPath('Unknown');     // => null
 */
export function getIspLogoPath(ispName) {
  const logo = getIspLogo(ispName);
  return logo ? `assets/isp/${logo}` : null;
}

/**
 * Check if an ISP has a logo mapping
 *
 * @param {string} ispName - ISP name to check
 * @returns {boolean} True if logo exists for ISP
 *
 * @example
 * hasIspLogo('Google LLC');    // => true
 * hasIspLogo('Unknown ISP');   // => false
 */
export function hasIspLogo(ispName) {
  return ispName && ISP_LOGOS[ispName] !== undefined;
}

/**
 * Get all supported ISP names
 *
 * @returns {Array<string>} Array of supported ISP names
 *
 * @example
 * const isps = getSupportedIsps();
 * console.log(`${isps.length} ISPs supported`);
 */
export function getSupportedIsps() {
  return Object.keys(ISP_LOGOS);
}

/**
 * Get all supported country codes
 *
 * @returns {Array<string>} Array of supported country codes
 *
 * @example
 * const countries = getSupportedCountries();
 * console.log(`${countries.length} countries supported`);
 */
export function getSupportedCountries() {
  return Object.keys(COUNTRY_EMOJI);
}
