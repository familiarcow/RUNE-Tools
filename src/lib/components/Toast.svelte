<script>
  /**
   * Toast - Notification popup component
   * Shows temporary messages at the bottom of the screen
   *
   * @prop {string} message - The message to display
   * @prop {boolean} visible - Whether the toast is visible
   * @prop {number} duration - Auto-hide duration in ms (default: 3000, 0 to disable)
   * @prop {'info' | 'success' | 'warning' | 'error'} variant - Toast style variant
   *
   * @event hide - Fired when toast should be hidden
   *
   * @example
   * <Toast
   *   message="Copied to clipboard!"
   *   visible={showToast}
   *   on:hide={() => showToast = false}
   * />
   */
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';

  export let message = '';
  export let visible = false;
  export let duration = 3000;
  export let variant = 'info';

  const dispatch = createEventDispatcher();
  let timeoutId;

  $: if (visible && duration > 0) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      dispatch('hide');
    }, duration);
  }

  function handleClick() {
    dispatch('hide');
  }
</script>

{#if visible && message}
  <div
    class="toast toast-{variant}"
    transition:fade={{ duration: 200 }}
    on:click={handleClick}
    role="alert"
  >
    {#if variant === 'success'}
      <span class="toast-icon">✓</span>
    {:else if variant === 'warning'}
      <span class="toast-icon">⚠</span>
    {:else if variant === 'error'}
      <span class="toast-icon">✕</span>
    {/if}
    <span class="toast-message">{message}</span>
  </div>
{/if}

<style>
  @import '$lib/styles/variables.css';

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-default);
    font-weight: var(--font-semibold);
    z-index: var(--z-toast);
    font-size: var(--text-base);
    max-width: 80%;
    text-align: center;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    transition: var(--transition-fast);
  }

  .toast:hover {
    transform: translateX(-50%) scale(1.02);
  }

  .toast-icon {
    font-size: var(--text-md);
    flex-shrink: 0;
  }

  .toast-message {
    color: var(--text-primary);
  }

  /* Variant: Info (default) */
  .toast-info {
    background: linear-gradient(135deg, var(--accent-link) 0%, #357abd 100%);
    color: var(--text-primary);
  }

  /* Variant: Success */
  .toast-success {
    background: linear-gradient(135deg, var(--color-success) 0%, #218838 100%);
    color: var(--text-primary);
  }

  /* Variant: Warning */
  .toast-warning {
    background: linear-gradient(135deg, var(--color-warning) 0%, #e68a00 100%);
    color: #1a1a1a;
  }

  .toast-warning .toast-message {
    color: #1a1a1a;
  }

  /* Variant: Error */
  .toast-error {
    background: linear-gradient(135deg, var(--color-error) 0%, #c82333 100%);
    color: var(--text-primary);
  }

  @media (max-width: 600px) {
    .toast {
      bottom: 40px;
      font-size: var(--text-sm);
      padding: 10px 20px;
      max-width: 90%;
    }
  }
</style>
