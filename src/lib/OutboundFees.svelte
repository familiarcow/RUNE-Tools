<script>
  import { onMount } from 'svelte';

  let outboundFees = [];
  let prices = {};
  let mimirData = {};
  let isLoading = true;
  let error = null;
  let sortField = 'outbound_fee';
  let sortDirection = 'desc';
  let searchQuery = '';

  // Asset logos mapping - merged from SwapEstimator.svelte and PriceChecker.svelte
  const assetLogos = {
    'BTC.BTC': 'assets/coins/bitcoin-btc-logo.svg',
    'ETH.ETH': 'assets/coins/ethereum-eth-logo.svg',
    'BSC.BNB': 'assets/coins/binance-coin-bnb-logo.svg',
    'BCH.BCH': 'assets/coins/bitcoin-cash-bch-logo.svg',
    'LTC.LTC': 'assets/coins/litecoin-ltc-logo.svg',
    'AVAX.AVAX': 'assets/coins/avalanche-avax-logo.svg',
    'GAIA.ATOM': 'assets/coins/cosmos-atom-logo.svg',
    'DOGE.DOGE': 'assets/coins/dogecoin-doge-logo.svg',
    'THOR.RUNE': 'assets/coins/RUNE-ICON.svg',
    'THOR.TCY': 'assets/coins/TCY.svg',
    'SOL.SOL': 'assets/coins/solana-sol-logo.svg',
    'BASE.ETH': 'assets/coins/ethereum-eth-logo.svg',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
    'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'assets/coins/aave-aave-logo.svg',
    'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'assets/coins/chainlink-link-logo.svg',
    'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': 'assets/coins/synthetix-snx-logo.svg',
    'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'assets/coins/fox-token-fox-logo.svg',
    'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': 'assets/coins/dpi-logo.png',
    'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'assets/coins/thorswap-logo.png',
    'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': 'assets/coins/thorswap-logo.png',
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'assets/coins/xrune-logo.png',
    'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': 'assets/coins/tgt-logo.png',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg',
    'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': 'assets/coins/solana-sol-logo.svg',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
    'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': 'assets/coins/twt-logo.png',
    'BNB.BUSD-BD1': 'assets/coins/binance-usd-busd-logo.svg',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': 'assets/coins/usd-coin-usdc-logo.svg',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'assets/coins/coinbase-wrapped-btc-logo.svg'
  };


  const API_ENDPOINTS = {
    primary: 'https://thornode.ninerealms.com',
    fallback: 'https://thornode.thorchain.liquify.com'
  };

  // Fetch data from API with automatic fallback
  const fetchWithFallback = async (endpoint, options = {}) => {
    const primaryUrl = `${API_ENDPOINTS.primary}${endpoint}`;
    const fallbackUrl = `${API_ENDPOINTS.fallback}${endpoint}`;
    
    try {
      // Try primary endpoint first
      const response = await fetch(primaryUrl, options);
      if (response.ok) {
        return response;
      }
      throw new Error(`Primary endpoint failed: ${response.status}`);
    } catch (error) {
      console.warn(`Primary endpoint failed, trying fallback: ${error.message}`);
      
      try {
        // Try fallback endpoint
        const fallbackResponse = await fetch(fallbackUrl, options);
        if (fallbackResponse.ok) {
          console.log(`Using fallback endpoint for: ${endpoint}`);
          return fallbackResponse;
        }
        throw new Error(`Fallback endpoint failed: ${fallbackResponse.status}`);
      } catch (fallbackError) {
        console.error(`Both endpoints failed for ${endpoint}:`, fallbackError);
        throw fallbackError;
      }
    }
  };

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Format amount (divide by 1e8)
  const formatAmount = (amount) => {
    if (!amount) return '0';
    return formatNumber((Number(amount) / 1e8).toFixed(8));
  };

  // Format amount without decimals (for surplus display)
  const formatAmountNoDecimals = (amount) => {
    if (!amount) return '0';
    return formatNumber(Math.round(Number(amount) / 1e8));
  };

  // Format outbound fee amount (divide by 1e8 but don't round)
  const formatOutboundFee = (amount) => {
    if (!amount) return '0';
    const value = Number(amount) / 1e8;
    // Use toLocaleString with maximum precision to avoid rounding
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 20 
    });
  };

  // Format USD amount
  const formatUSD = (amount) => {
    if (!amount || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  // Calculate outbound fee in USD
  const calculateFeeUSD = (asset, outboundFee) => {
    const assetPrice = prices[asset];
    if (!assetPrice || !outboundFee) return 0;
    
    const feeAmount = Number(outboundFee) / 1e8; // Convert fee to decimal
    const priceUSD = Number(assetPrice) / 1e8; // Convert price to USD
    
    return feeAmount * priceUSD;
  };

  // Format percentage from basis points (divide by 10000)
  const formatPercentage = (basisPoints) => {
    if (!basisPoints) return '0';
    return ((Number(basisPoints) / 10000) * 100).toFixed(2);
  };

  // Format mimir basis points to percentage (divide by 100)
  const formatMimirPercentage = (basisPoints) => {
    if (!basisPoints) return '0';
    return (Number(basisPoints) / 100).toFixed(1);
  };

  // Get short asset name with chain (e.g., "BTC.BTC" -> "BTC", "ETH.USDC-0X..." -> "USDC (ETH)")
  const getShortAssetName = (asset) => {
    if (asset === 'THOR.RUNE') return 'RUNE';
    
    const parts = asset.split(/\.|-/);
    const [chain, assetName] = parts;
    
    if (assetName === 'ETH') {
      return `${assetName} (${chain})`;
    } else if (["ETH", "BSC", "AVAX", "BASE"].includes(chain) && parts[2]) {
      return `${assetName} (${chain})`;
    } else {
      return assetName || asset;
    }
  };

  // Get asset logo (returns undefined if no logo exists)
  const getAssetLogo = (asset) => {
    return assetLogos[asset];
  };

  // Sort function
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      
      switch (field) {
        case 'asset':
          comparison = getShortAssetName(a.asset).localeCompare(getShortAssetName(b.asset));
          break;
        case 'outbound_fee':
        case 'fee_withheld_rune':
        case 'fee_spent_rune':
        case 'surplus_rune':
          const aVal = Number(a[field]) || 0;
          const bVal = Number(b[field]) || 0;
          comparison = bVal - aVal;
          break;
        case 'outbound_fee_usd':
          const aUSD = calculateFeeUSD(a.asset, a.outbound_fee);
          const bUSD = calculateFeeUSD(b.asset, b.outbound_fee);
          comparison = bUSD - aUSD;
          break;
        case 'dynamic_multiplier_basis_points':
          const aMultiplier = Number(a.dynamic_multiplier_basis_points) || 0;
          const bMultiplier = Number(b.dynamic_multiplier_basis_points) || 0;
          comparison = bMultiplier - aMultiplier;
          break;
        default:
          return 0;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  // Handle sort click
  const handleSort = (field) => {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'desc';
    }
    
    outboundFees = sortData(outboundFees, sortField, sortDirection);
  };

  // Filter data based on search query
  const filterData = (data, query) => {
    if (!query) return data;
    
    const searchTerm = query.toLowerCase().trim();
    return data.filter(fee => 
      fee.asset.toLowerCase().includes(searchTerm) ||
      getShortAssetName(fee.asset).toLowerCase().includes(searchTerm)
    );
  };

  // Reactive statement for filtered data
  $: filteredFees = filterData(outboundFees, searchQuery);

  // Calculate total surplus (fee_withheld_rune - fee_spent_rune)
  $: totalSurplus = (() => {
    let totalWithheld = 0;
    let totalSpent = 0;
    
    filteredFees.forEach(fee => {
      if (fee.fee_withheld_rune) {
        totalWithheld += Number(fee.fee_withheld_rune);
      }
      if (fee.fee_spent_rune) {
        totalSpent += Number(fee.fee_spent_rune);
      }
    });
    
    return totalWithheld - totalSpent;
  })();

  // Fetch outbound fees data
  const fetchOutboundFees = async () => {
    try {
      isLoading = true;
      error = null;
      
      // Fetch outbound fees, pools, and mimir data in parallel
      const [feesResponse, poolsResponse, mimirResponse] = await Promise.all([
        fetchWithFallback('/thorchain/outbound_fees'),
        fetchWithFallback('/thorchain/pools'),
        fetchWithFallback('/thorchain/mimir')
      ]);
      
      const feesData = await feesResponse.json();
      const poolsData = await poolsResponse.json();
      const mimirDataResponse = await mimirResponse.json();
      
      // Create price mapping from pools data
      const priceMap = {};
      poolsData.forEach(pool => {
        priceMap[pool.asset] = pool.asset_tor_price;
      });
      
      prices = priceMap;
      mimirData = mimirDataResponse;
      outboundFees = sortData(feesData, sortField, sortDirection);
      isLoading = false;
    } catch (err) {
      console.error('Error fetching outbound fees:', err);
      error = 'Failed to fetch outbound fees data';
      isLoading = false;
    }
  };

  onMount(async () => {
    await fetchOutboundFees();
  });
</script>

<div class="outbound-fees-container">
  <div class="header-controls">
    <div class="search-container">
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search by asset name..."
        class="search-input"
      />
      {#if searchQuery}
        <button 
          class="clear-search" 
          on:click={() => searchQuery = ''}
          title="Clear search"
        >
          ×
        </button>
      {/if}
    </div>
    <div class="controls-right">
      <div class="total-surplus-display" title="Total surplus: Fee Withheld - Fee Spent (RUNE)">
        <span class="surplus-amount">{formatAmountNoDecimals(totalSurplus)}</span>
        <span class="surplus-label">RUNE Surplus</span>
        <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="surplus-icon" />
      </div>
      <div class="total-assets-display" title="Total number of assets with outbound fees">
        <span class="assets-count">{filteredFees.length}</span>
        <span class="assets-label">Assets</span>
      </div>
    </div>
  </div>

  <!-- Mimir Values Display -->
  {#if mimirData && Object.keys(mimirData).length > 0}
    <div class="mimir-display">
      <h3>Network Parameters</h3>
      <div class="mimir-values">
        <div class="mimir-item">
          <span class="mimir-label">Min Fee Multiplier:</span>
          <span class="mimir-value">{formatMimirPercentage(mimirData.MINOUTBOUNDFEEMULTIPLIERBASISPOINTS)}%</span>
        </div>
        <div class="mimir-item">
          <span class="mimir-label">Max Fee Multiplier:</span>
          <span class="mimir-value">{formatMimirPercentage(mimirData.MAXOUTBOUNDFEEMULTIPLIERBASISPOINTS)}%</span>
        </div>
        <div class="mimir-item">
          <span class="mimir-label">Target Surplus:</span>
          <span class="mimir-value rune-target">
            {formatAmountNoDecimals(mimirData.TARGETOUTBOUNDFEESURPLUSRUNE)}
            <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="mimir-rune-icon" />
          </span>
        </div>
      </div>
    </div>
  {/if}

  <h2>Outbound Fees</h2>

  {#if isLoading}
    <div class="loading-container">
      <div class="loading-text">Loading outbound fees...</div>
    </div>
  {:else if error}
    <div class="error-container">
      <div class="error-text">{error}</div>
      <button class="retry-button" on:click={fetchOutboundFees}>Retry</button>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th title="Asset">#</th>
            <th 
              class="sortable" 
              title="Asset name"
              on:click={() => handleSort('asset')}
            >
              Asset
              {#if sortField === 'asset'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Outbound fee amount"
              on:click={() => handleSort('outbound_fee')}
            >
              Outbound Fee
              {#if sortField === 'outbound_fee'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Outbound fee in USD"
              on:click={() => handleSort('outbound_fee_usd')}
            >
              Fee (USD)
              {#if sortField === 'outbound_fee_usd'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Fee withheld in RUNE"
              on:click={() => handleSort('fee_withheld_rune')}
            >
              Fee Withheld (RUNE)
              {#if sortField === 'fee_withheld_rune'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Fee spent in RUNE"
              on:click={() => handleSort('fee_spent_rune')}
            >
              Fee Spent (RUNE)
              {#if sortField === 'fee_spent_rune'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Surplus in RUNE"
              on:click={() => handleSort('surplus_rune')}
            >
              Surplus (RUNE)
              {#if sortField === 'surplus_rune'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
            <th 
              class="sortable" 
              title="Dynamic multiplier percentage"
              on:click={() => handleSort('dynamic_multiplier_basis_points')}
            >
              Dynamic Multiplier
              {#if sortField === 'dynamic_multiplier_basis_points'}
                <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              {/if}
            </th>
          </tr>
        </thead>
        <tbody>
          {#each filteredFees as fee, i}
            <tr class="main-row">
              <td class="number-cell">{i + 1}</td>
              <td class="asset-cell">
                <div class="asset-info">
                  {#if getAssetLogo(fee.asset)}
                    <img 
                      src={getAssetLogo(fee.asset)} 
                      alt={getShortAssetName(fee.asset)}
                      class="asset-logo"
                      loading="lazy"
                    />
                  {/if}
                  <span class="asset-name">{getShortAssetName(fee.asset)}</span>
                </div>
              </td>
              <td class="amount-cell">
                <span class="outbound-fee-amount">
                  {formatOutboundFee(fee.outbound_fee)}
                  {#if getAssetLogo(fee.asset)}
                    <img 
                      src={getAssetLogo(fee.asset)} 
                      alt={getShortAssetName(fee.asset)}
                      class="fee-asset-icon"
                      loading="lazy"
                    />
                  {/if}
                </span>
              </td>
              <td class="amount-cell">
                <span class="usd-amount">
                  {formatUSD(calculateFeeUSD(fee.asset, fee.outbound_fee))}
                </span>
              </td>
              <td class="amount-cell">
                {#if fee.fee_withheld_rune}
                  <span class="rune-amount">
                    {formatAmount(fee.fee_withheld_rune)}
                    <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                {:else}
                  <span class="no-value">-</span>
                {/if}
              </td>
              <td class="amount-cell">
                {#if fee.fee_spent_rune}
                  <span class="rune-amount">
                    {formatAmount(fee.fee_spent_rune)}
                    <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                {:else}
                  <span class="no-value">-</span>
                {/if}
              </td>
              <td class="amount-cell">
                {#if fee.surplus_rune}
                  <span class="rune-amount">
                    {formatAmount(fee.surplus_rune)}
                    <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                {:else}
                  <span class="no-value">-</span>
                {/if}
              </td>
              <td class="multiplier-cell">
                {#if fee.dynamic_multiplier_basis_points}
                  <span class="multiplier-value">
                    {formatPercentage(fee.dynamic_multiplier_basis_points)}%
                  </span>
                {:else}
                  <span class="no-value">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  /* Container styles with modern design */
  .outbound-fees-container {
    padding: 16px 128px;
    max-width: 100%;
    width: 100%;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  /* Remove side padding below 1462px */
  @media (max-width: 1462px) {
    .outbound-fees-container {
      padding: 16px 0;
    }
  }

  h2 {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 12px;
    margin: 32px 0 12px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: #FFFFFF;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    text-align: center;
    position: relative;
    overflow: hidden;
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

  h3 {
    color: #ffffff;
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: -0.1px;
  }

  /* First h2 should have less top margin */
  h2:first-of-type {
    margin-top: 16px;
  }

  .mimir-display {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    margin: 16px 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .mimir-display:hover {
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .mimir-values {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
  }

  .mimir-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
    text-align: center;
  }

  .mimir-label {
    color: #a0a0a0;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .mimir-value {
    color: #ffffff;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.1px;
  }

  .rune-target {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #69db7c !important;
  }

  .mimir-rune-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 16px;
  }

  .search-container {
    position: relative;
    flex-grow: 1;
    max-width: 400px;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .search-input::placeholder {
    color: #a0a0a0;
  }

  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #a0a0a0;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .clear-search:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-50%) scale(1.1);
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .total-surplus-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(105, 219, 124, 0.3);
    color: #69db7c;
    font-size: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .total-surplus-display:hover {
    background: rgba(105, 219, 124, 0.1);
    border-color: rgba(105, 219, 124, 0.5);
    transform: translateY(-1px);
  }

  .surplus-amount {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
  }

  .surplus-label {
    font-weight: 600;
    font-family: inherit;
  }

  .surplus-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .total-assets-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #6366f1;
    font-size: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .total-assets-display:hover {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.5);
    transform: translateY(-1px);
  }

  .assets-count {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
  }

  .assets-label {
    font-weight: 600;
    font-family: inherit;
  }

  .loading-container, .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin: 24px 0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .loading-text {
    color: #a0a0a0;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    margin-bottom: 16px;
  }

  .error-text {
    color: #dc3545;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    margin-bottom: 16px;
  }

  .retry-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    cursor: pointer;
    font-weight: 600;
    font-family: inherit;
    font-size: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .retry-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }

  .retry-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .table-container {
    margin-bottom: 32px;
    overflow-x: auto;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    border-radius: 12px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0 1px;
    width: 100%;
    display: block;
    -webkit-overflow-scrolling: touch;
  }

  /* Webkit scrollbar styles */
  .table-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .table-container::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: #4a4a4a;
    border-radius: 4px;
    border: 2px solid #1a1a1a;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #666;
  }

  .table-container::-webkit-scrollbar-corner {
    background: #1a1a1a;
  }

  /* Firefox scrollbar styles */
  .table-container {
    scrollbar-width: thin;
    scrollbar-color: #4a4a4a #1a1a1a;
  }

  table {
    width: max-content;
    min-width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background-color: transparent;
    font-size: 14px;
    line-height: 1.4;
    table-layout: fixed;
    font-family: inherit;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  th {
    background: #1a1a1a;
    color: #ffffff;
    font-weight: 600;
    font-family: inherit;
    padding: 8px 8px;
    text-align: center;
    border-bottom: 2px solid #667eea;
    border-right: 1px solid #3a3a3c;
    font-size: 13px;
    letter-spacing: 0.5px;
    white-space: nowrap;
    text-transform: uppercase;
    transition: all 0.2s ease;
  }

  th:last-child {
    border-right: none;
  }

  th:hover {
    background: #2a2a2a;
    color: #667eea;
  }

  td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    vertical-align: middle;
    font-family: inherit;
  }

  /* Alternating row colors */
  tr.main-row {
    background: #2c2c2c;
    transition: all 0.2s ease;
  }

  tr.main-row:nth-child(even) {
    background: #252525;
  }

  .main-row:hover {
    background: #3a3a3a !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  /* Column width controls */
  th:nth-child(1), td:nth-child(1) { 
    width: 40px !important; 
    min-width: 40px !important; 
    max-width: 40px !important;
    padding: 6px 0 !important;
    text-align: center !important;
  }
  th:nth-child(2), td:nth-child(2) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }
  th:nth-child(3), td:nth-child(3) { width: 140px !important; min-width: 140px !important; max-width: 140px !important; }
  th:nth-child(4), td:nth-child(4) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }
  th:nth-child(5), td:nth-child(5) { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
  th:nth-child(6), td:nth-child(6) { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
  th:nth-child(7), td:nth-child(7) { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
  th:nth-child(8), td:nth-child(8) { width: 140px !important; min-width: 140px !important; max-width: 140px !important; }

  /* Force all cells to maintain their layout */
  th, td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
  }

  .number-cell {
    text-align: center !important;
  }

  .asset-cell {
    text-align: left !important;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }

  .asset-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .asset-name {
    color: #ffffff;
    font-weight: 600;
    font-size: 14px;
    font-family: inherit;
    letter-spacing: -0.1px;
  }

  .amount-cell {
    text-align: right !important;
  }



  .outbound-fee-amount {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    font-family: inherit;
    font-size: 13px;
    color: #ffffff;
    font-weight: 600;
    min-height: 16px;
  }

  .fee-asset-icon {
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .usd-amount {
    font-family: inherit;
    font-size: 13px;
    color: #69db7c;
    font-weight: 600;
  }

  .rune-amount {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    font-family: inherit;
    font-size: 13px;
    color: #ffffff;
    font-weight: 600;
  }

  .rune-icon {
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .multiplier-cell {
    text-align: center !important;
  }

  .multiplier-value {
    color: #69db7c;
    font-weight: 600;
    font-size: 14px;
    font-family: inherit;
  }

  .no-value {
    color: #a0a0a0;
    font-style: italic;
    font-family: inherit;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
    position: relative;
    padding-right: 20px !important;
    text-align: center !important;
  }

  .sortable:hover {
    background: #2a2a2a;
    color: #667eea;
  }

  .sort-indicator {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    color: #667eea;
    font-size: 12px;
    font-weight: 700;
  }

  .sortable:hover .sort-indicator {
    color: #ffffff;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .outbound-fees-container {
      padding: 8px;
    }

    .header-controls {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .controls-right {
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
    }

    .total-surplus-display {
      flex: 1 1 calc(50% - 4px);
      min-width: 160px;
      font-size: 0.75rem;
    }

    .surplus-amount {
      font-size: 0.75rem;
    }

    .total-assets-display {
      flex: 1 1 calc(50% - 4px);
      min-width: 140px;
      font-size: 0.75rem;
    }

    .assets-count {
      font-size: 0.75rem;
    }

    .mimir-display {
      margin: 16px -8px;
      border-radius: 0;
      width: 100vw;
      position: relative;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 16px;
    }

    .mimir-values {
      gap: 16px;
    }

    .mimir-item {
      min-width: 140px;
    }

    .table-container {
      margin: 0 -8px 32px -8px;
      border-radius: 0;
      max-height: none;
      width: 100vw;
      position: relative;
      left: 50%;
      transform: translateX(-50%);
    }

    table {
      font-size: 0.8125rem;
    }

    th, td {
      padding: 6px 4px;
    }
  }

  /* iOS specific fixes */
  @supports (-webkit-touch-callout: none) {
    .table-container {
      overflow-x: scroll;
      -webkit-overflow-scrolling: touch;
    }
    
    table {
      transform: translateZ(0);
    }
  }
</style>
