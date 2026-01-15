<script>
  import { onMount } from 'svelte';
  import LPChecker from './LPChecker.svelte';
  import LPDetail from './LPDetail.svelte';
  import { writable } from 'svelte/store';

  let activeTab = 'checker';
  let selectedPool = null;
  let selectedAddress = null;
  let selectedBlockHeight = null;
  let runePrice = 0;
  let assetPrices = {};

  const addressParam = writable('');

  let pools = [];
  let loading = true;
  let error = null;

  const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'https://thornode-archive.ninerealms.com';

  // Add this store to track the active tab across components
  const activeTabStore = writable('checker');
  
  // Subscribe to changes in the store
  activeTabStore.subscribe(value => {
    activeTab = value;
  });

  // Add a temporary store for the address input and block height
  let addressInput = '';
  let blockHeightInput = '';

  onMount(async () => {
    try {
      // Fetch pools list
      const poolsResponse = await fetch(`${API_DOMAIN}/thorchain/pools`);
      pools = await poolsResponse.json();

      // Fetch RUNE price
      const networkResponse = await fetch(`${API_DOMAIN}/thorchain/network`);
      const networkData = await networkResponse.json();
      runePrice = parseFloat(networkData.rune_price_in_tor) / 1e8;

      // Fetch asset prices
      for (const pool of pools) {
        assetPrices[pool.asset] = parseFloat(pool.asset_tor_price) / 1e8;
      }

      // Parse URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const pool = urlParams.get('pool');
      const address = urlParams.get('address');
      const blockHeight = urlParams.get('height');

      if (pool && address) {
        selectedPool = pool;
        selectedAddress = address;
        if (blockHeight) {
          selectedBlockHeight = blockHeight;
        }
        activeTabStore.set('detail'); // Use the store instead of direct assignment
      }

      loading = false;

      // Add this to handle initial page load with URL parameters
      if (selectedAddress) {
        updateTitle(selectedAddress);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      error = 'Failed to load data. Please try again later.';
      loading = false;
    }
  });

  // Add this function to update the document title
  function updateTitle(address) {
    if (address) {
      document.title = `${address.slice(-4)} LP - RUNE Tools`;
    } else {
      document.title = 'LP Checker - RUNE Tools';
    }
  }

  // Update the handleSelectLP function
  function handleSelectLP(event) {
    selectedPool = event.detail.pool;
    selectedAddress = event.detail.address;
    activeTabStore.set('detail');
    updateURL();
    updateTitle(event.detail.address);
  }

  // Update the handleGoBack function
  function handleGoBack() {
    activeTabStore.set('checker');
    updateURL();
    updateTitle(null);
  }

  function updateURL() {
    let url = '/lp';
    if (activeTab === 'detail' && selectedPool && selectedAddress) {
      url += `?pool=${selectedPool}&address=${selectedAddress}`;
      if (selectedBlockHeight) {
        url += `&height=${selectedBlockHeight}`;
      }
    }
    history.pushState(null, '', url);
  }

  // Update the viewRandomLP function
  function viewRandomLP() {
    if (pools.length > 0) {
      const randomPool = pools[Math.floor(Math.random() * pools.length)];
      selectedPool = randomPool.asset;
      selectedAddress = null;
      activeTabStore.set('detail'); // Use the store instead of direct assignment
      updateURL();
    }
  }

  function handlePoolSelect(event) {
    selectedPool = event.target.value;
  }

  function handleAddressInput(event) {
    // Update temporary input value instead of selectedAddress
    addressInput = event.target.value;
  }

  // Update the handleDetailSubmit function
  function handleDetailSubmit() {
    if (selectedPool && addressInput) {
      // Only update selectedAddress when submitting
      selectedAddress = addressInput;
      if (blockHeightInput) {
        selectedBlockHeight = blockHeightInput;
      }
      activeTabStore.set('detail');
      updateURL();
      updateTitle(selectedAddress);
    }
  }

  // Update the tab click handlers in the template
  function handleTabClick(tab) {
    activeTabStore.set(tab);
    updateURL();
  }
</script>

<div class="liquidity-providers">
  <div class="container">
    <div class="tabs">
      <button 
        class:active={activeTab === 'checker'} 
        on:click={() => handleTabClick('checker')}
      >
        LP Checker
      </button>
      <button 
        class:active={activeTab === 'detail'} 
        on:click={() => handleTabClick('detail')}
      >
        LP Detail
      </button>
    </div>

    {#if loading}
      <p class="loading">Loading data...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else}
      <div class="tab-content">
        {#if activeTab === 'checker'}
          <LPChecker 
            on:selectLP={handleSelectLP}
            {runePrice}
            {assetPrices}
            {pools}
          />
        {:else if activeTab === 'detail'}
          {#if selectedPool && selectedAddress}
            <LPDetail 
              address={selectedAddress}
              pool={selectedPool}
              height={selectedBlockHeight}
              goBack={handleGoBack}
              {runePrice}
              {assetPrices}
              {viewRandomLP}
            />
          {:else}
            <div class="lp-detail-selector">
              <h3>Enter LP Details</h3>
              <select bind:value={selectedPool} on:change={handlePoolSelect}>
                <option value="">Select a pool</option>
                {#each pools as pool}
                  <option value={pool.asset}>{pool.asset}</option>
                {/each}
              </select>
              <input 
                type="text" 
                placeholder="Enter LP address" 
                bind:value={addressInput}
                on:input={handleAddressInput}
              />
              <input
                type="number"
                placeholder="Block height (optional)"
                bind:value={blockHeightInput}
                min="4786560"
              />
              <button 
                on:click={handleDetailSubmit} 
                disabled={!selectedPool || !addressInput}
              >
                View LP Details
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .liquidity-providers {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  h2 {
    display: none;  /* Remove the title */
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 0;
    background-color: #2c2c2c;
  }

  .tabs button {
    flex: 1;
    padding: 16px 24px;
    background-color: #2c2c2c;
    border: none;
    color: #888;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
    border-bottom: 3px solid transparent;
  }

  .tabs button.active {
    background-color: #1a1a1a;
    color: #4A90E2;
    border-bottom: 3px solid #4A90E2;
    font-weight: 500;
  }

  .tabs button:hover:not(.active) {
    background-color: #252525;
    color: #bbb;
    border-bottom: 3px solid #357abd;
  }

  .tab-content {
    padding: 20px;
  }

  .lp-detail-selector {
    max-width: 500px;
    margin: 0 auto;
    padding: 30px;
    background-color: #242424;
    border-radius: 12px;
    border: 1px solid #333;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .lp-detail-selector h3 {
    color: #4A90E2;
    text-align: center;
    margin: 0 0 24px 0;
    font-size: 22px;
    font-weight: 600;
  }

  .lp-detail-selector select,
  .lp-detail-selector input {
    width: 100%;
    padding: 14px 16px;
    margin-bottom: 16px;
    border: 1px solid #444;
    border-radius: 8px;
    background-color: #1a1a1a;
    color: #fff;
    font-size: 15px;
    transition: all 0.2s ease;
  }

  .lp-detail-selector select:hover,
  .lp-detail-selector input:hover {
    border-color: #4A90E2;
    background-color: #1f1f1f;
  }

  .lp-detail-selector select:focus,
  .lp-detail-selector input:focus {
    border-color: #4A90E2;
    outline: none;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
    background-color: #1f1f1f;
  }

  .lp-detail-selector button {
    width: 100%;
    padding: 14px;
    background-color: #4A90E2;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 8px;
  }

  .lp-detail-selector button:hover:not(:disabled) {
    background-color: #357abd;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
  }

  .lp-detail-selector button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: none;
  }

  .lp-detail-selector button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #666;
  }

  .loading {
    text-align: center;
    color: #888;
    padding: 40px;
    font-size: 18px;
  }

  .error {
    color: #f44336;
    text-align: center;
    padding: 20px;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .liquidity-providers {
      padding: 10px;
    }
    
    .tabs {
      flex-direction: column;
      padding: 10px;
    }
    
    .tabs button {
      border-radius: 4px;
      margin-bottom: 5px;
    }

    .lp-detail-selector {
      padding: 20px;
    }
  }
</style>
