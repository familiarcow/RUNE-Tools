<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import SettingsIcon from '../../public/assets/Settings.svelte';
  import RefreshIcon from '../../public/assets/Refresh.svelte';
  import { getAllPools } from '$lib/utils/liquidity';
  import { getAsgardVaults } from '$lib/utils/network';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import { fetchJSONWithFallback } from '$lib/utils/api';

  const showInUSD = writable(false);
  const showVaultInfo = writable(false);
  const showSynthData = writable(false);
  const showSettings = writable(false);
  const showSynthConversion = writable(true);
  const selectedSortOption = writable('depth');
  const pools = writable([]);

  async function getVaultBalances() {
    try {
      // Use shared utility with caching and fallback support
      const vaults = await getAsgardVaults();
      const coinSums = {};

      vaults.forEach((vault) => {
        if (!vault.coins) {
          return;
        }
        vault.coins.forEach((coin) => {
          const asset = coin.asset;
          const amount = Number(coin.amount);
          if (coinSums[asset]) {
            coinSums[asset] += amount;
          } else {
            coinSums[asset] = amount;
          }
        });
      });

      return coinSums;
    } catch (error) {
      return {};
    }
  }

  async function getTradeAssets() {
    try {
      // Use shared utility with fallback support
      const data = await fetchJSONWithFallback('/thorchain/trade/units');
      return data.reduce((acc, item) => {
        const formattedAsset = item.asset.replace('~', '.');
        acc[formattedAsset] = Number(item.depth);
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to fetch trade assets:', error);
      return {};
    }
  }

  async function getPools() {
    const [tradeAssets, vaultBalances, data] = await Promise.all([
      getTradeAssets(),
      getVaultBalances(),
      getAllPools()
    ]);
    return data
      .filter(pool => pool.status === "Available")
      .map(pool => {
        const assetDepth = Number(tradeAssets[pool.asset] || '0');
        const vaultBalance = Number(vaultBalances[pool.asset] || '0');
        const usdPrice = fromBaseUnit(pool.asset_tor_price);
        const synthSupply = Number(pool.synth_supply) || 0;
        const saversDepth = Number(pool.savers_depth) || 0;
        const nonSaverSynths = synthSupply - saversDepth;
        const synthConversion = assetDepth + nonSaverSynths > 0 ? (assetDepth / (assetDepth + nonSaverSynths)) * 100 : 0;

        return {
          ...pool,
          trade_asset_depth: assetDepth,
          vault_balance: vaultBalance,
          usd_price: usdPrice,
          synth_supply: synthSupply,
          savers_depth: saversDepth,
          non_saver_synths: nonSaverSynths,
          synth_conversion: synthConversion
        };
      })
      .sort((a, b) => b.balance_rune - a.balance_rune);
  }

  onMount(async () => {
    pools.set(await getPools());
  });

  function refreshPools() {
    getPools().then(newPools => pools.set(newPools));
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
    const assetPrefix = toAsset.split(".")[0];
    const decimals = {
      BTC: 5, ETH: 3, BSC: 2, BCH: 2, LTC: 2, AVAX: 2, GAIA: 2, DOGE: 2, THOR: 2,
    };
    const decimalPoints = decimals[assetPrefix] || 2;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimalPoints,
      maximumFractionDigits: decimalPoints,
    }).format(number);
  }

  function formatNumberUSD(number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  }

  function calculateSums(pools, showInUSD) {
    return pools.reduce((acc, pool) => {
      const poolDepth = fromBaseUnit(pool.balance_asset);
      const tradeDepth = fromBaseUnit(pool.trade_asset_depth);
      const vaultBalance = fromBaseUnit(pool.vault_balance);
      const vaultSurplus = fromBaseUnit(pool.vault_balance - pool.balance_asset - pool.trade_asset_depth);
      const synthSupply = fromBaseUnit(pool.synth_supply);
      const saversDepth = fromBaseUnit(pool.savers_depth);
      const nonSaverSynths = fromBaseUnit(pool.non_saver_synths);
      const usdMultiplier = pool.usd_price;

      acc.poolDepth += showInUSD ? poolDepth * usdMultiplier : poolDepth;
      acc.tradeDepth += showInUSD ? tradeDepth * usdMultiplier : tradeDepth;
      acc.vaultBalance += showInUSD ? vaultBalance * usdMultiplier : vaultBalance;
      acc.vaultSurplus += showInUSD ? vaultSurplus * usdMultiplier : vaultSurplus;
      acc.synthSupply += showInUSD ? synthSupply * usdMultiplier : synthSupply;
      acc.saversDepth += showInUSD ? saversDepth * usdMultiplier : saversDepth;
      acc.nonSaverSynths += showInUSD ? nonSaverSynths * usdMultiplier : nonSaverSynths;

      return acc;
    }, { poolDepth: 0, tradeDepth: 0, vaultBalance: 0, vaultSurplus: 0, synthSupply: 0, saversDepth: 0, nonSaverSynths: 0 });
  }

  function sortPools(pools, sortBy) {
    return pools.sort((a, b) => {
      const aUsdPrice = a.usd_price || 1;
      const bUsdPrice = b.usd_price || 1;

      switch (sortBy) {
        case 'depth':
          return (b.balance_asset * bUsdPrice) - (a.balance_asset * aUsdPrice);
        case 'tradeDepth':
          return (b.trade_asset_depth * bUsdPrice) - (a.trade_asset_depth * aUsdPrice);
        case 'nonSaverSynths':
          return (b.non_saver_synths * bUsdPrice) - (a.non_saver_synths * aUsdPrice);
        case 'vaultSurplus':
          return ((b.vault_balance - b.balance_asset - b.trade_asset_depth) * bUsdPrice) - ((a.vault_balance - a.balance_asset - a.trade_asset_depth) * aUsdPrice);
        case 'synthConversion':
          return b.synth_conversion - a.synth_conversion;
        default:
          return 0;
      }
    });
  }

  $: sortedPools = sortPools($pools, $selectedSortOption);
</script>

<div class="container">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
    <h2>THORChain Trade Assets</h2>
    <div class="header-buttons">
      <button class="icon-button" on:click={() => showSettings.update(n => !n)}>
        <SettingsIcon />
      </button>
      <button class="icon-button" on:click={refreshPools}>
        <RefreshIcon />
      </button>
    </div>
  </div>

  {#if $showSettings}
    <div class="settings-panel">
      <div class="settings-grid">
        <label class="setting-item">
          <input type="checkbox" bind:checked={$showInUSD}>
          <span>Show values in USD</span>
        </label>
        <label class="setting-item">
          <input type="checkbox" bind:checked={$showVaultInfo}>
          <span>Show Vault Info</span>
        </label>
        <label class="setting-item">
          <input type="checkbox" bind:checked={$showSynthData}>
          <span>Show Synth Data</span>
        </label>
        <label class="setting-item">
          <input type="checkbox" bind:checked={$showSynthConversion}>
          <span>Show Synth Conversion %</span>
        </label>
        <div class="setting-item select-wrapper">
          <span>Sort by:</span>
          <select bind:value={$selectedSortOption}>
            <option value="depth">Pool Depth</option>
            <option value="tradeDepth">Trade Asset Depth</option>
            <option value="nonSaverSynths">Non-Saver Synths</option>
            <option value="vaultSurplus">Vault Surplus</option>
            <option value="synthConversion">Synth Conversion %</option>
          </select>
        </div>
      </div>
    </div>
  {/if}

  {#if $pools.length > 0}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="asset-column">Asset</th>
            <th class="number-column">Pool Depth</th>
            <th class="number-column">Trade Asset Depth</th>
            {#if $showVaultInfo}
              <th class="number-column">Vault Balance</th>
              <th class="number-column">Vault Surplus</th>
            {/if}
            {#if $showSynthData}
              <th class="number-column">Synth Supply</th>
              <th class="number-column">Non-Saver Synths</th>
            {/if}
            {#if $showSynthConversion}
              <th class="number-column">Synth Conversion %</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each sortedPools as pool}
            <tr>
              <td class="asset-cell">{formatCryptoName(pool.asset)}</td>
              <td class="number-cell">{$showInUSD ? formatNumberUSD((pool.balance_asset / 1e8) * pool.usd_price) : formatNumberCrypto(pool.balance_asset / 1e8, pool.asset)}</td>
              <td class="number-cell">{$showInUSD ? formatNumberUSD((pool.trade_asset_depth / 1e8) * pool.usd_price) : formatNumberCrypto(pool.trade_asset_depth / 1e8, pool.asset)}</td>
              {#if $showVaultInfo}
                <td class="number-cell">{$showInUSD ? formatNumberUSD((pool.vault_balance / 1e8) * pool.usd_price) : formatNumberCrypto(pool.vault_balance / 1e8, pool.asset)}</td>
                <td class="number-cell">{$showInUSD ? formatNumberUSD(((pool.vault_balance - pool.balance_asset - pool.trade_asset_depth) / 1e8) * pool.usd_price) : formatNumberCrypto((pool.vault_balance - pool.balance_asset - pool.trade_asset_depth) / 1e8, pool.asset)}</td>
              {/if}
              {#if $showSynthData}
                <td class="number-cell">{$showInUSD ? formatNumberUSD((pool.synth_supply / 1e8) * pool.usd_price) : formatNumberCrypto(pool.synth_supply / 1e8, pool.asset)}</td>
                <td class="number-cell">{$showInUSD ? formatNumberUSD((pool.non_saver_synths / 1e8) * pool.usd_price) : formatNumberCrypto(pool.non_saver_synths / 1e8, pool.asset)}</td>
              {/if}
              {#if $showSynthConversion}
                <td class="number-cell">{pool.synth_conversion.toFixed(2)}%</td>
              {/if}
            </tr>
          {/each}
          {#if $showInUSD}
            <tr class="total-row">
              <td class="asset-cell">Total</td>
              <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).poolDepth)}</td>
              <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).tradeDepth)}</td>
              {#if $showVaultInfo}
                <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).vaultBalance)}</td>
                <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).vaultSurplus)}</td>
              {/if}
              {#if $showSynthData}
                <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).synthSupply)}</td>
                <td class="number-cell">{formatNumberUSD(calculateSums($pools, $showInUSD).nonSaverSynths)}</td>
              {/if}
            </tr>
          {/if}
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

  .setting-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #4A90E2;
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

  .total-row {
    background-color: #1a1a1a;
    font-weight: 600;
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
  