<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import SettingsIcon from '../../public/assets/Settings.svelte';
  import RefreshIcon from '../../public/assets/Refresh.svelte';
  import { fetchJSONWithFallback } from '$lib/utils/api';

  const showInUSD = writable(false);
  const showSettings = writable(false);
  const selectedSortOption = writable('depth');
  const assets = writable([]);

  async function getSecuredAssets() {
    try {
      // Use shared utility with fallback support
      const data = await fetchJSONWithFallback('/thorchain/securedassets');
      return data.map(asset => ({
        ...asset,
        supply: Number(asset.supply),
        depth: Number(asset.depth)
      })).sort((a, b) => b.depth - a.depth);
    } catch (error) {
      console.error('Failed to fetch secured assets:', error);
      return [];
    }
  }

  onMount(async () => {
    assets.set(await getSecuredAssets());
  });

  function refreshAssets() {
    getSecuredAssets().then(newAssets => assets.set(newAssets));
  }

  function formatCryptoName(cryptoName) {
    const parts = cryptoName.split(/\.|-/);
    const [chain, asset, identifier] = parts;
    if (["ETH", "BSC", "AVAX"].includes(chain) && identifier) {
      return `${asset} (${chain})`;
    } else {
      return asset;
    }
  }

  function formatNumberCrypto(number, toAsset) {
    const assetPrefix = toAsset.split("-")[0];
    const decimals = {
      BTC: 5, ETH: 3, BSC: 2, BCH: 2, LTC: 2, AVAX: 2, GAIA: 2, DOGE: 2, THOR: 2,
    };
    const decimalPoints = decimals[assetPrefix] || 2;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimalPoints,
      maximumFractionDigits: decimalPoints,
    }).format(number);
  }

  function sortAssets(assets, sortBy) {
    return assets.sort((a, b) => {
      switch (sortBy) {
        case 'depth':
          return b.depth - a.depth;
        case 'supply':
          return b.supply - a.supply;
        default:
          return 0;
      }
    });
  }

  $: sortedAssets = sortAssets($assets, $selectedSortOption);
</script>

<div class="container">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
    <h2>THORChain Secured Assets</h2>
    <div class="header-buttons">
      <button class="icon-button" on:click={() => showSettings.update(n => !n)}>
        <SettingsIcon />
      </button>
      <button class="icon-button" on:click={refreshAssets}>
        <RefreshIcon />
      </button>
    </div>
  </div>

  {#if $showSettings}
    <div class="settings-panel">
      <div class="settings-grid">
        <div class="setting-item select-wrapper">
          <span>Sort by:</span>
          <select bind:value={$selectedSortOption}>
            <option value="depth">Depth</option>
            <option value="supply">Supply</option>
          </select>
        </div>
      </div>
    </div>
  {/if}

  {#if $assets.length > 0}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="asset-column">Asset</th>
            <th class="number-column">Supply</th>
            <th class="number-column">Depth</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedAssets as asset}
            <tr>
              <td class="asset-cell">{formatCryptoName(asset.asset)}</td>
              <td class="number-cell">{formatNumberCrypto(asset.supply / 1e8, asset.asset)}</td>
              <td class="number-cell">{formatNumberCrypto(asset.depth / 1e8, asset.asset)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="loading">Loading data...</div>
  {/if}
</div>

<style>
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo 2', sans-serif;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
    gap: 15px;
    position: relative;
  }

  .app-header img {
    width: 40px;
    height: 40px;
  }

  .app-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #f8f8f8;
  }

  .header-buttons {
    position: absolute;
    right: 0;
    display: flex;
    gap: 10px;
  }

  .icon-button {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .icon-button:hover {
    opacity: 1;
  }

  .icon-button :global(svg) {
    width: 20px;
    height: 20px;
  }

  .settings-panel {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #f8f8f8;
  }

  .select-wrapper select {
    background: #1a1a1a;
    border: 1px solid #3a3a3c;
    color: #f8f8f8;
    padding: 8px;
    border-radius: 6px;
    width: 100%;
    margin-top: 5px;
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow-x: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #2c2c2c;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #3a3a3c;
  }

  tr {
    border-bottom: 1px solid #3a3a3c;
  }

  tr:last-child {
    border-bottom: none;
  }

  .asset-cell {
    padding: 12px 16px;
    color: #4A90E2;
    font-weight: 500;
  }

  .number-cell {
    padding: 12px 16px;
    font-family: monospace;
    font-size: 14px;
    text-align: right;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .settings-grid {
      grid-template-columns: 1fr;
    }

    .app-header h2 {
      font-size: 20px;
    }

    th, td {
      padding: 10px;
      font-size: 14px;
    }

    .number-cell {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .settings-panel {
      padding: 15px;
    }

    .setting-item {
      font-size: 14px;
    }

    .select-wrapper select {
      font-size: 14px;
    }
  }
</style>
