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

// ============================================
// Address formatting utilities
// ============================================

/**
 * Shorten an address for display
 * @param {string} address - Full address
 * @param {number} startChars - Characters to show at start (default: 8)
 * @param {number} endChars - Characters to show at end (default: 8)
 * @returns {string} Shortened address (e.g., "thor1abc...wxyz")
 *
 * @example
 * shortenAddress('thor1abc123def456ghi789jkl012mno345pqr678stu')
 * // => 'thor1abc...678stu'
 */
export function shortenAddress(address, startChars = 8, endChars = 6) {
  if (!address) return '';
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Get last N characters of an address (useful for node identifiers)
 * @param {string} address - Full address
 * @param {number} chars - Number of characters (default: 4)
 * @returns {string} Last N characters
 *
 * @example
 * getAddressSuffix('thor1abc123def456ghi789jkl012mno345pqr678stu')
 * // => 'stu'
 */
export function getAddressSuffix(address, chars = 4) {
  if (!address) return '';
  return address.slice(-chars);
}

// ============================================
// RUNE-specific formatting utilities
// ============================================

/**
 * Format a RUNE amount with smart decimals based on size
 * - Large amounts (>=1000): No decimals
 * - Medium amounts (>=1): 2 decimals
 * - Small amounts (>=0.01): 4 decimals
 * - Tiny amounts: 8 decimals
 * @param {number} amount - Amount in human-readable units
 * @returns {string} Formatted RUNE amount
 *
 * @example
 * formatRuneAmount(1234567.89) // => '1,234,568'
 * formatRuneAmount(123.456789) // => '123.46'
 * formatRuneAmount(0.12345678) // => '0.1235'
 * formatRuneAmount(0.00012345) // => '0.00012345'
 */
export function formatRuneAmount(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';

  const absAmount = Math.abs(amount);

  if (absAmount >= 1000) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else if (absAmount >= 1) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (absAmount >= 0.01) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  return amount.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

/**
 * Format a THORChain amount from base units (1e8) to display string
 * @param {number|string} amount - Amount in base units
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted amount string
 *
 * @example
 * formatThorAmount('12345678900') // => '123.46'
 * formatThorAmount('12345678900', 4) // => '123.4568'
 */
export function formatThorAmount(amount, decimals = 2) {
  if (amount === null || amount === undefined) return '0';

  const value = Number(amount) / 1e8;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
