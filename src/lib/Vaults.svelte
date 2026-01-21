<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import {
    copyToClipboard as copyToClipboardUtil,
    shortenAddress as shortenAddressUtil,
    formatThorAmount,
    formatUSD
  } from '$lib/utils/formatting';
  import { Toast, LoadingBar, ChevronDownIcon } from '$lib/components';
  import {
    CHAIN_ICONS,
    CHAIN_EXPLORERS,
    getAsgardVaults,
    sortVaultsByStatus,
    formatVaultName,
    calculateVaultBond,
    calculateVaultAssetValue
  } from '$lib/utils/network';
  import { fetchJSONWithFallback } from '$lib/utils/api';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import { getNodes } from '$lib/utils/nodes';
  import { getAssetLogo, getAssetDisplayName } from '$lib/constants';

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

  // Use shared chain icons directly
  const chainIcons = CHAIN_ICONS;

  // Extend shared chain explorers with app-specific URL overrides
  // BTC: prefers blockstream over mempool, GAIA: uses /account/ path, THOR: uses thorchain.net
  const chainExplorers = {
    ...CHAIN_EXPLORERS,
    'BTC': 'https://blockstream.info/address/',
    'GAIA': 'https://www.mintscan.io/cosmos/account/',
    'THOR': 'https://thorchain.net/address/'
  };

  async function fetchPrices() {
    try {
      const pools = await fetchJSONWithFallback('/thorchain/pools');

      const priceMap = pools.reduce((acc, pool) => {
        const assetExistsInVaults = vaults.some(vault =>
          vault.coins.some(coin => coin.asset === pool.asset)
        );

        if (assetExistsInVaults) {
          acc[pool.asset] = fromBaseUnit(pool.asset_tor_price);
        }
        return acc;
      }, {});

      return { prices: priceMap, pools };
    } catch (e) {
      console.error('Error fetching prices:', e);
      return { prices: {}, pools: [] };
    }
  }

  async function fetchNodesData() {
    try {
      nodesData = await getNodes();
    } catch (e) {
      console.error('Error fetching nodes:', e);
    }
  }

  function calculateVaultBondUSD(bondInRune) {
    if (!networkData) return 0;
    const runePrice = fromBaseUnit(networkData.rune_price_in_tor);
    return bondInRune * runePrice;
  }

  async function fetchNetwork() {
    try {
      networkData = await fetchJSONWithFallback('/thorchain/network');
    } catch (e) {
      console.error('Error fetching network data:', e);
    }
  }

  async function fetchVaults() {
    try {
      const [data] = await Promise.all([
        getAsgardVaults(),
        fetchNodesData(),
        fetchNetwork()
      ]);

      // Sort vaults using shared utility - Active first, then Retiring
      vaults = sortVaultsByStatus(data);

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


  async function copyToClipboard(text, description) {
    const success = await copyToClipboardUtil(text, description);
    if (success) {
      toastMessage = `Copied ${description}!`;
      showToast = true;
    }
  }

  function toggleAllVaults() {
    showAssetBalances = !showAssetBalances;
  }

  // Local wrapper to maintain maxLength behavior using shared utility
  function shortenAddress(address, maxLength = 24) {
    if (!address) return '';
    if (address.length <= maxLength) return address;

    const start = Math.ceil(maxLength / 2);
    const end = Math.floor(maxLength / 2);

    return shortenAddressUtil(address, start, end);
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
      <div class="loading-container">
        <LoadingBar variant="main" width="200px" />
        <LoadingBar variant="sub" width="120px" />
      </div>
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
                  <span class="clickable amount-with-icon" on:click={() => copyToClipboard(Math.floor(calculateVaultBond(vault, nodesData)).toLocaleString(), 'bond amount')}>
                    {Math.floor(calculateVaultBond(vault, nodesData)).toLocaleString()}
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
                  <span class="clickable" on:click={() => copyToClipboard(formatUSD(calculateVaultBondUSD(calculateVaultBond(vault, nodesData))), 'bond value')}>
                    {formatUSD(calculateVaultBondUSD(calculateVaultBond(vault, nodesData)))}
                  </span>
                </div>
                <div class="bond-row">
                  <span>Total Asset Value:</span>
                  <span class="clickable" on:click={() => copyToClipboard(formatUSD(calculateVaultAssetValue(vault.coins, prices)), 'total asset value')}>
                    {formatUSD(calculateVaultAssetValue(vault.coins, prices))}
                  </span>
                </div>
              </div>

              <div class="expand-section">
                <button 
                  class="expand-button" 
                  class:expanded={showAssetBalances}
                  on:click={toggleAllVaults}
                >
                  <ChevronDownIcon size={24} />
                </button>
              </div>

              {#if showAssetBalances}
                <div transition:slide={{ duration: 300 }}>
                  <h4>Asset Balances</h4>
                  {#each vault.coins
                    .filter(coin => prices[coin.asset])
                    .sort((a, b) => {
                      const aValue = fromBaseUnit(a.amount) * prices[a.asset];
                      const bValue = fromBaseUnit(b.amount) * prices[b.asset];
                      return bValue - aValue;
                    }) as coin}
                    {@const assetLogo = getAssetLogo(coin.asset)}
                    {@const assetName = getAssetDisplayName(coin.asset)}
                    {@const chainId = coin.asset.split('.')[0]}
                    <div class="balance-row">
                      <div class="asset-info">
                        <div class="logo-container">
                          {#if assetLogo}
                            <img
                              src={assetLogo}
                              alt={assetName}
                              class="asset-icon"
                              on:error={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/assets/coins/fallback-logo.svg';
                              }}
                            />
                            <div class="chain-logo-container">
                              <img
                                src={`assets/chains/${chainId}.svg`}
                                alt={chainId}
                                class="chain-icon"
                              />
                            </div>
                          {/if}
                        </div>
                        <span class="asset-name">{assetName}</span>
                      </div>
                      <div class="amount-group">
                        <span
                          class="amount clickable"
                          on:click={() => copyToClipboard(formatThorAmount(fromBaseUnit(coin.amount)), `${assetName} amount`)}
                        >{formatThorAmount(fromBaseUnit(coin.amount))}</span>
                        <span
                          class="usd-value clickable"
                          on:click={() => copyToClipboard(formatUSD(fromBaseUnit(coin.amount) * prices[coin.asset]), `${assetName} USD value`)}
                        >{formatUSD(fromBaseUnit(coin.amount) * prices[coin.asset])}</span>
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

<Toast
      message={toastMessage}
      visible={showToast}
      on:hide={() => showToast = false}
    />
  </div>
</main>

<style>
  @import '$lib/styles/variables.css';

  main {
    padding: var(--space-xl);
    color: var(--text-primary);
    background-color: var(--bg-main);
    min-height: 100vh;
    font-family: var(--font-system);
  }

  .container {
    max-width: var(--container-2xl);
    margin: 0 auto;
    padding: 0 var(--space-xl);
  }

  h1 {
    background: var(--gradient-primary);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
    font-size: var(--text-3xl);
    font-weight: var(--font-extrabold);
    letter-spacing: var(--tracking-tight);
    color: var(--text-primary);
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
    animation: shimmerSlide 5s infinite;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: 40px;
  }

  .vaults-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-lg);
    max-width: 100%;
  }

  @media (min-width: 1400px) {
    .vaults-container {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .vault-card {
    background: var(--gradient-card);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-default);
    transition: var(--transition-smooth);
  }

  .vault-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);
    background: var(--gradient-card-hover);
  }

  .card-header {
    background: var(--gradient-primary);
    padding: var(--space-md);
  }

  .card-header.retiring {
    background: var(--gradient-error);
  }

  .card-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    font-family: inherit;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .pubkey {
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: rgba(255, 255, 255, 0.8);
    margin-top: var(--space-sm);
    white-space: nowrap;
  }

  .card-content {
    padding: var(--space-md);
  }

  .address-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
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
    color: var(--text-primary);
    font-weight: var(--font-semibold);
  }

  .address {
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
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
    gap: var(--space-md);
  }

  .asset-name {
    color: var(--text-primary);
    font-weight: var(--font-semibold);
    font-family: inherit;
  }

  .amount {
    font-family: inherit;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .usd-value {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    opacity: 0.9;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: var(--space-sm) 0;
  }

  h4 {
    margin: var(--space-sm) 0;
    color: var(--text-primary);
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    font-family: inherit;
    letter-spacing: -0.2px;
    text-transform: uppercase;
    opacity: 0.9;
  }

  .error {
    color: var(--color-error);
    text-align: center;
    padding: 40px;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    background: rgba(220, 53, 69, 0.1);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  @media (max-width: 600px) {
    main {
      padding: var(--space-md);
    }

    .container {
      padding: 0 var(--space-md);
    }

    h1 {
      font-size: var(--text-2xl);
      padding: var(--space-md);
    }

    .vaults-container {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }

    .card-header {
      padding: 10px;
    }

    .card-header h2 {
      font-size: var(--text-lg);
    }

    .card-content {
      padding: 10px;
    }
  }

  @media (max-width: 400px) {
    main {
      padding: var(--space-sm);
    }

    .container {
      padding: 0 var(--space-sm);
    }

    h1 {
      font-size: 22px;
      padding: 10px;
    }

    .card-header {
      padding: var(--space-sm);
    }

    .card-header h2 {
      font-size: var(--text-md);
    }

    .card-content {
      padding: var(--space-sm);
    }

    .total-bond, .transaction-counts, .signers-container {
      padding: 6px;
    }
  }

  .clickable {
    cursor: pointer;
    user-select: none;
    transition: var(--transition-base);
  }

  .clickable:hover {
    opacity: 0.8;
  }

  .clickable:active {
    opacity: 0.6;
  }

  /* Make text selectable only when copying */
  .address, .amount, .usd-value {
    user-select: none;
  }

  .total-bond {
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: var(--space-sm);
    padding: var(--space-sm);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }

  .bond-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .bond-row:last-child {
    margin-bottom: 0;
  }

  .transaction-counts {
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: var(--space-sm);
    padding: var(--space-sm);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }

  .tx-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .tx-row:last-child {
    margin-bottom: 0;
  }

  .amount-with-icon {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .rune-icon {
    width: 16px;
    height: 16px;
  }

  .expand-section {
    display: flex;
    justify-content: center;
    margin-top: var(--space-sm);
  }

  .expand-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    color: var(--text-primary);
    opacity: 0.7;
    transition: var(--transition-base);
  }

  .expand-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .expand-button.expanded :global(svg) {
    transform: rotate(180deg);
  }

  .expand-button :global(svg) {
    transition: var(--transition-smooth);
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
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
    z-index: var(--z-base);
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
    padding: var(--space-xs);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    flex-shrink: 0;
    transition: var(--transition-base);
    opacity: 0.7;
  }

  .explorer-link:hover {
    color: var(--text-primary);
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
    margin-top: var(--space-xs);
    padding: var(--space-sm);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }

  .signer-tag {
    background: rgba(255, 255, 255, 0.1);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11px;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    transition: var(--transition-base);
  }

  .signer-tag:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }
</style>
