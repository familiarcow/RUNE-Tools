<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let loading = true;
  let error = null;
  let vaultAssets = [];
  let totalVaultValueInRune = 0;
  let totalSecurityBudget = 0;
  let totalNodeBond = 0;
  let securityDelta = 0;

  // Asset logos configuration
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
    'ETH.USDC': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT': 'assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'AVAX.USDC': 'assets/coins/usd-coin-usdc-logo.svg',
    'AVAX.USDT': 'assets/coins/tether-usdt-logo.svg',
    'BSC.USDC': 'assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT': 'assets/coins/tether-usdt-logo.svg',
    'BSC.TWT': 'assets/coins/twt-logo.png',
    'ETH.DAI': 'assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD': 'assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD': 'assets/coins/liquity-usd-logo.svg',
    'ETH.USDP': 'assets/coins/paxos-standard-usdp-logo.svg',
    'ETH.AAVE': 'assets/coins/aave-aave-logo.svg',
    'ETH.LINK': 'assets/coins/chainlink-link-logo.svg',
    'ETH.SNX': 'assets/coins/synthetix-snx-logo.svg',
    'ETH.FOX': 'assets/coins/fox-token-fox-logo.svg',
    'AVAX.SOL': 'assets/coins/solana-sol-logo.svg',
    'BASE.ETH': 'assets/coins/ethereum-eth-logo.svg',
    'BASE.USDC': 'assets/coins/usd-coin-usdc-logo.svg',
    'BASE.CBBTC': 'assets/coins/coinbase-wrapped-btc-logo.svg',
    'ETH.DPI': 'assets/coins/dpi-logo.png',
    'ETH.THOR': 'assets/coins/thorswap-logo.png',
    'ETH.VTHOR': 'assets/coins/thorswap-logo.png',
    'ETH.XRUNE': 'assets/coins/xrune-logo.png',
    'ETH.TGT': 'assets/coins/tgt-logo.png'
  };

  // Format number with commas and specified decimal places
  function formatNumber(number, decimals = 2) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number);
  }

  // Format asset name to remove contract address
  function formatAssetName(asset) {
    return asset.split('-')[0];
  }

  // Get logo URL for asset
  function getAssetLogo(asset) {
    const shortAsset = formatAssetName(asset);
    return assetLogos[shortAsset] || '/assets/coins/fallback-logo.svg';
  }

  async function fetchVaultData() {
    try {
      // Fetch vault data
      const vaultsResponse = await fetch('https://thornode.ninerealms.com/thorchain/vaults/asgard');
      const vaults = await vaultsResponse.json();

      // Fetch pool data for asset prices
      const poolsResponse = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      const pools = await poolsResponse.json();

      // Create a map of asset prices in RUNE
      const assetPrices = {};
      pools.forEach(pool => {
        const assetPrice = Number(pool.balance_rune) / Number(pool.balance_asset);
        assetPrices[pool.asset] = assetPrice;
      });

      // Calculate total assets and their RUNE values
      const assets = new Map();
      vaults.forEach(vault => {
        vault.coins.forEach(coin => {
          const currentAmount = assets.get(coin.asset)?.amount || 0;
          assets.set(coin.asset, {
            amount: currentAmount + Number(coin.amount),
            asset: coin.asset
          });
        });
      });

      // Convert to array and calculate RUNE values
      vaultAssets = Array.from(assets.values()).map(asset => {
        const amountInBase = asset.amount / 1e8;
        const runePrice = assetPrices[asset.asset] || 0;
        const runeValue = amountInBase * runePrice;

        return {
          asset: asset.asset,
          amount: amountInBase,
          runeValue: runeValue
        };
      });

      // Calculate total vault value in RUNE
      totalVaultValueInRune = vaultAssets.reduce((sum, asset) => sum + asset.runeValue, 0);

      // Fetch node data for security budget
      const nodesResponse = await fetch('https://thornode.ninerealms.com/thorchain/nodes');
      const nodes = await nodesResponse.json();

      // Get active nodes and sort by bond size (largest to smallest)
      const activeNodes = nodes
        .filter(node => node.status === 'Active')
        .sort((a, b) => Number(b.total_bond) - Number(a.total_bond));

      // Calculate total node bond
      totalNodeBond = activeNodes.reduce((sum, node) => sum + Number(node.total_bond), 0) / 1e8;

      // Calculate cutoff index for bottom 2/3 of nodes
      const cutoffIndex = Math.floor(activeNodes.length / 3);
      const bottomTwoThirdsNodes = activeNodes.slice(cutoffIndex);

      // Calculate security budget from bottom 2/3 of nodes
      totalSecurityBudget = bottomTwoThirdsNodes.reduce((sum, node) => sum + Number(node.total_bond), 0) / 1e8;

      // Calculate the delta between security budget and vault value
      securityDelta = totalSecurityBudget - totalVaultValueInRune;

      loading = false;
    } catch (e) {
      console.error('Error fetching data:', e);
      error = e.message;
      loading = false;
    }
  }

  onMount(() => {
    fetchVaultData();
  });
</script>

<main>
  <div class="container">
    <h1>THORChain Liquidity Cap Analysis</h1>

    {#if loading}
      <div class="loading" transition:fade>Loading data...</div>
    {:else if error}
      <div class="error" transition:fade>Error: {error}</div>
    {:else}
      <div class="summary-card" transition:fade>
        <div class="metric main">
          <h2>Total Vault Value</h2>
          <div class="value">{formatNumber(totalVaultValueInRune)} RUNE</div>
        </div>
        <div class="metric main">
          <h2>Security Budget (Bottom 2/3)</h2>
          <div class="value">{formatNumber(totalSecurityBudget)} RUNE</div>
        </div>
        <div class="metric main">
          <h2>Security Delta</h2>
          <div class="value" class:negative={securityDelta < 0}>
            {securityDelta >= 0 ? '+' : ''}{formatNumber(securityDelta)} RUNE
          </div>
          <div class="status-text" class:negative={securityDelta < 0}>
            {securityDelta < 0 ? 'Network Underbonded' : 'Network Well Bonded'}
          </div>
        </div>
      </div>

      <div class="secondary-info" transition:fade>
        <span>Total Node Bond: {formatNumber(totalNodeBond)} RUNE</span>
      </div>

      <div class="assets-table" transition:fade>
        <h2>Asset Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Amount</th>
              <th>Value (RUNE)</th>
            </tr>
          </thead>
          <tbody>
            {#each vaultAssets.sort((a, b) => b.runeValue - a.runeValue) as asset}
              <tr>
                <td class="asset-cell">
                  <div class="asset-info">
                    <div class="logo-container">
                      <img 
                        src={getAssetLogo(asset.asset)} 
                        alt={formatAssetName(asset.asset)}
                        class="asset-icon"
                        on:error={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/coins/fallback-logo.svg';
                        }}
                      />
                      <div class="chain-logo-container">
                        <img 
                          src={`assets/chains/${asset.asset.split('.')[0]}.svg`}
                          alt={asset.asset.split('.')[0]}
                          class="chain-icon"
                        />
                      </div>
                    </div>
                    <span class="asset-name">{formatAssetName(asset.asset)}</span>
                  </div>
                </td>
                <td class="amount">{formatNumber(asset.amount)}</td>
                <td class="amount">{formatNumber(asset.runeValue)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    padding: 1rem;
    color: var(--text-color);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  h1 {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 1.5rem;
  }

  h2 {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: var(--error-color);
  }

  .summary-card {
    background: var(--surface-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
  }

  .summary-card:hover {
    transform: translateY(-2px);
  }

  .metric {
    text-align: center;
  }

  .metric.main {
    padding: 1.5rem;
    border-radius: 8px;
    background: var(--surface-color-light);
    transition: all 0.3s ease;
  }

  .metric.main:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .value {
    font-size: 1.8rem;
    font-weight: bold;
    margin-top: 0.75rem;
  }

  .value.negative {
    color: var(--error-color);
  }

  .status-text {
    font-size: 0.9rem;
    margin-top: 0.75rem;
    color: var(--success-color);
    font-weight: 500;
  }

  .status-text.negative {
    color: var(--error-color);
  }

  .secondary-info {
    text-align: right;
    font-size: 0.9rem;
    color: var(--secondary-text-color);
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: var(--surface-color-light);
    border-radius: 4px;
    opacity: 0.8;
  }

  .assets-table {
    background: var(--surface-color);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
  }

  .assets-table:hover {
    transform: translateY(-2px);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    font-weight: 500;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr {
    transition: background-color 0.2s ease;
  }

  tr:hover {
    background-color: var(--surface-color-light);
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-container {
    position: relative;
    width: 32px;
    height: 32px;
  }

  .asset-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .chain-logo-container {
    position: absolute;
    bottom: -2px;
    right: -4px;
    width: 16px;
    height: 16px;
    background: var(--surface-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .chain-icon {
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .asset-name {
    font-weight: 500;
    color: var(--text-color);
  }

  .amount {
    font-family: monospace;
    font-size: 0.95rem;
    color: var(--text-color);
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 0.5rem;
    }

    .summary-card {
      grid-template-columns: 1fr;
      gap: 1rem;
      padding: 1rem;
    }

    .metric.main {
      padding: 1rem;
    }

    .value {
      font-size: 1.4rem;
    }

    .assets-table {
      padding: 1rem;
    }

    table {
      font-size: 0.85rem;
    }

    th, td {
      padding: 0.5rem;
    }

    .logo-container {
      width: 24px;
      height: 24px;
    }

    .asset-icon {
      width: 24px;
      height: 24px;
    }

    .chain-logo-container {
      width: 14px;
      height: 14px;
    }

    .chain-icon {
      width: 10px;
      height: 10px;
    }
  }
</style>
