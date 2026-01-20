<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { getRunePrice } from '$lib/utils/network';
  import { getAllPools } from '$lib/utils/liquidity';
  import { fromBaseUnit } from '$lib/utils/blockchain';

  const pools = writable([]);
  const loading = writable(true);
  const error = writable(null);
  const runePrice = writable(0);
  let showUSD = true; // Default to USD display
  
  // Treasury addresses from the documentation
  const TREASURY_ADDRESSES = [
    'thor1egxvam70a86jafa8gcg3kqfmfax3s0m2g3m754', // Treasury 1
    'thor1wfe7hsuvup27lx04p5al4zlcnx6elsnyft7dzm', // Treasury 2
    'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt', // Reserve
    'thor10qh5272ktq4wes8ex343ky9rsuehcypddjh08k'  // Treasury Vultisig
  ];

  let sortBy = 'poolTotalLiquidityUSD';
  let sortDirection = 'desc';

  async function fetchRUNEPrice() {
    try {
      // Use shared utility with caching and fallback support
      return await getRunePrice();
    } catch (error) {
      console.error('Failed to fetch RUNE price:', error);
      return 0;
    }
  }

  async function fetchMemberPositions(address) {
    try {
      const response = await fetch(`https://midgard.ninerealms.com/v2/member/${address}`);
      if (!response.ok) return { pools: [] };
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Failed to fetch member positions for ${address}:`, error);
      return { pools: [] };
    }
  }

  async function fetchPoolsData() {
    try {
      // Use shared utility with caching and fallback support
      const data = await getAllPools();
      return data.filter(pool => pool.status === 'Available');
    } catch (error) {
      console.error('Failed to fetch pools data:', error);
      return [];
    }
  }

  async function calculatePOLData() {
    try {
      loading.set(true);
      error.set(null);

      // Fetch RUNE price
      const price = await fetchRUNEPrice();
      runePrice.set(price);

      // Fetch all treasury positions
      const treasuryPositions = await Promise.all(
        TREASURY_ADDRESSES.map(addr => fetchMemberPositions(addr))
      );

      // Fetch pools data
      const poolsData = await fetchPoolsData();

      // Combine treasury positions by pool
      const combinedPositions = {};
      treasuryPositions.forEach(memberData => {
        if (memberData.pools) {
          memberData.pools.forEach(position => {
            const poolAsset = position.pool;
            if (!combinedPositions[poolAsset]) {
              combinedPositions[poolAsset] = {
                liquidityUnits: 0,
                runeAdded: 0,
                assetAdded: 0
              };
            }
            combinedPositions[poolAsset].liquidityUnits += Number(position.liquidityUnits);
            combinedPositions[poolAsset].runeAdded += Number(position.runeAdded);
            combinedPositions[poolAsset].assetAdded += Number(position.assetAdded);
          });
        }
      });

      // Calculate POL data for each pool
      const polData = poolsData.map(pool => {
        const poolUnits = Number(pool.LP_units) + Number(pool.synth_units);
        const synthUnits = Number(pool.synth_units);
        const balanceRune = Number(pool.balance_rune);
        const balanceAsset = Number(pool.balance_asset);
        
        // Treasury positions for this pool
        const treasuryPosition = combinedPositions[pool.asset] || { liquidityUnits: 0, runeAdded: 0, assetAdded: 0 };
        
        // Total POL ownership = Treasury LP units + Protocol synth units
        const totalPOLUnits = treasuryPosition.liquidityUnits + synthUnits;
        
        // Calculate ownership percentages
        const polOwnershipPercent = poolUnits > 0 ? (totalPOLUnits / poolUnits) * 100 : 0;
        const synthOwnershipPercent = poolUnits > 0 ? (synthUnits / poolUnits) * 100 : 0;
        const treasuryOwnershipPercent = poolUnits > 0 ? (treasuryPosition.liquidityUnits / poolUnits) * 100 : 0;
        
        // Calculate pool values in RUNE and USD
        const poolTotalLiquidityRune = fromBaseUnit(balanceRune) * 2;
        const poolTotalLiquidityUSD = poolTotalLiquidityRune * price;
        
        // Calculate POL value
        const polValueRune = (poolTotalLiquidityRune * polOwnershipPercent) / 100;
        const polValueUSD = polValueRune * price;

        return {
          asset: pool.asset,
          poolUnits,
          synthUnits,
          treasuryLiquidityUnits: treasuryPosition.liquidityUnits,
          totalPOLUnits,
          polOwnershipPercent,
          synthOwnershipPercent,
          treasuryOwnershipPercent,
          poolTotalLiquidityRune,
          poolTotalLiquidityUSD,
          polValueRune,
          polValueUSD,
          balanceRune,
          balanceAsset,
          assetPrice: fromBaseUnit(pool.asset_tor_price)
        };
      });

      pools.set(polData.sort((a, b) => b[sortBy] - a[sortBy]));
    } catch (err) {
      console.error('Error calculating POL data:', err);
      error.set('Failed to load POL data. Please try again.');
    } finally {
      loading.set(false);
    }
  }

  function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(value);
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatAssetName(asset) {
    const parts = asset.split('.');
    if (parts.length >= 2) {
      const chain = parts[0];
      let symbol = parts[1];
      
      // Handle contract addresses - extract just the token symbol
      if (symbol.includes('-0X')) {
        symbol = symbol.split('-')[0];
      }
      
      // Show chain for native assets that appear on multiple chains
      if (['ETH', 'BNB', 'AVAX'].includes(symbol)) {
        return `${symbol} (${chain})`;
      }
      
      return symbol;
    }
    return asset;
  }

  function sortTable(column) {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'desc';
    }
    
    pools.update(poolsData => {
      return [...poolsData].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        if (column === 'asset') {
          aVal = formatAssetName(aVal);
          bVal = formatAssetName(bVal);
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        const result = aVal - bVal;
        return sortDirection === 'asc' ? result : -result;
      });
    });
  }

  onMount(() => {
    calculatePOLData();
    // Refresh every 5 minutes
    const interval = setInterval(calculatePOLData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  });

  $: totalPOLValueUSD = $pools.reduce((sum, pool) => sum + pool.polValueUSD, 0);
  $: totalPoolLiquidityRune = $pools.reduce((sum, pool) => sum + pool.poolTotalLiquidityRune, 0);
  $: totalPoolValueUSD = totalPoolLiquidityRune * $runePrice;
  $: totalPOLOwnership = totalPoolValueUSD > 0 ? (totalPOLValueUSD / totalPoolValueUSD) * 100 : 0;
</script>

<main>
  <div class="container">
    <div class="app-header">
      <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
      <h2>Protocol Owned Liquidity (POL)</h2>
      <div class="header-controls">
        <label class="toggle">
          <input 
            type="checkbox" 
            bind:checked={showUSD}
          >
          <span class="slider">
            <span class="knob">
              <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="knob-icon rune" />
              <span class="knob-icon dollar">$</span>
            </span>
          </span>
        </label>
        <div class="info-icon" on:click={() => alert('Track THORChain protocol-owned liquidity positions across all pools, including treasury holdings and synthetic asset positions.')}>ⓘ</div>
      </div>
    </div>

    {#if $loading}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading POL data...</p>
      </div>
    {:else if $error}
      <div class="error">
        <p>{$error}</p>
        <button class="refresh-button" on:click={calculatePOLData}>Try Again</button>
      </div>
    {:else}
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-title">Total POL Value</div>
          <div class="card-value">
            {#if showUSD}
              {formatCurrency(totalPOLValueUSD)}
            {:else}
              <span class="rune-amount">
                {formatNumber(totalPOLValueUSD / $runePrice, 0)}
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
              </span>
            {/if}
          </div>
          <div class="card-subtitle">
            {#if showUSD}
              {formatNumber(totalPOLValueUSD / $runePrice)} RUNE
            {:else}
              {formatCurrency(totalPOLValueUSD)}
            {/if}
          </div>
        </div>
        <div class="summary-card">
          <div class="card-title">Total Pool Liquidity</div>
          <div class="card-value">
            {#if showUSD}
              {formatCurrency(totalPoolValueUSD)}
            {:else}
              <span class="rune-amount">
                {formatNumber(totalPoolLiquidityRune, 0)}
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
              </span>
            {/if}
          </div>
          <div class="card-subtitle">
            {#if showUSD}
              {formatNumber(totalPoolLiquidityRune)} RUNE
            {:else}
              {formatCurrency(totalPoolValueUSD)}
            {/if}
          </div>
        </div>
        <div class="summary-card">
          <div class="card-title">Total POL Ownership</div>
          <div class="card-value">{formatNumber(totalPOLOwnership, 1)}%</div>
          <div class="card-subtitle">Of all pool liquidity</div>
        </div>
      </div>

      <!-- POL Table -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th on:click={() => sortTable('asset')} class="sortable">
                Asset {sortBy === 'asset' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th on:click={() => sortTable('poolTotalLiquidityUSD')} class="sortable">
                Pool Liquidity ({showUSD ? 'USD' : 'RUNE'}) {sortBy === 'poolTotalLiquidityUSD' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th on:click={() => sortTable('polOwnershipPercent')} class="sortable">
                Total POL % {sortBy === 'polOwnershipPercent' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th on:click={() => sortTable('treasuryOwnershipPercent')} class="sortable">
                Treasury % {sortBy === 'treasuryOwnershipPercent' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th on:click={() => sortTable('synthOwnershipPercent')} class="sortable">
                Synth % {sortBy === 'synthOwnershipPercent' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th on:click={() => sortTable('polValueUSD')} class="sortable">
                POL Value ({showUSD ? 'USD' : 'RUNE'}) {sortBy === 'polValueUSD' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each $pools as pool}
              <tr>
                <td class="asset-cell">
                  <div class="asset-info">
                    <img 
                      src="assets/chains/{pool.asset.split('.')[0]}.svg" 
                      alt={pool.asset.split('.')[0]} 
                      class="chain-icon"
                      on:error={(e) => e.target.style.display = 'none'}
                    />
                    {formatAssetName(pool.asset)}
                  </div>
                </td>
                <td class="number-cell">
                  {#if showUSD}
                    {formatCurrency(pool.poolTotalLiquidityUSD)}
                  {:else}
                    <span class="rune-amount">
                      {formatNumber(pool.poolTotalLiquidityRune, 0)}
                      <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon-small" />
                    </span>
                  {/if}
                </td>
                <td class="percentage-cell" class:high-pol={pool.polOwnershipPercent > 50}>
                  {formatNumber(pool.polOwnershipPercent, 1)}%
                </td>
                <td class="percentage-cell">
                  {formatNumber(pool.treasuryOwnershipPercent, 1)}%
                </td>
                <td class="percentage-cell">
                  {formatNumber(pool.synthOwnershipPercent, 1)}%
                </td>
                <td class="number-cell">
                  {#if showUSD}
                    {formatCurrency(pool.polValueUSD)}
                  {:else}
                    <span class="rune-amount">
                      {formatNumber(pool.polValueRune, 0)}
                      <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon-small" />
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="refresh-container">
        <button class="refresh-button" on:click={calculatePOLData}>
          🔄 Refresh Data
        </button>
        <p class="last-updated">Data refreshes automatically every 5 minutes</p>
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    color: #FFFFFF;
    background-color: #1a1a1a;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .app-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 30px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }

  .header-controls {
    position: absolute;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 1;
  }

  .app-header::before {
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
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .app-header img {
    width: 40px;
    height: 40px;
    position: relative;
    z-index: 1;
  }

  .app-header h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #FFFFFF;
    background: transparent;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    z-index: 1;
  }

  .info-icon {
    color: #FFFFFF;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .info-icon:hover {
    opacity: 1;
  }

  .toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .toggle input {
    display: none;
  }

  .slider {
    position: relative;
    width: 64px;
    height: 32px;
    background-color: rgba(26, 26, 26, 0.8);
    border-radius: 16px;
    transition: 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .knob {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    width: 26px;
    left: 3px;
    bottom: 2px;
    background-color: #4A90E2;
    border-radius: 50%;
    transition: 0.3s;
  }

  .knob-icon {
    position: absolute;
    transition: 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .knob-icon.rune {
    width: 16px;
    height: 16px;
    opacity: 1;
  }

  .knob-icon.dollar {
    color: white;
    font-size: 16px;
    font-weight: 600;
    opacity: 0;
  }

  input:checked + .slider .knob {
    transform: translateX(32px);
  }

  input:checked + .slider .knob-icon.rune {
    opacity: 0;
  }

  input:checked + .slider .knob-icon.dollar {
    opacity: 1;
  }

  .toggle:hover .slider {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
  }

  .rune-amount {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .rune-icon {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }

  .rune-icon-small {
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }

  .loading {
    text-align: center;
    padding: 60px 20px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #4A90E2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading p {
    color: #a0a0a0;
    font-size: 16px;
    margin: 0;
  }

  .error {
    text-align: center;
    padding: 40px 20px;
    color: #dc3545;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .summary-card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .summary-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
  }

  .card-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a0a0a0;
    margin-bottom: 8px;
  }

  .card-value {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .card-subtitle {
    font-size: 12px;
    font-weight: 500;
    color: #c0c0c0;
  }

  .table-wrapper {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 30px;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  th {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 20px 16px;
    text-align: left;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border: none;
    position: relative;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
  }

  th.sortable:hover {
    background: linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%);
  }

  tbody tr {
    background: #2c2c2c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  tbody tr:nth-child(even) {
    background: #252525;
  }

  tbody tr:hover {
    background: #3a3a3a !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  td {
    padding: 16px;
    color: #ffffff;
    font-weight: 500;
    border: none;
  }

  .asset-cell {
    font-weight: 600;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chain-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .number-cell {
    text-align: right;
    font-weight: 600;
  }

  .percentage-cell {
    text-align: center;
    font-weight: 600;
  }

  .percentage-cell.high-pol {
    color: #31FD9D;
    font-weight: 700;
  }

  .refresh-container {
    text-align: center;
    margin-top: 30px;
  }

  .refresh-button {
    background: linear-gradient(145deg, #4A90E2 0%, #357abd 100%);
    border: none;
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 16px rgba(74, 144, 226, 0.3);
    margin-bottom: 10px;
  }

  .refresh-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(74, 144, 226, 0.4);
  }

  .last-updated {
    color: #a0a0a0;
    font-size: 12px;
    margin: 0;
  }

  @media (max-width: 768px) {
    .container {
      padding: 16px;
    }

    .app-header {
      padding: 16px;
      flex-direction: column;
      text-align: center;
    }

    .app-header h2 {
      font-size: 22px;
    }

    .summary-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .summary-card {
      padding: 16px;
    }

    .card-value {
      font-size: 20px;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    th, td {
      padding: 12px 8px;
      font-size: 14px;
    }

    .chain-icon {
      width: 16px;
      height: 16px;
    }
  }

  @media (max-width: 480px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .app-header h2 {
      font-size: 20px;
    }

    th, td {
      padding: 8px 6px;
      font-size: 12px;
    }
  }
</style>