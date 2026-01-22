<script>
  /**
   * ErrorDisplay - Unified error/warning/info display component
   *
   * @prop {string} type - Type of message: "error", "warning", "info" (default: "error")
   * @prop {string} variant - Display variant: "inline", "banner" (default: "banner")
   * @prop {string} message - The message to display
   * @prop {string} title - Optional title/header for the message
   * @prop {boolean} dismissible - Whether to show a dismiss button (default: false)
   * @prop {boolean} icon - Whether to show an icon (default: true)
   *
   * Usage:
   *   <ErrorDisplay message="Failed to load data" />
   *   <ErrorDisplay type="warning" message="No data available" />
   *   <ErrorDisplay type="info" variant="inline" message="Loading..." />
   *   <ErrorDisplay type="error" title="Connection Error" message="Could not reach server" dismissible />
   */

  import { createEventDispatcher } from 'svelte';
  import WarningIcon from './WarningIcon.svelte';

  export let type = "error";
  export let variant = "banner";
  export let message = "";
  export let title = "";
  export let dismissible = false;
  export let icon = true;

  const dispatch = createEventDispatcher();

  let visible = true;

  function handleDismiss() {
    visible = false;
    dispatch('dismiss');
  }

  // Get icon color based on type
  $: iconColor = type === 'error' ? '#dc3545'
               : type === 'warning' ? '#ffc107'
               : '#6366f1';
</script>

{#if visible && message}
  <div
    class="error-display {type} {variant}"
    role={type === 'error' ? 'alert' : 'status'}
    aria-live={type === 'error' ? 'assertive' : 'polite'}
  >
    {#if icon && variant === 'banner'}
      <span class="icon">
        {#if type === 'error'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        {:else if type === 'warning'}
          <WarningIcon size={18} color={iconColor} />
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        {/if}
      </span>
    {/if}

    <div class="content">
      {#if title}
        <span class="title">{title}</span>
      {/if}
      <span class="message">{message}</span>
    </div>

    {#if dismissible}
      <button class="dismiss" on:click={handleDismiss} aria-label="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .error-display {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  /* Banner variant - full width with background */
  .error-display.banner {
    background-color: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.2);
    border-radius: 12px;
    padding: 12px 16px;
  }

  .error-display.banner.warning {
    background-color: rgba(255, 193, 7, 0.1);
    border-color: rgba(255, 193, 7, 0.2);
  }

  .error-display.banner.info {
    background-color: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.2);
  }

  /* Inline variant - simple text */
  .error-display.inline {
    padding: 8px 0;
  }

  /* Icon styles */
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .error .icon {
    color: #dc3545;
  }

  .warning .icon {
    color: #ffc107;
  }

  .info .icon {
    color: #6366f1;
  }

  /* Content styles */
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font-weight: 600;
    font-size: 14px;
  }

  .message {
    font-size: 14px;
    font-weight: 500;
  }

  .error .title,
  .error .message {
    color: #dc3545;
  }

  .warning .title,
  .warning .message {
    color: #ffc107;
  }

  .info .title,
  .info .message {
    color: #6366f1;
  }

  /* Inline variant text colors are slightly different for readability */
  .error-display.inline.error .message {
    color: #f44336;
  }

  .error-display.inline.warning .message {
    color: #ff9800;
  }

  .error-display.inline.info .message {
    color: #818cf8;
  }

  /* Dismiss button */
  .dismiss {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .error .dismiss {
    color: #dc3545;
  }

  .warning .dismiss {
    color: #ffc107;
  }

  .info .dismiss {
    color: #6366f1;
  }

  .dismiss:hover {
    opacity: 1;
  }

  /* Multiple messages container - use this wrapper class in parent */
  :global(.error-messages) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
