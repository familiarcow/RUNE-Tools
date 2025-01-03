<script>
  import { onMount } from "svelte";

  export let asset = "";
  export let address = "";

  let saverData = null;
  let error = null;
  let isViewingPosition = false;
  let availableAssets = [];
  let showWithdraw = false;
  let withdrawPercentage = 100;  // Changed from 1 to 100
  let withdrawQuote = null;

  onMount(async () => {
    await fetchAvailableAssets();
    updateAddressesFromURL();
  });

  async function fetchAvailableAssets() {
    try {
      const response = await fetch("https://thornode.ninerealms.com/thorchain/pools");
      if (!response.ok) {
        throw new Error('Failed to fetch pool data');
      }
      const pools = await response.json();
      availableAssets = pools
        .filter(pool => parseInt(pool.savers_depth) > 0)
        .map(pool => ({
          fullName: pool.asset,
          displayName: pool.asset.split('-')[0]  // This will get 'AVAX.USDC' from 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E'
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (err) {
      console.error("Error fetching available assets:", err);
    }
  }

  function updateAddressesFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAsset = urlParams.get("asset");
    const urlAddress = urlParams.get("address");
    if (urlAsset && urlAddress) {
      asset = urlAsset;
      address = urlAddress;
      isViewingPosition = true;
      fetchSaverData();
    }
  }

  async function fetchSaverData() {
    try {
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/pool/${asset}/saver/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch saver data');
      }
      saverData = await response.json();
      isViewingPosition = true;
      updateURL();
    } catch (err) {
      error = err.message;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    fetchSaverData();
  }

  function updateURL() {
    const url = new URL(window.location);
    url.searchParams.set("asset", asset);
    url.searchParams.set("address", address);
    window.history.pushState({}, '', url);
  }

  function formatValue(value) {
    return (value / 1e8).toFixed(8);
  }

  function getAssetLogo(assetName) {
    const logoMap = {
      'AVAX.AVAX': 'avalanche-avax-logo.svg',
      'LTC.LTC': 'litecoin-ltc-logo.svg',
      'BTC.BTC': 'bitcoin-btc-logo.svg',
      'BCH.BCH': 'bitcoin-cash-bch-logo.svg',
      'ETH.ETH': 'ethereum-eth-logo.svg',
      'GAIA.ATOM': 'cosmos-atom-logo.svg',
      'DOGE.DOGE': 'dogecoin-doge-logo.svg',
      'BSC.BNB': 'binance-coin-bnb-logo.svg',
      'AVAX.USDC': 'usd-coin-usdc-logo.svg',
      'ETH.USDC': 'usd-coin-usdc-logo.svg',
      'ETH.USDT': 'tether-usdt-logo.svg',
    };
    
    const [chain, baseAsset] = assetName.split('.');
    const lookupKey = `${chain}.${baseAsset}`.toUpperCase();
    
    return `/assets/coins/${logoMap[lookupKey] || 'fallback-logo.svg'}`;
  }

  async function fetchWithdrawQuote() {
    try {
      const bps = Math.floor(withdrawPercentage * 100);
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/quote/saver/withdraw?asset=${asset}&address=${address}&withdraw_bps=${bps}`);
      if (!response.ok) {
        throw new Error('Failed to fetch withdraw quote');
      }
      withdrawQuote = await response.json();
    } catch (err) {
      error = err.message;
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Address copied to clipboard!");
    });
  }

  let showToast = false;
  let toastMessage = "";

  function showToastMessage(message) {
    toastMessage = message;
    showToast = true;
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  function isWithdrawAllowed(asset) {
    const disallowedAssets = ['ETH.USDT', 'ETH.USDC', 'AVAX.USDC'];
    return !disallowedAssets.includes(asset.split('-')[0]);
  }

  // Remove the reactive statement that was automatically fetching the quote
  // $: if (showWithdraw && withdrawPercentage) {
  //   fetchWithdrawQuote();
  // }
</script>

<div class="savers-position">
  <h2>Savers Position {address.slice(-5)}</h2>
  
  {#if !isViewingPosition}
    <form on:submit={handleSubmit}>
      <label>
        Asset:
        <select bind:value={asset} required>
          <option value="">Select an asset</option>
          {#each availableAssets as { fullName, displayName }}
            <option value={fullName}>
              <img src={getAssetLogo(displayName)} alt={displayName} class="asset-icon" />
              {displayName}
            </option>
          {/each}
        </select>
      </label>
      <label>
        Address:
        <input type="text" bind:value={address} required placeholder="e.g., thor1..." />
      </label>
      <button type="submit">Check Position</button>
    </form>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {:else if saverData}
    <div class="position-data">
      <div class="card deposit-value">
        <h3>Deposit Value</h3>
        <div class="main-value">
          {formatValue(saverData.asset_deposit_value)}
          <img src={getAssetLogo(asset.split('-')[0])} alt={asset.split('-')[0]} class="asset-icon" />
        </div>
      </div>
      <div class="card redeem-value">
        <h3>Redeem Value</h3>
        <div class="main-value">
          {formatValue(saverData.asset_redeem_value)}
          <img src={getAssetLogo(asset.split('-')[0])} alt={asset.split('-')[0]} class="asset-icon" />
        </div>
      </div>
      <div class="card growth">
        <h3>Growth</h3>
        <div class="main-value">
          {(parseFloat(saverData.growth_pct) * 100).toFixed(2)}%
        </div>
      </div>
    </div>
    {#if isWithdrawAllowed(asset)}
      <div class="withdraw-button-container">
        <button on:click={() => showWithdraw = !showWithdraw}>
          {showWithdraw ? 'Hide' : 'Show'} Withdraw Options
        </button>
      </div>
    {/if}
    {#if showWithdraw}
      <div class="withdraw-section">
        <h3>Withdraw</h3>
        {#if !withdrawQuote}
          <div class="slider-container">
            <input type="range" min="1" max="100" bind:value={withdrawPercentage}>
          </div>
          <p class="withdraw-text">Withdraw <span class="percentage">{withdrawPercentage}%</span> of your position</p>
          <button on:click={fetchWithdrawQuote} class="quote-button">Get Withdraw Quote</button>
        {:else}
          <div class="withdraw-info">
            <div class="info-item">
              <span class="label">Amount to Withdraw:</span>
              <span class="value">{(withdrawQuote.expected_amount_out / 1e8).toFixed(8)} {asset.split('-')[0]}</span>
            </div>
            <div class="info-item">
              <span class="label">Address:</span>
              <span class="value copyable" on:click={() => copyToClipboard(withdrawQuote.inbound_address)}>
                {withdrawQuote.inbound_address}
              </span>
            </div>
            <div class="info-item">
              <span class="label">Amount to send:</span>
              <span class="value">{(withdrawQuote.dust_amount / 1e8).toFixed(8)} {asset.split('-')[0]}</span>
            </div>
            <div class="instructions">
              <h4>Instructions</h4>
              <p>Send EXACTLY <strong>{(withdrawQuote.dust_amount / 1e8).toFixed(8)} {asset.split('-')[0]}</strong> to:</p>
              <p class="address">{withdrawQuote.inbound_address}</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

{#if showToast}
  <div class="toast">
    {toastMessage}
  </div>
{/if}

<style>
  .savers-position {
    background-color: #1a1a1a;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  h2 {
    text-align: center;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 20px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #e0e0e0;
  }

  input {
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #2c2c2c;
    color: #e0e0e0;
  }

  button {
    padding: 10px;
    background-color: #4A90E2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  button:hover {
    background-color: #3A7BC8;
  }

  .position-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .position-header .asset-logo {
    width: 40px;
    height: 40px;
  }

  .position-header h3 {
    font-size: 18px;
    color: #e0e0e0;
  }

  .position-data {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px; /* Add space below the position data */
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
  }

  h3 {
    font-size: 16px;
    color: #a9a9a9;
    margin-bottom: 10px;
    text-align: center;
  }

  .main-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  .asset-icon {
    width: 24px;
    height: 24px;
  }

  .error {
    color: #ff6b6b;
    text-align: center;
  }

  select {
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #2c2c2c;
    color: #e0e0e0;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e0e0e0' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }

  option {
    background-color: #2c2c2c;
    color: #e0e0e0;
    display: flex;
    align-items: center;
  }

  .asset-icon {
    width: 20px;
    height: 20px;
    margin-right: 5px;
    vertical-align: middle;
  }

  .withdraw-section {
    margin-top: 20px;
    padding: 20px;
    background-color: #2c2c2c;
    border-radius: 8px;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .slider-container {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  input[type="range"] {
    width: 100%;
    margin-right: 10px;
  }

  .withdraw-text {
    text-align: center;
    margin-bottom: 15px;
    color: #e0e0e0;
  }

  .percentage {
    font-size: 18px;
    font-weight: bold;
    color: #4A90E2;
  }

  .quote-button {
    background-color: #4A90E2;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    width: 100%;
    font-size: 16px;
  }

  .quote-button:hover {
    background-color: #3A7BC8;
  }

  .withdraw-info {
    margin-top: 20px;
    background-color: #3a3a3a;
    border-radius: 4px;
    padding: 15px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    margin-bottom: 15px;
  }

  .label {
    color: #a9a9a9;
    margin-bottom: 5px;
  }

  .value {
    color: #e0e0e0;
    font-weight: bold;
    word-break: break-all;
  }

  .copyable {
    cursor: pointer;
    text-decoration: underline;
    color: #4A90E2;
  }

  .instructions {
    margin-top: 20px;
    border: 2px solid #4A90E2;
    border-radius: 4px;
    padding: 15px;
    background-color: rgba(74, 144, 226, 0.1);
  }

  .instructions h4 {
    color: #4A90E2;
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 18px;
  }

  .instructions p {
    margin: 5px 0;
    color: #e0e0e0;
  }

  .instructions .address {
    background-color: #2c2c2c;
    padding: 10px;
    border-radius: 4px;
    word-break: break-all;
    font-family: monospace;
    font-size: 14px;
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4A90E2;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 1000;
  }

  .withdraw-section button {
    margin-top: 10px;
    width: 100%;
  }

  .withdraw-button-container {
    text-align: center;
    margin-top: 30px; /* Add space above the withdraw button */
  }

  .withdraw-button-container button {
    padding: 12px 24px; /* Make the button slightly larger */
    font-size: 16px; /* Increase font size for better visibility */
  }
</style>