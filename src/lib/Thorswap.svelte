<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let assets = [];
  let fromAsset = 'BTC.BTC';
  let toAsset = 'THOR.RUNE';
  let amount = '';
  let isLoading = true;
  let assetPrices = new Map();
  let usdValue = '';
  let runePrice = 0;

  // Add the logo mapping
  const ASSET_LOGOS = {
    'BTC.BTC': 'assets/coins/bitcoin-btc-logo.svg',
    'ETH.ETH': 'assets/coins/ethereum-eth-logo.svg',
    'BSC.BNB': 'assets/coins/binance-coin-bnb-logo.svg',
    'BCH.BCH': 'assets/coins/bitcoin-cash-bch-logo.svg',
    'LTC.LTC': 'assets/coins/litecoin-ltc-logo.svg',
    'AVAX.AVAX': 'assets/coins/avalanche-avax-logo.svg',
    'GAIA.ATOM': 'assets/coins/cosmos-atom-logo.svg',
    'DOGE.DOGE': 'assets/coins/dogecoin-doge-logo.svg',
    'THOR.RUNE': 'assets/coins/RUNE-ICON.svg',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'BNB.BUSD-BD1': 'assets/coins/binance-usd-busd-logo.svg',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg'
  };

  // Update RUNE_ASSET to use the correct logo path
  const RUNE_ASSET = {
    asset: 'THOR.RUNE',
    chain: 'THOR',
    ticker: 'RUNE',
    iconPath: ASSET_LOGOS['THOR.RUNE']
  };

  onMount(async () => {
    try {
      const [poolsResponse, networkResponse] = await Promise.all([
        fetch('https://thornode.ninerealms.com/thorchain/pools'),
        fetch('https://thornode.ninerealms.com/thorchain/network')
      ]);

      const pools = await poolsResponse.json();
      const network = await networkResponse.json();
      
      // Get RUNE price in USD from network data
      runePrice = network.rune_price_in_tor / 1e8;
      
      // Filter for active pools only
      const activePools = pools.filter(pool => pool.status === 'Available');
      
      // Store prices for active pools only
      activePools.forEach(pool => {
        assetPrices.set(pool.asset, pool.asset_tor_price / 1e8);
      });
      assetPrices.set('THOR.RUNE', runePrice);
      
      // Update asset mapping with active pools only
      assets = activePools.map(pool => {
        const [chain, ...rest] = pool.asset.split('.');
        const ticker = rest.join('.').split('-')[0];
        return {
          asset: pool.asset,
          chain,
          ticker,
          iconPath: ASSET_LOGOS[pool.asset] || 'assets/coins/RUNE-ICON.svg'
        };
      });

      assets = [RUNE_ASSET, ...assets];
      isLoading = false;
    } catch (error) {
      console.error('Error fetching data:', error);
      isLoading = false;
    }
  });

  function generateThorswapUrl() {
    if (!fromAsset || !toAsset) return '';
    
    const baseUrl = 'https://app.thorswap.finance/swap';
    const fromAssetEncoded = encodeURIComponent(fromAsset);
    const toAssetEncoded = encodeURIComponent(toAsset);
    
    let url = `${baseUrl}/${fromAssetEncoded}_${toAssetEncoded}?ref=-`;
    
    // Only add amount parameter if amount is provided
    if (amount) {
      url += `&sellAmount=${amount}`;
    }
    
    return url;
  }

  function handleSwap() {
    const url = generateThorswapUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  function swapAssets() {
    [fromAsset, toAsset] = [toAsset, fromAsset];
  }

  // Group assets by chain
  $: assetsByChain = assets.reduce((acc, asset) => {
    if (!acc[asset.chain]) {
      acc[asset.chain] = [];
    }
    acc[asset.chain].push(asset);
    return acc;
  }, {});

  // Handle amount input validation
  function handleAmountInput(event) {
    const value = event.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      amount = value;
    }
  }

  // Add function to calculate USD value
  function calculateUsdValue() {
    if (!fromAsset || !amount) {
      usdValue = '';
      return;
    }
    
    const price = assetPrices.get(fromAsset);
    if (price) {
      const value = parseFloat(amount) * price;
      usdValue = value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      usdValue = '';
    }
  }

  // Update amount and fromAsset to trigger USD calculation
  $: {
    amount;
    fromAsset;
    calculateUsdValue();
  }

  // Add reactive store for current assets
  $: currentAssets = {
    from: assets.find(a => a.asset === fromAsset) || RUNE_ASSET,
    to: assets.find(a => a.asset === toAsset) || RUNE_ASSET
  };
</script>

<div class="thorswap-wrapper">
  <div class="container">
    <div class="card-header">
      <h2>THORSwap</h2>
    </div>

    <div class="card-body">
      {#if isLoading}
        <div class="loading">Loading assets...</div>
      {:else}
        <div class="swap-form">
          <div class="input-group">
            <div class="input-column">
              <span class="input-label">From</span>
              <select 
                class="form-control"
                bind:value={fromAsset}
              >
                <option value="">Select asset</option>
                {#each Object.entries(assetsByChain) as [chain, chainAssets]}
                  <optgroup label={chain}>
                    {#each chainAssets as asset}
                      <option value={asset.asset}>
                        {asset.ticker}
                      </option>
                    {/each}
                  </optgroup>
                {/each}
              </select>
            </div>

            <div class="input-column">
              <span class="input-label">Amount</span>
              <div class="input-container">
                <input 
                  type="text"
                  class="form-control"
                  placeholder="Enter amount (Optional)"
                  bind:value={amount}
                  on:input={handleAmountInput}
                />
                {#if usdValue}
                  <div class="usd-value" transition:fade={{ duration: 200 }}>
                    ≈ {usdValue}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="swap-direction">
            <div class="coin-logo">
              <img 
                src={currentAssets.from.iconPath} 
                alt={currentAssets.from.ticker}
                transition:fade={{ duration: 200 }}
              />
            </div>
            
            <button class="swap-button" on:click={swapAssets}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M7.5 21.5l-5-5l5-5l1.4 1.4L6.4 15H17v2H6.4l2.5 2.5L7.5 21.5z M16.5 7.5l-1.4-1.4L17.6 4H7V2h10.6l-2.5-2.5L16.5 -1l5 5L16.5 7.5z"/>
              </svg>
            </button>

            <div class="coin-logo">
              <img 
                src={currentAssets.to.iconPath} 
                alt={currentAssets.to.ticker}
                transition:fade={{ duration: 200 }}
              />
            </div>
          </div>

          <div class="input-column">
            <span class="input-label">To</span>
            <select 
              class="form-control"
              bind:value={toAsset}
            >
              <option value="">Select asset</option>
              {#each Object.entries(assetsByChain) as [chain, chainAssets]}
                <optgroup label={chain}>
                  {#each chainAssets as asset}
                    <option value={asset.asset}>
                      {asset.ticker}
                    </option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>

          <div class="submit-container">
            <button 
              class="btn btn-primary"
              on:click={handleSwap}
              disabled={!fromAsset || !toAsset}
            >
              Swap on THORSwap
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .thorswap-wrapper {
    position: relative;
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .card-header {
    background-color: #2c2c2c;
    padding: 20px;
  }

  .card-header h2 {
    margin: 0;
    text-align: center;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  .card-body {
    padding: 20px;
  }

  .swap-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    min-height: 48px;
  }

  .input-label {
    color: #e0e0e0;
    font-weight: 500;
    font-size: 0.9rem;
    min-width: 60px;
    padding-top: 12px;
    text-align: left;
  }

  .input-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .form-control {
    width: 100%;
    height: 48px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(74, 144, 226, 0.3);
    background-color: #2c2c2c;
    color: #e0e0e0;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .form-control:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  }

  select.form-control {
    cursor: pointer;
    appearance: none;
    padding-right: 30px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A90E2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
  }

  select.form-control optgroup {
    background-color: #1a1a1a;
    color: #4A90E2;
    font-weight: 600;
    font-size: 0.9rem;
    padding: 8px;
  }

  select.form-control option {
    background-color: #2c2c2c;
    color: #e0e0e0;
    padding: 8px;
    font-size: 0.95rem;
  }

  select.form-control option:hover {
    background-color: #4A90E2;
    color: white;
  }

  select.form-control:focus {
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  }

  .swap-direction {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
  }

  .coin-logo {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .coin-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .swap-button {
    background: transparent;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 0.75rem;
    border-radius: 50%;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .swap-button:hover {
    color: #357ABD;
    transform: scale(1.1);
  }

  .submit-container {
    margin-top: 1rem;
  }

  .btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background-color: #4A90E2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #357ABD;
    transform: translateY(-2px);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #a9a9a9;
  }

  .usd-value {
    font-size: 0.8rem;
    color: #a9a9a9;
    margin-top: 0.25rem;
    text-align: right;
  }

  .input-group {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 1rem;
    align-items: start;
  }

  .input-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-label {
    color: #e0e0e0;
    font-weight: 500;
    font-size: 0.9rem;
  }

  @media (max-width: 600px) {
    .input-group {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>
