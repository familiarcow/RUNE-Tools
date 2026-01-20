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
 * Convert basis points to decimal percentage
 * @param {number} basisPoints - Value in basis points (10000 = 100%)
 * @returns {number} Decimal percentage (e.g., 5000 -> 50)
 *
 * @example
 * basisPointsToPercent(10000); // => 100
 * basisPointsToPercent(5000);  // => 50
 * basisPointsToPercent(150);   // => 1.5
 */
export function basisPointsToPercent(basisPoints) {
  if (!basisPoints) return 0;
  return Number(basisPoints) / 100;
}

/**
 * Format basis points as percentage string
 * THORChain uses 10000 basis points = 100%
 *
 * @param {number} basisPoints - Value in basis points
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted percentage (e.g., "50.00%")
 *
 * @example
 * formatBasisPoints(10000);  // => "100.00%"
 * formatBasisPoints(5000);   // => "50.00%"
 * formatBasisPoints(150, 1); // => "1.5%"
 */
export function formatBasisPoints(basisPoints, decimals = 2) {
  if (!basisPoints) return '0%';
  return `${basisPointsToPercent(basisPoints).toFixed(decimals)}%`;
}

/**
 * Format mimir basis points (100 = 1%)
 * Some mimir values use 100 bp = 1% instead of 10000 bp = 100%
 *
 * @param {number} basisPoints - Value in mimir basis points
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Formatted percentage (e.g., "50.0%")
 *
 * @example
 * formatMimirBasisPoints(5000); // => "50.0%"
 * formatMimirBasisPoints(150);  // => "1.5%"
 */
export function formatMimirBasisPoints(basisPoints, decimals = 1) {
  if (!basisPoints) return '0%';
  return `${(Number(basisPoints) / 100).toFixed(decimals)}%`;
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

// ============================================
// Countdown and Duration Formatting
// ============================================

/**
 * Format seconds into a human-readable countdown string
 *
 * Supports multiple format options:
 * - 'compact': "5d 12h 30m" (default)
 * - 'full': "5 days, 12 hours, 30 minutes"
 * - 'short': "5d" or "12h" or "30m" (largest unit only)
 *
 * @param {number} seconds - Total seconds remaining
 * @param {Object} [options={}] - Formatting options
 * @param {string} [options.format='compact'] - Output format
 * @param {boolean} [options.showSeconds=false] - Include seconds in output
 * @param {string} [options.zeroText='Now!'] - Text to show when countdown reaches zero
 * @returns {string} Formatted countdown string
 *
 * @example
 * formatCountdown(90061) // => "1d 1h 1m"
 * formatCountdown(90061, { format: 'full' }) // => "1 day, 1 hour, 1 minute"
 * formatCountdown(90061, { showSeconds: true }) // => "1d 1h 1m 1s"
 * formatCountdown(3661) // => "1h 1m"
 * formatCountdown(61) // => "1m"
 * formatCountdown(0) // => "Now!"
 */
export function formatCountdown(seconds, options = {}) {
  const { format = 'compact', showSeconds = false, zeroText = 'Now!' } = options;

  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return zeroText;
  }

  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (format === 'full') {
    const parts = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    if (showSeconds && secs > 0) parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);

    return parts.length > 0 ? parts.join(', ') : zeroText;
  }

  if (format === 'short') {
    // Return only the largest unit
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    if (showSeconds && secs > 0) return `${secs}s`;
    return zeroText;
  }

  // Default: compact format "5d 12h 30m"
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  if (showSeconds && secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Format a duration in seconds to "X days and Y hours" style
 *
 * Commonly used for longer durations like unbonding periods.
 *
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted duration string
 *
 * @example
 * formatDuration(90000) // => "1 day and 1 hour"
 * formatDuration(172800) // => "2 days"
 * formatDuration(3600) // => "1 hour"
 * formatDuration(1800) // => "30 minutes"
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return '0 seconds';
  }

  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0 && days === 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  if (parts.length === 0) {
    return `${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}`;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

/**
 * Format blocks remaining as a countdown string
 *
 * Convenience function that combines block-to-time conversion with formatting.
 *
 * @param {number} blocks - Number of blocks remaining
 * @param {number} [blockTimeSeconds=6] - Seconds per block
 * @param {Object} [options={}] - Formatting options (passed to formatCountdown)
 * @returns {string} Formatted countdown string
 *
 * @example
 * formatBlocksCountdown(600) // => "1h 0m" (600 blocks * 6 seconds = 3600 seconds)
 * formatBlocksCountdown(14400) // => "1d 0h 0m" (14400 blocks = 1 day)
 */
export function formatBlocksCountdown(blocks, blockTimeSeconds = 6, options = {}) {
  const seconds = blocks * blockTimeSeconds;
  return formatCountdown(seconds, options);
}

// ============================================
// Clipboard Utilities
// ============================================

/**
 * Copy text to clipboard
 *
 * Uses the modern Clipboard API with a fallback for older browsers.
 *
 * @param {string} text - Text to copy to clipboard
 * @param {string} [description] - Optional description for logging/notifications
 * @returns {Promise<boolean>} True if copy succeeded, false otherwise
 *
 * @example
 * await copyToClipboard('thor1abc...xyz');
 * await copyToClipboard(address, 'wallet address');
 */
export async function copyToClipboard(text, description) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    if (description) {
      console.log(`Copied ${description}: ${text}`);
    }
    return true;
  } catch (err) {
    console.error('Failed to copy text:', err);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      console.error('Fallback copy also failed:', fallbackErr);
      return false;
    }
  }
}
