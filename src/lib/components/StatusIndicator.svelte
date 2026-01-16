<script>
  /**
   * StatusIndicator - Colored dot/badge for status display
   *
   * @prop {string} status - 'active' | 'standby' | 'inactive' | 'disabled' | 'warning' | 'error'
   * @prop {boolean} pulse - Enable pulsing animation (default: true for active)
   * @prop {string} size - 'small' (8px) | 'medium' (10px, default) | 'large' (12px)
   * @prop {string} label - Optional text label to display next to indicator
   */
  export let status = 'inactive';
  export let pulse = null;
  export let size = 'medium';
  export let label = '';

  // Auto-enable pulse for active status unless explicitly disabled
  $: shouldPulse = pulse !== null ? pulse : status === 'active';

  const statusColors = {
    active: '#28a745',
    standby: '#ff9800',
    inactive: '#6c757d',
    disabled: '#4a4a4a',
    warning: '#ff9800',
    error: '#dc3545'
  };

  $: color = statusColors[status] || statusColors.inactive;
</script>

<span class="status-indicator-wrapper">
  <span
    class="status-indicator {size}"
    class:pulse={shouldPulse}
    style="--status-color: {color};"
    title={label || status}
  ></span>
  {#if label}
    <span class="status-label" style="color: {color};">{label}</span>
  {/if}
</span>

<style>
  .status-indicator-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .status-indicator {
    display: inline-block;
    border-radius: 50%;
    background-color: var(--status-color);
    box-shadow: 0 0 6px rgba(var(--status-color), 0.4);
  }

  .status-indicator.small {
    width: 8px;
    height: 8px;
  }

  .status-indicator.medium {
    width: 10px;
    height: 10px;
  }

  .status-indicator.large {
    width: 12px;
    height: 12px;
  }

  .status-indicator.pulse {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  .status-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }
</style>
