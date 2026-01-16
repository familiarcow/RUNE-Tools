<script>
  /**
   * PageHeader - Section header with gradient background and shimmer effect
   * Used at the top of each tool/page section
   *
   * @prop {string} title - Header title text
   * @prop {string} subtitle - Optional subtitle text
   * @prop {boolean} showShimmer - Enable shimmer animation (default: true)
   */
  export let title = '';
  export let subtitle = '';
  export let showShimmer = true;
</script>

<div class="page-header" class:shimmer={showShimmer}>
  <div class="header-content">
    <h2>{title}</h2>
    {#if subtitle}
      <p class="subtitle">{subtitle}</p>
    {/if}
    <slot name="actions" />
  </div>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }

  .page-header.shimmer::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: shimmer 5s infinite;
  }

  @keyframes shimmer {
    0% {
      left: -100%;
    }
    50%, 100% {
      left: 100%;
    }
  }

  .header-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  h2 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #ffffff;
    margin: 0;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    background: transparent;
  }

  .subtitle {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    margin: 4px 0 0 0;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .page-header {
      padding: 16px 18px;
      border-radius: 12px;
    }

    h2 {
      font-size: 22px;
    }

    .subtitle {
      font-size: 13px;
    }
  }
</style>
