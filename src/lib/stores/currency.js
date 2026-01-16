/**
 * Currency Store - Multi-currency support for RUNE Tools
 *
 * USAGE:
 *
 * 1. Import in your component:
 *    import {
 *      currentCurrency,
 *      exchangeRates,
 *      currencySymbols,
 *      initCurrency,
 *      switchCurrency,
 *      formatCurrency,
 *      formatCurrencyWithDecimals
 *    } from '$lib/stores/currency';
 *
 * 2. Initialize on mount (reads URL params, fetches rates):
 *    onMount(() => initCurrency());
 *
 * 3. Use reactive values:
 *    $: formattedPrice = formatCurrency($exchangeRates, valueInUSD, $currentCurrency);
 *
 * 4. Switch currency (cycles USD -> EUR -> GBP -> JPY -> USD):
 *    <button on:click={switchCurrency}>Switch</button>
 *
 * 5. Get current symbol:
 *    {currencySymbols[$currentCurrency]}  // $, EUR, GBP, or JPY
 */

import { writable } from 'svelte/store';

// Supported currencies
export const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

// Currency symbols for display
export const currencySymbols = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5'
};

// Current selected currency (writable store)
export const currentCurrency = writable('USD');

// Exchange rates - RUNE price in each currency (writable store)
export const exchangeRates = writable({});

/**
 * Fetch exchange rates from CoinGecko
 * Updates the exchangeRates store with RUNE prices in USD, EUR, GBP, JPY
 */
export async function fetchExchangeRates() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=thorchain&vs_currencies=usd,eur,gbp,jpy'
    );
    const data = await response.json();
    exchangeRates.set({
      USD: data.thorchain.usd,
      EUR: data.thorchain.eur,
      GBP: data.thorchain.gbp,
      JPY: data.thorchain.jpy
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
  }
}

/**
 * Cycle to the next currency in the list
 * USD -> EUR -> GBP -> JPY -> USD
 */
export function switchCurrency() {
  currentCurrency.update(curr => {
    const idx = currencies.indexOf(curr);
    const next = currencies[(idx + 1) % currencies.length];
    updateCurrencyURL(next);
    return next;
  });
}

/**
 * Update the URL with the current currency param
 * USD is the default so it's removed from URL
 */
function updateCurrencyURL(currency) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location);
  if (currency !== 'USD') {
    url.searchParams.set('currency', currency);
  } else {
    url.searchParams.delete('currency');
  }
  window.history.pushState({}, '', url);
}

/**
 * Read currency from URL params
 * @returns {string} Currency code (defaults to 'USD')
 */
function readCurrencyFromURL() {
  if (typeof window === 'undefined') return 'USD';
  const urlParams = new URLSearchParams(window.location.search);
  const urlCurrency = urlParams.get('currency');
  if (urlCurrency && currencies.includes(urlCurrency.toUpperCase())) {
    return urlCurrency.toUpperCase();
  }
  return 'USD';
}

/**
 * Initialize the currency system
 * - Reads currency from URL params
 * - Fetches exchange rates from CoinGecko
 * Call this in onMount() of components that use multi-currency
 */
export async function initCurrency() {
  const urlCurrency = readCurrencyFromURL();
  currentCurrency.set(urlCurrency);
  await fetchExchangeRates();
}

/**
 * Format a USD value in the specified currency (no decimals)
 * Use for large values like bond amounts, totals
 *
 * @param {object} rates - Exchange rates object from $exchangeRates store
 * @param {number} valueInUSD - The value in USD to format
 * @param {string} currency - Target currency (USD, EUR, GBP, JPY)
 * @returns {string} Formatted currency string (e.g., "$1,234" or "EUR1.023")
 */
export function formatCurrency(rates, valueInUSD, currency) {
  if (!rates || !rates[currency] || !rates.USD) return '';

  const convertedValue = valueInUSD * (rates[currency] / rates.USD);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(convertedValue);

  // Replace the currency symbol/code with our preferred symbol
  return formatted.replace(/^[^\d-]+/, currencySymbols[currency]);
}

/**
 * Format a USD value in the specified currency (2 decimals)
 * Use for precise values like prices
 *
 * @param {object} rates - Exchange rates object from $exchangeRates store
 * @param {number} valueInUSD - The value in USD to format
 * @param {string} currency - Target currency (USD, EUR, GBP, JPY)
 * @returns {string} Formatted currency string (e.g., "$1.23" or "EUR1.02")
 */
export function formatCurrencyWithDecimals(rates, valueInUSD, currency) {
  if (!rates || !rates[currency] || !rates.USD) return '';

  const convertedValue = valueInUSD * (rates[currency] / rates.USD);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(convertedValue);

  // Replace the currency symbol/code with our preferred symbol
  return formatted.replace(/^[^\d-]+/, currencySymbols[currency]);
}
