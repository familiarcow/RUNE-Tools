<script>
  import { onMount } from 'svelte';
  import LPChecker from './LPChecker.svelte';
  import LPDetail from './LPDetail.svelte';
  import { writable } from 'svelte/store';

  let activeTab = 'checker';
  let selectedPool = null;
  let selectedAddress = null;
  let runePrice = 0;
  let assetPrices = {};

  const addressParam = writable('');

  let pools = [];
  let loading = true;
  let error = null;

  const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'https://thornode.ninerealms.com';

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

      if (pool && address) {
        selectedPool = pool;
        selectedAddress = address;
        activeTab = 'detail';
      }

      loading = false;
    } catch (err) {
      console.error('Failed to fetch data:', err);
      error = 'Failed to load data. Please try again later.';
      loading = false;
    }
  });

  function handleSelectLP(event) {
    selectedPool = event.detail.pool;
    selectedAddress = event.detail.address;
    activeTab = 'detail';
    updateURL();
  }

  function handleGoBack() {
    activeTab = 'checker';
    updateURL();
  }

  function updateURL() {
    const url = activeTab === 'detail' && selectedPool && selectedAddress
      ? `/lp?pool=${selectedPool}&address=${selectedAddress}`
      : '/lp';
    history.pushState(null, '', url);
  }

  function viewRandomLP() {
    if (pools.length > 0) {
      const randomPool = pools[Math.floor(Math.random() * pools.length)];
      selectedPool = randomPool.asset;
      selectedAddress = null;
      activeTab = 'detail';
      updateURL();
    }
  }

  function handlePoolSelect(event) {
    selectedPool = event.target.value;
  }

  function handleAddressInput(event) {
    selectedAddress = event.target.value;
  }

  function handleDetailSubmit() {
    if (selectedPool && selectedAddress) {
      activeTab = 'detail';
      updateURL();
    }
  }
</script>

<div class="liquidity-providers">
  <div class="tabs">
    <button 
      class:active={activeTab === 'checker'} 
      on:click={() => { activeTab = 'checker'; updateURL(); }}
    >
      LP Checker
    </button>
    <button 
      class:active={activeTab === 'detail'} 
      on:click={() => { activeTab = 'detail'; updateURL(); }}
    >
      LP Detail
    </button>
  </div>

  {#if loading}
    <p>Loading data...</p>
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
              bind:value={selectedAddress} 
              on:input={handleAddressInput}
            />
            <button on:click={handleDetailSubmit} disabled={!selectedPool || !selectedAddress}>
              View LP Details
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .liquidity-providers {
    margin: 20px auto;
    max-width: 1200px;
    color: var(--text-color);
  }

  .tabs {
    display: flex;
    margin-bottom: 20px;
  }

  .tabs button {
    background-color: var(--surface-color);
    color: var(--text-color);
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .tabs button.active {
    background-color: var(--primary-color);
    color: white;
  }

  .tabs button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab-content {
    background-color: var(--surface-color);
    padding: 20px;
    border-radius: 4px;
  }

  .lp-detail-selector {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
    margin: 0 auto;
  }

  .lp-detail-selector select,
  .lp-detail-selector input,
  .lp-detail-selector button {
    padding: 10px;
    font-size: 16px;
    border: 1px solid var(--text-muted);
    border-radius: 4px;
    background-color: var(--surface-color);
    color: var(--text-color);
  }

  .lp-detail-selector button {
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .lp-detail-selector button:hover:not(:disabled) {
    background-color: var(--primary-color);
    color: white;
  }

  .lp-detail-selector button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    color: #f44336;
    font-weight: bold;
  }
</style>