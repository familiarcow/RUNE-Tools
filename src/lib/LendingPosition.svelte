<script>
  import { onMount } from "svelte";

  export let asset = "BTC.BTC";
  export let address = "";

  let lendingData = null;
  let error = null;
  let isViewingPosition = false;
  let availableAssets = [
    { fullName: 'BTC.BTC', displayName: 'BTC.BTC' },
    { fullName: 'ETH.ETH', displayName: 'ETH.ETH' }
  ];

  onMount(async () => {
    updateAddressesFromURL();
  });

  function updateAddressesFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAsset = urlParams.get("asset");
    const urlAddress = urlParams.get("address");
    if (urlAsset && urlAddress) {
      asset = urlAsset;
      address = urlAddress;
      isViewingPosition = true;
      fetchLendingData();
    }
  }

  async function fetchLendingData() {
    try {
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/pool/${asset}/borrower/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lending data. Double check your address. If you just closed your loan, your funds may be in the network outbound queue.');
      }
      lendingData = await response.json();
      isViewingPosition = true;
      updateURL();
    } catch (err) {
      error = err.message;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    fetchLendingData();
  }

  function updateURL() {
    const url = new URL(window.location);
    url.searchParams.set("asset", asset);
    url.searchParams.set("address", address);
    window.history.pushState({}, '', url);
  }

  function formatValue(value, decimals = 8) {
    return (value / 1e8).toFixed(decimals);
  }

  function getAssetLogo(assetName) {
    const logoMap = {
      'BTC.BTC': 'bitcoin-btc-logo.svg',
      'ETH.ETH': 'ethereum-eth-logo.svg',
    };
    
    return `/assets/coins/${logoMap[assetName] || 'fallback-logo.svg'}`;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToastMessage("Address copied to clipboard!");
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
</script>

<div class="lending-position">
  <div class="container">
    <h2>Lending Position {address ? address.slice(-5) : ''}</h2>
    
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
          {asset.split('.')[0]} Address:
          <input type="text" bind:value={address} required placeholder="Input your {asset.split('.')[0]} address" />
        </label>
        <button type="submit">Check Position</button>
      </form>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {:else if lendingData}
      <div class="position-data">
        <div class="card debt-value">
          <h3>Current Debt</h3>
          <div class="main-value">
            ${formatValue(lendingData.debt_current, 2)}
          </div>
          <div class="sub-info">
            <div>Issued: ${formatValue(lendingData.debt_issued, 2)}</div>
            <div>Repaid: ${formatValue(lendingData.debt_repaid, 2)}</div>
          </div>
        </div>
        <div class="card collateral-value">
          <h3>Current Collateral</h3>
          <div class="main-value">
            {formatValue(lendingData.collateral_current)}
            <img src={getAssetLogo(asset)} alt={asset} class="asset-icon" />
          </div>
          <div class="sub-info">
            <div>Deposited: {formatValue(lendingData.collateral_deposited)}</div>
            <div>Withdrawn: {formatValue(lendingData.collateral_withdrawn)}</div>
          </div>
        </div>
        <div class="card position-info">
          <h3>Position Info</h3>
          <div class="info-grid">
            <div>Last Open Height</div>
            <div>{lendingData.last_open_height}</div>
            <div>Last Replay Height</div>
            <div>{lendingData.last_replay_height}</div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showToast}
  <div class="toast">
    {toastMessage}
  </div>
{/if}

<style>
  .lending-position {
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding: 20px;
    position: relative;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    margin-bottom: 20px;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px;
    background-color: #2c2c2c;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background-color: #2c2c2c;
    border-radius: 12px;
    position: relative;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #e0e0e0;
  }

  input, select {
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #2c2c2c;
    color: #e0e0e0;
    width: 100%;
    box-sizing: border-box;
  }

  select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e0e0e0' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }

  button {
    padding: 12px;
    background-color: #4A90E2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    width: 100%;
    font-size: 16px;
  }

  button:hover {
    background-color: #3A7BC8;
  }

  .position-data {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.3s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  h3 {
    font-size: 16px;
    color: #a9a9a9;
    margin-bottom: 15px;
    text-align: center;
  }

  .main-value {
    font-size: 28px;
    font-weight: bold;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 15px;
  }

  .sub-info {
    color: #a9a9a9;
    font-size: 14px;
    text-align: center;
  }

  .sub-info div {
    margin: 5px 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: auto auto;
    gap: 10px;
    color: #e0e0e0;
  }

  .info-grid div:nth-child(even) {
    text-align: right;
    color: #4A90E2;
  }

  .asset-icon {
    width: 24px;
    height: 24px;
  }

  .error {
    color: #ff6b6b;
    text-align: center;
    margin: 20px 0;
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4A90E2;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 1000;
  }

  @media (max-width: 600px) {
    .lending-position {
      padding: 10px;
    }
    
    .container {
      padding: 10px;
    }
    
    .position-data {
      padding: 10px;
    }
  }
</style>
