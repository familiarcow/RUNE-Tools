/**
 * API index - re-exports all API clients
 *
 * Usage:
 *   import { thornode, midgard, THORNODE_ENDPOINTS } from '$lib/api';
 */

// THORNode client
export {
  thornode,
  ThorNodeClient,
  PROVIDERS,
  THORNODE_ENDPOINTS
} from './thornode.js';

// Midgard client
export {
  midgard,
  MidgardClient,
  MIDGARD_BASE
} from './midgard.js';

/**
 * All endpoint constants for reference
 */
export const ENDPOINTS = {
  thornode: {
    liquify: 'https://thornode.thorchain.liquify.com',
    ninerealms: 'https://thornode.ninerealms.com',
    archive: 'https://thornode-archive.ninerealms.com'
  },
  midgard: 'https://midgard.ninerealms.com/v2',
  coingecko: 'https://api.coingecko.com/api/v3'
};
