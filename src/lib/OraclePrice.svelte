<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { fetchJSONWithFallback } from '$lib/utils/api';
  import { getAllPools } from '$lib/utils/liquidity';
  import { fromBaseUnit } from '$lib/utils/blockchain';

  const oraclePrices = writable({});
  const poolPrices = writable({});
  const runePrice = writable(null);
  const loading = writable(true);

  // Function to map any asset to oracle symbol
  function getOracleSymbolForAsset(asset) {
    const upperAsset = asset.toUpperCase();
    
    // Direct matches for native assets - these SHOULD be compared to oracle
    const nativeAssetMappings = {
      'BTC.BTC': 'BTC',
      'ETH.ETH': 'ETH', 
      'BSC.BNB': 'BNB',
      'BCH.BCH': 'BCH',
      'LTC.LTC': 'LTC',
      'AVAX.AVAX': 'AVAX',
      'GAIA.ATOM': 'ATOM',
      'DOGE.DOGE': 'DOGE',
      'XRP.XRP': 'XRP',
      'TRX.TRX': 'TRX'
    };
    
    // First check exact native asset matches
    if (nativeAssetMappings[upperAsset]) {
      return nativeAssetMappings[upperAsset];
    }
    
    // Special case: RUNE is handled separately with network price
    if (upperAsset === 'THOR.RUNE') {
      return null; // RUNE handled separately
    }
    
    // Check for WRAPPED/TOKENIZED versions on OTHER chains
    // BTC wrapped tokens (not native BTC.BTC)
    if (upperAsset.includes('WBTC') || upperAsset.includes('BTCB') || 
        (upperAsset.includes('BTC') && !upperAsset.startsWith('BTC.'))) {
      return 'BTC';
    }
    
    // ETH wrapped tokens (not native ETH.ETH) 
    if (upperAsset.includes('WETH') || 
        (upperAsset.includes('ETH') && !upperAsset.startsWith('ETH.'))) {
      return 'ETH';
    }
    
    // Stablecoins on any chain
    if (upperAsset.includes('USDC')) {
      return 'USDC';
    }
    if (upperAsset.includes('USDT')) {
      return 'USDT';
    }
    
    // Cross-chain wrapped tokens
    if (upperAsset.includes('SOL') && !upperAsset.startsWith('SOL.')) {
      return 'SOL';
    }
    if (upperAsset.includes('AVAX') && !upperAsset.startsWith('AVAX.')) {
      return 'AVAX';
    }
    if (upperAsset.includes('BNB') && !upperAsset.startsWith('BSC.')) {
      return 'BNB';
    }
    if (upperAsset.includes('ATOM') && !upperAsset.startsWith('GAIA.')) {
      return 'ATOM';
    }
    if (upperAsset.includes('DOGE') && !upperAsset.startsWith('DOGE.')) {
      return 'DOGE';
    }
    if (upperAsset.includes('LTC') && !upperAsset.startsWith('LTC.')) {
      return 'LTC';
    }
    if (upperAsset.includes('BCH') && !upperAsset.startsWith('BCH.')) {
      return 'BCH';
    }
    if (upperAsset.includes('XRP') && !upperAsset.startsWith('XRP.')) {
      return 'XRP';
    }
    if (upperAsset.includes('TRX') && !upperAsset.startsWith('TRX.')) {
      return 'TRX';
    }
    
    return null;
  }

  // Function to get appropriate logo for any asset
  function getAssetLogo(asset, oracleSymbol) {
    const upperAsset = asset.toUpperCase();
    
    // First try exact asset match
    const exactLogos = {
      'BTC.BTC': 'assets/coins/bitcoin-btc-logo.svg',
      'ETH.ETH': 'assets/coins/ethereum-eth-logo.svg',
      'BSC.BNB': 'assets/coins/binance-coin-bnb-logo.svg',
      'BCH.BCH': 'assets/coins/bitcoin-cash-bch-logo.svg',
      'LTC.LTC': 'assets/coins/litecoin-ltc-logo.svg',
      'AVAX.AVAX': 'assets/coins/avalanche-avax-logo.svg',
      'GAIA.ATOM': 'assets/coins/cosmos-atom-logo.svg',
      'DOGE.DOGE': 'assets/coins/dogecoin-doge-logo.svg',
      'THOR.RUNE': 'assets/coins/RUNE-ICON.svg',
      'XRP.XRP': 'assets/chains/XRP.svg',
      'TRX.TRX': 'assets/coins/fallback-logo.svg'
    };
    
    if (exactLogos[upperAsset]) {
      return exactLogos[upperAsset];
    }
    
    // Use oracle symbol to determine logo for wrapped/tokenized assets
    const symbolLogos = {
      'BTC': 'assets/coins/bitcoin-btc-logo.svg',
      'ETH': 'assets/coins/ethereum-eth-logo.svg',
      'BNB': 'assets/coins/binance-coin-bnb-logo.svg',
      'BCH': 'assets/coins/bitcoin-cash-bch-logo.svg',
      'LTC': 'assets/coins/litecoin-ltc-logo.svg',
      'AVAX': 'assets/coins/avalanche-avax-logo.svg',
      'ATOM': 'assets/coins/cosmos-atom-logo.svg',
      'DOGE': 'assets/coins/dogecoin-doge-logo.svg',
      'RUNE': 'assets/coins/RUNE-ICON.svg',
      'SOL': 'assets/coins/solana-sol-logo.svg',
      'XRP': 'assets/chains/XRP.svg',
      'USDC': 'assets/coins/usd-coin-usdc-logo.svg',
      'USDT': 'assets/coins/tether-usdt-logo.svg',
      'TRX': 'assets/coins/fallback-logo.svg'
    };
    
    return symbolLogos[oracleSymbol] || 'assets/coins/fallback-logo.svg';
  }

  // Chain logos mapping
  const chainLogos = {
    'BTC': 'assets/chains/BTC.svg',
    'ETH': 'assets/chains/ETH.svg',
    'BSC': 'assets/chains/BSC.svg',
    'BCH': 'assets/chains/BCH.svg',
    'LTC': 'assets/chains/LTC.svg',
    'AVAX': 'assets/chains/AVAX.svg',
    'GAIA': 'assets/chains/GAIA.svg',
    'DOGE': 'assets/chains/DOGE.svg',
    'THOR': 'assets/chains/THOR.svg',
    'SOL': 'assets/chains/SOL.svg',
    'XRP': 'assets/chains/XRP.svg',
    'BASE': 'assets/chains/BASE.svg',
    'TRX': 'assets/chains/THOR.svg' // Placeholder - no TRX chain logo available
  };

  async function fetchOraclePrices() {
    try {
      // Use shared utility with fallback support
      const data = await fetchJSONWithFallback('/thorchain/oracle/prices');
      const pricesMap = {};
      data.prices.forEach(item => {
        pricesMap[item.symbol] = parseFloat(item.price);
      });
      return pricesMap;
    } catch (error) {
      console.error('Failed to fetch oracle prices:', error);
      return {};
    }
  }

  async function fetchPoolPrices() {
    try {
      // Use shared utility with caching and fallback support
      const data = await getAllPools();
      const pricesMap = {};
      data
        .filter(pool => pool.status === 'Available')
        .forEach(pool => {
          pricesMap[pool.asset] = fromBaseUnit(pool.asset_tor_price);
        });
      return pricesMap;
    } catch (error) {
      console.error('Failed to fetch pool prices:', error);
      return {};
    }
  }

  async function fetchRunePrice() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
      const data = await response.json();
      return Number(data.rune_price_in_tor) / 1e8;
    } catch (error) {
      console.error('Failed to fetch RUNE price:', error);
      return null;
    }
  }

  async function loadData() {
    loading.set(true);
    try {
      const [oracleData, poolData, runePriceData] = await Promise.all([
        fetchOraclePrices(),
        fetchPoolPrices(),
        fetchRunePrice()
      ]);
      oraclePrices.set(oracleData);
      poolPrices.set(poolData);
      runePrice.set(runePriceData);
    } finally {
      loading.set(false);
    }
  }

  function formatPrice(price) {
    if (price >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price);
    } else if (price >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }).format(price);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      }).format(price);
    }
  }

  function formatAssetName(asset) {
    if (asset === 'USDC' || asset === 'USDT') return asset;
    const parts = asset.split('.');
    const chain = parts[0];
    const token = parts[1];
    
    if (!token) return asset; // Simple case like BTC, ETH
    
    // Extract token name from contract address format
    if (token.includes('-0X')) {
      const tokenName = token.split('-')[0];
      return `${tokenName} (${chain})`;
    }
    
    // For simple token format
    if (token === chain) {
      return token; // BTC.BTC -> BTC
    }
    
    return `${token} (${chain})`;
  }

  function formatOracleSymbol(symbol) {
    return symbol; // Oracle symbols are already clean (BTC, ETH, USDT, etc.)
  }

  function formatPercentage(percent) {
    if (percent === null || percent === undefined) return 'N/A';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  }

  function getColorForPercentage(percent) {
    if (percent === null || percent === undefined) return '#888';
    const abs = Math.abs(percent);
    if (abs < 1) return '#888';
    if (abs < 5) return percent > 0 ? '#4ade80' : '#f87171';
    return percent > 0 ? '#22c55e' : '#ef4444';
  }

  // Compute comparison data - show ALL matching pool assets for each oracle symbol
  $: comparisonData = (() => {
    const poolComparisons = [];
    
    // For each pool asset, check if we can map it to an oracle symbol
    Object.keys($poolPrices).forEach(asset => {
      const oracleSymbol = getOracleSymbolForAsset(asset);
      const oraclePrice = $oraclePrices[oracleSymbol];
      const poolPrice = $poolPrices[asset];
      
      if (oracleSymbol && oraclePrice && poolPrice) {
        const delta = ((poolPrice - oraclePrice) / oraclePrice) * 100;
        
        poolComparisons.push({
          symbol: oracleSymbol,
          asset,
          oraclePrice,
          poolPrice,
          delta,
          hasPoolPrice: true,
          isRune: false
        });
      }
    });

    // Add RUNE comparison if both oracle RUNE price and network RUNE price are available
    const runeComparisons = [];
    if ($oraclePrices.RUNE && $runePrice) {
      const oraclePrice = $oraclePrices.RUNE;
      const networkPrice = $runePrice;
      const delta = ((networkPrice - oraclePrice) / oraclePrice) * 100;
      
      runeComparisons.push({
        symbol: 'RUNE',
        asset: 'THOR.RUNE',
        oraclePrice,
        poolPrice: networkPrice,
        delta,
        hasPoolPrice: true,
        isRune: true
      });
    }

    return [...poolComparisons, ...runeComparisons]
      .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));
  })();

  function slideIn(node, { duration = 400 }) {
    return {
      duration,
      css: (t) => {
        const eased = cubicOut(t);
        return `
          transform: translateY(${20 * (1 - eased)}px);
          opacity: ${eased};
        `;
      }
    };
  }

  onMount(() => {
    loadData();
  });
</script>

<main>
  <div class="container">
    <div class="app-header">
      <div class="header-icon">🔮</div>
      <div class="header-content">
        <h2>Oracle vs Pool Prices</h2>
        <p>Compare THORChain oracle prices with pool prices</p>
      </div>
      <button class="refresh-btn" on:click={loadData} disabled={$loading}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
    </div>

    {#if $loading}
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading oracle and pool data...</p>
      </div>
    {:else if comparisonData.length === 0}
      <div class="no-data">
        <div class="no-data-icon">📊</div>
        <h3>No Data Available</h3>
        <p>Unable to load comparison data. Please try refreshing.</p>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🔗</div>
          <div class="stat-value">{comparisonData.length}</div>
          <div class="stat-label">Network Assets vs Oracle</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-value">
            {comparisonData.filter(d => d.delta > 0).length}
          </div>
          <div class="stat-label">Network &gt; Oracle</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📉</div>
          <div class="stat-value">
            {comparisonData.filter(d => d.delta < 0).length}
          </div>
          <div class="stat-label">Network &lt; Oracle</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚖️</div>
          <div class="stat-value">
            {Math.abs(comparisonData.reduce((sum, d) => sum + (d.delta || 0), 0) / comparisonData.length).toFixed(2)}%
          </div>
          <div class="stat-label">Avg Difference</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Oracle Price</th>
                <th>Network Price</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {#each comparisonData as item, i}
                <tr in:slideIn="{{ delay: i * 50 }}">
                  <td class="asset-cell">
                    <div class="asset-info">
                      <div class="logo-container">
                        <img 
                          src={getAssetLogo(item.asset, item.symbol)} 
                          alt={item.symbol}
                          class="asset-icon"
                        />
                        <div class="chain-logo-container">
                          <img 
                            src={chainLogos[item.asset?.split('.')[0]] || chainLogos[item.symbol] || 'assets/chains/THOR.svg'}
                            alt="chain"
                            class="chain-icon"
                          />
                        </div>
                      </div>
                      <div class="asset-name">
                        <div class="symbol">{formatOracleSymbol(item.symbol)}</div>
                        <div class="asset-path">{formatAssetName(item.asset)}</div>
                      </div>
                    </div>
                  </td>
                  <td class="price-cell oracle">
                    {formatPrice(item.oraclePrice)}
                  </td>
                  <td class="price-cell pool">
                    {formatPrice(item.poolPrice)}
                  </td>
                  <td class="delta-cell">
                    <div 
                      class="delta-value"
                      style="color: {getColorForPercentage(item.delta)}"
                    >
                      {formatPercentage(item.delta)}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    color: #fff;
    background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo 2', sans-serif;
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 40px;
    padding: 20px;
    background: linear-gradient(135deg, #2c2c2c, #3a3a3a);
    border-radius: 16px;
    border: 1px solid #4a4a4a;
    position: relative;
    overflow: hidden;
  }

  .app-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent, rgba(116, 79, 168, 0.1), transparent);
    pointer-events: none;
  }

  .header-icon {
    font-size: 3rem;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 10px rgba(124, 58, 237, 0.3));
  }

  .header-content {
    flex: 1;
  }

  .header-content h2 {
    margin: 0 0 8px 0;
    font-size: 1.8rem;
    font-weight: 600;
    background: linear-gradient(135deg, #fff, #e0e0e0);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header-content p {
    margin: 0;
    color: #b0b0b0;
    font-size: 1rem;
  }

  .refresh-btn {
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: none;
    color: white;
    padding: 12px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(124, 58, 237, 0.3);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #3a3a3a;
    border-top: 3px solid #7c3aed;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
  }

  .no-data-icon {
    font-size: 4rem;
    margin-bottom: 20px;
    opacity: 0.5;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }

  .stat-card {
    background: linear-gradient(135deg, #2c2c2c, #3a3a3a);
    border: 1px solid #4a4a4a;
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, transparent, rgba(124, 58, 237, 0.05), transparent);
    pointer-events: none;
  }

  .stat-icon {
    font-size: 2rem;
    margin-bottom: 12px;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
  }

  .stat-label {
    color: #b0b0b0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .table-container {
    background: linear-gradient(135deg, #2c2c2c, #3a3a3a);
    border-radius: 16px;
    border: 1px solid #4a4a4a;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    color: #b0b0b0;
    font-weight: 600;
    padding: 20px 16px;
    text-align: left;
    border-bottom: 1px solid #4a4a4a;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover {
    background: rgba(124, 58, 237, 0.05);
  }

  .asset-cell {
    min-width: 180px;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-container {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .asset-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: contain;
  }

  .chain-logo-container {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    background: #2c2c2c;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #2c2c2c;
  }

  .chain-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
  }

  .asset-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .symbol {
    font-weight: 600;
    color: #fff;
    font-size: 1rem;
  }

  .asset-path {
    font-size: 0.8rem;
    color: #888;
  }

  .price-cell {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 500;
    font-size: 0.9rem;
    min-width: 120px;
  }

  .price-cell.oracle {
    color: #7c3aed;
  }

  .price-cell.pool {
    color: #06b6d4;
  }

  .delta-cell {
    text-align: right;
    min-width: 100px;
  }

  .delta-value {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 600;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    .container {
      padding: 16px;
    }

    .app-header {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 2.5rem;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .stat-card {
      padding: 16px;
    }

    .stat-value {
      font-size: 1.5rem;
    }

    th, td {
      padding: 12px 8px;
      font-size: 0.8rem;
    }

    .asset-info {
      gap: 8px;
    }

    .logo-container {
      width: 32px;
      height: 32px;
    }

    .asset-icon {
      width: 32px;
      height: 32px;
    }

    .chain-logo-container {
      width: 16px;
      height: 16px;
    }

    .chain-icon {
      width: 12px;
      height: 12px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
    
    .table-wrapper {
      font-size: 0.7rem;
    }
    
    .asset-path {
      display: none;
    }
  }
</style>