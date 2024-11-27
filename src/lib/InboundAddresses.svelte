<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let inboundAddresses = [];
  let loading = true;
  let error = null;
  let toastMessage = '';
  let showToast = false;

  const chainIcons = {
    BTC: 'bitcoin-btc-logo.svg',
    ETH: 'ethereum-eth-logo.svg',
    BCH: 'bitcoin-cash-bch-logo.svg',
    LTC: 'litecoin-ltc-logo.svg',
    DOGE: 'dogecoin-doge-logo.svg',
    AVAX: 'avalanche-avax-logo.svg',
    GAIA: 'cosmos-atom-logo.svg',
    BSC: 'binance-coin-bnb-logo.svg',
  };

  const clipboardIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  `;

  onMount(async () => {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/inbound_addresses');
      if (!response.ok) {
        throw new Error('Failed to fetch inbound addresses');
      }
      inboundAddresses = await response.json();
      loading = false;
    } catch (e) {
      error = e.message;
      loading = false;
    }
  });

  function copyToClipboard(text, description) {
    navigator.clipboard.writeText(text).then(() => {
      toastMessage = `Copied ${description}`;
      showToast = true;
      setTimeout(() => {
        showToast = false;
      }, 3000);
    });
  }

  function formatOutboundFee(fee, chain) {
    const feeValue = parseInt(fee) / 1e8;
    let formattedFee;
    
    if (feeValue >= 0.001) {
      formattedFee = feeValue.toFixed(3);
    } else {
      // Find the first non-zero digit
      const decimalPlaces = Math.abs(Math.floor(Math.log10(feeValue))) + 1;
      formattedFee = feeValue.toFixed(Math.max(decimalPlaces, 8));
    }
    
    // Trim trailing zeros after the decimal point
    formattedFee = formattedFee.replace(/\.?0+$/, '');
    
    return `${formattedFee} ${chain}`;
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
              <img src={`/assets/coins/${chainIcons[address.chain]}`} alt={`${address.chain} logo`} class="chain-icon" />
              <h2>{address.chain}</h2>
            </div>
            <div class="card-content">
              <div class="info-row">
                <strong>Inbound Address:</strong>
                <div class="address-container">
                  <span class="address">{address.address}</span>
                  <button class="copy-icon" on:click={() => copyToClipboard(address.address, `${address.chain} inbound address`)}>
                    {@html clipboardIcon}
                  </button>
                </div>
              </div>
              {#if address.router}
                <div class="info-row">
                  <strong>Router Address:</strong>
                  <div class="address-container">
                    <span class="address">{address.router}</span>
                    <button class="copy-icon" on:click={() => copyToClipboard(address.router, `${address.chain} router address`)}>
                      {@html clipboardIcon}
                    </button>
                  </div>
                </div>
              {/if}
              <div class="info-row">
                <strong>Gas Rate:</strong>
                <span>{address.gas_rate} {address.gas_rate_units}</span>
              </div>
              <div class="info-row">
                <strong>Outbound Fee:</strong>
                <span>{formatOutboundFee(address.outbound_fee, address.chain)}</span>
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
    padding: 1rem;
    color: var(--text-color);
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  h1 {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 1.5rem;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    max-width: 100%;
  }

  @media (min-width: 1400px) {
    .card-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .card {
    background-color: var(--surface-color);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
  }

  .card:hover {
    transform: translateY(-5px);
  }

  .card-header {
    display: flex;
    align-items: center;
    padding: 1rem;
    background-color: #4A90E2;
  }

  .chain-icon {
    width: 24px;
    height: 24px;
    margin-right: 0.5rem;
  }

  .card-header h2 {
    margin: 0;
    color: #ecf0f1;
    font-size: 1.2rem;
  }

  .card-content {
    padding: 1rem;
  }

  .info-row {
    margin: 0.5rem 0;
    display: flex;
    flex-direction: column;
  }

  .info-row strong {
    margin-bottom: 0.25rem;
  }

  .address-container {
    display: flex;
    align-items: center;
  }

  .address {
    font-family: monospace;
    word-break: break-all;
    font-size: 0.9rem;
    flex-grow: 1;
  }

  .copy-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-left: 0.5rem;
    color: #4A90E2;
    transition: color 0.3s ease;
  }

  .copy-icon:hover {
    color: #3A7BC8;
  }

  .error {
    color: #ff3e00;
    text-align: center;
  }

  .toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--surface-color);
    color: var(--text-color);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }

  @media (max-width: 600px) {
    .container {
      padding: 0 1rem;
    }

    h1 {
      font-size: 1.2rem;
    }

    .card-grid {
      grid-template-columns: 1fr;
    }

    .card-header h2 {
      font-size: 1rem;
    }

    .card-content {
      padding: 0.75rem;
    }

    .info-row {
      font-size: 0.9rem;
    }

    .address {
      font-size: 0.8rem;
    }
  }
</style>
