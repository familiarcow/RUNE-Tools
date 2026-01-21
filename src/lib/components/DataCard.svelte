<script>
  /**
   * DataCard - Standard card container with loading state
   * Used throughout the app for displaying metrics and data
   *
   * @prop {string} title - Card title (uppercase, small text)
   * @prop {boolean} loading - Show loading shimmer state
   * @prop {string} error - Error message to display
   * @prop {string} height - Card height (default: '120px')
   * @prop {boolean} compact - Use compact padding (default: false)
   * @prop {boolean} noHover - Disable hover effects (default: false)
   */
  import LoadingBar from './LoadingBar.svelte';

  export let title = '';
  export let loading = false;
  export let error = null;
  export let height = '120px';
  export let compact = false;
  export let noHover = false;
</script>

<div
  class="data-card"
  class:compact
  class:no-hover={noHover}
  style="height: {height};"
>
  {#if title}
    <h3 class="card-title">{title}</h3>
  {/if}

  <div class="card-content">
    {#if loading}
      <div class="loading-state">
        <LoadingBar variant="main" />
        <LoadingBar variant="sub" />
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{error}</span>
      </div>
    {:else}
      <slot />
    {/if}
  </div>
</div>

<style>
  /* Import CSS variables */
  @import '$lib/styles/variables.css';

  .data-card {
    background: var(--gradient-card);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-default);
    position: relative;
    transition: var(--transition-smooth);
  }

  .data-card.compact {
    padding: var(--space-md);
  }

  .data-card:not(.no-hover):hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-card-hover), var(--shadow-glow);
    border-color: var(--border-hover);
    background: var(--gradient-card-hover);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--text-muted);
    margin: 0 0 12px 0;
  }

  .card-content {
    position: relative;
    height: calc(100% - 28px);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-top: var(--space-sm);
  }

  .error-state {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-error);
    font-size: var(--text-base);
  }

  .error-icon {
    font-size: var(--text-lg);
  }

  .error-message {
    color: #ff6b6b;
  }

  @media (max-width: 600px) {
    .data-card {
      padding: var(--space-base, 14px);
      min-height: 100px;
    }

    .data-card.compact {
      padding: var(--space-md, 10px);
    }
  }
</style>
