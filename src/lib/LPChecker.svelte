<script>
  import { onMount } from 'svelte';
  import axios from 'axios';
  import LPDetail from './LPDetail.svelte';
  import { writable } from 'svelte/store';
  import { sleep } from './utils';

  let pools = [];
  let selectedPool = null;
  let liquidityProviders = [];
  let loading = false;
  let error = null;
  let showPendingValues = false;
  let showUnits = false;
  let showUSD = false;
  let toastMessage = '';
  let sortField = 'asset_deposit_value';
  let sortOrder = 'desc';
  let runePrice = 0;
  let assetPrices = {};
  let analyzingAll = false;
  let analyzingProgress = 0;
  let totalAnalysisTime = 0;

  const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'https://thornode.ninerealms.com';

  const route = writable({ view: 'list', params: {} });

  let initialLoadComplete = false;
  let urlPool = null;
  let urlAddress = null;

  function updateRoute() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    urlPool = urlParams.get('pool');
    urlAddress = urlParams.get('address');

    if (urlPool && urlAddress) {
      route.set({ view: 'detail', params: { pool: urlPool, address: urlAddress } });
    } else if (path === '/lp-checker' || path === '/lp') {
      route.set({ view: 'list', params: {} });
    } else {
      const match = path.match(/^\/lp\/(.+)/);
      if (match) {
        route.set({ view: 'detail', params: { address: match[1] } });
      } else {
        route.set({ view: 'list', params: {} });
      }
    }
  }

  async function handleRouteChange() {
    if ($route.view === 'detail') {
      if ($route.params.pool) {
        selectedPool = $route.params.pool;
      } else {
        await findPoolForLP($route.params.address);
      }
      if (selectedPool) {
        await viewLPDetails($route.params.address);
      }
    }
  }

  onMount(async () => {
    updateRoute();
    window.addEventListener('popstate', updateRoute);

    try {
      const [poolsResponse, networkResponse] = await Promise.all([
        axios.get(`${API_DOMAIN}/thorchain/pools`),
        axios.get(`${API_DOMAIN}/thorchain/network`)
      ]);

      pools = poolsResponse.data;
      runePrice = parseFloat(networkResponse.data.rune_price_in_tor) / 1e8;
      pools.forEach(pool => {
        assetPrices[pool.asset] = parseFloat(pool.asset_tor_price) / 1e8;
      });

      initialLoadComplete = true;
      await handleRouteChange();
    } catch (err) {
      error = 'Failed to fetch data';
      console.error(error, err);
    }

    return () => {
      window.removeEventListener('popstate', updateRoute);
    };
  });

  async function findPoolForLP(address) {
    if (!initialLoadComplete) {
      await new Promise(resolve => {
        const checkLoaded = () => {
          if (initialLoadComplete) {
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    for (let pool of pools) {
      try {
        const response = await axios.get(`${API_DOMAIN}/thorchain/pool/${pool.asset}/liquidity_provider/${address}`);
        if (response.data) {
          selectedPool = pool.asset;
          return;
        }
      } catch (err) {
        // LP not found in this pool, continue to next
      }
    }
    // If we get here, we didn't find the LP in any pool
    error = 'LP not found in any pool';
  }

  $: {
    if (liquidityProviders.length > 0) {
      liquidityProviders = liquidityProviders.map(lp => ({...lp}));
    }
  }

  async function fetchLiquidityProviders() {
    if (!selectedPool) return;
    loading = true;
    error = null;
    try {
      const response = await axios.get(`${API_DOMAIN}/thorchain/pool/${selectedPool}/liquidity_providers`);
      liquidityProviders = response.data.map(lp => {
        const type = lp.rune_address && lp.asset_address ? 'Sym' : lp.rune_address ? 'RUNE Asym' : 'Asset Asym';
        return {
          ...lp,
          type,
          units: parseFloat((parseFloat(lp.units) / 1e8).toFixed(8)),
          pending_rune: parseFloat((parseFloat(lp.pending_rune) / 1e8).toFixed(8)),
          pending_asset: parseFloat((parseFloat(lp.pending_asset) / 1e8).toFixed(8)),
          rune_deposit_value: parseFloat((parseFloat(lp.rune_deposit_value) / 1e8).toFixed(8)),
          asset_deposit_value: parseFloat((parseFloat(lp.asset_deposit_value) / 1e8).toFixed(8))
        };
      });
      sortLiquidityProviders(); // Call this after mapping the data
    } catch (err) {
      error = 'Failed to fetch liquidity providers';
      console.error(error, err);
    } finally {
      loading = false;
    }
  }

  function shortenAddress(address) {
    if (!address) return '-';
    if (address === "thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt") return "RUNEPool";
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      toastMessage = `Copied: ${text}`;
      setTimeout(() => toastMessage = '', 3000);
    });
  }

  function togglePendingValues() {
    showPendingValues = !showPendingValues;
  }

  function toggleUnits() {
    showUnits = !showUnits;
  }

  function toggleUSD() {
    showUSD = !showUSD;
    // Force update of liquidityProviders to trigger re-render
    liquidityProviders = [...liquidityProviders];
  }

  function sortLiquidityProviders(field) {
    if (field) {
      if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortOrder = 'desc'; // Change default to 'desc' when switching fields
      }
    }

    liquidityProviders = liquidityProviders.sort((a, b) => {
      let comparison = 0;
      if (a[sortField] > b[sortField]) comparison = 1;
      if (a[sortField] < b[sortField]) comparison = -1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  function getSortIcon(field) {
    if (sortField !== field) return '⇅';
    return sortOrder === 'asc' ? '↑' : '↓';
  }

  function formatValue(value, asset) {
    if (showUSD) {
      const price = asset === 'RUNE' ? runePrice : assetPrices[asset];
      const usdValue = value * price;
      return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toFixed(8);
  }

  async function viewLPDetails(address) {
    if (!selectedPool) {
      await findPoolForLP(address);
    }
    if (selectedPool) {
      route.set({ view: 'detail', params: { pool: selectedPool, address: address } });
    } else {
      error = 'Unable to find pool for this LP';
    }
  }

  function goBackToLPChecker() {
    window.history.pushState({}, '', '/lp-checker');
    route.set({ view: 'list', params: {} });
  }

  function viewRandomLP() {
    if (liquidityProviders.length > 0) {
      const randomIndex = Math.floor(Math.random() * liquidityProviders.length);
      const randomLP = liquidityProviders[randomIndex];
      const address = randomLP.rune_address || randomLP.asset_address;
      viewLPDetails(address);
    }
  }

  function getDiceSvg() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <circle cx="15.5" cy="8.5" r="1.5"></circle>
        <circle cx="15.5" cy="15.5" r="1.5"></circle>
        <circle cx="8.5" cy="15.5" r="1.5"></circle>
      </svg>
    `;
  }

  let showSettings = false;

  function toggleSettings() {
    showSettings = !showSettings;
  }

  function getSettingsSvg() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" />
      </svg>
    `;
  }

  async function analyzeAllLPs() {
    if (!selectedPool || analyzingAll) return;
    analyzingAll = true;
    analyzingProgress = 0;
    const totalLPs = liquidityProviders.length;
    totalAnalysisTime = totalLPs * 1; // 1 second per LP

    for (let i = 0; i < totalLPs; i++) {
      const lp = liquidityProviders[i];
      const address = lp.rune_address || lp.asset_address;
      try {
        const response = await axios.get(`${API_DOMAIN}/thorchain/pool/${selectedPool}/liquidity_provider/${address}`);
        const lpData = response.data;
        
        // Calculate PnL % (copied from LPDetail.svelte)
        const runeDeposit = parseFloat(lpData.rune_deposit_value) / 1e8;
        const runeRedeem = parseFloat(lpData.rune_redeem_value) / 1e8;
        const assetDeposit = parseFloat(lpData.asset_deposit_value) / 1e8;
        const assetRedeem = parseFloat(lpData.asset_redeem_value) / 1e8;
        const runeDepositUSD = runeDeposit * runePrice;
        const runeRedeemUSD = runeRedeem * runePrice;
        const assetDepositUSD = assetDeposit * assetPrices[selectedPool];
        const assetRedeemUSD = assetRedeem * assetPrices[selectedPool];
        const totalDepositUSD = runeDepositUSD + assetDepositUSD;
        const totalRedeemUSD = runeRedeemUSD + assetRedeemUSD;
        const profitUSD = totalRedeemUSD - totalDepositUSD;
        const profitPercentage = (profitUSD / totalDepositUSD) * 100;

        // Update the LP data with the PnL %
        liquidityProviders[i] = {
          ...lp,
          pnlPercentage: profitPercentage
        };
      } catch (err) {
        console.error(`Error analyzing LP ${address}:`, err);
      }

      analyzingProgress = ((i + 1) / totalLPs) * 100;
      await sleep(1000); // Sleep for 1 second
    }

    analyzingAll = false;
    liquidityProviders = [...liquidityProviders]; // Trigger reactivity
  }

  function formatPnL(pnl) {
    if (pnl === undefined) return 'N/A';
    return `${pnl.toFixed(2)}%`;
  }

  function getShortPoolName(fullName) {
    if (fullName === 'BTC.BTC') return 'BTC';
    if (fullName === 'GAIA.ATOM') return 'ATOM';
    
    const parts = fullName.split('-');
    if (parts.length > 1) {
      const [chain, asset] = parts[0].split('.');
      return `${asset} (${chain})`;
    }
    
    return fullName.split('.')[1] || fullName;
  }

  $: {
    if (initialLoadComplete) {
      handleRouteChange();
    }
  }
</script>

{#if $route.view === 'detail'}
  {#if selectedPool}
    <LPDetail 
      address={$route.params.address} 
      pool={selectedPool} 
      goBack={() => route.set({ view: 'list', params: {} })}
      runePrice={runePrice}
      assetPrices={assetPrices}
      viewRandomLP={viewRandomLP}
    />
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <p>Loading LP details...</p>
  {/if}
{:else}
  <div class="lp-checker">
    <h2>LP Checker</h2>

    <div class="controls">
      <div class="left-content">
        <select bind:value={selectedPool} on:change={fetchLiquidityProviders}>
          <option value={null}>Select a pool</option>
          {#each pools as pool}
            <option value={pool.asset}>{getShortPoolName(pool.asset)}</option>
          {/each}
        </select>
      </div>
      <div class="right-content">
        <button on:click={toggleSettings} class="icon-button no-border" title="Settings">
          {@html getSettingsSvg()}
        </button>
        {#if selectedPool}
          <button on:click={viewRandomLP} class="icon-button no-border" title="View Random LP">
            {@html getDiceSvg()}
          </button>
        {/if}
      </div>
    </div>

    {#if showSettings}
      <div class="settings-menu">
        <button on:click={togglePendingValues}>
          {showPendingValues ? 'Hide' : 'Show'} Pending Values
        </button>
        <button on:click={toggleUnits}>
          {showUnits ? 'Hide' : 'Show'} Units
        </button>
        <button on:click={toggleUSD}>
          {showUSD ? 'Show in RUNE/ASSET' : 'Show in USD'}
        </button>
        {#if selectedPool}
          <button on:click={analyzeAllLPs}>
            Analyze All LPs
          </button>
        {/if}
      </div>
    {/if}

    {#if analyzingAll}
      <div class="analysis-progress">
        <p>Please wait ({Math.ceil(totalAnalysisTime - (analyzingProgress / 100 * totalAnalysisTime))} sec remaining)</p>
        <progress value={analyzingProgress} max="100"></progress>
      </div>
    {/if}

    {#if loading}
      <p>Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if liquidityProviders.length > 0}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Rune Address</th>
              <th class="sortable" on:click={() => sortLiquidityProviders('last_add_height')}>
                Last Add {getSortIcon('last_add_height')}
              </th>
              {#if showUnits}
                <th class="sortable" on:click={() => sortLiquidityProviders('units')}>
                  Units {getSortIcon('units')}
                </th>
              {/if}
              {#if showPendingValues}
                <th>Pending Rune</th>
                <th>Pending Asset</th>
              {/if}
              <th class="sortable" on:click={() => sortLiquidityProviders('rune_deposit_value')}>
                Rune Value {getSortIcon('rune_deposit_value')}
              </th>
              <th class="sortable" on:click={() => sortLiquidityProviders('asset_deposit_value')}>
                {getShortPoolName(selectedPool)} Value {getSortIcon('asset_deposit_value')}
              </th>
              {#if liquidityProviders.some(lp => lp.pnlPercentage !== undefined)}
                <th class="sortable" on:click={() => sortLiquidityProviders('pnlPercentage')}>
                  PnL % {getSortIcon('pnlPercentage')}
                </th>
              {/if}
              <th>Type</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {#each liquidityProviders as lp}
              <tr>
                <td class="clickable" on:click={() => copyToClipboard(lp.rune_address)}>{shortenAddress(lp.rune_address)}</td>
                <td>{lp.last_add_height}</td>
                {#if showUnits}
                  <td>{formatValue(lp.units, 'RUNE')}</td>
                {/if}
                {#if showPendingValues}
                  <td>{formatValue(lp.pending_rune, 'RUNE')}</td>
                  <td>{formatValue(lp.pending_asset, lp.asset)}</td>
                {/if}
                <td>{formatValue(lp.rune_deposit_value, 'RUNE')}</td>
                <td>{formatValue(lp.asset_deposit_value, lp.asset)}</td>
                {#if liquidityProviders.some(lp => lp.pnlPercentage !== undefined)}
                  <td>{formatPnL(lp.pnlPercentage)}</td>
                {/if}
                <td>{lp.type}</td>
                <td>
                  <button on:click={() => viewLPDetails(lp.rune_address || lp.asset_address)} class="eye-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if selectedPool}
      <p>No liquidity providers found for this pool.</p>
    {/if}
  </div>
{/if}

{#if toastMessage}
  <div class="toast">{toastMessage}</div>
{/if}

<style>
  .lp-checker {
    margin: 20px auto;
    max-width: 1200px;
    color: var(--text-color);
    padding: 0 15px;
  }

  h2 {
    color: var(--text-color);
    margin-bottom: 20px;
    font-size: 1.5rem;
  }

  select, button {
    margin-bottom: 10px;
    background-color: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--text-muted);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    width: 100%;
  }

  button {
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  button:hover {
    background-color: var(--primary-color);
    color: white;
  }

  .table-container {
    overflow-x: auto;
    background-color: var(--surface-color);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12px;
  }

  th, td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--text-muted);
  }

  th {
    background-color: var(--surface-color);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--primary-color);
  }

  tr:last-child td {
    border-bottom: none;
  }

  .clickable {
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .clickable:hover {
    background-color: var(--hover-color);
  }

  .error {
    color: var(--primary-color);
    font-weight: bold;
  }

  .toast {
    position: fixed;
    bottom: 60px;
    right: 20px;
    background-color: var(--surface-color);
    color: var(--text-color);
    padding: 10px 20px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    background-color: var(--hover-color);
  }

  .eye-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: var(--text-color);
    transition: color 0.3s ease;
  }

  .eye-button:hover {
    color: var(--primary-color);
  }

  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-left: 15px;
    color: var(--text-color);
    transition: color 0.3s ease;
  }

  .icon-button:hover {
    color: var(--primary-color);
  }

  .icon-button svg {
    margin-right: 8px;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .left-content {
    flex-grow: 1;
    margin-right: 10px;
  }

  .right-content {
    display: flex;
    gap: 10px;
  }

  .settings-menu {
    margin-bottom: 20px;
    padding: 10px;
    background-color: var(--surface-color);
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .settings-menu button {
    display: block;
    width: 100%;
    text-align: left;
    margin-bottom: 10px;
  }

  .settings-menu button:last-child {
    margin-bottom: 0;
  }

  .icon-button.no-border {
    border: none;
    background: none;
    padding: 0;
    width: auto;
  }

  .icon-button.no-border:hover {
    background: none;
    color: var(--primary-color);
  }

  .analysis-progress {
    margin-bottom: 20px;
  }

  progress {
    width: 100%;
  }

  @media (max-width: 768px) {
    .lp-checker {
      padding: 0 10px;
    }

    h2 {
      font-size: 1.2rem;
    }

    table {
      font-size: 10px;
    }

    th, td {
      padding: 6px;
    }

    .controls {
      flex-direction: column;
    }

    .left-content, .right-content {
      width: 100%;
    }

    .icon-button {
      margin-left: 10px;
    }

    .settings-menu {
      padding: 5px;
    }

    .settings-menu button {
      font-size: 12px;
      padding: 6px 10px;
    }
  }
</style>
