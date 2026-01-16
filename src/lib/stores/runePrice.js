/**
 * RUNE Price Store
 *
 * Provides real-time RUNE price data shared across all components.
 * Uses reference counting to manage lifecycle - only fetches when
 * there are active subscribers.
 */

import { writable, derived, get } from 'svelte/store';
import { thornode } from '../api/thornode.js';

// Private state for lifecycle management
let updateInterval = null;
let subscriberCount = 0;

/**
 * Core RUNE price store (in USD)
 */
export const runePrice = writable(0);

/**
 * Price history for sparklines and charts
 * Stores { price, timestamp } objects
 */
export const runePriceHistory = writable([]);

/**
 * Loading state
 */
export const runePriceLoading = writable(true);

/**
 * Error state
 */
export const runePriceError = writable(null);

/**
 * Last update timestamp
 */
export const runePriceLastUpdate = writable(null);

// ============================================
// Derived stores
// ============================================

/**
 * Formatted RUNE price string
 */
export const runePriceFormatted = derived(runePrice, ($price) => {
  if ($price === 0) return '$0.00';
  return `$${$price.toFixed(6)}`;
});

/**
 * Price change from previous value
 */
export const runePriceChange = derived(runePriceHistory, ($history) => {
  if ($history.length < 2) {
    return { absolute: 0, percentage: 0, direction: 'neutral' };
  }

  const current = $history[$history.length - 1]?.price || 0;
  const previous = $history[$history.length - 2]?.price || 0;
  const absolute = current - previous;
  const percentage = previous > 0 ? (absolute / previous) * 100 : 0;

  return {
    absolute,
    percentage,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'neutral'
  };
});

// ============================================
// Core functions
// ============================================

/**
 * Fetch and update RUNE price
 */
async function fetchRunePrice() {
  try {
    const price = await thornode.getRunePrice({ realtime: true });

    runePrice.set(price);
    runePriceLastUpdate.set(new Date());

    // Update history (keep last hour at 6-second intervals = 600 entries max)
    runePriceHistory.update((history) => {
      const timestamp = new Date();
      const oneHourAgo = new Date(timestamp.getTime() - 3600000);

      // Filter out old entries
      const filtered = history.filter((point) => point.timestamp > oneHourAgo);

      return [...filtered, { price, timestamp }];
    });

    runePriceError.set(null);
    runePriceLoading.set(false);
  } catch (error) {
    runePriceError.set(error.message);
    console.error('Failed to fetch RUNE price:', error);
  }
}

/**
 * Start automatic price updates
 * Uses reference counting to manage lifecycle
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRunePrice() {
  subscriberCount++;

  if (subscriberCount === 1) {
    // First subscriber - start fetching
    runePriceLoading.set(true);
    fetchRunePrice();
    updateInterval = setInterval(fetchRunePrice, 6000); // Every 6 seconds
  }

  // Return unsubscribe function
  return () => {
    subscriberCount--;
    if (subscriberCount === 0 && updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  };
}

/**
 * Force refresh the price (doesn't affect subscription lifecycle)
 * @returns {Promise<void>}
 */
export function refreshRunePrice() {
  return fetchRunePrice();
}

/**
 * Get current RUNE price synchronously
 * @returns {number} Current RUNE price
 */
export function getRunePriceNow() {
  return get(runePrice);
}

/**
 * Check if the price store is currently active
 * @returns {boolean}
 */
export function isRunePriceActive() {
  return subscriberCount > 0;
}
