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
  THORNODE_PROVIDERS
} from './thornode.js';

// Midgard client
export {
  midgard,
  MidgardClient,
  MIDGARD_PROVIDERS
} from './midgard.js';
