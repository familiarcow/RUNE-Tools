<script>
  /**
   * LoadingBar - Shimmer loading placeholder
   * Used for skeleton loading states throughout the app
   *
   * @prop {string} variant - 'main' (28px) | 'sub' (12px) | 'inline' (16px) | 'custom'
   * @prop {string} width - CSS width value (default based on variant)
   * @prop {string} height - CSS height value (only for 'custom' variant)
   */
  export let variant = 'main';
  export let width = null;
  export let height = null;

  // Default dimensions based on variant
  const variants = {
    main: { height: '28px', width: '60%' },
    sub: { height: '12px', width: '80%' },
    inline: { height: '16px', width: '100px' },
    custom: { height: height || '20px', width: width || '100%' }
  };

  $: dimensions = variants[variant] || variants.main;
  $: styleHeight = height || dimensions.height;
  $: styleWidth = width || dimensions.width;
</script>

<div
  class="loading-bar"
  style="height: {styleHeight}; width: {styleWidth};"
/>

<style>
  .loading-bar {
    background: linear-gradient(90deg, #3a3a3a 25%, #5a5a5a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite ease-in-out;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
