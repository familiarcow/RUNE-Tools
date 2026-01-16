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
   */
  import LoadingBar from './LoadingBar.svelte';

  export let title = '';
  export let loading = false;
  export let error = null;
  export let height = '120px';
  export let compact = false;
</script>

<div
  class="data-card"
  class:compact
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
  .data-card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .data-card.compact {
    padding: 12px;
  }

  .data-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #323232 0%, #424242 100%);
  }

  .card-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a0a0a0;
    margin: 0 0 12px 0;
  }

  .card-content {
    position: relative;
    height: calc(100% - 28px);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
  }

  .error-state {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #dc3545;
    font-size: 14px;
  }

  .error-icon {
    font-size: 18px;
  }

  .error-message {
    color: #ff6b6b;
  }

  @media (max-width: 600px) {
    .data-card {
      padding: 14px;
      min-height: 100px;
    }

    .data-card.compact {
      padding: 10px;
    }
  }
</style>
