<script>
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { LinkOutIcon, ChevronDownIcon } from '$lib/components';

  let whales = [];
  let loading = true;
  let error = null;

  const assetIcons = {
    'ETH.USDC': '/assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT': '/assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC': '/assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    // Add any other specific asset icons here
  };

  const chainIcons = {
    BTC: '/assets/coins/bitcoin-btc-logo.svg',
    ETH: '/assets/coins/ethereum-eth-logo.svg',
    BCH: '/assets/coins/bitcoin-cash-bch-logo.svg',
    LTC: '/assets/coins/litecoin-ltc-logo.svg',
    DOGE: '/assets/coins/dogecoin-doge-logo.svg',
    AVAX: '/assets/coins/avalanche-avax-logo.svg',
    BSC: '/assets/coins/binance-coin-bnb-logo.svg',
    GAIA: '/assets/coins/cosmos-atom-logo.svg',
    THOR: '/assets/coins/RUNE-ICON.svg'
  };

  const affiliateInfo = {
    'ti': {
      name: 'Trust Wallet',
      logo: '/assets/services/trustwallet.svg'
    },
    'dx': {
      name: 'ASGARDEX',
      logo: '/assets/services/asgardex.png'
    },
    'te': {
      name: 'Trust Wallet',
      logo: '/assets/services/trustwallet.svg'
    },
    'll': {
      name: 'Ledger Live',
      logo: '/assets/services/ledger.svg'
    },
    't': {
      name: 'THORSwap',
      logo: '/assets/services/thorswap.png'
    },
    'lifi': {
      name: 'Li.Fi',
      logo: '/assets/services/lifi.svg'
    },
    'ss': {
      name: 'ShapeShift',
      logo: '/assets/services/shapeshift.svg'
    },
    'okw': {
      name: 'OKX Wallet',
      logo: '/assets/services/okx.svg'
    },
    'xdf': {
      name: 'CTRL',
      logo: '/assets/services/CTRL.svg'
    },
    '-_': {
      name: 'SwapKit',
      logo: '/assets/services/swapkit.svg'
    },
    '_': {
      name: 'SwapKit',
      logo: '/assets/services/swapkit.svg'
    }
  };

  function getAssetIcon(asset) {
    // Clean the asset name first (remove contract part)
    const cleanedAsset = cleanAssetName(asset);
    
    // For contract assets (e.g. ETH.USDC-1233), use the token icon
    if (cleanedAsset.includes('.') && /.*-\d+.*/.test(asset)) {
      const token = cleanedAsset.split('.')[1];
      return assetIcons[`${cleanedAsset.split('.')[0]}.${token}`] || '/assets/coins/fallback-logo.svg';
    }
    
    // Check if we have a specific asset icon for the cleaned name
    if (assetIcons[cleanedAsset]) {
      return assetIcons[cleanedAsset];
    }
    
    // Fall back to chain icon
    const chain = cleanedAsset.split('.')[0];
    return chainIcons[chain] || '/assets/coins/fallback-logo.svg';
  }

  function formatUSD(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function cleanAssetName(asset) {
    if (!asset) return '';
    // Handle both tilde and hyphen separators
    return asset.split(/[-~]/)[0];
  }

  // Change expandedTxs to an array instead of a Set for better reactivity
  let expandedTxs = [];
  let txDetails = new Map();

  async function toggleDetails(txid) {
    if (expandedTxs.includes(txid)) {
      expandedTxs = expandedTxs.filter(id => id !== txid);
    } else {
      expandedTxs = [...expandedTxs, txid];
      if (!txDetails.has(txid)) {
        await fetchTxDetails(txid);
      }
    }
  }

  async function fetchTxDetails(txid) {
    try {
      const response = await fetch(`https://midgard.ninerealms.com/v2/actions?txid=${txid}`);
      const data = await response.json();
      if (data.actions && data.actions[0]) {
        const action = data.actions[0];
        const affiliateOutput = action.out.find(o => o.affiliate);
        txDetails.set(txid, {
          affiliateAddress: action.metadata.swap.affiliateAddress,
          affiliateFee: action.metadata.swap.affiliateFee,
          liquidityFee: Number(action.metadata.swap.liquidityFee) / 1e8,
          streamingCount: action.metadata.swap.streamingSwapMeta?.count || 'N/A',
          swapSlip: `${(Number(action.metadata.swap.swapSlip) / 100).toFixed(2)}%`,
          affiliateReward: affiliateOutput ? {
            amount: Number(affiliateOutput.coins[0].amount) / 1e8,
            asset: affiliateOutput.coins[0].asset
          } : null
        });
        txDetails = txDetails; // Trigger reactivity
      }
    } catch (err) {
      console.error(`Error fetching details for ${txid}:`, err);
    }
  }

  async function fetchWhales() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/869c011a-1d08-4bb6-97d8-6d6153ed0036/data/latest');
      const data = await response.json();
      
      whales = data
        .filter(whale => whale.HAS_COMPLETED && !whale.WAS_REFUNDED)
        .map(whale => ({
          txid: whale.TX_ID || '',
          date: new Date(whale.START_BLOCK_TIMESTAMP || Date.now()),
          from: {
            asset: cleanAssetName(whale.INBOUND_ASSET || ''),
            originalAsset: whale.INBOUND_ASSET || '',
            amount: whale.INBOUND_AMOUNT || 0,
            usd_value: whale.INBOUND_AMOUNT_USD || 0
          },
          to: {
            asset: cleanAssetName(whale.OUTBOUND_ASSET || ''),
            originalAsset: whale.OUTBOUND_ASSET || '',
            amount: whale.OUTBOUND_AMOUNT || 0,
            usd_value: whale.OUTBOUND_AMOUNT_USD || 0
          },
          streaming: {
            isStreaming: whale.IS_STREAMING || false,
            swapCount: whale.INBOUND_SWAP_COUNT || 0,
            interval: whale.SWAP_INTERVAL || 0,
            timeSeconds: whale.SWAP_TIME_SECONDS || 0
          },
          memo: whale.MEMO || '',
          affiliate: whale.AFFILIATE || '',
          liquidityFeeUsd: whale.LIQ_FEE_USD || 0,
          networkVolumeUsd: whale.NETWORK_VOLUME_USD || 0,
          inbound_address: whale.INBOUND_ADDRESS || '',
          outbound_address: whale.OUTBOUND_ADDRESS || '',
        }));

      // Remove duplicate TXs (keep first occurrence)
      whales = whales.filter((whale, index, self) =>
        index === self.findIndex((t) => t.txid === whale.txid)
      );
        
    } catch (err) {
      error = 'Failed to fetch whale data';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchWhales();
    // Refresh every 60 seconds
    const interval = setInterval(fetchWhales, 60000);
    return () => clearInterval(interval);
  });

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (isMobile) {
      // On mobile, only show the highest unit
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return `${remainingSeconds}s`;
    } else {
      // On desktop, keep current format
      let timeString = '';
      if (hours > 0) {
        timeString += `${hours}h ${minutes}m`;
      } else {
        if (minutes > 0) timeString += `${minutes}m `;
        if (remainingSeconds > 0) timeString += `${remainingSeconds}s`;
      }
      return timeString.trim();
    }
  }

  // Add isMobile detection
  let isMobile = false;

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth <= 600;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Add this helper function to determine if an asset is an ERC20 token
  function isERC20(asset) {
    if (!asset || !asset.includes('.')) return false;
    
    const [chain, token] = asset.split('.');
    
    switch (chain) {
      case 'ETH':
        return token.toLowerCase() !== 'eth';
      case 'BSC':
        return token.toLowerCase() !== 'bnb';
      case 'AVAX':
        return token.toLowerCase() !== 'avax';
      default:
        return false;
    }
  }
</script>

<div class="whale-watching">
  <h2>Swap Leaderboard</h2>
  <p class="subtitle">Monitoring the largest swaps on THORChain in the last 7 days</p>
  
  {#if loading}
    <div class="loading">Loading whale activity...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="whale-list">
      {#each whales as whale, index}
        <div class="whale-card">
          <div class="transaction-header">
            <div class="header-left">
              <div class="info-pill position">
                #{index + 1}
              </div>
              <div class="info-pill">
                {new Date(whale.date).toLocaleDateString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  year: isMobile ? undefined : 'numeric'
                })}
              </div>
              {#if whale.streaming.timeSeconds > 0}
                <div class="info-pill timer">
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {formatTime(whale.streaming.timeSeconds)}
                </div>
              {/if}
              {#if whale.affiliate}
                <div class="info-pill affiliate">
                  {#if affiliateInfo[whale.affiliate]}
                    <img 
                      src={affiliateInfo[whale.affiliate].logo} 
                      alt={affiliateInfo[whale.affiliate].name}
                      class="affiliate-icon"
                      on:error={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/coins/fallback-logo.svg';
                      }}
                    />
                    <span class="affiliate-name">{affiliateInfo[whale.affiliate].name}</span>
                  {:else if whale.affiliate}
                    <span>{whale.affiliate.slice(0, 2)}</span>
                  {/if}
                </div>
              {/if}
              <button 
                class="expand-button" 
                class:expanded={expandedTxs.includes(whale.txid)}
                on:click|stopPropagation={(e) => {
                  e.preventDefault();
                  toggleDetails(whale.txid);
                }}
              >
                <ChevronDownIcon size={12} />
              </button>
            </div>
            <div class="info-pill">
              <span 
                class="txid clickable" 
                on:click={() => {
                  navigator.clipboard.writeText(whale.txid);
                }}
                title="Click to copy full TXID"
              >{whale.txid.slice(-4)}</span>
              <a 
                href={`https://runescan.io/tx/${whale.txid}`} 
                target="_blank" 
                class="tx-link"
                title="View on RuneScan"
              >
                <LinkOutIcon size={16} color="#4a90e2" />
              </a>
            </div>
          </div>

          <div class="transaction-details">
            <div class="swap-details">
              <div class="asset-container">
                <div class="asset-icon-container">
                  <img 
                    src={getAssetIcon(whale.from.asset)} 
                    alt={whale.from.asset}
                    class="asset-icon"
                    on:error={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/coins/fallback-logo.svg';
                    }}
                  />
                  {#if isERC20(whale.from.originalAsset)}
                    <img 
                      src={chainIcons[whale.from.originalAsset.split('.')[0]]} 
                      alt={whale.from.originalAsset.split('.')[0]}
                      class="chain-icon"
                      on:error={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/coins/fallback-logo.svg';
                      }}
                    />
                  {/if}
                </div>
                <div class="asset-info">
                  <div class="asset-amount">
                    <span class="amount">{formatAmount(whale.from.amount)}</span>
                    <span class="asset-name">{whale.from.asset}</span>
                  </div>
                  <span class="usd-value">{formatUSD(whale.from.usd_value)}</span>
                </div>
              </div>

              <div class="arrow">→</div>

              <div class="asset-container">
                <div class="asset-icon-container">
                  <img 
                    src={getAssetIcon(whale.to.asset)} 
                    alt={whale.to.asset}
                    class="asset-icon"
                    on:error={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/coins/fallback-logo.svg';
                    }}
                  />
                  {#if isERC20(whale.to.originalAsset)}
                    <img 
                      src={chainIcons[whale.to.originalAsset.split('.')[0]]} 
                      alt={whale.to.originalAsset.split('.')[0]}
                      class="chain-icon"
                      on:error={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/coins/fallback-logo.svg';
                      }}
                    />
                  {/if}
                </div>
                <div class="asset-info">
                  <div class="asset-amount">
                    <span class="amount">{formatAmount(whale.to.amount)}</span>
                    <span class="asset-name">{whale.to.asset}</span>
                  </div>
                  <span class="usd-value">{formatUSD(whale.to.usd_value)}</span>
                </div>
              </div>
            </div>
          </div>

          {#if expandedTxs.includes(whale.txid)}
            <div class="extended-details" transition:slide>
              <div class="details-grid">
                {#if whale.streaming.isStreaming}
                  <div class="detail-item">
                    <span class="detail-label">Streaming Swap</span>
                    <span class="detail-value">
                      {whale.streaming.swapCount} swaps over {(whale.streaming.timeSeconds / 60).toFixed(1)} minutes
                    </span>
                  </div>
                {/if}
                <div class="detail-item">
                  <span class="detail-label">Liquidity Fee</span>
                  <span class="detail-value">{formatUSD(whale.liquidityFeeUsd)}</span>
                </div>
                {#if whale.affiliate}
                  <div class="detail-item">
                    <span class="detail-label">Affiliate</span>
                    <span class="detail-value">{whale.affiliate}</span>
                  </div>
                {/if}
              </div>
              
              <div class="address-container">
                <div class="address-item">
                  <span class="detail-label">From</span>
                  <span class="address-value" title={whale.inbound_address}>{whale.inbound_address}</span>
                </div>
                <div class="address-item">
                  <span class="detail-label">To</span>
                  <span class="address-value" title={whale.outbound_address}>{whale.outbound_address}</span>
                </div>
              </div>

              <div class="memo-container">
                <span class="detail-label">Memo</span>
                <span class="memo-value" title={whale.memo}>{whale.memo}</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .whale-watching {
    padding: 20px;
    width: fit-content;
    min-width: 300px;
    margin: 0 auto;
  }

  h2 {
    color: #e0e0e0;
    margin-bottom: 10px;
    text-align: center;
  }

  .subtitle {
    color: #a0a0a0;
    text-align: center;
    margin-bottom: 30px;
  }

  .whale-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .whale-card {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 12px;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .whale-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    gap: 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
  }

  .info-pill {
    background: #3a3a3a;
    padding: 4px 8px;
    border-radius: 12px;
    color: #e0e0e0;
    font-size: 0.9em;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    font-family: monospace;
  }

  .affiliate,
  .txid {
    font-family: inherit;
  }

  .txid {
    cursor: pointer;
    transition: color 0.2s;
  }

  .txid:hover {
    color: #4a90e2;
  }

  .tx-link {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s;
  }

  .tx-link:hover {
    opacity: 0.8;
  }

  .runescan-icon {
    width: 24px;
    height: 24px;
  }

  .transaction-details {
    background: #3a3a3a;
    border-radius: 8px;
    padding: 4px 8px;
    width: 100%;
    position: relative;
  }

  .swap-details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    width: 100%;
  }

  .asset-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 4px;
  }

  .asset-icon-container {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .asset-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    padding: 4px;
    background: #2c2c2c;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .chain-icon {
    position: absolute;
    bottom: 0;
    right: -3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #2c2c2c;
    padding: 1px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border: 1px solid #3a3a3a;
  }

  .asset-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .asset-amount {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .amount {
    font-family: monospace;
    color: #e0e0e0;
    font-size: 1em;
    font-weight: 500;
  }

  .asset-name {
    color: #a0a0a0;
    font-size: 0.9em;
  }

  .usd-value {
    color: #4a90e2;
    font-size: 0.8em;
    align-self: flex-start;
  }

  .arrow {
    color: #4a90e2;
    font-size: 1.2em;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .loading {
    color: #a0a0a0;
    text-align: center;
    padding: 20px;
  }

  .error {
    color: #ff3e00;
    text-align: center;
    padding: 20px;
  }

  .extended-details {
    margin-top: 12px;
    padding: 12px;
    background: #3a3a3a;
    border-radius: 8px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    color: #a0a0a0;
    font-size: 0.8em;
    text-transform: uppercase;
  }

  .detail-value {
    color: #e0e0e0;
    font-family: monospace;
    font-size: 0.9em;
  }

  .expand-button {
    width: 20px;
    height: 20px;
    padding: 0;
    background: #3a3a3a;
    border: none;
    border-radius: 50%;
    color: #4a90e2;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.7;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .expand-button:hover {
    opacity: 1;
  }

  .expand-button.expanded svg {
    transform: rotate(180deg);
  }

  .expand-button svg {
    transition: transform 0.2s;
  }

  .timer {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #e0e0e0;
    font-size: 0.9em;
  }

  .timer svg {
    opacity: 0.8;
    color: #4a90e2;
  }

  .affiliate {
    color: #e0e0e0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: monospace;
    white-space: nowrap;
  }

  .affiliate-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .position {
    min-width: 35px;
    justify-content: center;
    font-family: monospace;
    font-weight: 500;
    padding: 4px 6px;
  }

  .memo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    text-align: center;
  }

  .memo-value {
    color: #e0e0e0;
    font-family: monospace;
    font-size: 0.9em;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .address-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 12px 0;
    padding: 8px;
    text-align: center;
  }

  .address-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .address-value {
    color: #e0e0e0;
    font-family: monospace;
    font-size: 0.9em;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .address-value:hover {
    color: #4a90e2;
  }

  @media (max-width: 600px) {
    .whale-watching {
      width: 100%;
      padding: 4px;
    }

    .whale-card {
      padding: 8px;
    }

    .transaction-header {
      margin-bottom: 8px;
      gap: 4px;
    }

    .header-left {
      gap: 4px;
    }

    .info-pill {
      height: 22px;
      padding: 2px 6px;
      font-size: 0.8em;
      gap: 4px;
    }

    .position {
      min-width: 30px;
    }

    .transaction-details {
      padding: 6px;
    }

    .asset-container {
      gap: 6px;
    }

    .asset-icon-container {
      width: 28px;
      height: 28px;
    }

    .asset-icon {
      width: 28px;
      height: 28px;
      padding: 3px;
    }

    .asset-info {
      align-items: center;
    }

    .asset-amount {
      flex-direction: column;  /* Stack vertically only on mobile */
      align-items: center;
      gap: 1px;
    }

    .amount {
      font-size: 0.95em;
    }

    .asset-name {
      font-size: 0.8em;
    }

    .usd-value {
      align-self: center;
    }

    .arrow {
      font-size: 0.9em;
      margin: 1px 0;
    }

    .chain-icon {
      width: 12px;
      height: 12px;
      bottom: -2px;
      right: -2px;
      padding: 1px;
    }

    .affiliate-icon {
      width: 12px;
      height: 12px;
    }
  }
</style>
