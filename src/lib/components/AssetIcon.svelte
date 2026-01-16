<script>
  /**
   * AssetIcon - Asset logo with fallback
   * Displays crypto asset logos using the shared getAssetLogo utility
   *
   * @prop {string} asset - Asset identifier (e.g., 'BTC.BTC', 'ETH.USDC-0X...')
   * @prop {string} size - 'small' (16px) | 'medium' (24px, default) | 'large' (32px) | 'xlarge' (48px)
   * @prop {string} alt - Alt text (defaults to asset name)
   * @prop {boolean} showFallback - Show letter fallback if no logo found (default: true)
   */
  import { getAssetLogo, getAssetDisplayName } from '$lib/constants';
  import { parseAsset } from '$lib/utils';

  export let asset = '';
  export let size = 'medium';
  export let alt = '';
  export let showFallback = true;

  $: logoPath = getAssetLogo(asset);
  $: displayName = alt || getAssetDisplayName(asset);
  $: parsed = parseAsset(asset);
  $: fallbackLetter = parsed?.symbol?.[0]?.toUpperCase() || '?';

  const sizes = {
    small: 16,
    medium: 24,
    large: 32,
    xlarge: 48
  };

  $: pixelSize = sizes[size] || sizes.medium;

  let imageError = false;

  function handleImageError() {
    imageError = true;
  }
</script>

{#if logoPath && !imageError}
  <img
    src={logoPath}
    {alt}
    class="asset-icon {size}"
    style="width: {pixelSize}px; height: {pixelSize}px;"
    on:error={handleImageError}
    title={displayName}
  />
{:else if showFallback}
  <span
    class="asset-fallback {size}"
    style="width: {pixelSize}px; height: {pixelSize}px; font-size: {pixelSize * 0.5}px;"
    title={displayName}
  >
    {fallbackLetter}
  </span>
{/if}

<style>
  .asset-icon {
    border-radius: 50%;
    object-fit: contain;
    vertical-align: middle;
  }

  .asset-icon.small {
    vertical-align: middle;
    position: relative;
    top: -1px;
  }

  .asset-icon.medium {
    vertical-align: top;
    position: relative;
    top: 2px;
  }

  .asset-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%);
    color: #ffffff;
    border-radius: 50%;
    font-weight: 700;
    vertical-align: middle;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
