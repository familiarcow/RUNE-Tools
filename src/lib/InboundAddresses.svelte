<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { copyToClipboard as copyToClipboardUtil } from '$lib/utils/formatting';

  let inboundAddresses = [];
  let loading = true;
  let error = null;
  let toastMessage = '';
  let showToast = false;
  let assetPrices = new Map();

  const chainIcons = {
    BTC: 'bitcoin-btc-logo.svg',
    ETH: 'ethereum-eth-logo.svg',
    BCH: 'bitcoin-cash-bch-logo.svg',
    LTC: 'litecoin-ltc-logo.svg',
    DOGE: 'dogecoin-doge-logo.svg',
    AVAX: 'avalanche-avax-logo.svg',
    GAIA: 'cosmos-atom-logo.svg',
    BSC: 'binance-coin-bnb-logo.svg',
    THOR: 'Thorchain_icon.svg',
  };

  const chainToToken = {
    THOR: 'RUNE',
    BSC: 'BNB',
    GAIA: 'ATOM',
    BASE: 'ETH'
  };

  const chainExplorers = {
    THOR: 'https://runescan.io/address/',
    BTC: 'https://mempool.space/address/',
    ETH: 'https://etherscan.io/address/',
    BCH: 'https://blockchair.com/bitcoin-cash/address/',
    LTC: 'https://blockchair.com/litecoin/address/',
    DOGE: 'https://blockchair.com/dogecoin/address/',
    AVAX: 'https://snowtrace.io/address/',
    GAIA: 'https://www.mintscan.io/cosmos/address/',
    BSC: 'https://bscscan.com/address/',
    BASE: 'https://basescan.org/address/'
  };

  const clipboardIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  `;

  const linkIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;

  onMount(async () => {
    try {
      const [inboundResponse, poolsResponse, networkResponse] = await Promise.all([
        fetch('https://thornode.ninerealms.com/thorchain/inbound_addresses'),
        fetch('https://thornode.ninerealms.com/thorchain/pools'),
        fetch('https://thornode.ninerealms.com/thorchain/network')
      ]);

      if (!inboundResponse.ok || !poolsResponse.ok || !networkResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [inboundData, poolsData, networkData] = await Promise.all([
        inboundResponse.json(),
        poolsResponse.json(),
        networkResponse.json()
      ]);

      const runePrice = Number(networkData.rune_price_in_tor) / 1e8;
      assetPrices.set('THOR.RUNE', runePrice);

      poolsData.forEach(pool => {
        const priceInUsd = Number(pool.asset_tor_price) / 1e8;
        assetPrices.set(pool.asset, priceInUsd);
      });

      inboundAddresses = inboundData;
      loading = false;
    } catch (e) {
      error = e.message;
      loading = false;
    }
  });

  async function copyToClipboard(text, description) {
    const success = await copyToClipboardUtil(text, description);
    if (success) {
      toastMessage = `Copied ${description}`;
      showToast = true;
      setTimeout(() => {
        showToast = false;
      }, 3000);
    }
  }

  function formatOutboundFee(fee, chain) {
    const feeValue = parseInt(fee) / 1e8;
    let formattedFee;
    
    if (feeValue >= 0.001) {
      formattedFee = feeValue.toFixed(3);
    } else {
      const decimalPlaces = Math.abs(Math.floor(Math.log10(feeValue))) + 1;
      formattedFee = feeValue.toFixed(Math.max(decimalPlaces, 8));
    }
    
    formattedFee = formattedFee.replace(/\.?0+$/, '');
    const tokenName = chainToToken[chain] || chain;
    
    const assetKey = `${chain}.${tokenName}`;
    const priceInUsd = assetPrices.get(assetKey);
    const feeInUsd = priceInUsd ? feeValue * priceInUsd : null;
    
    return {
      base: `${formattedFee} ${tokenName}`,
      usd: feeInUsd ? `$${feeInUsd.toFixed(2)}` : null
    };
  }

  function formatAddress(address) {
    if (!address || address.length <= 16) return address;
    const start = address.slice(0, 8);
    const end = address.slice(-8);
    return `${start}...${end}`;
  }
</script>

<main>
  <div class="container">
    <h1>THORChain Inbound Addresses</h1>

    {#if loading}
      <p>Loading inbound addresses...</p>
    {:else if error}
      <p class="error">Error: {error}</p>
    {:else}
      <div class="card-grid">
        {#each inboundAddresses as address}
          <div class="card">
            <div class="card-header">
              <img src={`/assets/chains/${address.chain}.svg`} alt={`${address.chain} logo`} class="chain-icon" />
              <h2>{address.chain}</h2>
            </div>
            <div class="card-content">
              <div class="info-row">
                <strong>Inbound Address:</strong>
                <div class="address-container">
                  <span class="address" title={address.address}>{formatAddress(address.address)}</span>
                  <div class="button-group">
                    <button class="icon-button" on:click={() => copyToClipboard(address.address, `${address.chain} inbound address`)}>
                      {@html clipboardIcon}
                    </button>
                    <a 
                      href={chainExplorers[address.chain] + address.address} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="icon-button"
                      title="View on block explorer"
                    >
                      {@html linkIcon}
                    </a>
                  </div>
                </div>
              </div>
              {#if address.router}
                <div class="info-row">
                  <strong>Router Address:</strong>
                  <div class="address-container">
                    <span class="address" title={address.router}>{formatAddress(address.router)}</span>
                    <div class="button-group">
                      <button class="icon-button" on:click={() => copyToClipboard(address.router, `${address.chain} router address`)}>
                        {@html clipboardIcon}
                      </button>
                      <a 
                        href={chainExplorers[address.chain] + address.router} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="icon-button"
                        title="View on block explorer"
                      >
                        {@html linkIcon}
                      </a>
                    </div>
                  </div>
                </div>
              {/if}
              {#if address.chain !== 'THOR' && address.gas_rate}
                <div class="info-row">
                  <strong>Gas Rate:</strong>
                  <span>{address.gas_rate} {address.gas_rate_units}</span>
                </div>
              {/if}
              <div class="info-row">
                <strong>Outbound Fee:</strong>
                <span>
                  {formatOutboundFee(address.outbound_fee, address.chain).base}
                  {#if formatOutboundFee(address.outbound_fee, address.chain).usd}
                    <span class="usd-amount">({formatOutboundFee(address.outbound_fee, address.chain).usd})</span>
                  {/if}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if showToast}
      <div class="toast" transition:fade>
        {toastMessage}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    padding: 20px;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
  }

  h1 {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 30px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #FFFFFF;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
    text-align: center;
  }

  h1::before {
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

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1.5rem;
    max-width: 100%;
  }

  @media (min-width: 1400px) {
    .card-grid {
      grid-template-columns: repeat(3, 1fr);
      max-width: 1200px;
      margin: 0 auto;
    }
  }

  .card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .card-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-bottom: none;
  }

  .chain-icon {
    width: 28px;
    height: 28px;
    margin-right: 12px;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
  }

  .card-header h2 {
    margin: 0;
    color: #FFFFFF;
    font-size: 20px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.2px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .card-content {
    padding: 20px;
  }

  .info-row {
    margin: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-row:first-child {
    margin-top: 0;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  .info-row strong {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a0a0a0;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .address-container {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .address-container:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .address {
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    color: #ffffff;
    letter-spacing: -0.1px;
  }

  .button-group {
    display: flex;
    gap: 6px;
    margin-left: 12px;
  }

  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: #c0c0c0;
    opacity: 0.7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    text-decoration: none;
  }

  .icon-button:hover {
    opacity: 1;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .icon-button:active {
    transform: translateY(0) scale(1.02);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .error {
    color: #dc3545;
    text-align: center;
    padding: 60px;
    font-size: 18px;
    font-weight: 600;
    font-family: inherit;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4A90E2 0%, #357abd 100%);
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-weight: 600;
    z-index: 1000;
    font-size: 14px;
    max-width: 80%;
    text-align: center;
  }

  .usd-amount {
    font-size: 13px;
    color: #a0a0a0;
    margin-left: 6px;
    opacity: 0.9;
  }

  main p {
    text-align: center;
    color: #a0a0a0;
    font-size: 18px;
    font-weight: 600;
    padding: 60px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin: 0;
  }

  @media (max-width: 600px) {
    .container {
      padding: 0 0.75rem;
    }

    h1 {
      font-size: 1.2rem;
    }

    .card-grid {
      grid-template-columns: 1fr;
    }

    .card-header {
      padding: 0.75rem;
    }

    .card-content {
      padding: 0.75rem;
    }

    .chain-icon {
      width: 24px;
      height: 24px;
    }

    .card-header h2 {
      font-size: 1.1rem;
    }

    .info-row strong {
      font-size: 0.8rem;
    }

    .address-container {
      padding: 0.4rem 0.6rem;
    }

    .copy-icon {
      padding: 0.3rem;
    }

    .address {
      font-size: 0.85rem;
    }

    .usd-amount {
      font-size: 0.8em;
    }
  }
</style>
