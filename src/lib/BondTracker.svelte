<script>
  import { onMount } from "svelte";
  import { thornode } from '$lib/api';
  import { midgard } from '$lib/api/midgard';
  import { formatNumber, simplifyNumber, formatCountdown, getAddressSuffix } from '$lib/utils/formatting';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import { getChurnInfo, getLastChurn } from '$lib/utils/nodes';
  import { calculateAPR, calculateAPY } from '$lib/utils/calculations';
  import { LoadingBar, StatusIndicator, ActionButton, Toast } from '$lib/components';
  import {
    currentCurrency,
    exchangeRates,
    currencySymbols,
    initCurrency,
    switchCurrency,
    formatCurrency,
    formatCurrencyWithDecimals
  } from '$lib/stores/currency';

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
  let isChurningHalted = false; // HALTCHURNING mimir flag
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
  let isLoading = false;
  let showContent = true; // Show content by default

  // Make these reactive (using currency store)
  $: formattedRunePrice = formatCurrencyWithDecimals($exchangeRates, runePriceUSD, $currentCurrency);
  $: formattedBondValue = formatCurrency($exchangeRates, (my_bond / 1e8) * runePriceUSD, $currentCurrency);
  $: formattedNextAward = formatCurrency($exchangeRates, (my_award / 1e8) * runePriceUSD, $currentCurrency);
  $: formattedAPY = formatCurrency($exchangeRates, ((APY * my_bond) / 1e8) * runePriceUSD, $currentCurrency);
  $: nextAwardBtcValue = (my_award * bondvaluebtc) / my_bond;

  // Using shared formatNumber from $lib/utils/formatting

  const updateAddressesFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBondAddress = urlParams.get("bond_address");

    if (urlBondAddress) {
      my_bond_address = urlBondAddress;
      bondAddressSuffix = getAddressSuffix(urlBondAddress, 4);
      showData = true;

      // Always use new multi-node mode, ignore node_address parameter
      fetchBondData();
    }
  };

  const fetchChurnInterval = async () => {
    try {
      // Use shared churn utilities
      const churnInfo = await getChurnInfo(recentChurnTimestamp);
      isChurningHalted = churnInfo.isHalted;
      nextChurnTime = churnInfo.nextChurnTimestamp;
      updateCountdown();
    } catch (error) {
      console.error("Error fetching churn interval:", error);
    }
  };

  const updateCountdown = () => {
    const now = Date.now() / 1000;
    const secondsLeft = nextChurnTime - now;
    countdown = formatCountdown(secondsLeft, { zeroText: 'Now!' });
  };

  const fetchBtcPoolData = async () => {
    try {
      const btcPoolData = await thornode.getPool('BTC.BTC');
      const balanceAsset = btcPoolData.balance_asset;
      const balanceRune = btcPoolData.balance_rune;
      const btcruneprice = balanceAsset / balanceRune;
      bondvaluebtc = (my_bond * btcruneprice) / 1e8;
    } catch (error) {
      console.error("Error fetching BTC pool data:", error);
    }
  };

  const fetchBondData = async () => {
    try {
      isLoading = true;
      showContent = false;

      // Fetch bond data from midgard
      const bondData = await midgard.fetch(`/bonds/${my_bond_address}`);
      
      // Filter nodes with bond > 1 RUNE (1e8 base units)
      const nodesWithBond = bondData.nodes.filter(node => Number(node.bond) > 1e8);
      
      if (nodesWithBond.length === 1) {
        // Single node - use existing UI
        isMultiNode = false;
        const singleNode = nodesWithBond[0];
        node_address = singleNode.address;
        nodeAddressSuffix = getAddressSuffix(node_address, 4);
        await fetchData();
      } else if (nodesWithBond.length > 1) {
        // Multiple nodes - use new UI
        isMultiNode = true;
        await fetchMultiNodeData(nodesWithBond);
      }
      
      // Data loaded, start transition
      isLoading = false;
      setTimeout(() => {
        showContent = true;
      }, 200);
    } catch (error) {
      console.error("Error fetching bond data:", error);
      isLoading = false;
      showContent = true;
    }
  };

  const fetchMultiNodeData = async (nodes) => {
    try {
      // Fetch common data first
      const [lastChurn, runePriceData, btcPoolData] = await Promise.all([
        getLastChurn(),
        thornode.getNetwork(),
        thornode.getPool('BTC.BTC')
      ]);

      recentChurnTimestamp = lastChurn?.timestampSec || 0;
      runePriceUSD = fromBaseUnit(runePriceData.rune_price_in_tor);
      
      const balanceAsset = btcPoolData.balance_asset;
      const balanceRune = btcPoolData.balance_rune;
      const btcruneprice = balanceAsset / balanceRune;

      // Fetch detailed data for each node
      const nodeDataPromises = nodes.map(async (node) => {
        const nodeData = await thornode.fetch(`/thorchain/node/${node.address}`);
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
        const apr = calculateAPR(userAward, userBond, timeDiff);
        const nodeAPY = calculateAPY(apr);

        return {
          address: node.address,
          addressSuffix: getAddressSuffix(node.address, 4),
          status: nodeData.status,
          bond: userBond,
          award: userAward,
          apy: nodeAPY,
          fee: nodeOperatorFee,
          bondFormatted: simplifyNumber(fromBaseUnit(userBond)),
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
      // Parallelize independent API calls
      const [nodeData, lastChurn, runePriceData] = await Promise.all([
        thornode.fetch(`/thorchain/node/${node_address}`),
        getLastChurn(),
        thornode.getNetwork()
      ]);

      // Process node data
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

      // Process churn data for APY calculation
      recentChurnTimestamp = lastChurn?.timestampSec || 0;
      const currentTime = Date.now() / 1000;
      const timeDiff = currentTime - recentChurnTimestamp;
      const apr = calculateAPR(my_award, my_bond, timeDiff);
      APY = calculateAPY(apr);

      // Process price data
      runePriceUSD = fromBaseUnit(runePriceData.rune_price_in_tor);

      // Fetch additional data (these also run in parallel with each other)
      fetchBtcPoolData();
      fetchChurnInterval();
    } catch (error) {
      console.error("Error fetching or processing data:", error);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (my_bond_address) {
      bondAddressSuffix = getAddressSuffix(my_bond_address, 4);
      showData = true;
      updateURLBondOnly();
      fetchBondData();
    }
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

  const showToastMessage = (message) => {
    toastMessage = message;
    showToast = true;
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
      const nodes = await thornode.getNodes();
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
      bondAddressSuffix = getAddressSuffix(my_bond_address, 4);
      nodeAddressSuffix = getAddressSuffix(node_address, 4);
      
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

  onMount(async () => {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    await initCurrency(); // Initialize currency from URL and fetch exchange rates
    updateAddressesFromURL();
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
              {#if isLoading}
                <LoadingBar variant="main" />
              {:else if showContent}
                <div class="fade-in-content">
                  {formatNumber(my_bond / 1e8, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                </div>
              {/if}
            </div>
            <div class="sub-values">
              {#if isLoading}
                <LoadingBar variant="sub" width="45%" />
                <LoadingBar variant="sub" width="45%" />
              {:else}
                <span class="usd-value {showContent ? 'fade-in-content' : ''}">{formattedBondValue}</span>
                <span class="btc-value {showContent ? 'fade-in-content' : ''}">
                  {bondvaluebtc.toFixed(2)}
                  <img src="/assets/coins/bitcoin-btc-logo.svg" alt="BTC" class="btc-icon" />
                </span>
              {/if}
            </div>
          </div>
            <div class="card next-award">
              <h3>Next Award</h3>
              <div class="main-value">
                {#if isLoading}
                  <LoadingBar variant="main" />
                {:else if showContent}
                  <div class="fade-in-content">
                    {formatNumber(my_award / 1e8, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </div>
                {/if}
              </div>
              <div class="sub-values">
                {#if isLoading}
                  <LoadingBar variant="sub" width="45%" />
                  <LoadingBar variant="sub" width="45%" />
                {:else}
                  <span class="usd-value {showContent ? 'fade-in-content' : ''}">{formattedNextAward}</span>
                  <span class="btc-value {showContent ? 'fade-in-content' : ''}">
                    {nextAwardBtcValue.toFixed(6)}
                    <img src="/assets/coins/bitcoin-btc-logo.svg" alt="BTC" class="btc-icon" />
                  </span>
                {/if}
              </div>
            </div>
            <div class="card {nodeStatus === 'Standby' && !isLoading ? 'node-status' : 'apy'}">
              {#if nodeStatus === "Standby" && !isLoading}
                <h3>Node Status</h3>
                <div class="main-value status-text">
                  {#if isLoading}
                    <LoadingBar variant="main" />
                  {:else}
                    <div class="{showContent ? 'fade-in-content' : ''}">{nodeStatus}</div>
                  {/if}
                </div>
                <div class="sub-values">
                  {#if isLoading}
                    <LoadingBar variant="sub" width="45%" />
                  {:else}
                    <span class="info-text {showContent ? 'fade-in-content' : ''}">Node is churned out</span>
                  {/if}
                </div>
              {:else}
                <h3>APY</h3>
                <div class="main-value">
                  {#if isLoading}
                    <LoadingBar variant="main" />
                  {:else}
                    <div class="{showContent ? 'fade-in-content' : ''}">{(APY * 100).toFixed(2)}%</div>
                  {/if}
                </div>
                <div class="sub-values">
                  {#if isLoading}
                    <LoadingBar variant="sub" width="45%" />
                    <LoadingBar variant="sub" width="45%" />
                  {:else}
                    <span class="usd-value {showContent ? 'fade-in-content' : ''}">{formattedAPY}/yr</span>
                    <span class="rune-value {showContent ? 'fade-in-content' : ''}">
                      {formatNumber((APY * my_bond) / 1e8, { maximumFractionDigits: 0 })}
                      <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                      /yr
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
          <div class="card links">
            <div class="link-list">
              <div class="rune-price">
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" width="24" height="24" />
                {#if isLoading}
                  <LoadingBar variant="custom" width="80px" height="18px" />
                {:else}
                  <span class="link-value {showContent ? 'fade-in-content' : ''}">{formattedRunePrice}</span>
                {/if}
              </div>
              <div class="info-row">
                <div class="info-item">
                  <span class="link-label">Next Churn</span>
                  {#if isLoading}
                    <LoadingBar variant="custom" width="100%" height="13px" />
                  {:else if isChurningHalted}
                    <span class="link-value churn-paused {showContent ? 'fade-in-content' : ''}">Paused</span>
                  {:else}
                    <span class="link-value {showContent ? 'fade-in-content' : ''}">{countdown}</span>
                  {/if}
                </div>
                <div class="info-item">
                  {#if !isMultiNode}
                    <span class="link-label">{nodeAddressSuffix || 'Node'} Fee</span>
                    {#if isLoading}
                      <LoadingBar variant="custom" width="100%" height="13px" />
                    {:else}
                      <span class="link-value {showContent ? 'fade-in-content' : ''}">{(nodeOperatorFee * 100).toFixed(2)}%</span>
                    {/if}
                  {:else}
                    <span class="link-label">Nodes</span>
                    {#if isLoading}
                      <LoadingBar variant="custom" width="100%" height="13px" />
                    {:else}
                      <span class="link-value {showContent ? 'fade-in-content' : ''}">{bondNodes.length}</span>
                    {/if}
                  {/if}
                </div>
              </div>
            </div>
          </div>

          {#if isMultiNode}
            <!-- Multi-node status display -->
            <div class="card multi-nodes">
              <h3>Node Status</h3>
              <div class="nodes-list">
                {#if isLoading}
                  {#each Array(3) as _}
                    <div class="node-item">
                      <div class="node-status">
                        <div class="loading-bar node-indicator-bar"></div>
                        <LoadingBar variant="custom" width="40px" height="14px" />
                      </div>
                      <div class="node-details">
                        <LoadingBar variant="custom" width="60px" height="14px" />
                        <LoadingBar variant="custom" width="50px" height="12px" />
                      </div>
                    </div>
                  {/each}
                {:else if showContent}
                  {#each bondNodes as node}
                    <div class="node-item fade-in-content">
                      <div class="node-status">
                        <StatusIndicator status={node.status === 'Active' ? 'active' : 'error'} pulse={node.status === 'Active'} />
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
                          {formatNumber(node.bondFullAmount)}
                          <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="node-rune-icon" />
                        </span>
                        <span class="node-fee">Fee: {(node.fee * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
      <div class="button-container">
        <ActionButton variant="refresh" title="Refresh Data" on:click={fetchBondData}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </ActionButton>
        <ActionButton variant="bookmark" title={isMobile ? "Add to Home Screen" : "Bookmark"} on:click={addBookmark}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </ActionButton>
        <ActionButton variant="copy" title="Copy Link" on:click={copyLink}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </ActionButton>
        <ActionButton variant="external" title="Open in RuneScan" on:click={openRuneScan}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </ActionButton>
        <ActionButton variant="currency" title="Switch Currency" on:click={switchCurrency}>
          {currencySymbols[$currentCurrency]}
        </ActionButton>
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

<Toast
  message={toastMessage}
  visible={showToast}
  duration={2000}
  on:hide={() => showToast = false}
/>

<style>
  @import '$lib/styles/variables.css';

  .bond-tracker-wrapper {
    position: relative;
    max-width: var(--container-sm);
    width: 95%;
    margin: 0 auto;
    padding-bottom: 60px;
  }

  .random-button {
    position: absolute;
    top: var(--space-xl);
    right: -70px;
    width: 50px;
    height: 50px;
    border-radius: var(--radius-full);
    background-color: var(--accent-link);
    color: var(--text-primary);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: var(--transition-smooth);
    box-shadow: var(--shadow-button);
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
    max-width: var(--container-md);
    width: 95%;
    margin: 0 auto;
    padding: var(--space-lg);
    position: relative;
    font-family: var(--font-system);
  }

  .container {
    background: linear-gradient(145deg, var(--bg-main) 0%, var(--bg-card) 100%);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-elevated);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
    margin-bottom: 80px;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: var(--space-xl);
    background: var(--gradient-primary);
    color: var(--text-primary);
    font-size: var(--text-3xl);
    font-weight: var(--font-extrabold);
    letter-spacing: var(--tracking-tight);
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  h2::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: var(--animation-shimmer-slow);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-lg);
    padding: var(--space-xl) var(--space-lg);
  }

  .card {
    background: var(--gradient-card);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    transition: var(--transition-smooth);
    height: var(--card-height);
    position: relative;
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-default);
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-card-hover), var(--shadow-glow);
    border-color: var(--border-hover);
    background: var(--gradient-card-hover);
  }

  h3 {
    font-size: var(--text-sm);
    margin: 0 0 6px 0;
    color: var(--text-muted);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .main-value {
    font-size: var(--text-2xl);
    font-weight: var(--font-extrabold);
    color: var(--text-primary);
    position: absolute;
    top: 50%;
    left: var(--space-lg);
    right: var(--space-lg);
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    letter-spacing: -0.3px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .main-value > div {
    display: flex;
    align-items: center;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
    vertical-align: middle;
  }

  .sub-values {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    position: absolute;
    bottom: var(--space-lg);
    left: var(--space-lg);
    right: var(--space-lg);
    font-weight: var(--font-medium);
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
    margin-left: var(--space-xs);
    margin-right: 2px;
    vertical-align: middle;
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
    margin-bottom: var(--space-sm);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 69, 19, 0.2) 100%);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .rune-price img {
    margin-right: var(--space-sm);
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .rune-price .link-value {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-primary);
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
    padding: 6px var(--space-xs);
    background: linear-gradient(145deg, #2a2a2a 0%, #373737 100%);
    border-radius: 6px;
    transition: var(--transition-smooth);
    border: 1px solid var(--border-subtle);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    min-width: 0;
    overflow: hidden;
  }

  .info-item:hover {
    background: var(--gradient-card-hover);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .link-label {
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    font-size: var(--text-xs);
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .link-value {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: var(--font-bold);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .link-value.churn-paused {
    color: var(--color-warning-light);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .button-container {
    position: absolute;
    bottom: var(--space-xl);
    right: var(--space-xl);
    display: flex;
    gap: var(--space-md);
  }

  .random-node {
    background-color: #6c757d;
  }

  .random-node:hover {
    background-color: #5a6268;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    padding: var(--space-3xl);
    background: linear-gradient(145deg, var(--bg-main) 0%, var(--bg-card) 100%);
    border-radius: var(--radius-xl);
    position: relative;
    box-shadow: var(--shadow-elevated);
    border: 1px solid var(--border-subtle);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    color: var(--text-secondary);
    font-weight: var(--font-semibold);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  input {
    padding: var(--space-lg) var(--space-xl);
    border-radius: var(--radius-lg);
    border: 2px solid var(--border-input);
    background: var(--gradient-card);
    color: var(--text-primary);
    font-size: var(--text-md);
    font-weight: var(--font-medium);
    transition: var(--transition-smooth);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-input-focus);
    transform: translateY(-2px);
    background: var(--gradient-card-hover);
  }

  input::placeholder {
    color: var(--text-dimmed);
  }

  button[type="submit"] {
    background: var(--gradient-primary);
    color: var(--text-primary);
    padding: var(--space-lg);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-smooth);
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
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
    margin-left: var(--space-xs);
    vertical-align: middle;
  }

  .button-group {
    display: flex;
    gap: var(--space-md);
  }

  .button-group button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition-smooth);
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
  }

  .button-group button:hover {
    background-color: #3A7BC8;
  }

  @media (max-width: 600px) {
    .bond-tracker {
      padding: var(--space-md);
    }

    .grid {
      grid-template-columns: 1fr;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-md);
    }

    .card {
      padding: var(--space-lg);
      height: auto;
      min-height: var(--card-height-mobile);
    }

    .main-value {
      position: static;
      transform: none;
      margin: var(--space-sm) 0;
      font-size: 22px;
      left: auto;
      right: auto;
    }

    .sub-values {
      position: static;
      margin-top: var(--space-sm);
      left: auto;
      right: auto;
    }

    h2 {
      font-size: var(--text-xl);
      padding: var(--space-lg) var(--space-md);
    }

    .link-list {
      padding: 2px 0;
    }

    .link-list a {
      padding: 1px 3px;
      font-size: 9px;
    }

    .button-container {
      bottom: var(--space-md);
      right: var(--space-md);
    }

    .multi-nodes {
      grid-column: 1 / -1;
    }

    .node-item {
      padding: 6px var(--space-sm);
    }

    .node-suffix {
      font-size: var(--text-sm);
    }

    .node-bond {
      font-size: var(--text-sm);
    }

    .node-fee {
      font-size: var(--text-xs);
    }
  }

  .status-text {
    color: var(--color-warning);
    font-size: var(--text-xl);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .info-text {
    color: #a9a9a9;
    font-size: var(--text-sm);
    text-align: center;
    width: 100%;
  }

  /* Multi-node styles */
  .multi-nodes {
    grid-column: 1 / -1;
    height: auto;
    min-height: 140px;
    background: var(--gradient-card-hover);
    border: 2px solid rgba(99, 102, 241, 0.3);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: var(--transition-smooth);
  }

  .multi-nodes:hover {
    border-color: var(--border-hover);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), var(--shadow-glow);
    background: linear-gradient(145deg, #383838 0%, #454545 100%);
  }

  .nodes-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: var(--space-md);
  }

  .node-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) 14px;
    background: linear-gradient(145deg, #2a2a2a 0%, #373737 100%);
    border-radius: var(--radius-md);
    transition: var(--transition-smooth);
    border: 1px solid var(--border-subtle);
  }

  .node-item:hover {
    background: linear-gradient(145deg, #383838 0%, #454545 100%);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateX(4px);
  }

  .node-status {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .node-suffix {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-size: var(--text-base);
  }

  .node-details {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .node-bond {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-size: var(--text-base);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .node-rune-icon {
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }

  .node-fee {
    font-size: var(--text-sm);
    color: #b0b0b0;
  }

  .node-link {
    background: none;
    border: none;
    color: var(--accent-link);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-smooth);
    margin-left: 6px;
  }

  .node-link:hover {
    background-color: rgba(74, 144, 226, 0.2);
    transform: scale(1.1);
  }

  /* Loading bars */
  .loading-bar {
    background: var(--gradient-shimmer);
    background-size: 200% 100%;
    border-radius: var(--radius-sm);
    animation: var(--animation-shimmer);
    opacity: 1;
    transition: var(--transition-base);
  }

  .loading-bar.fade-out {
    opacity: 0;
  }

  .fade-in-content {
    opacity: 0;
    animation: var(--animation-fade-in);
  }

  /* Node loading bar */
  .node-indicator-bar {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-full);
  }
</style>
