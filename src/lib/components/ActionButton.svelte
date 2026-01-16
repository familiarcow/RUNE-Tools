<script>
  /**
   * ActionButton - Standard action button with variants
   * 44x44px buttons with hover effects
   *
   * @prop {string} variant - 'refresh' | 'bookmark' | 'copy' | 'currency' | 'external' | 'default'
   * @prop {string} title - Tooltip/aria-label text
   * @prop {boolean} disabled - Disable button
   * @prop {boolean} active - Active/selected state (for toggles)
   * @prop {string} size - 'small' (32px) | 'medium' (44px, default) | 'large' (56px)
   */
  import { createEventDispatcher } from 'svelte';

  export let variant = 'default';
  export let title = '';
  export let disabled = false;
  export let active = false;
  export let size = 'medium';

  const dispatch = createEventDispatcher();

  const variantColors = {
    refresh: { base: '#6366f1', hover: '#4f46e5' },
    bookmark: { base: '#28a745', hover: '#218838' },
    copy: { base: '#4A90E2', hover: '#3A7BC8' },
    currency: { base: '#ffc107', hover: '#e0a800' },
    external: { base: '#6c757d', hover: '#5a6268' },
    default: { base: '#4a4a4a', hover: '#5a5a5a' }
  };

  $: colors = variantColors[variant] || variantColors.default;

  function handleClick(e) {
    if (!disabled) {
      dispatch('click', e);
    }
  }
</script>

<button
  class="action-button {size}"
  class:active
  class:disabled
  {title}
  aria-label={title}
  on:click={handleClick}
  style="--btn-color: {colors.base}; --btn-hover: {colors.hover};"
>
  <slot />
</button>

<style>
  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 14px;
    background: var(--btn-color);
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .action-button.small {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .action-button.medium {
    width: 44px;
    height: 44px;
  }

  .action-button.large {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }

  .action-button:hover:not(.disabled) {
    background: var(--btn-hover);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.2);
  }

  .action-button:active:not(.disabled) {
    transform: translateY(0) scale(0.98);
  }

  .action-button.active {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.4);
  }

  .action-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button :global(svg) {
    width: 20px;
    height: 20px;
  }

  .action-button.small :global(svg) {
    width: 16px;
    height: 16px;
  }

  .action-button.large :global(svg) {
    width: 24px;
    height: 24px;
  }
</style>
