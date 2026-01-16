/**
 * Shared formatting utilities for RUNE Tools
 * Consolidates duplicate formatting functions from 15+ components
 */

/**
 * Format a number with locale-aware thousands separators
 * @param {number} num - Number to format
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} Formatted number string
 */
export function formatNumber(num, options = {}) {
  if (num === null || num === undefined || isNaN(num)) return '0';

  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  };

  return new Intl.NumberFormat('en-US', { ...defaultOptions, ...options }).format(num);
}

/**
 * Format a number as USD currency
 * @param {number} amount - Amount in USD
 * @param {Object} options - Additional Intl.NumberFormat options
 * @returns {string} Formatted USD string (e.g., "$1,234.56")
 */
export function formatUSD(amount, options = {}) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';

  const defaultOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  };

  return new Intl.NumberFormat('en-US', { ...defaultOptions, ...options }).format(amount);
}

/**
 * Format a number as USD with decimals for smaller values
 * @param {number} amount - Amount in USD
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted USD string
 */
export function formatUSDWithDecimals(amount, decimals = 2) {
  return formatUSD(amount, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a percentage with sign
 * @param {number} num - Decimal value (0.5 = 50%)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted percentage string (e.g., "+50.00%" or "-25.50%")
 */
export function formatPercentage(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0%';

  const percentage = num * 100;
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(decimals)}%`;
}

/**
 * Format a percentage without sign prefix
 * @param {number} num - Decimal value (0.5 = 50%)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted percentage string (e.g., "50.00%")
 */
export function formatPercentageNoSign(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0%';

  const percentage = num * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Simplify large numbers to human-readable format
 * @param {number} num - Number to simplify
 * @returns {string} Simplified string (e.g., "1.5M", "2.3B")
 */
export function simplifyNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return sign + (absNum / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (absNum >= 1_000_000) {
    return sign + (absNum / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (absNum >= 1_000) {
    return sign + (absNum / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }

  return sign + Math.round(absNum).toString();
}

/**
 * Format a price with dynamic decimal places based on magnitude
 * - Prices >= 1000: 2 decimals
 * - Prices >= 1: 4 decimals
 * - Prices < 1: 6 decimals
 * @param {number} price - Price to format
 * @returns {string} Formatted price string
 */
export function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '0';

  let decimals;
  if (price >= 1000) {
    decimals = 2;
  } else if (price >= 1) {
    decimals = 4;
  } else if (price >= 0.01) {
    decimals = 6;
  } else {
    decimals = 8;
  }

  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a crypto amount with appropriate decimals
 * @param {number} amount - Amount to format
 * @param {number} decimals - Decimal places (default: 8)
 * @returns {string} Formatted amount string
 */
export function formatCryptoAmount(amount, decimals = 8) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals
  });
}

/**
 * Format time duration from seconds
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string (e.g., "5m 30s")
 */
export function formatTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '0s';

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format a date to locale string
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  const d = new Date(date);
  return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format a datetime to locale string
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
