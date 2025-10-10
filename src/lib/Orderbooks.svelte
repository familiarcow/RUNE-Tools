<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let limitSwapsSummary = null;
  let limitSwaps = [];
  let loading = true;
  let error = null;
  let selectedFilter = 'all';
  let searchTerm = '';
  let summarySearchTerm = '';
  let filteredSwaps = [];
  let filteredPairs = [];
  let selectedPair = null;
  let pairSwaps = [];
  let loadingPairDetails = false;
  let pools = [];
  let poolPrices = new Map();
  let runePrice = 0; // RUNE price in USD
  let testingQuote = new Set(); // Track which swaps are testing quotes
  let quoteResults = new Map(); // Store quote results

  const MAINNET_API = 'https://thornode.ninerealms.com/thorchain';

  async function fetchLimitSwapsSummary() {
    try {
      const response = await fetch(`${MAINNET_API}/queue/limit_swaps/summary`);
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
      const response = await fetch(`${MAINNET_API}/pools`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      pools = Array.isArray(data) ? data : [];
      
      // Create a map of asset -> USD price for quick lookup
      // Store multiple formats for easy lookups
      poolPrices.clear();
      pools.forEach(pool => {
        if (pool.asset && pool.asset_tor_price) {
          const usdPrice = parseInt(pool.asset_tor_price) / 1e8;
          
          // Store with original asset name (e.g., ETH.USDC-0X123...)
          poolPrices.set(pool.asset, usdPrice);
          
          // Store normalized version (e.g., ETH.USDC)  
          const normalizedAsset = normalizeAsset(pool.asset);
          poolPrices.set(normalizedAsset, usdPrice);
          
          // Create alternative format mappings for different asset types
          // If pool has ETH.USDC-0X123, also map ETH-USDC-0X123 and ETH~USDC-0X123
          if (pool.asset.includes('.') && pool.asset.includes('-0X')) {
            // Secured asset format (dash separator)
            const dashVersion = pool.asset.replace('.', '-');
            poolPrices.set(dashVersion, usdPrice);
            poolPrices.set(normalizeAsset(dashVersion), usdPrice);
            
            // Trade asset format (tilde separator)  
            const tildeVersion = pool.asset.replace('.', '~');
            poolPrices.set(tildeVersion, usdPrice);
            poolPrices.set(normalizeAsset(tildeVersion), usdPrice);
          }
        }
      });
      
      // Add THOR.RUNE price if we have it
      if (runePrice > 0) {
        poolPrices.set('THOR.RUNE', runePrice);
      }
      
      // Debug: Log all ETH-related pools
      console.log('All ETH pools from API:', pools.filter(p => p.asset.includes('ETH')).map(p => ({ asset: p.asset, balance: p.balance_asset, price: p.asset_tor_price })));
    } catch (err) {
      console.error('Error fetching pools:', err);
      // Don't set error for pools as it's not critical
    }
  }

  async function fetchNetworkInfo() {
    try {
      const response = await fetch(`${MAINNET_API}/network`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Get RUNE price in USD from rune_price_in_tor
      if (data.rune_price_in_tor) {
        runePrice = parseInt(data.rune_price_in_tor) / 1e8;
        // Update poolPrices map with RUNE price
        poolPrices.set('THOR.RUNE', runePrice);
      }
    } catch (err) {
      console.error('Error fetching network info:', err);
      // Don't set error for network info as it's not critical
    }
  }

  async function fetchLimitSwaps() {
    try {
      const response = await fetch(`${MAINNET_API}/queue/limit_swaps`);
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
      const response = await fetch(`${MAINNET_API}/queue/limit_swaps?${params}`);
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
      fetchNetworkInfo(),
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

  function normalizeAsset(asset) {
    if (!asset) return '';
    
    // Handle assets with contract addresses first
    // Format: ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48
    const dashParts = asset.split('-');
    let cleanAsset = asset;
    
    // Check if the last part is a contract address (starts with 0X and is long enough)
    if (dashParts.length >= 3) {
      const lastPart = dashParts[dashParts.length - 1];
      if (lastPart.toUpperCase().startsWith('0X') && lastPart.length > 10) {
        // Remove the contract address part
        cleanAsset = dashParts.slice(0, -1).join('-');
      }
    }
    
    // Now normalize the separators to dot notation for consistency
    // . = native asset (keep as-is)
    // - = secured asset (convert to .)
    // ~ = trade asset (convert to .)
    if (cleanAsset.includes('-') && !cleanAsset.includes('.') && !cleanAsset.includes('~')) {
      // This is a secured asset, convert to dot notation
      const parts = cleanAsset.split('-');
      if (parts.length === 2) {
        return `${parts[0]}.${parts[1]}`;
      }
    } else if (cleanAsset.includes('~')) {
      // This is a trade asset, convert to dot notation
      return cleanAsset.replace('~', '.');
    }
    
    // Native assets with . or already clean assets
    return cleanAsset;
  }

  function getAssetType(asset) {
    if (!asset) return 'unknown';
    
    // Remove contract address if present
    const dashParts = asset.split('-');
    let cleanAsset = asset;
    if (dashParts.length >= 3) {
      const lastPart = dashParts[dashParts.length - 1];
      if (lastPart.toUpperCase().startsWith('0X') && lastPart.length > 10) {
        cleanAsset = dashParts.slice(0, -1).join('-');
      }
    }
    
    if (cleanAsset.includes('.')) return 'native';
    if (cleanAsset.includes('-')) return 'secured';
    if (cleanAsset.includes('~')) return 'trade';
    return 'unknown';
  }

  function getAssetDisplay(asset) {
    return normalizeAsset(asset);
  }

  function getChainFromAsset(asset) {
    if (!asset) return '';
    
    // Use normalized asset (always uses dot notation)
    const normalizedAsset = normalizeAsset(asset);
    
    // Split on dot to get chain part
    const parts = normalizedAsset.split('.');
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
    // Normalize assets for price lookups
    const normalizedSource = normalizeAsset(sourceAsset);
    const normalizedTarget = normalizeAsset(targetAsset);
    
    const sourcePrice = getAssetPriceUSD(normalizedSource);
    const targetPrice = getAssetPriceUSD(normalizedTarget);
    
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
    if (!asset) return null;
    
    const normalizedAsset = normalizeAsset(asset);
    
    // Debug logging for ETH assets
    const isETH = asset.includes('ETH') && (asset.includes('USDC') || asset.includes('DAI'));
    if (isETH) {
      console.log('=== POOL LOOKUP DEBUG ===');
      console.log('Looking for pool with asset:', asset);
      console.log('Normalized to:', normalizedAsset);
    }
    
    // Convert secured/trade asset format to native pool format
    // ETH-USDC-0X123 -> ETH.USDC-0X123 (what pools API uses)
    function toPoolFormat(assetName) {
      if (!assetName) return assetName;
      
      // Handle secured assets: ETH-USDC-0X123 -> ETH.USDC-0X123
      const parts = assetName.split('-');
      if (parts.length >= 3 && parts[parts.length - 1].toUpperCase().startsWith('0X')) {
        // Has contract address, convert first dash to dot
        return `${parts[0]}.${parts.slice(1).join('-')}`;
      }
      
      // Handle secured assets without contract: ETH-USDC -> ETH.USDC  
      if (parts.length === 2 && !assetName.includes('.')) {
        return `${parts[0]}.${parts[1]}`;
      }
      
      // Handle trade assets: ETH~USDC-0X123 -> ETH.USDC-0X123
      if (assetName.includes('~')) {
        return assetName.replace('~', '.');
      }
      
      return assetName;
    }
    
    const poolFormatAsset = toPoolFormat(asset);
    const poolFormatNormalized = toPoolFormat(normalizedAsset);
    
    if (isETH) {
      console.log('Pool format asset:', poolFormatAsset);
      console.log('Pool format normalized:', poolFormatNormalized);
    }
    
    // Try multiple formats to find the pool
    // 1. Try pool format of original asset (ETH.USDC-0X123)
    let pool = pools.find(p => p.asset === poolFormatAsset);
    if (pool) {
      if (isETH) console.log('Found pool by pool format:', pool.asset);
      return pool;
    }
    
    // 2. Try normalized asset first (e.g., ETH.USDC)
    pool = pools.find(p => p.asset === normalizedAsset);
    if (pool) {
      if (isETH) console.log('Found pool by normalized asset:', pool.asset);
      return pool;
    }
    
    // 3. Try pool format of normalized asset
    pool = pools.find(p => p.asset === poolFormatNormalized);
    if (pool) {
      if (isETH) console.log('Found pool by pool format normalized:', pool.asset);
      return pool;
    }
    
    // 4. Try original asset format (fallback)
    pool = pools.find(p => p.asset === asset);
    if (pool) {
      if (isETH) console.log('Found pool by original asset:', pool.asset);
      return pool;
    }
    
    // 5. Try finding any pool asset that when normalized matches our asset
    pool = pools.find(p => normalizeAsset(p.asset) === normalizedAsset);
    if (pool) {
      if (isETH) console.log('Found pool by normalized match:', pool.asset);
      return pool;
    }
    
    if (isETH) {
      console.log('No pool found.');
      console.log('Tried formats:', [poolFormatAsset, normalizedAsset, poolFormatNormalized, asset]);
      console.log('Available ETH pools:', pools.filter(p => p.asset.includes('ETH')).map(p => p.asset));
      console.log('Available USDC pools:', pools.filter(p => p.asset.includes('USDC')).map(p => p.asset));
      console.log('Available DAI pools:', pools.filter(p => p.asset.includes('DAI')).map(p => p.asset));
    }
    
    return null;
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
    if (!pool || !pool.balance_asset || !pool.asset_tor_price) {
      console.log('Pool depth calculation failed:', { pool, hasBalance: !!pool?.balance_asset, hasPrice: !!pool?.asset_tor_price });
      return 0;
    }
    const balanceAsset = parseInt(pool.balance_asset) / 1e8;
    const assetPrice = parseInt(pool.asset_tor_price) / 1e8;
    const depth = 2 * balanceAsset * assetPrice;
    
    // Debug logging for ETH assets
    if (pool.asset && pool.asset.includes('ETH') && (pool.asset.includes('USDC') || pool.asset.includes('DAI'))) {
      console.log('Pool depth calculation for', pool.asset, ':', { balanceAsset, assetPrice, depth });
    }
    
    return depth;
  }


  function getAssetPriceUSD(asset) {
    if (!asset) return null;
    
    // Normalize the asset for consistent lookups
    const normalizedAsset = normalizeAsset(asset);
    
    // Debug logging for ETH assets
    if (asset.includes('ETH') && (asset.includes('USDC') || asset.includes('DAI'))) {
      console.log('=== PRICE LOOKUP DEBUG ===');
      console.log('Original asset:', asset);
      console.log('Normalized asset:', normalizedAsset);
      console.log('All ETH pool mappings:', Array.from(poolPrices.entries()).filter(([k, v]) => k.includes('ETH') && (k.includes('USDC') || k.includes('DAI'))));
      console.log('Has normalized?', poolPrices.has(normalizedAsset));
      console.log('Has original?', poolPrices.has(asset));
    }
    
    // Try normalized asset first
    if (poolPrices.has(normalizedAsset)) {
      return poolPrices.get(normalizedAsset);
    }
    
    // Try original asset as fallback
    if (poolPrices.has(asset)) {
      return poolPrices.get(asset);
    }
    
    // Fallback to pool data search with normalized asset
    const pool = getPoolByAsset(normalizedAsset);
    if (pool && pool.asset_tor_price) {
      return parseInt(pool.asset_tor_price) / 1e8;
    }
    
    // Final fallback: search pools with original asset name
    const originalPool = pools.find(pool => pool.asset === asset);
    if (originalPool && originalPool.asset_tor_price) {
      return parseInt(originalPool.asset_tor_price) / 1e8;
    }
    
    return null;
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
      const fromAsset = swap.swap.tx.coins[0].asset || 'THOR.RUNE';
      const toAsset = swap.swap.target_asset;
      const amount = swap.swap.tx.coins[0].amount; // Already in 1e8 format
      const destination = swap.swap.destination;
      
      // Use streaming parameters from the swap state
      const streamingInterval = swap.swap.state?.interval || "0";
      const streamingQuantity = swap.swap.state?.quantity || "4";

      // Build the quote URL for mainnet
      let url = `${MAINNET_API}/quote/swap?`;
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

  // Update filtered pairs for summary screen
  function updateFilteredPairs() {
    if (!limitSwapsSummary?.asset_pairs || !Array.isArray(limitSwapsSummary.asset_pairs)) {
      filteredPairs = [];
      return;
    }
    
    filteredPairs = limitSwapsSummary.asset_pairs.filter(pair => {
      if (summarySearchTerm === '') return true;
      
      const searchLower = summarySearchTerm.toLowerCase();
      const sourceAsset = getAssetDisplay(pair.source_asset).toLowerCase();
      const targetAsset = getAssetDisplay(pair.target_asset).toLowerCase();
      const sourceChain = getChainFromAsset(pair.source_asset).toLowerCase();
      const targetChain = getChainFromAsset(pair.target_asset).toLowerCase();
      
      return sourceAsset.includes(searchLower) || 
             targetAsset.includes(searchLower) ||
             sourceChain.includes(searchLower) ||
             targetChain.includes(searchLower) ||
             pair.source_asset.toLowerCase().includes(searchLower) ||
             pair.target_asset.toLowerCase().includes(searchLower);
    });
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
  
  // Reactive statements for filtering
  $: {
    limitSwapsSummary;
    summarySearchTerm;
    updateFilteredPairs();
  }
  
  $: {
    limitSwaps;
    searchTerm;
    selectedFilter;
    updateFilteredSwaps();
  }
</script>

<div class="orderbooks-container">
  <div class="header">
    <h1>THORChain Orderbooks</h1>
    <p class="subtitle">Monitor active limit swaps on THORChain mainnet</p>
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
          <h2>Trading Pairs ({filteredPairs.length} of {limitSwapsSummary?.asset_pairs?.length || 0})</h2>
          <button on:click={loadData} class="refresh-btn" title="Refresh Data">
            🔄
          </button>
        </div>
        
        <!-- Search for pairs -->
        <div class="summary-search">
          <input 
            type="text" 
            placeholder="Search pairs by asset name or chain..." 
            bind:value={summarySearchTerm}
            class="summary-search-input"
          />
        </div>
        
        {#if filteredPairs.length > 0}
          <div class="pairs-table">
            <div class="table-header">
              <div class="header-cell">Source Asset</div>
              <div class="header-cell">Target Asset</div>
              <div class="header-cell">Current Ratio</div>
              <div class="header-cell">Count</div>
              <div class="header-cell">Total Value (USD)</div>
              <div class="header-cell">Action</div>
            </div>
            {#each filteredPairs as pair, i}
              <div 
                class="table-row" 
                in:fly={{ y: 20, duration: 300, delay: i * 100 }}
              >
                <div class="cell">
                  <div class="asset-info">
                    <span class="asset-name">{getAssetDisplay(pair.source_asset)}</span>
                    <div class="asset-badges">
                      <span class="chain-badge">{getChainFromAsset(pair.source_asset)}</span>
                      <span class="asset-type-badge asset-type-{getAssetType(pair.source_asset)}">{getAssetType(pair.source_asset)}</span>
                    </div>
                  </div>
                </div>
                <div class="cell">
                  <div class="asset-info">
                    <span class="asset-name">{getAssetDisplay(pair.target_asset)}</span>
                    <div class="asset-badges">
                      <span class="chain-badge">{getChainFromAsset(pair.target_asset)}</span>
                      <span class="asset-type-badge asset-type-{getAssetType(pair.target_asset)}">{getAssetType(pair.target_asset)}</span>
                    </div>
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
        {:else if limitSwapsSummary?.asset_pairs?.length > 0}
          <div class="no-pairs">
            <p>No trading pairs match your search</p>
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
                      <div class="asset-with-type">
                        <span class="from-asset">{getAssetDisplay(swap.swap?.tx?.coins?.[0]?.asset || 'THOR.RUNE')}</span>
                        <span class="asset-type-badge asset-type-{getAssetType(swap.swap?.tx?.coins?.[0]?.asset || 'THOR.RUNE')}">{getAssetType(swap.swap?.tx?.coins?.[0]?.asset || 'THOR.RUNE')}</span>
                      </div>
                      <span class="arrow">→</span>
                      <div class="asset-with-type">
                        <span class="to-asset">{getAssetDisplay(swap.swap?.target_asset)}</span>
                        <span class="asset-type-badge asset-type-{getAssetType(swap.swap?.target_asset)}">{getAssetType(swap.swap?.target_asset)}</span>
                      </div>
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
                      <span class="value">{formatAmount(swap.swap?.tx?.coins?.[0]?.amount)} {getAssetDisplay(swap.swap?.tx?.coins?.[0]?.asset || 'THOR.RUNE')}</span>
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
                          {testingQuote.has(swap.swap?.tx?.id) ? '⏳' : '🏃'}
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

  .summary-search {
    margin-bottom: 1.5rem;
  }

  .summary-search-input {
    width: 100%;
    padding: 0.75rem;
    background: var(--surface-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-color);
    font-size: 1rem;
    max-width: 400px;
  }

  .summary-search-input::placeholder {
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

  .asset-badges {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .chain-badge {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-muted);
    width: fit-content;
  }

  .asset-type-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
    width: fit-content;
  }

  .asset-type-native {
    background: rgba(76, 175, 80, 0.2);
    color: #4CAF50;
    border: 1px solid rgba(76, 175, 80, 0.3);
  }

  .asset-type-secured {
    background: rgba(255, 193, 7, 0.2);
    color: #FFC107;
    border: 1px solid rgba(255, 193, 7, 0.3);
  }

  .asset-type-trade {
    background: rgba(156, 39, 176, 0.2);
    color: #9C27B0;
    border: 1px solid rgba(156, 39, 176, 0.3);
  }

  .asset-type-unknown {
    background: rgba(158, 158, 158, 0.2);
    color: #9E9E9E;
    border: 1px solid rgba(158, 158, 158, 0.3);
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
    background: linear-gradient(135deg, rgba(255, 62, 0, 0.15), rgba(255, 62, 0, 0.05));
    color: var(--primary-color);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid rgba(255, 62, 0, 0.2);
    text-align: center;
    backdrop-filter: blur(4px);
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
    grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr));
    gap: 1.25rem;
  }

  @media (min-width: 1200px) {
    .swaps-grid {
      grid-template-columns: repeat(3, 1fr);
      max-width: none;
    }
  }

  @media (min-width: 768px) and (max-width: 1199px) {
    .swaps-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 767px) {
    .swaps-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .swap-card {
      padding: 1rem;
    }
  }

  .swap-card {
    background: linear-gradient(135deg, var(--surface-color), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .swap-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 62, 0, 0.3);
  }

  .swap-header {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .swap-pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .asset-with-type {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
    flex: 1;
  }

  .from-asset, .to-asset {
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: -0.02em;
  }

  .from-asset {
    color: var(--primary-color);
  }

  .to-asset {
    color: #4CAF50;
  }

  .arrow {
    color: var(--text-color);
    font-size: 1.4rem;
    font-weight: 300;
    opacity: 0.7;
    transition: all 0.2s ease;
    padding: 0.4rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    min-width: 2.4rem;
    height: 2.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .swap-card:hover .arrow {
    opacity: 1;
    background: rgba(255, 62, 0, 0.1);
    color: var(--primary-color);
    transform: scale(1.1);
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
    background: rgba(255, 255, 255, 0.02);
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .detail-row:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .detail-row .label {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 80px;
  }

  .detail-row .value {
    color: var(--text-color);
    font-weight: 600;
    text-align: right;
    flex: 1;
  }

  .detail-row .value.address {
    font-family: monospace;
    font-size: 0.85rem;
  }

  .swap-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.1);
    margin: 0 -1.25rem -1.25rem -1.25rem;
    padding: 1rem 1.25rem;
    border-radius: 0 0 12px 12px;
  }

  .tx-id {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .tx-id .value.tx {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .tx-actions {
    display: flex;
    gap: 0.75rem;
    margin-left: 1rem;
  }

  .tx-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
    color: var(--text-color);
    font-weight: 500;
    min-width: 2.2rem;
    text-align: center;
    backdrop-filter: blur(4px);
  }

  .tx-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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