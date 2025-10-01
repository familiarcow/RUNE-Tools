<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let limitSwapsSummary = null;
  let limitSwaps = [];
  let loading = true;
  let error = null;
  let selectedFilter = 'all';
  let searchTerm = '';
  let filteredSwaps = [];
  let selectedPair = null;
  let pairSwaps = [];
  let loadingPairDetails = false;
  let pools = [];
  let poolPrices = new Map();
  let testingQuote = new Set(); // Track which swaps are testing quotes
  let quoteResults = new Map(); // Store quote results

  const STAGENET_API = 'https://stagenet-thornode.ninerealms.com/thorchain';

  async function fetchLimitSwapsSummary() {
    try {
      const response = await fetch(`${STAGENET_API}/queue/limit_swaps/summary`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      limitSwapsSummary = data;
    } catch (err) {
      console.error('Error fetching limit swaps summary:', err);
      error = `Failed to fetch summary: ${err.message}`;
    }
  }

  async function fetchPools() {
    try {
      const response = await fetch(`${STAGENET_API}/pools`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      pools = Array.isArray(data) ? data : [];
      
      // Create a map of asset -> USD price for quick lookup
      poolPrices.clear();
      pools.forEach(pool => {
        if (pool.asset && pool.asset_tor_price) {
          const usdPrice = parseInt(pool.asset_tor_price) / 1e8;
          poolPrices.set(pool.asset, usdPrice);
        }
      });
    } catch (err) {
      console.error('Error fetching pools:', err);
      // Don't set error for pools as it's not critical
    }
  }

  async function fetchLimitSwaps() {
    try {
      const response = await fetch(`${STAGENET_API}/queue/limit_swaps`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Ensure we always have an array
      if (Array.isArray(data)) {
        limitSwaps = data;
      } else {
        // Handle case where data might be wrapped in an object
        limitSwaps = data?.swaps || data?.queue || [];
      }
    } catch (err) {
      console.error('Error fetching limit swaps:', err);
      error = `Failed to fetch swaps: ${err.message}`;
      limitSwaps = []; // Ensure it stays an array on error
    }
  }

  async function fetchPairDetails(sourceAsset, targetAsset) {
    loadingPairDetails = true;
    try {
      const params = new URLSearchParams({
        offset: '0',
        limit: '100',
        source_asset: sourceAsset,
        target_asset: targetAsset,
        sort_by: 'ratio',
        sort_order: 'asc'
      });
      const response = await fetch(`${STAGENET_API}/queue/limit_swaps?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        pairSwaps = data;
      } else if (data?.limit_swaps) {
        pairSwaps = data.limit_swaps;
      } else {
        pairSwaps = data?.swaps || data?.queue || [];
      }
    } catch (err) {
      console.error('Error fetching pair details:', err);
      error = `Failed to fetch pair details: ${err.message}`;
      pairSwaps = [];
    }
    loadingPairDetails = false;
  }

  async function loadData() {
    loading = true;
    error = null;
    
    await Promise.all([
      fetchLimitSwapsSummary(),
      fetchLimitSwaps(),
      fetchPools()
    ]);
    
    loading = false;
  }

  function selectPair(pair) {
    selectedPair = pair;
    fetchPairDetails(pair.source_asset, pair.target_asset);
  }

  function goBackToSummary() {
    selectedPair = null;
    pairSwaps = [];
  }

  onMount(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  });

  function formatAmount(amount, decimals = 8) {
    if (!amount) return '0';
    const num = parseInt(amount) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }

  function formatUSD(amount) {
    if (!amount) return '$0';
    const usdValue = parseInt(amount) / 1e8;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(usdValue);
  }

  function getAssetDisplay(asset) {
    if (!asset) return '';
    
    // Handle assets with contract addresses (e.g., BSC.USDT-0X...)
    const parts = asset.split('-');
    if (parts.length > 1 && parts[1].startsWith('0X')) {
      // Return chain.token format (e.g., BSC.USDT)
      return parts[0];
    }
    
    // For regular assets, return as-is
    return asset;
  }

  function getChainFromAsset(asset) {
    if (!asset) return '';
    const parts = asset.split('.');
    return parts[0] || '';
  }

  function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function getBlocksToExpiry(swap) {
    if (!swap.expiry_height || !swap.initial_height) return 'N/A';
    return swap.expiry_height - swap.initial_height;
  }

  function getPairRatio(sourceAsset, targetAsset) {
    const sourcePrice = poolPrices.get(sourceAsset);
    const targetPrice = poolPrices.get(targetAsset);
    
    if (!sourcePrice || !targetPrice) return null;
    
    // Calculate how many target tokens you get per source token
    const ratio = sourcePrice / targetPrice;
    return ratio;
  }

  function formatRatio(ratio) {
    if (!ratio) return 'N/A';
    return ratio.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  }

  function getPoolByAsset(asset) {
    return pools.find(pool => pool.asset === asset);
  }

  function formatUSDShort(amount) {
    if (!amount || amount === 0) return '$0';
    
    const num = Math.floor(amount);
    
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(1)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(1)}k`;
    } else {
      return `$${num}`;
    }
  }

  function getPoolDepthUSD(pool) {
    if (!pool || !pool.balance_asset || !pool.asset_tor_price) return 0;
    const balanceAsset = parseInt(pool.balance_asset) / 1e8;
    const assetPrice = parseInt(pool.asset_tor_price) / 1e8;
    return 2 * balanceAsset * assetPrice;
  }

  function getAssetPriceUSD(asset) {
    const pool = getPoolByAsset(asset);
    if (!pool || !pool.asset_tor_price) return null;
    return parseInt(pool.asset_tor_price) / 1e8;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here if desired
      console.log('Copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  function openTxLink(txid) {
    window.open(`https://thorchain.net/tx/${txid}`, '_blank');
  }

  async function testQuote(swap) {
    const swapId = swap.swap?.tx?.id;
    if (!swapId) return;

    testingQuote.add(swapId);
    testingQuote = testingQuote; // Trigger reactivity

    try {
      // Extract swap parameters
      const fromAsset = `${swap.swap.tx.chain}.${swap.swap.tx.chain}`;
      const toAsset = swap.swap.target_asset;
      const amount = swap.swap.tx.coins[0].amount; // Already in 1e8 format
      const destination = swap.swap.destination;
      
      // Use streaming parameters from the swap state
      const streamingInterval = swap.swap.state?.interval || "0";
      const streamingQuantity = swap.swap.state?.quantity || "4";

      // Build the quote URL for stagenet
      let url = `${STAGENET_API}/quote/swap?`;
      url += `amount=${amount}&from_asset=${fromAsset}&to_asset=${toAsset}&destination=${destination}`;
      url += `&streaming_interval=${streamingInterval}&streaming_quantity=${streamingQuantity}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Store the result
      quoteResults.set(swapId, {
        expected_amount_out: parseInt(result.expected_amount_out) / 1e8,
        target_amount: parseInt(swap.swap.trade_target) / 1e8,
        difference: (parseInt(result.expected_amount_out) - parseInt(swap.swap.trade_target)) / 1e8,
        percentage_diff: ((parseInt(result.expected_amount_out) - parseInt(swap.swap.trade_target)) / parseInt(swap.swap.trade_target)) * 100
      });
      quoteResults = quoteResults; // Trigger reactivity

    } catch (err) {
      console.error('Error fetching quote:', err);
      quoteResults.set(swapId, {
        error: err.message
      });
      quoteResults = quoteResults;
    } finally {
      testingQuote.delete(swapId);
      testingQuote = testingQuote;
    }
  }

  // Update filtered swaps whenever limitSwaps, searchTerm, or selectedFilter changes
  function updateFilteredSwaps() {
    if (!Array.isArray(limitSwaps)) {
      filteredSwaps = [];
      return;
    }
    
    filteredSwaps = limitSwaps.filter(swap => {
      const matchesSearch = searchTerm === '' || 
        swap.tx_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        swap.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        swap.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        swap.source_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        swap.target_address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (selectedFilter === 'all') return matchesSearch;
      
      // Add more filters as needed
      return matchesSearch;
    });
  }
  
  // Reactive statement to update filtered swaps
  $: {
    limitSwaps;
    searchTerm;
    selectedFilter;
    updateFilteredSwaps();
  }
</script>

<div class="orderbooks-container">
  <div class="header">
    <h1>THORChain Orderbooks (Stagenet)</h1>
    <p class="subtitle">Monitor active limit swaps on THORChain's stagenet</p>
  </div>

  {#if loading}
    <div class="loading" in:fade>
      <div class="spinner"></div>
      <p>Loading limit swaps...</p>
    </div>
  {:else if error}
    <div class="error" in:fade>
      <p>⚠️ {error}</p>
      <button on:click={loadData} class="retry-btn">Retry</button>
    </div>
  {:else}
    <!-- Summary Section -->
    {#if limitSwapsSummary}
      <div class="summary-section" in:fly={{ y: 20, duration: 400 }}>
        <h2>Network Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">{limitSwapsSummary.total_limit_swaps || 0}</div>
            <div class="summary-label">Total Limit Swaps</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{formatUSD(limitSwapsSummary.total_value_usd || 0)}</div>
            <div class="summary-label">Total Value (USD)</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{limitSwapsSummary.oldest_swap_blocks || 0}</div>
            <div class="summary-label">Oldest Swap (Blocks)</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{limitSwapsSummary.average_age_blocks || 0}</div>
            <div class="summary-label">Average Age (Blocks)</div>
          </div>
        </div>
      </div>
    {/if}

    {#if !selectedPair}
      <!-- Asset Pairs Table -->
      <div class="pairs-section" in:fly={{ y: 20, duration: 400, delay: 100 }}>
        <div class="section-header">
          <h2>Trading Pairs ({limitSwapsSummary?.asset_pairs?.length || 0})</h2>
          <button on:click={loadData} class="refresh-btn" title="Refresh Data">
            🔄
          </button>
        </div>
        
        {#if limitSwapsSummary?.asset_pairs?.length}
          <div class="pairs-table">
            <div class="table-header">
              <div class="header-cell">Source Asset</div>
              <div class="header-cell">Target Asset</div>
              <div class="header-cell">Current Ratio</div>
              <div class="header-cell">Count</div>
              <div class="header-cell">Total Value (USD)</div>
              <div class="header-cell">Action</div>
            </div>
            {#each limitSwapsSummary.asset_pairs as pair, i}
              <div 
                class="table-row" 
                in:fly={{ y: 20, duration: 300, delay: i * 100 }}
              >
                <div class="cell">
                  <div class="asset-info">
                    <span class="asset-name">{getAssetDisplay(pair.source_asset)}</span>
                    <span class="chain-badge">{getChainFromAsset(pair.source_asset)}</span>
                  </div>
                </div>
                <div class="cell">
                  <div class="asset-info">
                    <span class="asset-name">{getAssetDisplay(pair.target_asset)}</span>
                    <span class="chain-badge">{getChainFromAsset(pair.target_asset)}</span>
                  </div>
                </div>
                <div class="cell ratio">
                  {#if getPairRatio(pair.source_asset, pair.target_asset)}
                    <span class="ratio-value">{formatRatio(getPairRatio(pair.source_asset, pair.target_asset))}</span>
                    <span class="ratio-label">{getAssetDisplay(pair.target_asset)} per {getAssetDisplay(pair.source_asset)}</span>
                  {:else}
                    <span class="ratio-na">N/A</span>
                  {/if}
                </div>
                <div class="cell count">{pair.count}</div>
                <div class="cell value">{formatUSD(pair.total_value_usd)}</div>
                <div class="cell">
                  <button 
                    class="view-details-btn"
                    on:click={() => selectPair(pair)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-pairs">
            <p>No trading pairs found</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Pair Details View -->
      <div class="pair-details" in:fly={{ y: 20, duration: 400 }}>
        <div class="details-header">
          <button class="back-btn" on:click={goBackToSummary}>
            ← Back to Summary
          </button>
          <h2>
            {getAssetDisplay(selectedPair.source_asset)} → {getAssetDisplay(selectedPair.target_asset)}
          </h2>
        </div>

        <!-- Pair Market Information -->
        <div class="pair-market-info" in:fly={{ y: 20, duration: 400, delay: 100 }}>
          <div class="market-info-grid">
            <!-- Current Market Ratio -->
            <div class="info-card market-ratio-card">
              <div class="info-value">
                {#if getPairRatio(selectedPair.source_asset, selectedPair.target_asset)}
                  {formatRatio(getPairRatio(selectedPair.source_asset, selectedPair.target_asset))}
                {:else}
                  N/A
                {/if}
              </div>
              <div class="info-label">
                Current Market Ratio
                <div class="info-sublabel">
                  {getAssetDisplay(selectedPair.target_asset)} per {getAssetDisplay(selectedPair.source_asset)}
                </div>
              </div>
            </div>

            <!-- Source Asset Info -->
            <div class="info-card">
              <div class="info-value">
                {#if getAssetPriceUSD(selectedPair.source_asset)}
                  ${getAssetPriceUSD(selectedPair.source_asset).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {:else}
                  N/A
                {/if}
              </div>
              <div class="info-label">
                {getAssetDisplay(selectedPair.source_asset)} Price
                <div class="info-sublabel">USD per token</div>
              </div>
            </div>

            <!-- Target Asset Info -->
            <div class="info-card">
              <div class="info-value">
                {#if getAssetPriceUSD(selectedPair.target_asset)}
                  ${getAssetPriceUSD(selectedPair.target_asset).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {:else}
                  N/A
                {/if}
              </div>
              <div class="info-label">
                {getAssetDisplay(selectedPair.target_asset)} Price
                <div class="info-sublabel">USD per token</div>
              </div>
            </div>

            <!-- Source Pool Depth -->
            <div class="info-card">
              <div class="info-value">
                {#if getPoolByAsset(selectedPair.source_asset)}
                  {formatUSDShort(getPoolDepthUSD(getPoolByAsset(selectedPair.source_asset)))}
                {:else}
                  N/A
                {/if}
              </div>
              <div class="info-label">
                {getAssetDisplay(selectedPair.source_asset)} Pool Depth
                <div class="info-sublabel">Total liquidity</div>
              </div>
            </div>

            <!-- Target Pool Depth -->
            <div class="info-card">
              <div class="info-value">
                {#if getPoolByAsset(selectedPair.target_asset)}
                  {formatUSDShort(getPoolDepthUSD(getPoolByAsset(selectedPair.target_asset)))}
                {:else}
                  N/A
                {/if}
              </div>
              <div class="info-label">
                {getAssetDisplay(selectedPair.target_asset)} Pool Depth
                <div class="info-sublabel">Total liquidity</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Controls Section -->
        <div class="controls">
          <div class="search-container">
            <input 
              type="text" 
              placeholder="Search by transaction ID, asset, or address..." 
              bind:value={searchTerm}
              class="search-input"
            />
          </div>
        </div>

        {#if loadingPairDetails}
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading pair details...</p>
          </div>
        {:else if pairSwaps.length === 0}
          <div class="no-swaps">
            <p>No limit swaps found for this pair</p>
          </div>
        {:else}
          <!-- Individual Swaps -->
          <div class="swaps-section">
            <h3>Individual Swaps ({pairSwaps.length})</h3>
            <div class="swaps-grid">
              {#each pairSwaps as swap, i}
                <div 
                  class="swap-card" 
                  in:fly={{ y: 20, duration: 300, delay: i * 50 }}
                >
                  <div class="swap-header">
                    <div class="swap-pair">
                      <span class="from-asset">{swap.swap?.tx?.chain}.{swap.swap?.tx?.chain}</span>
                      <span class="arrow">→</span>
                      <span class="to-asset">{getAssetDisplay(swap.swap?.target_asset)}</span>
                    </div>
                    <div class="swap-ratio">
                      <span class="ratio-badge">
                        Execution Ratio: {swap.ratio ? formatRatio(parseInt(swap.ratio) / 1e8) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div class="swap-details">
                    <div class="detail-row">
                      <span class="label">Amount:</span>
                      <span class="value">{formatAmount(swap.swap?.tx?.coins?.[0]?.amount)} {swap.swap?.tx?.chain}</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Target:</span>
                      <span class="value">{formatAmount(swap.swap?.trade_target)} {getAssetDisplay(swap.swap?.target_asset)}</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">From:</span>
                      <div class="address-container">
                        <span class="value address">{shortenAddress(swap.swap?.tx?.from_address)}</span>
                        <button 
                          class="address-copy-btn" 
                          on:click={() => copyToClipboard(swap.swap?.tx?.from_address)}
                          title="Copy full address"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div class="detail-row">
                      <span class="label">To:</span>
                      <div class="address-container">
                        <span class="value address">
                          {shortenAddress(swap.swap?.destination)}
                        </span>
                        {#if swap.swap?.destination}
                          <button 
                            class="address-copy-btn" 
                            on:click={() => copyToClipboard(swap.swap?.destination)}
                            title="Copy full address"
                          >
                            📋
                          </button>
                        {/if}
                      </div>
                    </div>
                    <div class="detail-row">
                      <span class="label">Age:</span>
                      <span class="value">{swap.blocks_since_created || 0} blocks</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Expiry:</span>
                      <span class="value">{swap.time_to_expiry_blocks || 'N/A'} blocks remaining</span>
                    </div>
                  </div>

                  <div class="swap-footer">
                    <div class="tx-id">
                      <span class="label">TX ID:</span>
                      <span class="value tx">{shortenAddress(swap.swap?.tx?.id)}</span>
                      <div class="tx-actions">
                        <button 
                          class="tx-btn copy-btn" 
                          on:click={() => copyToClipboard(swap.swap?.tx?.id)}
                          title="Copy full transaction ID"
                        >
                          📋
                        </button>
                        <button 
                          class="tx-btn link-btn" 
                          on:click={() => openTxLink(swap.swap?.tx?.id)}
                          title="View on thorchain.net"
                        >
                          🔗
                        </button>
                        <button 
                          class="tx-btn test-quote-btn" 
                          on:click={() => testQuote(swap)}
                          disabled={testingQuote.has(swap.swap?.tx?.id)}
                          title="Test current quote"
                        >
                          {testingQuote.has(swap.swap?.tx?.id) ? '⏳' : '📊'}
                        </button>
                      </div>
                    </div>
                    
                    <!-- Quote Results -->
                    {#if quoteResults.has(swap.swap?.tx?.id)}
                      <div class="quote-results">
                        {#if quoteResults.get(swap.swap.tx.id).error}
                          <div class="quote-error">
                            ⚠️ Error: {quoteResults.get(swap.swap.tx.id).error}
                          </div>
                        {:else}
                          <div class="quote-comparison">
                            <div class="quote-row">
                              <span class="quote-label">Expected Output:</span>
                              <span class="quote-value">{formatAmount(quoteResults.get(swap.swap.tx.id).expected_amount_out * 1e8)} {getAssetDisplay(swap.swap?.target_asset)}</span>
                            </div>
                            <div class="quote-row">
                              <span class="quote-label">Target Output:</span>
                              <span class="quote-value">{formatAmount(quoteResults.get(swap.swap.tx.id).target_amount * 1e8)} {getAssetDisplay(swap.swap?.target_asset)}</span>
                            </div>
                            <div class="quote-row">
                              <span class="quote-label">Difference:</span>
                              <span class="quote-value {quoteResults.get(swap.swap.tx.id).difference >= 0 ? 'positive' : 'negative'}">
                                {quoteResults.get(swap.swap.tx.id).difference >= 0 ? '+' : ''}{formatAmount(quoteResults.get(swap.swap.tx.id).difference * 1e8)} 
                                ({quoteResults.get(swap.swap.tx.id).percentage_diff >= 0 ? '+' : ''}{quoteResults.get(swap.swap.tx.id).percentage_diff.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .orderbooks-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    color: var(--text-color);
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 600;
    color: var(--text-color);
  }

  .subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 1.1rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error {
    text-align: center;
    padding: 2rem;
    color: #ff6b6b;
  }

  .retry-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 1rem;
  }

  .summary-section {
    margin-bottom: 2rem;
  }

  .summary-section h2 {
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .summary-card {
    background: var(--surface-color);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .summary-value {
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 0.5rem;
  }

  .summary-label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .market-ratio {
    border: 2px solid rgba(255, 62, 0, 0.3) !important;
    background: linear-gradient(135deg, var(--surface-color), rgba(255, 62, 0, 0.05)) !important;
  }

  .ratio-highlight {
    color: var(--primary-color) !important;
    font-weight: 700 !important;
  }

  .ratio-pair-label {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    color: var(--text-color);
    font-weight: 500;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-container {
    flex: 1;
    min-width: 250px;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-color);
    font-size: 1rem;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .filter-select {
    padding: 0.75rem;
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-color);
    font-size: 1rem;
    min-width: 150px;
  }

  .refresh-btn {
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.75rem;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: rotate(180deg);
  }

  .pairs-section {
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    margin: 0;
    color: var(--text-color);
  }

  .pairs-table {
    background: var(--surface-color);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto auto auto;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-cell {
    font-weight: 600;
    color: var(--text-color);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto auto auto;
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .table-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .cell {
    display: flex;
    align-items: center;
    color: var(--text-color);
  }

  .asset-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .asset-name {
    font-weight: 600;
    font-size: 1rem;
  }

  .chain-badge {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-muted);
    width: fit-content;
  }

  .cell.count, .cell.value {
    justify-content: center;
    font-weight: 600;
  }

  .cell.ratio {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .ratio-value {
    font-weight: 600;
    color: var(--primary-color);
  }

  .ratio-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .ratio-na {
    color: var(--text-muted);
    font-style: italic;
  }

  .swap-ratio {
    margin-top: 0.5rem;
  }

  .ratio-badge {
    background: rgba(255, 62, 0, 0.1);
    color: var(--primary-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .view-details-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .view-details-btn:hover {
    background: #e73300;
    transform: translateY(-1px);
  }

  .no-pairs {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    background: var(--surface-color);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .pair-details {
    margin-bottom: 2rem;
  }

  .details-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-btn {
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: var(--text-color);
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .details-header h2 {
    margin: 0;
    color: var(--text-color);
  }

  .pair-market-info {
    margin-bottom: 2rem;
  }

  .market-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-card {
    background: var(--surface-color);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  .info-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  .market-ratio-card {
    border: 2px solid rgba(255, 62, 0, 0.3);
    background: linear-gradient(135deg, var(--surface-color), rgba(255, 62, 0, 0.05));
  }

  .info-value {
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 0.5rem;
  }

  .market-ratio-card .info-value {
    color: var(--primary-color);
    font-weight: 700;
  }

  .info-label {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .info-sublabel {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    color: var(--text-muted);
    opacity: 0.8;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .swaps-section h2, .swaps-section h3 {
    margin-bottom: 1.5rem;
    color: var(--text-color);
  }

  .no-swaps {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    background: var(--surface-color);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .swaps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .swap-card {
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .swap-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  .swap-header {
    margin-bottom: 1rem;
  }

  .swap-pair {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .from-asset, .to-asset {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .from-asset {
    color: var(--primary-color);
  }

  .to-asset {
    color: #4CAF50;
  }

  .arrow {
    color: var(--text-muted);
    font-size: 1.2rem;
  }

  .swap-chains {
    display: flex;
    gap: 0.5rem;
  }

  .chain {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .swap-details {
    margin-bottom: 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .detail-row .label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .detail-row .value {
    color: var(--text-color);
    font-weight: 500;
  }

  .detail-row .value.address {
    font-family: monospace;
    font-size: 0.85rem;
  }

  .swap-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
  }

  .tx-id {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tx-id .value.tx {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .tx-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: 1rem;
  }

  .tx-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    color: var(--text-color);
  }

  .tx-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .copy-btn:hover {
    background: rgba(76, 175, 80, 0.2);
    border-color: rgba(76, 175, 80, 0.4);
  }

  .link-btn:hover {
    background: rgba(33, 150, 243, 0.2);
    border-color: rgba(33, 150, 243, 0.4);
  }

  .test-quote-btn:hover:not(:disabled) {
    background: rgba(156, 39, 176, 0.2);
    border-color: rgba(156, 39, 176, 0.4);
  }

  .test-quote-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quote-results {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .quote-error {
    color: #ff6b6b;
    font-size: 0.85rem;
  }

  .quote-comparison {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .quote-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .quote-label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .quote-value {
    color: var(--text-color);
    font-weight: 600;
    font-family: monospace;
  }

  .quote-value.positive {
    color: #4CAF50;
  }

  .quote-value.negative {
    color: #ff6b6b;
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .address-copy-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    padding: 0.2rem 0.3rem;
    cursor: pointer;
    font-size: 0.7rem;
    transition: all 0.2s ease;
    color: var(--text-muted);
  }

  .address-copy-btn:hover {
    background: rgba(76, 175, 80, 0.2);
    border-color: rgba(76, 175, 80, 0.4);
    color: var(--text-color);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .orderbooks-container {
      padding: 1rem;
    }

    .swaps-grid {
      grid-template-columns: 1fr;
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .search-container {
      min-width: auto;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .table-header, .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .table-header {
      display: none; /* Hide header on mobile, use card-like layout */
    }

    .table-row {
      background: var(--surface-color);
      margin-bottom: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem;
    }

    .cell {
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .cell:last-child {
      border-bottom: none;
      justify-content: center;
      margin-top: 0.5rem;
    }

    .cell:before {
      content: attr(data-label);
      font-weight: 600;
      color: var(--text-muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .details-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>