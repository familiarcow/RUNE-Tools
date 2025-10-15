<script>
  import { onMount } from "svelte";

  let my_bond_address = "";
  let node_address = ""; // Keep for backwards compatibility
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
  let nodeAddressSuffix = "";
  let isMobile = false;
  let nodeStatus = "";
  
  // New variables for multiple bond tracking
  let bondNodes = []; // Array of node data with bonds > 1 RUNE
  let isMultiNode = false; // Whether user has multiple nodes
  let totalBond = 0;
  let totalAward = 0;
  let aggregateAPY = 0;

  let currentCurrency = 'USD';
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
    updateCurrencyURL();
  };

  const updateCurrencyURL = () => {
    const url = new URL(window.location);
    if (currentCurrency !== 'USD') {
      url.searchParams.set("currency", currentCurrency);
    } else {
      url.searchParams.delete("currency");
    }
    window.history.pushState({}, '', url);
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
    const urlCurrency = urlParams.get("currency");
    
    // Set currency from URL parameter, default to USD if not specified or invalid
    if (urlCurrency && currencies.includes(urlCurrency.toUpperCase())) {
      currentCurrency = urlCurrency.toUpperCase();
    } else {
      currentCurrency = 'USD';
    }
    
    if (urlBondAddress) {
      my_bond_address = urlBondAddress;
      bondAddressSuffix = urlBondAddress.slice(-4);
      showData = true;
      
      // Always use new multi-node mode, ignore node_address parameter
      fetchBondData();
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

  const formatBondAmount = (bondAmount) => {
    const runeAmount = bondAmount / 1e8;
    if (runeAmount >= 1000000) {
      return Math.round(runeAmount / 1000000) + "M";
    } else if (runeAmount >= 1000) {
      return Math.round(runeAmount / 1000) + "k";
    } else {
      return Math.round(runeAmount);
    }
  };

  const fetchBondData = async () => {
    try {
      // Fetch bond data from midgard
      const bondData = await fetchJSON(`https://midgard.ninerealms.com/v2/bonds/${my_bond_address}`);
      
      // Filter nodes with bond > 1 RUNE (1e8 base units)
      const nodesWithBond = bondData.nodes.filter(node => Number(node.bond) > 1e8);
      
      if (nodesWithBond.length === 1) {
        // Single node - use existing UI
        isMultiNode = false;
        const singleNode = nodesWithBond[0];
        node_address = singleNode.address;
        nodeAddressSuffix = node_address.slice(-4);
        await fetchData();
      } else if (nodesWithBond.length > 1) {
        // Multiple nodes - use new UI
        isMultiNode = true;
        await fetchMultiNodeData(nodesWithBond);
      }
    } catch (error) {
      console.error("Error fetching bond data:", error);
    }
  };

  const fetchMultiNodeData = async (nodes) => {
    try {
      // Fetch common data first
      const [churns, runePriceData, btcPoolData] = await Promise.all([
        fetchJSON(`https://midgard.ninerealms.com/v2/churns`),
        fetchJSON("https://thornode.ninerealms.com/thorchain/network"),
        fetchJSON("https://thornode.ninerealms.com/thorchain/pool/BTC.BTC")
      ]);

      recentChurnTimestamp = Number(churns[0].date) / 1e9;
      runePriceUSD = runePriceData.rune_price_in_tor / 1e8;
      
      const balanceAsset = btcPoolData.balance_asset;
      const balanceRune = btcPoolData.balance_rune;
      const btcruneprice = balanceAsset / balanceRune;

      // Fetch detailed data for each node
      const nodeDataPromises = nodes.map(async (node) => {
        const nodeData = await fetchJSON(`https://thornode.ninerealms.com/thorchain/node/${node.address}`);
        const bondProviders = nodeData.bond_providers.providers;
        
        let userBond = 0;
        let totalBond = 0;
        
        for (const provider of bondProviders) {
          if (provider.bond_address === my_bond_address) {
            userBond = Number(provider.bond);
          }
          totalBond += Number(provider.bond);
        }
        
        const bondOwnershipPercentage = userBond / totalBond;
        const nodeOperatorFee = Number(nodeData.bond_providers.node_operator_fee) / 10000;
        const currentAward = Number(nodeData.current_award) * (1 - nodeOperatorFee);
        const userAward = bondOwnershipPercentage * currentAward;
        
        // Calculate APY for this node
        const currentTime = Date.now() / 1000;
        const timeDiff = currentTime - recentChurnTimestamp;
        const timeDiffInYears = timeDiff / (60 * 60 * 24 * 365.25);
        const APR = userAward / userBond / timeDiffInYears;
        const nodeAPY = (1 + APR / 365) ** 365 - 1;

        return {
          address: node.address,
          addressSuffix: node.address.slice(-4),
          status: nodeData.status,
          bond: userBond,
          award: userAward,
          apy: nodeAPY,
          fee: nodeOperatorFee,
          bondFormatted: formatBondAmount(userBond),
          bondFullAmount: Math.round(userBond / 1e8),
          btcValue: (userBond * btcruneprice) / 1e8
        };
      });

      bondNodes = await Promise.all(nodeDataPromises);
      
      // Calculate totals
      totalBond = bondNodes.reduce((sum, node) => sum + node.bond, 0);
      totalAward = bondNodes.reduce((sum, node) => sum + node.award, 0);
      
      // Calculate weighted average APY
      let weightedAPYSum = 0;
      for (const node of bondNodes) {
        const weight = node.bond / totalBond;
        weightedAPYSum += node.apy * weight;
      }
      aggregateAPY = weightedAPYSum;
      
      // Update legacy variables for existing reactive statements
      my_bond = totalBond;
      my_award = totalAward;
      APY = aggregateAPY;
      bondvaluebtc = bondNodes.reduce((sum, node) => sum + node.btcValue, 0);

      await fetchChurnInterval();
      
    } catch (error) {
      console.error("Error fetching multi-node data:", error);
    }
  };

  const fetchData = async () => {
    try {
      const nodeData = await fetchJSON(`https://thornode.ninerealms.com/thorchain/node/${node_address}`);
      nodeStatus = nodeData.status;
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
    if (my_bond_address) {
      bondAddressSuffix = my_bond_address.slice(-4);
      showData = true;
      updateURLBondOnly();
      fetchBondData();
    }
  };

  const updateURL = () => {
    const url = new URL(window.location);
    url.searchParams.set("bond_address", my_bond_address);
    url.searchParams.set("node_address", node_address);
    window.history.pushState({}, '', url);
  };

  const updateURLBondOnly = () => {
    const url = new URL(window.location);
    url.searchParams.set("bond_address", my_bond_address);
    url.searchParams.delete("node_address");
    if (currentCurrency !== 'USD') {
      url.searchParams.set("currency", currentCurrency);
    } else {
      url.searchParams.delete("currency");
    }
    window.history.pushState({}, '', url);
  };

  let showToast = false;
  let toastMessage = "";

  const openRuneScan = () => {
    window.open(`https://thorchain.net/address/${my_bond_address}`, '_blank');
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
    if (!isMultiNode && node_address) {
      url.searchParams.set("node_address", node_address);
    } else {
      url.searchParams.delete("node_address");
    }
    if (currentCurrency !== 'USD') {
      url.searchParams.set("currency", currentCurrency);
    } else {
      url.searchParams.delete("currency");
    }
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
      
      // Update suffixes
      bondAddressSuffix = my_bond_address.slice(-4);
      nodeAddressSuffix = node_address.slice(-4);
      
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
          <input type="text" bind:value={my_bond_address} required placeholder="Enter your bond address" />
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
            {#if nodeStatus === "Standby"}
              <div class="card node-status">
                <h3>Node Status</h3>
                <div class="main-value status-text">
                  {nodeStatus}
                </div>
                <div class="sub-values">
                  <span class="info-text">Node is churned out</span>
                </div>
              </div>
            {:else}
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
            {/if}
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
                {#if !isMultiNode}
                  <div class="info-item">
                    <span class="link-label">{nodeAddressSuffix} Fee</span>
                    <span class="link-value">{(nodeOperatorFee * 100).toFixed(2)}%</span>
                  </div>
                {:else}
                  <div class="info-item">
                    <span class="link-label">Nodes</span>
                    <span class="link-value">{bondNodes.length}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          {#if isMultiNode}
            <!-- Multi-node status display -->
            <div class="card multi-nodes">
              <h3>Node Status</h3>
              <div class="nodes-list">
                {#each bondNodes as node}
                  <div class="node-item">
                    <div class="node-status">
                      <div class="status-indicator" class:active={node.status === 'Active'} class:inactive={node.status !== 'Active'}></div>
                      <span class="node-suffix">{node.addressSuffix}</span>
                      <button class="node-link" on:click={() => window.open(`https://thorchain.net/node/${node.address}`, '_blank')} title="View Node Info">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15,3 21,3 21,9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </button>
                    </div>
                    <div class="node-details">
                      <span class="node-bond">
                        {numFormat(node.bondFullAmount)}
                        <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="node-rune-icon" />
                      </span>
                      <span class="node-fee">Fee: {(node.fee * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
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
    max-width: 650px;
    width: 95%;
    margin: 0 auto;
    padding: 16px;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .container {
    background: linear-gradient(145deg, #1a1a1a 0%, #2c2c2c 100%);
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    margin-bottom: 80px;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
    border-radius: 16px 16px 0 0;
  }

  h2::before {
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

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 20px 16px;
  }

  .card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 120px;
    position: relative;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 20px rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #333333 0%, #404040 100%);
  }

  h3 {
    font-size: 12px;
    margin: 0 0 6px 0;
    color: #a0a0a0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .main-value {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    position: absolute;
    top: 50%;
    left: 16px;
    right: 16px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    letter-spacing: -0.3px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
    color: #c0c0c0;
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    font-weight: 500;
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
    margin-left: 4px;
    margin-right: 2px;
    position: relative;
    top: -1px;
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
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 69, 19, 0.2) 100%);
    border-radius: 10px;
    padding: 8px 12px;
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .rune-price img {
    margin-right: 8px;
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .rune-price .link-value {
    font-size: 18px;
    font-weight: 500;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    letter-spacing: -0.3px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin: 0 -2px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    padding: 6px 4px;
    background: linear-gradient(145deg, #2a2a2a 0%, #373737 100%);
    border-radius: 6px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    min-width: 0;
    overflow: hidden;
  }

  .info-item:hover {
    background: linear-gradient(145deg, #333333 0%, #404040 100%);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .link-label {
    font-weight: 600;
    color: #a0a0a0;
    font-size: 10px;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .link-value {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .button-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
  }

  .action-button {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: none;
    padding: 0;
    backdrop-filter: blur(10px);
  }

  .action-button:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
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
    color: #ffffff;
  }

  .runescan-button:hover {
    background-color: #5a6268;
  }

  .currency-switch {
    background-color: #ffc107;
    color: #ffffff;
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
    padding: 32px;
    background: linear-gradient(145deg, #1a1a1a 0%, #2c2c2c 100%);
    border-radius: 16px;
    position: relative;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: #c0c0c0;
    font-weight: 600;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input {
    padding: 16px 20px;
    border-radius: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    color: #ffffff;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(99, 102, 241, 0.2), 0 0 20px rgba(99, 102, 241, 0.3);
    transform: translateY(-2px);
    background: linear-gradient(145deg, #333333 0%, #404040 100%);
  }

  input::placeholder {
    color: #888888;
  }

  button[type="submit"] {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.4);
  }

  button[type="submit"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px 0 rgba(102, 126, 234, 0.5);
  }

  button[type="submit"]:active {
    transform: translateY(0);
  }

  .btc-icon {
    width: 16px;
    height: 16px;
    margin-left: 4px;
    vertical-align: middle;
    position: relative;
    top: -1px;
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
    .bond-tracker {
      padding: 12px;
    }

    .grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px 12px;
    }

    .card {
      padding: 16px;
      height: auto;
      min-height: 110px;
    }

    .main-value {
      position: static;
      transform: none;
      margin: 8px 0;
      font-size: 22px;
      left: auto;
      right: auto;
    }

    .sub-values {
      position: static;
      margin-top: 8px;
      left: auto;
      right: auto;
    }

    h2 {
      font-size: 20px;
      padding: 16px 12px;
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

    .multi-nodes {
      grid-column: 1 / -1;
    }

    .node-item {
      padding: 6px 8px;
    }

    .node-suffix {
      font-size: 12px;
    }

    .node-bond {
      font-size: 12px;
    }

    .node-fee {
      font-size: 10px;
    }
  }

  .status-text {
    color: #ff9800;
    font-size: 20px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .info-text {
    color: #a9a9a9;
    font-size: 12px;
    text-align: center;
    width: 100%;
  }

  /* Multi-node styles */
  .multi-nodes {
    grid-column: 1 / -1; /* Span full width */
    height: auto;
    min-height: 140px;
    background: linear-gradient(145deg, #333333 0%, #404040 100%);
    border: 2px solid rgba(99, 102, 241, 0.3);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .multi-nodes:hover {
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 20px rgba(99, 102, 241, 0.3);
    background: linear-gradient(145deg, #383838 0%, #454545 100%);
  }

  .nodes-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
  }

  .node-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: linear-gradient(145deg, #2a2a2a 0%, #373737 100%);
    border-radius: 8px;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .node-item:hover {
    background: linear-gradient(145deg, #383838 0%, #454545 100%);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateX(4px);
  }

  .node-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .status-indicator.active {
    background-color: #28a745;
    box-shadow: 0 0 6px rgba(40, 167, 69, 0.4);
  }

  .status-indicator.inactive {
    background-color: #dc3545;
    box-shadow: 0 0 6px rgba(220, 53, 69, 0.4);
  }

  .node-suffix {
    font-weight: 600;
    color: #ffffff;
    font-size: 14px;
  }

  .node-details {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .node-bond {
    font-weight: 600;
    color: #ffffff;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .node-rune-icon {
    width: 16px;
    height: 16px;
  }

  .node-fee {
    font-size: 12px;
    color: #b0b0b0;
  }

  .node-link {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    margin-left: 6px;
  }

  .node-link:hover {
    background-color: rgba(74, 144, 226, 0.2);
    transform: scale(1.1);
  }
</style>
