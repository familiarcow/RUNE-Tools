<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  export let address = null;
  export let pool = null;
  export let goBack;
  export let runePrice;
  export let assetPrices;
  export let viewRandomLP;

  let lpData = null;
  let loading = true;
  let error = null;
  let toastMessage = '';
  let showLUVI = false;
  let showPending = false;

  const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'https://thornode.ninerealms.com';

  $: {
    if (pool && address) {
      loadLPData();
    }
  }

  async function loadLPData() {
    loading = true;
    error = null;
    try {
      const response = await axios.get(`${API_DOMAIN}/thorchain/pool/${pool}/liquidity_provider/${address}`);
      lpData = response.data;

      // Divide deposit and redeem values by 1e8
      ['rune_deposit_value', 'asset_deposit_value', 'rune_redeem_value', 'asset_redeem_value'].forEach(key => {
        if (lpData[key]) {
          lpData[key] = parseFloat(lpData[key]) / 1e8;
        }
      });
    } catch (err) {
      error = 'Failed to fetch LP details';
      console.error(error, err);
    } finally {
      loading = false;
    }
  }

  function formatValue(value, asset) {
    if (typeof value === 'number') {
      const price = asset === 'RUNE' ? runePrice : assetPrices[pool];
      const usdValue = value * price;
      return {
        native: value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
        usd: usdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      };
    }
    return { native: value, usd: 'N/A' };
  }

  function calculateNetChange(runeDeposit, runeRedeem, assetDeposit, assetRedeem) {
    const runeChange = runeRedeem - runeDeposit;
    const assetChange = assetRedeem - assetDeposit;
    const runeDepositUSD = runeDeposit * runePrice;
    const runeRedeemUSD = runeRedeem * runePrice;
    const assetDepositUSD = assetDeposit * assetPrices[pool];
    const assetRedeemUSD = assetRedeem * assetPrices[pool];
    const totalDepositUSD = runeDepositUSD + assetDepositUSD;
    const totalRedeemUSD = runeRedeemUSD + assetRedeemUSD;
    const profitUSD = totalRedeemUSD - totalDepositUSD;
    const profitPercentage = (profitUSD / totalDepositUSD) * 100;

    return {
      rune: runeChange,
      asset: assetChange,
      profitUSD,
      profitPercentage,
      isProfit: profitUSD >= 0
    };
  }

  function copyLink() {
    const baseUrl = 'https://rune.tools/lp';
    const url = `${baseUrl}?pool=${encodeURIComponent(pool)}&address=${encodeURIComponent(address)}`;
    navigator.clipboard.writeText(url).then(() => {
      toastMessage = `Copied: ${url}`;
      setTimeout(() => toastMessage = '', 3000);
    });
  }

  function toggleLUVI() {
    showLUVI = !showLUVI;
  }

  function togglePending() {
    showPending = !showPending;
  }

  function getRunescanUrl(blockHeight) {
    return `https://runescan.io/block/${blockHeight}`;
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

  function handleGoBack() {
    goBack();
  }

  // Add this function at the beginning of the script section
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
</script>

{#if pool && address}
  <div class="lp-detail">

    <h2>LP Details {pool ? `for ${getShortPoolName(pool)}` : ''}</h2>

    {#if !pool}
      <p>Loading pool information...</p>
    {:else if loading}
      <p>Loading LP details...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if lpData}
      {@const netChange = calculateNetChange(lpData.rune_deposit_value, lpData.rune_redeem_value, lpData.asset_deposit_value, lpData.asset_redeem_value)}
      <div class="net-change-container">
        <h3>Net Change</h3>
        <div class="net-change-grid">
          <div class="net-change-item">
            <h4>RUNE Change</h4>
            <p class="value {netChange.rune >= 0 ? 'positive' : 'negative'}">
              {netChange.rune.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </p>
            <p class="usd-value">
              {(netChange.rune * runePrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
          </div>
          <div class="net-change-item">
            <h4>{getShortPoolName(pool)} Change</h4>
            <p class="value {netChange.asset >= 0 ? 'positive' : 'negative'}">
              {netChange.asset.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </p>
            <p class="usd-value">
              {(netChange.asset * assetPrices[pool]).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
          </div>
          <div class="net-change-item">
            <h4>Total Profit/Loss</h4>
            <p class="value {netChange.isProfit ? 'positive' : 'negative'}">
              {netChange.profitUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p class="percent-change {netChange.isProfit ? 'positive' : 'negative'}">
              ({netChange.profitPercentage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
            </p>
          </div>
        </div>
      </div>

      <div class="comparison-container">
        <div class="comparison-section">
          <h3>RUNE</h3>
          <div class="value-grid">
            <div class="value-item">
              <h4>Deposit Amount</h4>
              <p class="valzue">{formatValue(lpData.rune_deposit_value, 'RUNE').native}</p>
              <p class="usd-value">{formatValue(lpData.rune_deposit_value, 'RUNE').usd}</p>
            </div>
            <div class="value-item">
              <h4>Current Amount</h4>
              <p class="value">{formatValue(lpData.rune_redeem_value, 'RUNE').native}</p>
              <p class="usd-value">{formatValue(lpData.rune_redeem_value, 'RUNE').usd}</p>
            </div>
          </div>
        </div>

        <div class="comparison-section">
          <h3>{getShortPoolName(pool)}</h3>
          <div class="value-grid">
            <div class="value-item">
              <h4>Deposit Amount</h4>
              <p class="value">{formatValue(lpData.asset_deposit_value, pool).native}</p>
              <p class="usd-value">{formatValue(lpData.asset_deposit_value, pool).usd}</p>
            </div>
            <div class="value-item">
              <h4>Current Amount</h4>
              <p class="value">{formatValue(lpData.asset_redeem_value, pool).native}</p>
              <p class="usd-value">{formatValue(lpData.asset_redeem_value, pool).usd}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="additional-info">
        <h3>Additional Information</h3>
        <table>
          <tbody>
            {#each Object.entries(lpData) as [key, value]}
              {#if !['rune_deposit_value', 'asset_deposit_value', 'rune_redeem_value', 'asset_redeem_value'].includes(key)}
                {#if !key.includes('luvi') || showLUVI}
                  {#if !key.includes('pending') || showPending}
                    <tr>
                      <td>
                        {#if key === 'rune_address'}
                          RUNE Address
                        {:else if key === 'asset_address'}
                          Asset Address
                        {:else if key === 'last_add_height'}
                          Last Add Block
                        {:else if key === 'last_withdraw_height'}
                          Last Withdraw Block
                        {:else if key === 'units'}
                          Liquidity Units
                        {:else if key === 'asset'}
                          Pool
                        {:else}
                          {key}
                        {/if}
                      </td>
                      <td>
                        {#if key === 'last_add_height' || key === 'last_withdraw_height'}
                          <a href={getRunescanUrl(value)} target="_blank" rel="noopener noreferrer">{value}</a>
                        {:else}
                          {value}
                        {/if}
                      </td>
                    </tr>
                  {/if}
                {/if}
              {/if}
            {/each}
          </tbody>
        </table>
      </div>

      <div class="settings">
        <button on:click={toggleLUVI}>
          {showLUVI ? 'Hide' : 'Show'} LUVI Values
        </button>
        <button on:click={togglePending}>
          {showPending ? 'Hide' : 'Show'} Pending Values
        </button>
      </div>

      <button on:click={copyLink} class="copy-link-button">Copy LP URL</button>
    {:else}
      <p>No data available for this LP.</p>
    {/if}
  </div>

  {#if toastMessage}
    <div class="toast">{toastMessage}</div>
  {/if}
{:else}
  <p>Please select a pool and enter an address to view LP details.</p>
{/if}

<style>
  .lp-detail {
    margin: 20px auto;
    max-width: 900px;
    color: var(--text-color);
    font-family: Arial, sans-serif;
  }

  h2, h3, h4 {
    color: var(--text-color);
    margin-bottom: 15px;
  }

  .net-change-container {
    background-color: var(--surface-color);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .net-change-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .net-change-item {
    text-align: center;
  }

  .net-change-item h4 {
    margin-bottom: 10px;
  }

  .comparison-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
  }

  .comparison-section {
    background-color: var(--surface-color);
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .value-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .value-item {
    text-align: center;
    overflow: hidden;
  }

  .value {
    font-size: 1.1em;
    font-weight: bold;
    margin-bottom: 5px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .usd-value {
    font-size: 0.9em;
    color: var(--text-muted);
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .percent-change {
    font-size: 0.9em;
    font-weight: bold;
  }

  .positive {
    color: #4caf50;
  }

  .negative {
    color: #f44336;
  }

  .additional-info {
    background-color: var(--surface-color);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--text-muted);
  }

  tr:last-child td {
    border-bottom: none;
  }

  .error {
    color: #f44336;
    font-weight: bold;
  }

  .back-button, .copy-link-button, .settings button {
    background-color: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--text-muted);
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    margin-right: 10px;
    margin-bottom: 15px;
  }

  .back-button:hover, .copy-link-button:hover, .settings button:hover {
    background-color: var(--primary-color);
    color: white;
  }

  .settings {
    margin-bottom: 20px;
  }

  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: var(--surface-color);
    color: var(--text-color);
    padding: 10px 20px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }

  @media (min-width: 768px) {
    .comparison-container {
      flex-direction: row;
    }

    .comparison-section {
      width: 48%;
    }

    .value-grid {
      gap: 15px;
    }

    .value {
      font-size: 1.1em;
    }

    .usd-value {
      font-size: 0.9em;
    }
  }

  .additional-info a {
    color: var(--primary-color);
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .additional-info a:hover {
    text-decoration: underline;
    color: var(--text-color);
  }

  .button-container {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .icon-button {
    display: flex;
    align-items: center;
    background-color: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--text-muted);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .icon-button:hover {
    background-color: var(--primary-color);
    color: white;
  }

  .icon-button svg {
    margin-right: 8px;
  }
</style>