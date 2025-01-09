<script>
  import { slide } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let selectedAsset;
  export let assets;
  export let assetNames;
  export let assetLogos;
  export let label;
  
  let isOpen = false;

  // Helper function to get chain logo path
  function getChainLogo(asset) {
    const chain = asset.split('.')[0];
    return `assets/chains/${chain}.svg`;
  }

  function handleAssetSelect(asset) {
    dispatch('select', { asset });
    selectedAsset = asset;
    isOpen = false;
  }
</script>

<style>
  .custom-select {
    position: relative;
    display: inline-block;
    flex: 1;
    margin-right: 10px;
  }

  .custom-select:last-child {
    margin-right: 0;
  }

  .selected,
  .options div {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    cursor: pointer;
    user-select: none;
  }

  .selected {
    background-color: #2e2e2e;
    border: 1px solid #444;
    border-radius: 4px;
  }

  .options {
    position: absolute;
    background-color: #2e2e2e;
    border: 1px solid #444;
    border-radius: 4px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    z-index: 1;
    max-height: 384px;
    overflow-y: auto;
    width: 100%;
    scrollbar-width: thin;  /* For Firefox */
    scrollbar-color: #444 #2e2e2e;  /* For Firefox */
  }

  /* Webkit scrollbar styles (Chrome, Safari, Edge) */
  .options::-webkit-scrollbar {
    width: 8px;  /* Width of the scrollbar */
  }

  .options::-webkit-scrollbar-track {
    background: #2e2e2e;  /* Color of the track */
    border-radius: 4px;
  }

  .options::-webkit-scrollbar-thumb {
    background: #444;  /* Color of the scroll thumb */
    border-radius: 4px;
    border: 2px solid #2e2e2e;  /* Creates padding effect */
  }

  .options::-webkit-scrollbar-thumb:hover {
    background: #555;  /* Slightly lighter on hover */
  }

  .options div:hover {
    background-color: #3c3c3c;
  }

  .logo-container {
    position: relative;
    display: flex;
    align-items: center;
    margin-right: 8px;
    height: 32px;
  }

  .asset-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .chain-logo-container {
    position: absolute;
    bottom: 0;
    right: -4px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
  }

  .chain-logo {
    width: 16px;
    height: 16px;
    object-fit: contain;
    border: none;
    pointer-events: none;
  }

  .asset-label {
    margin-right: 10px;
  }
</style>

<div class="custom-select">
  <div class="selected" on:click={() => (isOpen = !isOpen)}>
    <div class="logo-container">
      <img 
        class="asset-logo"
        src={assetLogos[selectedAsset]} 
        alt={assetNames[selectedAsset]} 
        on:error={(e) => {
          e.target.onerror = null;
          e.target.src = 'assets/coins/fallback-logo.svg';
        }}
      />
      <div class="chain-logo-container">
        <img 
          class="chain-logo"
          src={getChainLogo(selectedAsset)} 
          alt={selectedAsset.split('.')[0]}
          on:error={(e) => {
            e.target.onerror = null;
            e.target.src = 'assets/chains/fallback.svg';
          }}
        />
      </div>
    </div>
    <span>{assetNames[selectedAsset]}</span>
  </div>
  
  {#if isOpen}
    <div 
      class="options" 
      in:slide|local={{ duration: 300 }} 
      out:slide|local={{ duration: 200 }}
    >
      {#each assets as asset}
        <div on:click={() => handleAssetSelect(asset)}>
          <div class="logo-container">
            <img 
              class="asset-logo"
              src={assetLogos[asset]} 
              alt={assetNames[asset]} 
              on:error={(e) => {
                e.target.onerror = null;
                e.target.src = 'assets/coins/fallback-logo.svg';
              }}
            />
            <div class="chain-logo-container">
              <img 
                class="chain-logo"
                src={getChainLogo(asset)} 
                alt={asset.split('.')[0]}
                on:error={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'assets/chains/fallback.svg';
                }}
              />
            </div>
          </div>
          <span>{assetNames[asset]}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
