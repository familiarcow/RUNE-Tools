<script>
  import { onMount } from 'svelte';

  let basePools = [];
  let isLoading = true;
  let error = null;
  let totalValueLocked = 0;
  let showUSD = false;
  let runePrice = 0;

  const fetchRunePrice = async () => {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
      const data = await response.json();
      runePrice = Number(data.rune_price_in_tor) / 1e8;
    } catch (err) {
      console.error('Failed to fetch RUNE price:', err);
    }
  };

  const fetchMidgardStats = async (asset) => {
    try {
      const response = await fetch(`https://midgard.ninerealms.com/v2/pool/${asset}/stats`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`Failed to fetch Midgard stats for ${asset}:`, err);
      return null;
    }
  };

  const fetchBasePools = async () => {
    try {
      await fetchRunePrice();
      const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      const pools = await response.json();
      
      // Filter for BASE pools
      const filteredPools = pools.filter(pool => pool.asset.startsWith('BASE.'));
      
      // Fetch Midgard stats for each pool
      const poolsWithStats = await Promise.all(
        filteredPools.map(async (pool) => {
          const stats = await fetchMidgardStats(pool.asset);
          return { ...pool, stats };
        })
      );
      
      // Sort pools by status (Available first) and then by depth
      basePools = poolsWithStats.sort((a, b) => {
        // First sort by status
        if (a.status === 'Available' && b.status !== 'Available') return -1;
        if (a.status !== 'Available' && b.status === 'Available') return 1;
        
        // Then sort by depth
        const depthA = Number(a.balance_rune);
        const depthB = Number(b.balance_rune);
        return depthB - depthA;
      });
      
      // Calculate total value locked
      totalValueLocked = basePools.reduce((total, pool) => {
        const runeValue = Number(pool.balance_rune) / 1e8;
        return total + (runeValue * 2 * runePrice);
      }, 0);

      isLoading = false;
    } catch (err) {
      error = err.message;
      isLoading = false;
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatUSD = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getAssetLogo = (asset) => {
    const logoMap = {
      'BASE.ETH': '/assets/coins/ethereum-eth-logo.svg',
      'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': '/assets/coins/usd-coin-usdc-logo.svg',
      'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': '/assets/coins/coinbase-wrapped-btc-logo.svg'
    };
    return logoMap[asset] || '';
  };

  onMount(fetchBasePools);
</script>

<div class="base-stats-container">
  <div class="header">
    <h2>Base on THORChain</h2>
    <label class="toggle">
      <input type="checkbox" bind:checked={showUSD}>
      <span class="slider">
        <span class="knob">
          <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="knob-icon rune" />
          <span class="knob-icon dollar">$</span>
        </span>
      </span>
    </label>
  </div>

  {#if isLoading}
    <div class="loading">Loading Base stats...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else}
    <div class="stats-overview">
      <div class="stat-box">
        <h3>Total Base Liquidity</h3>
        <p class="stat-value">
          {formatUSD(totalValueLocked)}
        </p>
      </div>
    </div>

    <div class="pools-grid">
      {#each basePools as pool}
        <div class="pool-card">
          <div class="pool-header">
            {#if getAssetLogo(pool.asset)}
              <img src={getAssetLogo(pool.asset)} alt={pool.asset} class="pool-logo" />
            {/if}
            <h3>{pool.asset.split('-')[0].replace('BASE.', '')}</h3>
            <div class="price-pill">
              {formatUSD(Number(pool.asset_tor_price) / 1e8)}
            </div>
            <span class="status {pool.status.toLowerCase()}">{pool.status}</span>
          </div>
          <div class="pool-stats">
            <div class="stat">
              <span class="label">Liquidity</span>
              <span class="value">
                {formatUSD((Number(pool.balance_rune) / 1e8) * 2 * runePrice)}
              </span>
            </div>
            <div class="stat">
              <span class="label">RUNE Balance</span>
              <span class="value">
                {#if showUSD}
                  {formatUSD((Number(pool.balance_rune) / 1e8) * runePrice)}
                {:else}
                  <span class="value-with-logo">
                    {formatNumber((Number(pool.balance_rune) / 1e8))}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="inline-logo" />
                  </span>
                {/if}
              </span>
            </div>
            <div class="stat">
              <span class="label">Asset Balance</span>
              <span class="value">
                {#if showUSD}
                  {formatUSD((Number(pool.balance_asset) / 1e8) * (Number(pool.asset_tor_price) / 1e8))}
                {:else}
                  <span class="value-with-logo">
                    {formatNumber(Number(pool.balance_asset) / 1e8)}
                    {#if getAssetLogo(pool.asset)}
                      <img src={getAssetLogo(pool.asset)} alt={pool.asset} class="inline-logo" />
                    {/if}
                  </span>
                {/if}
              </span>
            </div>
            {#if pool.stats}
              <div class="stat">
                <span class="label">24h Volume</span>
                <span class="value">
                  {formatUSD(Number(pool.stats.swapVolume) / 1e8)}
                </span>
              </div>
              <div class="stat">
                <span class="label">Total Earned</span>
                <span class="value">
                  {formatUSD(Number(pool.stats.totalFees) / 1e8)}
                </span>
              </div>
              <div class="stat">
                <span class="label">Unique LPs</span>
                <span class="value">
                  {pool.stats.uniqueMemberCount}
                </span>
              </div>
              <div class="stat">
                <span class="label">Total Swaps</span>
                <span class="value">
                  {Number(pool.stats.toAssetCount) + Number(pool.stats.toRuneCount)}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .base-stats-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 30px;
    padding: 0 20px;
    position: relative;
  }

  .controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
    padding: 0 20px;
  }

  .title-container {
    text-align: center;
  }

  h2 {
    margin: 0;
    color: #4A90E2;
    font-size: 24px;
    white-space: nowrap;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .toggle {
    margin-left: auto;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .toggle input {
    display: none;
  }

  .slider {
    position: relative;
    width: 64px;
    height: 32px;
    background-color: #1a1a1a;
    border-radius: 16px;
    transition: 0.3s;
  }

  .knob {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    width: 26px;
    left: 3px;
    bottom: 2px;
    background-color: #4A90E2;
    border-radius: 50%;
    transition: 0.3s;
  }

  .knob-icon {
    position: absolute;
    transition: 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .knob-icon.rune {
    color: white;
    font-size: 20px;
    font-weight: 500;
    opacity: 1;
  }

  .knob-icon.dollar {
    color: white;
    font-size: 20px;
    font-weight: 600;
    opacity: 0;
  }

  input:checked + .slider .knob {
    transform: translateX(32px);
  }

  input:checked + .slider .knob-icon.rune {
    opacity: 0;
  }

  input:checked + .slider .knob-icon.dollar {
    opacity: 1;
  }

  .toggle:hover .slider {
    border-color: #4A90E2;
    box-shadow: 0 0 5px rgba(74, 144, 226, 0.2);
  }

  .stats-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }

  .stat-box {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .stat-box h3 {
    color: #888;
    font-size: 16px;
    margin: 0 0 10px 0;
  }

  .stat-value {
    color: #4A90E2;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }

  .pools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .pool-card {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .pool-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .pool-logo {
    width: 32px;
    height: 32px;
    margin-right: 12px;
  }

  .pool-header h3 {
    margin: 0;
    color: #4A90E2;
    font-size: 18px;
    flex: 1;
  }

  .price-pill {
    background-color: #1a1a1a;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #4A90E2;
    margin-right: 12px;
  }

  .status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status.available {
    background-color: #2cbe8c33;
    color: #2cbe8c;
  }

  .status.staged {
    background-color: #f39c1233;
    color: #f39c12;
  }

  .pool-stats {
    display: grid;
    gap: 15px;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background-color: #1a1a1a;
    border-radius: 8px;
  }

  .stat .label {
    color: #888;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat .value {
    color: white;
    font-weight: 500;
  }

  .value-with-logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loading, .error {
    text-align: center;
    padding: 40px;
    color: #888;
  }

  .error {
    color: #ff4444;
  }

  .inline-logo {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 600px) {
    .stats-overview {
      grid-template-columns: 1fr;
    }

    .pools-grid {
      grid-template-columns: 1fr;
    }

    .stat-box {
      padding: 15px;
    }

    .stat-value {
      font-size: 20px;
    }
  }
</style>