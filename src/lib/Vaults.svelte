<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { slide } from 'svelte/transition';

  let vaults = [];
  let prices = {};
  let loading = true;
  let error = null;
  let toastMessage = '';
  let showToast = false;
  let nodesData = [];
  let pools = [];
  let networkData = null;
  let showAssetBalances = false;

  const chainIcons = {
    BTC: '/assets/chains/BTC.svg',
    ETH: '/assets/chains/ETH.svg',
    BCH: '/assets/chains/BCH.svg',
    LTC: '/assets/chains/LTC.svg',
    DOGE: '/assets/chains/DOGE.svg',
    AVAX: '/assets/chains/AVAX.svg',
    BSC: '/assets/chains/BSC.svg',
    GAIA: '/assets/chains/GAIA.svg',
    THOR: '/assets/chains/THOR.svg',
    BASE: '/assets/chains/BASE.svg',
    XRP: '/assets/chains/XRP.svg',
    TRON: '/assets/chains/TRON.svg'
  };

  const chainExplorers = {
    'BTC': 'https://blockstream.info/address/',
    'ETH': 'https://etherscan.io/address/',
    'BCH': 'https://blockchair.com/bitcoin-cash/address/',
    'LTC': 'https://blockchair.com/litecoin/address/',
    'DOGE': 'https://blockchair.com/dogecoin/address/',
    'AVAX': 'https://snowtrace.io/address/',
    'BSC': 'https://bscscan.com/address/',
    'GAIA': 'https://www.mintscan.io/cosmos/account/',
    'THOR': 'https://thorchain.net/address/',
    'BASE': 'https://basescan.org/address/',
    'XRP': 'https://xrpscan.com/account/',
    'TRON': 'https://tronscan.org/#/address/'
  };

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
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
    'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': 'assets/coins/twt-logo.png',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
    'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'assets/coins/aave-aave-logo.svg',
    'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'assets/coins/chainlink-link-logo.svg',
    'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': 'assets/coins/synthetix-snx-logo.svg',
    'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'assets/coins/fox-token-fox-logo.svg',
    'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': 'assets/coins/solana-sol-logo.svg',
    'BASE.ETH': 'assets/coins/ethereum-eth-logo.svg',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': 'assets/coins/usd-coin-usdc-logo.svg',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'assets/coins/coinbase-wrapped-btc-logo.svg',
    'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': 'assets/coins/dpi-logo.png',
    'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'assets/coins/thorswap-logo.png',
    'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': 'assets/coins/thorswap-logo.png',
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'assets/coins/xrune-logo.png',
    'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': 'assets/coins/tgt-logo.png'
  };

  async function fetchPrices() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      const pools = await response.json();
      
      const priceMap = pools.reduce((acc, pool) => {
        const assetExistsInVaults = vaults.some(vault => 
          vault.coins.some(coin => coin.asset === pool.asset)
        );
        
        if (assetExistsInVaults) {
          acc[pool.asset] = Number(pool.asset_tor_price) / 1e8;
        }
        return acc;
      }, {});

      return { prices: priceMap, pools };
    } catch (e) {
      console.error('Error fetching prices:', e);
      return { prices: {}, pools: [] };
    }
  }

  function formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount) / 1e8);
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatAssetName(asset) {
    const [chain, token] = asset.split('.');
    
    // Handle native assets (e.g., BTC.BTC, ETH.ETH)
    if (token === chain) {
      return token;
    }
    
    // Handle synths and tokens (e.g., AVAX.USDC-0XB97EF9EF8734C71904D8002F)
    const baseToken = token.split('-')[0];
    return `${baseToken} (${chain})`;
  }

  async function fetchNodes() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/nodes');
      nodesData = await response.json();
    } catch (e) {
      console.error('Error fetching nodes:', e);
    }
  }

  function calculateVaultBond(vault) {
    if (!vault || !vault.membership || !nodesData.length) return 0;
    
    const totalBond = vault.membership.reduce((sum, pubkey) => {
      const node = nodesData.find(n => n.pub_key_set?.secp256k1 === pubkey);
      if (node) {
        return sum + Number(node.total_bond);
      }
      return sum;
    }, 0);
    
    return totalBond / 1e8;
  }

  function calculateVaultBondUSD(bondInRune) {
    if (!networkData) return 0;
    const runePrice = Number(networkData.rune_price_in_tor) / 1e8;
    return bondInRune * runePrice;
  }

  function calculateTotalAssetValue(coins) {
    return coins.reduce((sum, coin) => {
      if (prices[coin.asset]) {
        const amount = Number(coin.amount) / 1e8;
        return sum + (amount * prices[coin.asset]);
      }
      return sum;
    }, 0);
  }

  async function fetchNetwork() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
      networkData = await response.json();
    } catch (e) {
      console.error('Error fetching network data:', e);
    }
  }

  async function fetchVaults() {
    try {
      const [vaultsResponse] = await Promise.all([
        fetch('https://thornode.ninerealms.com/thorchain/vaults/asgard'),
        fetchNodes(),
        fetchNetwork()
      ]);
      
      const data = await vaultsResponse.json();
      
      // Sort vaults - Active first, then Retiring
      vaults = data.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === 'ActiveVault' ? -1 : 1;
      });
      
      const priceData = await fetchPrices();
      prices = priceData.prices;
      pools = priceData.pools;
      loading = false;
    } catch (e) {
      error = e.message;
      loading = false;
    }
  }

  onMount(() => {
    fetchVaults();
  });

  function formatVaultName(pubKey) {
    return pubKey.slice(-4).toUpperCase();
  }

  function formatUSDValue(amount, price = 1) {
    const value = price === 1 ? amount : (Number(amount) / 1e8) * price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  function copyToClipboard(text, description) {
    navigator.clipboard.writeText(text).then(() => {
      toastMessage = `Copied ${description}!`;
      showToast = true;
      setTimeout(() => {
        showToast = false;
      }, 3000);
    });
  }

  function toggleAllVaults() {
    showAssetBalances = !showAssetBalances;
  }

  function shortenAddress(address, maxLength = 24) {
    if (!address) return '';
    if (address.length <= maxLength) return address;
    
    const start = Math.ceil(maxLength / 2);
    const end = Math.floor(maxLength / 2);
    
    return address.slice(0, start) + '...' + address.slice(-end);
  }

  function openExplorer(chain, address) {
    const explorerUrl = chainExplorers[chain];
    if (explorerUrl) {
      window.open(explorerUrl + address, '_blank');
    }
  }
</script>

<main>
  <div class="container">
    <h1>THORChain Vaults</h1>

    {#if loading}
      <div class="loading">Loading vaults...</div>
    {:else if error}
      <div class="error">Error: {error}</div>
    {:else}
      <div class="vaults-container">
        {#each vaults as vault}
          <div class="vault-card" transition:fade>
            <div class="card-header" class:retiring={vault.status === 'RetiringVault'}>
              <h2>Vault {formatVaultName(vault.pub_key)}{vault.status === 'RetiringVault' ? ' (Retiring)' : ''}</h2>
              <div class="pubkey clickable" on:click={() => copyToClipboard(vault.pub_key, 'vault ECDSA pubkey')}>
                ECDSA: {shortenAddress(vault.pub_key)}
              </div>
              {#if vault.pub_key_eddsa}
                <div class="pubkey clickable" on:click={() => copyToClipboard(vault.pub_key_eddsa, 'vault EdDSA pubkey')}>
                  EdDSA: {shortenAddress(vault.pub_key_eddsa)}
                </div>
              {/if}
            </div>

            <div class="card-content">
              <h4>Chain Addresses</h4>
              {#each vault.addresses as address}
                <div class="address-row">
                  <img 
                    src={chainIcons[address.chain.split('.')[0]]} 
                    alt={address.chain}
                    class="chain-icon"
                    on:error={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/coins/fallback-logo.svg';
                    }}
                  />
                  <span class="chain-name">{address.chain}</span>
                  <span 
                    class="address clickable" 
                    on:click={() => copyToClipboard(address.address, `${address.chain} address`)}
                  >{shortenAddress(address.address)}</span>
                  {#if chainExplorers[address.chain]}
                    <button 
                      class="explorer-link" 
                      on:click={() => openExplorer(address.chain, address.address)}
                      title="View on explorer"
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        stroke-width="2" 
                        stroke-linecap="round" 
                        stroke-linejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15,3 21,3 21,9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </button>
                  {/if}
                </div>
              {/each}

              <hr />

              {#if vault.inbound_tx_count !== undefined || vault.outbound_tx_count !== undefined}
                <div class="transaction-counts">
                  <div class="tx-row">
                    <span>Transactions In:</span>
                    <span class="clickable" on:click={() => copyToClipboard(vault.inbound_tx_count?.toLocaleString() || '0', 'inbound transaction count')}>
                      {(vault.inbound_tx_count || 0).toLocaleString()}
                    </span>
                  </div>
                  <div class="tx-row">
                    <span>Transactions Out:</span>
                    <span class="clickable" on:click={() => copyToClipboard(vault.outbound_tx_count?.toLocaleString() || '0', 'outbound transaction count')}>
                      {(vault.outbound_tx_count || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              {/if}

              <div class="total-bond">
                <div class="bond-row">
                  <span>Total Bond:</span>
                  <span class="clickable amount-with-icon" on:click={() => copyToClipboard(Math.floor(calculateVaultBond(vault)).toLocaleString(), 'bond amount')}>
                    {Math.floor(calculateVaultBond(vault)).toLocaleString()}
                    <img 
                      src="/assets/coins/RUNE-ICON.svg" 
                      alt="RUNE"
                      class="rune-icon"
                      on:error={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/coins/fallback-logo.svg';
                      }}
                    />
                  </span>
                </div>
                <div class="bond-row">
                  <span> Total Bond Value:</span>
                  <span class="clickable" on:click={() => copyToClipboard(formatUSDValue(calculateVaultBondUSD(calculateVaultBond(vault))), 'bond value')}>
                    {formatUSDValue(calculateVaultBondUSD(calculateVaultBond(vault)))}
                  </span>
                </div>
                <div class="bond-row">
                  <span>Total Asset Value:</span>
                  <span class="clickable" on:click={() => copyToClipboard(formatUSDValue(calculateTotalAssetValue(vault.coins)), 'total asset value')}>
                    {formatUSDValue(calculateTotalAssetValue(vault.coins))}
                  </span>
                </div>
              </div>

              <div class="expand-section">
                <button 
                  class="expand-button" 
                  class:expanded={showAssetBalances}
                  on:click={toggleAllVaults}
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              {#if showAssetBalances}
                <div transition:slide={{ duration: 300 }}>
                  <h4>Asset Balances</h4>
                  {#each vault.coins
                    .filter(coin => prices[coin.asset])
                    .sort((a, b) => {
                      const aValue = (Number(a.amount) / 1e8) * prices[a.asset];
                      const bValue = (Number(b.amount) / 1e8) * prices[b.asset];
                      return bValue - aValue;
                    }) as coin}
                    <div class="balance-row">
                      <div class="asset-info">
                        <div class="logo-container">
                          {#if assetLogos[coin.asset]}
                            <img 
                              src={assetLogos[coin.asset]} 
                              alt={formatAssetName(coin.asset)}
                              class="asset-icon"
                            />
                            <div class="chain-logo-container">
                              <img 
                                src={`assets/chains/${coin.asset.split('.')[0]}.svg`}
                                alt={coin.asset.split('.')[0]}
                                class="chain-icon"
                              />
                            </div>
                          {/if}
                        </div>
                        <span class="asset-name">{formatAssetName(coin.asset)}</span>
                      </div>
                      <div class="amount-group">
                        <span 
                          class="amount clickable" 
                          on:click={() => copyToClipboard(formatAmount(coin.amount), `${formatAssetName(coin.asset)} amount`)}
                        >{formatAmount(coin.amount)}</span>
                        <span 
                          class="usd-value clickable" 
                          on:click={() => copyToClipboard(formatUSDValue(coin.amount, prices[coin.asset]), `${formatAssetName(coin.asset)} USD value`)}
                        >{formatUSDValue(coin.amount, prices[coin.asset])}</span>
                      </div>
                    </div>
                  {/each}
                </div>

                {#if vault.membership && vault.membership.length > 0}
                  <div transition:slide={{ duration: 300 }}>
                    <h4>Signers ({vault.membership.length})</h4>
                    <div class="signers-container">
                      {#each vault.membership as signer}
                        <div class="signer-tag clickable" on:click={() => copyToClipboard(signer, 'signer pubkey')}>
                          {signer.slice(-4).toUpperCase()}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/if}
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
    margin-bottom: 16px;
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

  .vaults-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    max-width: 100%;
  }

  @media (min-width: 1400px) {
    .vaults-container {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .vault-card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .vault-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .card-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 12px;
  }

  .card-header.retiring {
    background: linear-gradient(135deg, #ff6b6b 0%, #dc3545 100%);
  }

  .card-header h2 {
    margin: 0;
    color: #FFFFFF;
    font-size: 20px;
    font-weight: 700;
    font-family: inherit;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .pubkey {
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 8px;
    white-space: nowrap;
  }

  .card-content {
    padding: 12px;
  }

  .address-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 13px;
    width: 100%;
  }

  .chain-icon {
    width: 24px;
    height: 24px;
  }

  .chain-name {
    min-width: 60px;
    flex-shrink: 0;
    color: #ffffff;
    font-weight: 600;
  }

  .address {
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    color: #c0c0c0;
    white-space: nowrap;
    flex: 1;
  }

  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
    font-size: 13px;
  }

  .amount-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .asset-name {
    color: #ffffff;
    font-weight: 600;
    font-family: inherit;
  }

  .amount {
    font-family: inherit;
    font-weight: 600;
    color: #ffffff;
  }

  .usd-value {
    font-size: 12px;
    font-weight: 500;
    color: #a0a0a0;
    opacity: 0.9;
  }

  hr {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 8px 0;
  }

  h4 {
    margin: 8px 0;
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.2px;
    text-transform: uppercase;
    opacity: 0.9;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #a0a0a0;
    font-size: 18px;
    font-weight: 600;
  }

  .error {
    color: #dc3545;
    text-align: center;
    padding: 40px;
    font-size: 18px;
    font-weight: 600;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  @media (max-width: 600px) {
    main {
      padding: 12px;
    }

    .container {
      padding: 0 12px;
    }

    h1 {
      font-size: 24px;
      padding: 12px;
    }

    .vaults-container {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .card-header {
      padding: 10px;
    }

    .card-header h2 {
      font-size: 18px;
    }

    .card-content {
      padding: 10px;
    }
  }

  @media (max-width: 400px) {
    main {
      padding: 8px;
    }

    .container {
      padding: 0 8px;
    }

    h1 {
      font-size: 22px;
      padding: 10px;
    }

    .card-header {
      padding: 8px;
    }

    .card-header h2 {
      font-size: 16px;
    }

    .card-content {
      padding: 8px;
    }

    .total-bond, .transaction-counts, .signers-container {
      padding: 6px;
    }
  }

  .clickable {
    cursor: pointer;
    user-select: none;
    transition: opacity 0.2s ease;
  }

  .clickable:hover {
    opacity: 0.8;
  }

  .clickable:active {
    opacity: 0.6;
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

  /* Make text selectable only when copying */
  .address, .amount, .usd-value {
    user-select: none;
  }

  .total-bond {
    font-size: 13px;
    color: #ffffff;
    margin-bottom: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .bond-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .bond-row:last-child {
    margin-bottom: 0;
  }

  .transaction-counts {
    font-size: 13px;
    color: #ffffff;
    margin-bottom: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tx-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .tx-row:last-child {
    margin-bottom: 0;
  }

  .amount-with-icon {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rune-icon {
    width: 16px;
    height: 16px;
  }

  .expand-section {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .expand-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    color: #ffffff;
    opacity: 0.7;
    transition: all 0.2s ease;
  }

  .expand-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .expand-button.expanded svg {
    transform: rotate(180deg);
  }

  .expand-button svg {
    transition: transform 0.3s ease;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .asset-info .logo-container {
    position: relative;
    display: flex;
    align-items: center;
    height: 24px;
  }

  .asset-info .asset-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .asset-info .chain-logo-container {
    position: absolute;
    bottom: -2px;
    right: -4px;
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
  }

  .asset-info .chain-icon {
    width: 12px;
    height: 12px;
    object-fit: contain;
    border: none;
    pointer-events: none;
  }

  /* Restore original chain address icons */
  .address-row .chain-icon {
    width: 24px;
    height: 24px;
  }

  .explorer-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: #c0c0c0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    flex-shrink: 0;
    transition: all 0.2s ease;
    opacity: 0.7;
  }

  .explorer-link:hover {
    color: #ffffff;
    opacity: 1;
    transform: scale(1.1);
  }

  .explorer-link:active {
    transform: scale(0.95);
  }

  /* Signers styles */
  .signers-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }



  .signer-tag {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .signer-tag:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }
</style>
