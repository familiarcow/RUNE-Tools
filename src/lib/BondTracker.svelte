<script>
  import { onMount } from "svelte";

  let my_bond_address = "";
  let node_address = "";
  let showData = false;
  let my_bond = 0;
  let my_bond_ownership_percentage = 0;
  let current_award = 0;
  let my_award = 0;
  let APY = 0;
  let runePriceUSD = 0;
  let nextChurnTime = 0; // This will hold the timestamp of the next churn
  let countdown = ""; // This will hold the formatted countdown string
  let recentChurnTimestamp = 0;
  let nodeOperatorFee = 0;
  let bondvaluebtc = 0;
  let bondAddressSuffix = "";
  let isMobile = false;

  $: currentCurrency = 'USD';
  const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
  let exchangeRates = {};

  // Make these reactive
  $: formattedRunePrice = formatCurrencyWithDecimals(runePriceUSD, currentCurrency);
  $: formattedBondValue = formatCurrency((my_bond / 1e8) * runePriceUSD, currentCurrency);
  $: formattedNextAward = formatCurrency((my_award / 1e8) * runePriceUSD, currentCurrency);
  $: formattedAPY = formatCurrency(((APY * my_bond) / 1e8) * runePriceUSD, currentCurrency);
  $: nextAwardBtcValue = (my_award * bondvaluebtc) / my_bond;

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=thorchain&vs_currencies=usd,eur,gbp,jpy`);
      const data = await response.json();
      exchangeRates = {
        USD: data.thorchain.usd,
        EUR: data.thorchain.eur,
        GBP: data.thorchain.gbp,
        JPY: data.thorchain.jpy
      };
      runePriceUSD = exchangeRates.USD;
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
    }
  };

  const switchCurrency = () => {
    const currentIndex = currencies.indexOf(currentCurrency);
    currentCurrency = currencies[(currentIndex + 1) % currencies.length];
  };

  const formatCurrency = (value, currency) => {
    if (!exchangeRates[currency]) return '';
    const formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value * (exchangeRates[currency] / exchangeRates.USD));

    // Replace the currency symbol with the appropriate one
    const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    return formattedValue.replace(/^\D+/, currencySymbols[currency]);
  };

  const formatCurrencyWithDecimals = (value, currency) => {
    if (!exchangeRates[currency]) return '';
    const formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value * (exchangeRates[currency] / exchangeRates.USD));

    // Replace the currency symbol with the appropriate one
    const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    return formattedValue.replace(/^\D+/, currencySymbols[currency]);
  };

  const numFormat = (x) => Intl.NumberFormat().format(x); //formats large numbers with commas

  const updateAddressesFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBondAddress = urlParams.get("bond_address");
    const urlNodeAddress = urlParams.get("node_address");
    if (urlBondAddress && urlNodeAddress) {
      my_bond_address = urlBondAddress;
      node_address = urlNodeAddress;
      bondAddressSuffix = urlBondAddress.slice(-4);
      showData = true;
      fetchData();
    }
  };

  const fetchJSON = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
    return response.json();
  };

  const fetchText = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
    return response.text();
  };

  const fetchChurnInterval = async () => {
    try {
      const CHURNINTERVALText = await fetchText(
        "https://thornode.ninerealms.com/thorchain/mimir/key/CHURNINTERVAL"
      );
      const CHURNINTERVAL = Number(CHURNINTERVALText);
      const CHURNINTERVALSECONDS = CHURNINTERVAL * 6;
      nextChurnTime = recentChurnTimestamp + CHURNINTERVALSECONDS;
      updateCountdown();
    } catch (error) {
      console.error("Error fetching churn interval:", error);
    }
  };

  const updateCountdown = () => {
    const now = Date.now() / 1000;
    const secondsLeft = nextChurnTime - now;
    if (secondsLeft <= 0) {
      countdown = "Now!";
    } else {
      const days = Math.floor(secondsLeft / (3600 * 24));
      const hours = Math.floor((secondsLeft % (3600 * 24)) / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      countdown = `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m`;
    }
  };

  const fetchBtcPoolData = async () => {
    try {
      const btcPoolData = await fetchJSON("https://thornode.ninerealms.com/thorchain/pool/BTC.BTC");
      const balanceAsset = btcPoolData.balance_asset;
      const balanceRune = btcPoolData.balance_rune;
      const btcruneprice = balanceAsset / balanceRune;
      bondvaluebtc = (my_bond * btcruneprice) / 1e8;
    } catch (error) {
      console.error("Error fetching BTC pool data:", error);
    }
  };

  const fetchData = async () => {
    try {
      const nodeData = await fetchJSON(`https://thornode.ninerealms.com/thorchain/node/${node_address}`);
      const bondProviders = nodeData.bond_providers.providers;
      let total_bond = 0;
      for (const provider of bondProviders) {
        if (provider.bond_address === my_bond_address) my_bond = Number(provider.bond);
        total_bond += Number(provider.bond);
      }
      my_bond_ownership_percentage = my_bond / total_bond;
      nodeOperatorFee = Number(nodeData.bond_providers.node_operator_fee) / 10000;
      current_award = Number(nodeData.current_award) * (1 - nodeOperatorFee);
      my_award = my_bond_ownership_percentage * current_award;

      const churns = await fetchJSON(`https://midgard.ninerealms.com/v2/churns`);
      recentChurnTimestamp = Number(churns[0].date) / 1e9;
      const currentTime = Date.now() / 1000;
      const timeDiff = currentTime - recentChurnTimestamp;
      const timeDiffInYears = timeDiff / (60 * 60 * 24 * 365.25);
      const APR = my_award / my_bond / timeDiffInYears;
      APY = (1 + APR / 365) ** 365 - 1;

      const runePriceData = await fetchJSON("https://thornode.ninerealms.com/thorchain/network");
      const runePriceInTor = runePriceData.rune_price_in_tor;
      runePriceUSD = runePriceInTor / 1e8;

      fetchBtcPoolData();
      fetchChurnInterval();
    } catch (error) {
      console.error("Error fetching or processing data:", error);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (my_bond_address && node_address) {
      bondAddressSuffix = my_bond_address.slice(-4);
      showData = true;
      updateURL();
      fetchData();
    }
  };

  const updateURL = () => {
    const url = new URL(window.location);
    url.searchParams.set("bond_address", my_bond_address);
    url.searchParams.set("node_address", node_address);
    window.history.pushState({}, '', url);
  };

  let showToast = false;
  let toastMessage = "";

  const openRuneScan = () => {
    window.open(`https://runescan.io/address/${my_bond_address}`, '_blank');
  };

  // Modify the existing showToast logic
  let toastTimeout;
  const showToastMessage = (message) => {
    clearTimeout(toastTimeout);
    toastMessage = message;
    showToast = true;
    toastTimeout = setTimeout(() => {
      showToast = false;
    }, 2000); // 2 seconds
  };

  // Update other functions to use showToastMessage
  const copyLink = () => {
    const url = new URL(window.location);
    url.searchParams.set("bond_address", my_bond_address);
    url.searchParams.set("node_address", node_address);
    navigator.clipboard.writeText(url.toString()).then(() => {
      showToastMessage("Link copied to clipboard!");
    });
  };

  const addBookmark = () => {
    if (isMobile) {
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        showToastMessage("To add to home screen: tap the share icon, then 'Add to Home Screen'.");
      } else if (/Android/.test(navigator.userAgent)) {
        showToastMessage("To add to home screen: tap the menu icon, then 'Add to Home Screen'.");
      } else {
        showToastMessage("To add to home screen, check your browser's options or menu.");
      }
    } else {
      showToastMessage("Press " + (navigator.userAgent.toLowerCase().indexOf('mac') != -1 ? 'Cmd' : 'Ctrl') + "+D to bookmark this page.");
    }
  };

  async function pickRandomNode() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/nodes');
      const nodes = await response.json();
      
      const activeNodes = nodes.filter(node => node.status === 'Active');
      if (activeNodes.length === 0) {
        throw new Error('No active nodes found');
      }

      const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
      const bondProviders = randomNode.bond_providers.providers;
      const randomBondProvider = bondProviders[Math.floor(Math.random() * bondProviders.length)];

      node_address = randomNode.node_address;
      my_bond_address = randomBondProvider.bond_address;
      
      // Update the URL with the new addresses
      const url = new URL(window.location);
      url.searchParams.set('node_address', node_address);
      url.searchParams.set('bond_address', my_bond_address);
      window.history.pushState({}, '', url);

      // Fetch data for the selected node and bond provider
      await fetchData();
      showData = true;
    } catch (error) {
      console.error('Error picking random node:', error);
      // You might want to show an error message to the user here
    }
  }

  onMount(() => {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    updateAddressesFromURL();
    fetchExchangeRates();
  });
</script>

<div class="bond-tracker-wrapper">
  <div class="bond-tracker">
    {#if !showData}
      <form on:submit={handleSubmit}>
        <h2>Bond Tracker</h2>
        <label>
          Bond Address:
          <input type="text" bind:value={my_bond_address} required />
        </label>
        <label>
          Node Address:
          <input type="text" bind:value={node_address} required />
        </label>
        <button type="submit">Track Bond</button>
      </form>
    {:else}
      <div class="container">
        <h2>Bond Tracker - {bondAddressSuffix}</h2>
        <div class="grid">
          <div class="card bond">
            <h3>Bond</h3>
            <div class="main-value">
              {numFormat((my_bond / 1e8).toFixed(1))}
              <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
            </div>
            <div class="sub-values">
              <span class="usd-value">{formattedBondValue}</span>
              <span class="btc-value">
                {bondvaluebtc.toFixed(2)}
                <img src="/assets/coins/bitcoin-btc-logo.svg" alt="BTC" class="btc-icon" />
              </span>
            </div>
          </div>
          <div class="card next-award">
            <h3>Next Award</h3>
            <div class="main-value">
              {numFormat((my_award / 1e8).toFixed(1))}
              <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
            </div>
            <div class="sub-values">
              <span class="usd-value">{formattedNextAward}</span>
              <span class="btc-value">
                {nextAwardBtcValue.toFixed(6)}
                <img src="/assets/coins/bitcoin-btc-logo.svg" alt="BTC" class="btc-icon" />
              </span>
            </div>
          </div>
          <div class="card apy">
            <h3>APY</h3>
            <div class="main-value">{(APY * 100).toFixed(2)}%</div>
            <div class="sub-values">
              <span class="usd-value">{formattedAPY}/yr</span>
              <span class="rune-value">
                {numFormat(((APY * my_bond) / 1e8).toFixed(0))}
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                /yr
              </span>
            </div>
          </div>
          <div class="card links">
            <div class="link-list">
              <div class="rune-price">
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" width="24" height="24" />
                <span class="link-value">{formattedRunePrice}</span>
              </div>
              <div class="info-row">
                <div class="info-item">
                  <span class="link-label">Next Churn</span>
                  <span class="link-value">{countdown}</span>
                </div>
                <div class="info-item">
                  <span class="link-label">Node Fee</span>
                  <span class="link-value">{(nodeOperatorFee * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="button-container">
        <button class="action-button bookmark-button" on:click={addBookmark} title={isMobile ? "Add to Home Screen" : "Bookmark"}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
        <button class="action-button copy-link" on:click={copyLink} title="Copy Link">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="action-button runescan-button" on:click={openRuneScan} title="Open in RuneScan">
          <img src="/assets/viewblock.png" alt="RuneScan" width="24" height="24" />
        </button>
        <button class="action-button currency-switch" on:click={switchCurrency} title="Switch Currency">
          {#if currentCurrency === 'USD'}
            $
          {:else if currentCurrency === 'EUR'}
            €
          {:else if currentCurrency === 'GBP'}
            £
          {:else if currentCurrency === 'JPY'}
            ¥
          {/if}
        </button>
      </div>
    {/if}
  </div>

  {#if !showData}
    <div class="random-button" on:click={pickRandomNode} title="Pick Random Node">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <circle cx="15.5" cy="8.5" r="1.5"></circle>
        <circle cx="15.5" cy="15.5" r="1.5"></circle>
        <circle cx="8.5" cy="15.5" r="1.5"></circle>
      </svg>
    </div>
  {/if}
</div>

{#if showToast}
  <div class="toast" transition:fade>
    {toastMessage}
  </div>
{/if}

<style>
  .bond-tracker-wrapper {
    position: relative;
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding-bottom: 60px; /* Add space for the random button */
  }

  .bond-tracker {
    /* ... existing styles ... */
  }

  .random-button {
    position: absolute;
    top: 20px;
    right: -70px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: #4A90E2;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .random-button:hover {
    background-color: #3A7BC8;
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    .random-button {
      top: auto;
      bottom: -70px;
      right: 0;
    }
  }

  .bond-tracker {
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
    margin-bottom: 50px; /* Increased space for the copy button */
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

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 120px;
    position: relative;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  h3 {
    font-size: 14px;
    margin: 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .main-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    position: absolute;
    top: 50%;
    left: 15px;
    right: 15px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
  }

  .sub-values {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #a9a9a9;
    position: absolute;
    bottom: 15px;
    left: 15px;
    right: 15px;
  }

  .sub-values .usd-value {
    text-align: left;
  }

  .sub-values .btc-value,
  .sub-values .rune-value {
    text-align: right;
  }

  .sub-values .rune-value {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .sub-values .rune-value .rune-icon {
    width: 16px;
    height: 16px;
    margin-left: 2px;
    margin-right: 2px;
  }

  .link-list {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 0;
  }

  .rune-price {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 8px;
    background-color: rgba(74, 144, 226, 0.15);
    border-radius: 12px;
    padding: 6px 10px;
  }

  .rune-price img {
    margin-right: 8px;
    width: 24px;
    height: 24px;
  }

  .rune-price .link-value {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    border-radius: 8px;
    padding: 6px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48%;
    padding: 4px;
    background-color: rgba(74, 144, 226, 0.05);
    border-radius: 6px;
    transition: all 0.3s ease;
  }

  .info-item:hover {
    background-color: rgba(74, 144, 226, 0.2);
  }

  .link-label {
    font-weight: 600;
    color: #4A90E2;
    font-size: 11px;
    margin-bottom: 2px;
    text-transform: uppercase;
  }

  .link-value {
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
  }

  .button-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
  }

  .action-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: none;
    padding: 0;
  }

  .action-button:hover {
    transform: scale(1.1);
  }

  .action-button svg {
    width: 20px;
    height: 20px;
  }

  .action-button img {
    width: 24px;
    height: 24px;
  }

  .bookmark-button {
    background-color: #28a745;
    color: white;
  }

  .bookmark-button:hover {
    background-color: #218838;
  }

  .copy-link {
    background-color: #4A90E2;
    color: white;
  }

  .copy-link:hover {
    background-color: #3A7BC8;
  }

  .runescan-button {
    background-color: #6c757d;
  }

  .runescan-button:hover {
    background-color: #5a6268;
  }

  .currency-switch {
    background-color: #ffc107;
    color: #000;
    font-size: 18px;
    font-weight: bold;
  }

  .currency-switch:hover {
    background-color: #e0a800;
  }

  .random-node {
    background-color: #6c757d;
  }

  .random-node:hover {
    background-color: #5a6268;
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
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    max-width: 80%;
    text-align: center;
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

  input {
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #1a1a1a;
    color: #e0e0e0;
    font-size: 16px;
  }

  button[type="submit"] {
    background-color: #4A90E2;
    color: white;
    padding: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    font-size: 18px;
    font-weight: 600;
  }

  button[type="submit"]:hover {
    background-color: #3A7BC8;
  }

  .btc-icon {
    width: 16px;
    height: 16px;
    margin-left: 2px;
    vertical-align: middle;
  }

  .button-group {
    display: flex;
    gap: 10px;
  }

  .button-group button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    font-size: 16px;
    font-weight: 600;
  }

  .button-group button:hover {
    background-color: #3A7BC8;
  }

  .random-button {
    background-color: #6c757d;
    color: white;
  }

  .random-button:hover {
    background-color: #5a6268;
  }

  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .card {
      padding: 12px;
      height: auto;
      min-height: 100px; /* Reduced minimum height for mobile */
    }

    .main-value {
      position: static;
      transform: none;
      margin: 10px 0;
    }

    .sub-values {
      position: static;
      margin-top: 5px;
    }

    .link-list {
      padding: 2px 0;
    }

    .link-list a {
      padding: 1px 3px;
      font-size: 9px;
    }

    .button-container {
      bottom: 10px;
      right: 10px;
    }

    .action-button {
      padding: 8px;
    }

    .action-button svg {
      width: 14px;
      height: 14px;
    }

    .toast {
      font-size: 12px;
      padding: 10px 20px;
    }
  }
</style>
