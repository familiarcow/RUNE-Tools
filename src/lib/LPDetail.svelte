<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  export let address = null;
  export let pool = null;
  export let height = null;
  export let goBack;
  export let runePrice;
  export let assetPrices;
  export let viewRandomLP;

  let lpData = null;
  let loading = true;
  let error = null;
  let showMore = false;

  const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'https://thornode-archive.ninerealms.com';

  const assetLogos = {
    'BTC.BTC': '/assets/coins/bitcoin-btc-logo.svg',
    'ETH.ETH': '/assets/coins/ethereum-eth-logo.svg',
    'BSC.BNB': '/assets/coins/binance-coin-bnb-logo.svg',
    'BCH.BCH': '/assets/coins/bitcoin-cash-bch-logo.svg',
    'LTC.LTC': '/assets/coins/litecoin-ltc-logo.svg',
    'AVAX.AVAX': '/assets/coins/avalanche-avax-logo.svg',
    'GAIA.ATOM': '/assets/coins/cosmos-atom-logo.svg',
    'DOGE.DOGE': '/assets/coins/dogecoin-doge-logo.svg',
    'THOR.RUNE': '/assets/coins/RUNE-ICON.svg',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': '/assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': '/assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': '/assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': '/assets/coins/usd-coin-usdc-logo.svg',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': '/assets/coins/tether-usdt-logo.svg',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': '/assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': '/assets/coins/tether-usdt-logo.svg',
    'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': '/assets/coins/twt-logo.png',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': '/assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': '/assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': '/assets/coins/liquity-usd-logo.svg',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': '/assets/coins/paxos-standard-usdp-logo.svg',
    'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': '/assets/coins/aave-aave-logo.svg',
    'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': '/assets/coins/chainlink-link-logo.svg',
    'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': '/assets/coins/synthetix-snx-logo.svg',
    'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': '/assets/coins/fox-token-fox-logo.svg',
    'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': '/assets/coins/solana-sol-logo.svg',
    'BASE.ETH': '/assets/coins/ethereum-eth-logo.svg',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': '/assets/coins/usd-coin-usdc-logo.svg',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': '/assets/coins/coinbase-wrapped-btc-logo.svg',
    'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': '/assets/coins/dpi-logo.png',
    'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': '/assets/coins/thorswap-logo.png',
    'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': '/assets/coins/thorswap-logo.png',
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': '/assets/coins/xrune-logo.png',
    'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': '/assets/coins/tgt-logo.png'
  };

  $: {
    if (pool && address) {
      loadLPData();
    }
  }

  async function loadLPData() {
    loading = true;
    error = null;

    let url = `${API_DOMAIN}/thorchain/pool/${pool}/liquidity_provider/${address}`;
    if (height) {
      url += `?height=${height}`;
    }

    try {
      const response = await axios.get(url);
      lpData = response.data;

      // Divide deposit and redeem values by 1e8
      ['rune_deposit_value', 'asset_deposit_value', 'rune_redeem_value', 'asset_redeem_value'].forEach(key => {
        if (lpData[key]) {
          lpData[key] = parseFloat(lpData[key]) / 1e8;
        }
      });
    } catch (err) {
      error = 'Failed to fetch LP details';
      console.error(error, err);
    } finally {
      loading = false;
    }
  }

  function formatValue(value, asset) {
    if (typeof value === 'number') {
      const price = asset === 'RUNE' ? runePrice : assetPrices[pool];
      const usdValue = value * price;
      return {
        native: value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        usd: usdValue.toLocaleString('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0 
        })
      };
    }
    return { native: value, usd: 'N/A' };
  }

  function calculateNetChange(runeDeposit, runeRedeem, assetDeposit, assetRedeem) {
    const runeChange = runeRedeem - runeDeposit;
    const assetChange = assetRedeem - assetDeposit;
    const runeDepositUSD = runeDeposit * runePrice;
    const runeRedeemUSD = runeRedeem * runePrice;
    const assetDepositUSD = assetDeposit * assetPrices[pool];
    const assetRedeemUSD = assetRedeem * assetPrices[pool];
    const totalDepositUSD = runeDepositUSD + assetDepositUSD;
    const totalRedeemUSD = runeRedeemUSD + assetRedeemUSD;
    const profitUSD = totalRedeemUSD - totalDepositUSD;
    const profitPercentage = (profitUSD / totalDepositUSD) * 100;

    return {
      rune: runeChange,
      asset: assetChange,
      profitUSD,
      profitPercentage,
      isProfit: profitUSD >= 0
    };
  }

  function getRunescanUrl(blockHeight) {
    return `https://runescan.io/block/${blockHeight}`;
  }

  function handleGoBack() {
    goBack();
  }

  // Add this function at the beginning of the script section
  function getShortPoolName(fullName) {
    if (fullName === 'BTC.BTC') return 'BTC';
    if (fullName === 'GAIA.ATOM') return 'ATOM';
    
    const parts = fullName.split('-');
    if (parts.length > 1) {
      const [chain, asset] = parts[0].split('.');
      return `${asset} (${chain})`;
    }
    
    return fullName.split('.')[1] || fullName;
  }

  // Add this helper function for formatting currency values
  function formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function toggleShowMore() {
    showMore = !showMore;
  }

  // Add this function to handle copying the URL
  function copyPageUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      // You could add a toast notification here if you want
      alert('URL copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL');
    });
  }
</script>

{#if pool && address}
  <div class="lp-detail">
    <div class="container">
      <div class="header-container">
        <div class="title-container">
          <h2>{address ? `${address.slice(-4).toUpperCase()}` : ''} LP Details - {pool ? ` ${getShortPoolName(pool)}` : ''}</h2>
        </div>
        <button class="copy-url-button" on:click={copyPageUrl} title="Copy page URL">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>

      {#if !pool}
        <p>Loading pool information...</p>
      {:else if loading}
        <p>Loading LP details...</p>
      {:else if error}
        <p class="error">{error}</p>
      {:else if lpData}
        {@const netChange = calculateNetChange(lpData.rune_deposit_value, lpData.rune_redeem_value, lpData.asset_deposit_value, lpData.asset_redeem_value)}
        
        <!-- Total Value Card -->
        <div class="total-value">
          {#if height}
            <span class="total-label">Total Value (as of height {height})</span>
          {:else}
            <span class="total-label">Total Value</span>
          {/if}
          <span class="total-amount">
            {formatUSD((lpData.rune_redeem_value * runePrice) + (lpData.asset_redeem_value * assetPrices[pool]))}
          </span>
        </div>

        <!-- Stats Grid -->
        <div class="stats-container">
          <div class="stat-box">
            <span class="stat-label">Net Profit/Loss</span>
            <span class="stat-value {netChange.isProfit ? 'positive' : 'negative'}">
              {formatUSD(netChange.profitUSD)}
              <span class="percent-change">
                ({netChange.profitPercentage.toFixed(2)}%)
              </span>
            </span>
          </div>
          
          <div class="stat-box">
            <span class="stat-label">RUNE Balance</span>
            <span class="stat-value">
              {formatValue(lpData.rune_redeem_value, 'RUNE').native}
              <div class="logo-container small">
                <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="asset-icon" />
                <div class="chain-logo-container">
                  <img src="/assets/chains/THOR.svg" alt="THOR" class="chain-icon" />
                </div>
              </div>
            </span>
          </div>

          <div class="stat-box">
            <span class="stat-label">{getShortPoolName(pool)} Balance</span>
            <span class="stat-value">
              {formatValue(lpData.asset_redeem_value, pool).native}
              <div class="logo-container small">
                <img 
                  src={assetLogos[pool] || '/assets/runetools-logo.svg'} 
                  alt={pool}
                  class="asset-icon"
                />
                <div class="chain-logo-container">
                  <img 
                    src={`/assets/chains/${pool.split('.')[0]}.svg`}
                    alt={pool.split('.')[0]}
                    class="chain-icon"
                  />
                </div>
              </div>
            </span>
          </div>
        </div>

        <!-- Position Details Cards -->
        <div class="position-grid">
          <div class="position-card">
            <h3>RUNE Position</h3>
            <div class="position-details">
              <div class="amount-row">
                <span class="label">Deposit</span>
                <span class="amount">
                  {formatValue(lpData.rune_deposit_value, 'RUNE').native}
                  <div class="logo-container small">
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="asset-icon" />
                    <div class="chain-logo-container">
                      <img src="/assets/chains/THOR.svg" alt="THOR" class="chain-icon" />
                    </div>
                  </div>
                </span>
                <span class="usd-value">{formatValue(lpData.rune_deposit_value, 'RUNE').usd}</span>
              </div>
              <div class="amount-row">
                <span class="label">Change</span>
                <span class="amount {netChange.rune >= 0 ? 'positive' : 'negative'}">
                  {netChange.rune.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div class="logo-container small">
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="asset-icon" />
                    <div class="chain-logo-container">
                      <img src="/assets/chains/THOR.svg" alt="THOR" class="chain-icon" />
                    </div>
                  </div>
                </span>
                <span class="usd-value">{formatValue(netChange.rune, 'RUNE').usd}</span>
              </div>
            </div>
          </div>

          <div class="position-card">
            <h3>{getShortPoolName(pool)} Position</h3>
            <div class="position-details">
              <div class="amount-row">
                <span class="label">Deposit</span>
                <span class="amount">
                  {formatValue(lpData.asset_deposit_value, pool).native}
                  <div class="logo-container small">
                    <img 
                      src={assetLogos[pool] || '/assets/runetools-logo.svg'} 
                      alt={pool}
                      class="asset-icon"
                    />
                    <div class="chain-logo-container">
                      <img 
                        src={`/assets/chains/${pool.split('.')[0]}.svg`}
                        alt={pool.split('.')[0]}
                        class="chain-icon"
                      />
                    </div>
                  </div>
                </span>
                <span class="usd-value">{formatValue(lpData.asset_deposit_value, pool).usd}</span>
              </div>
              <div class="amount-row">
                <span class="label">Change</span>
                <span class="amount {netChange.asset >= 0 ? 'positive' : 'negative'}">
                  {netChange.asset.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div class="logo-container small">
                    <img 
                      src={assetLogos[pool] || '/assets/runetools-logo.svg'} 
                      alt={pool}
                      class="asset-icon"
                    />
                    <div class="chain-logo-container">
                      <img 
                        src={`/assets/chains/${pool.split('.')[0]}.svg`}
                        alt={pool.split('.')[0]}
                        class="chain-icon"
                      />
                    </div>
                  </div>
                </span>
                <span class="usd-value">{formatValue(netChange.asset, pool).usd}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional Info Card -->
        <div class="info-card">
          <h3>Additional Information</h3>
          <div class="info-content">
            <!-- Always show these -->
            {#each Object.entries(lpData) as [key, value]}
              {#if ['rune_address', 'asset_address', 'asset'].includes(key)}
                <div class="info-row">
                  <div class="info-label">
                    {#if key === 'rune_address'}
                      RUNE Address
                    {:else if key === 'asset_address'}
                      Asset Address
                    {:else if key === 'asset'}
                      Pool
                    {/if}
                  </div>
                  <div class="info-value">
                    {#if key === 'rune_address' || key === 'asset_address'}
                      <span class="address">{value}</span>
                    {:else}
                      {value}
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}

            <!-- Show More section -->
            {#if showMore}
              {#each Object.entries(lpData) as [key, value]}
                {#if ['last_add_height', 'last_withdraw_height', 'units', 'pending_rune', 'pending_asset', 'luvi_deposit_value', 'luvi_redeem_value', 'luvi_growth_pct'].includes(key)}
                  <div class="info-row">
                    <div class="info-label">
                      {#if key === 'last_add_height'}
                        Last Add Block
                      {:else if key === 'last_withdraw_height'}
                        Last Withdraw Block
                      {:else if key === 'units'}
                        Liquidity Units
                      {:else if key === 'pending_rune'}
                        Pending RUNE
                      {:else if key === 'pending_asset'}
                        Pending Asset
                      {:else if key === 'luvi_deposit_value'}
                        LUVI Deposit Value
                      {:else if key === 'luvi_redeem_value'}
                        LUVI Redeem Value
                      {:else if key === 'luvi_growth_pct'}
                        LUVI Growth %
                      {/if}
                    </div>
                    <div class="info-value">
                      {#if key === 'last_add_height' || key === 'last_withdraw_height'}
                        <a href={getRunescanUrl(value)} target="_blank" rel="noopener noreferrer">{value}</a>
                      {:else if key === 'luvi_growth_pct'}
                        {(Number(value) * 100).toFixed(2)}%
                      {:else}
                        {value}
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
            {/if}

            <!-- Show More button -->
            <button class="show-more-button" on:click={toggleShowMore}>
              {showMore ? 'Show Less' : 'Show More'}
            </button>
          </div>
        </div>
      {:else}
        <p>No data available for this LP.</p>
      {/if}
    </div>
  </div>
{:else}
  <p>Please select a pool and enter an address to view LP details.</p>
{/if}

<style>
  .lp-detail {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
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

  .total-value {
    text-align: center;
    padding: 20px;
    margin: 20px;
    background-color: #2c2c2c;
    border-radius: 8px;
  }

  .total-label {
    display: block;
    color: #a9a9a9;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .total-amount {
    font-size: 28px;
    font-weight: bold;
    color: white;
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    padding: 20px;
  }

  .stat-box {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
  }

  .stat-label {
    display: block;
    color: #a9a9a9;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: bold;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .position-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    padding: 20px;
  }

  .position-card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 20px;
  }

  .position-card h3 {
    margin: 0 0 15px 0;
    color: #4A90E2;
    font-size: 18px;
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .amount-row:last-child {
    border-bottom: none;
  }

  .label {
    color: #a9a9a9;
    font-size: 14px;
  }

  .amount {
    display: flex;
    align-items: center;
    gap: 5px;
    color: white;
    font-weight: 500;
  }

  .asset-icon {
    width: 20px;
    height: 20px;
  }

  .usd-value {
    color: #a9a9a9;
    font-size: 14px;
  }

  .info-card {
    margin: 20px;
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 20px;
  }

  .info-card h3 {
    margin: 0 0 15px 0;
    color: #4A90E2;
    font-size: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 10px;
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-row {
    display: flex;
    flex-direction: column;
    padding: 12px;
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    gap: 4px;
  }

  .info-row:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .info-label {
    color: #a9a9a9;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    color: white;
    font-family: monospace;
    font-size: 14px;
    word-break: break-all;
  }

  .info-value .address {
    color: #4A90E2;
  }

  .info-value a {
    color: #4A90E2;
    text-decoration: none;
  }

  .info-value a:hover {
    text-decoration: underline;
  }

  @media (min-width: 768px) {
    .info-row {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .info-label {
      min-width: 150px;
      font-size: 13px;
    }

    .info-value {
      text-align: right;
      flex: 1;
    }
  }

  @media (max-width: 768px) {
    .lp-detail {
      padding: 10px;
    }

    .stats-container,
    .position-grid {
      grid-template-columns: 1fr;
    }
  }

  .show-more-button {
    margin-top: 10px;
    background-color: transparent;
    border: 1px solid #4A90E2;
    color: #4A90E2;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
    width: 100%;
    font-size: 14px;
  }

  .show-more-button:hover {
    background-color: #4A90E2;
    color: white;
  }

  .logo-container {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
  }

  .logo-container.small {
    height: 24px;
    width: 24px;
  }

  .asset-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .logo-container.small .asset-icon {
    width: 24px;
    height: 24px;
  }

  .chain-logo-container {
    position: absolute;
    bottom: 0;
    right: -4px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
  }

  .logo-container.small .chain-logo-container {
    width: 12px;
    height: 12px;
    right: -2px;
    bottom: -2px;
  }

  .chain-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    border: none;
    pointer-events: none;
  }

  .logo-container.small .chain-icon {
    width: 12px;
    height: 12px;
  }

  .header-container {
    position: relative;
    padding: 20px;
    background-color: #2c2c2c;
    text-align: center;
  }

  .title-container {
    margin: 0 40px;  /* Make space for the button */
  }

  .header-container h2 {
    padding: 0;
    background-color: transparent;
    margin: 0;
  }

  .copy-url-button {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    color: #4A90E2;
    border: none;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: color 0.3s ease;
  }

  .copy-url-button:hover {
    color: #357abd;
  }

  .copy-url-button svg {
    width: 20px;
    height: 20px;
  }

  @media (max-width: 768px) {
    .header-container {
      padding: 20px 10px;
    }

    .title-container {
      margin: 0 30px;
    }

    .copy-url-button {
      right: 10px;
    }
  }
</style>
