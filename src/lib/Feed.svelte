<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import LinkOutIcon from './LinkOutIcon.svelte';

  let transactions = [];
  let transactionQueue = [];
  let isProcessingQueue = false;
  let loading = true;
  let error = null;
  let lastBlockHeight = null;
  let isPaused = false;
  let feedContainer;
  let seenTxIds = new Set();
  let assetPrices = new Map();
  let txStatusCache = new Map();

  // Reuse asset icons from WhaleWatching
  const assetIcons = {
    'ETH.USDC': '/assets/coins/usd-coin-usdc-logo.svg',
    'ETH.USDT': '/assets/coins/tether-usdt-logo.svg',
    'ETH.WBTC': '/assets/coins/wrapped-bitcoin-wbtc-logo.svg',
    'BSC.USDT': '/assets/coins/tether-usdt-logo.svg',
    'AVAX.USDT': '/assets/coins/tether-usdt-logo.svg',
    'AVAX.USDC': '/assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDC': '/assets/coins/usd-coin-usdc-logo.svg',
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

  // Reuse affiliate info from WhaleWatching
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
    },
    'tb': {
      name: 'Trust Wallet',
      logo: '/assets/services/trustwallet.svg'
    },
    'td': {
      name: 'Trust Wallet',
      logo: '/assets/services/trustwallet.svg'
    },
    'bgw': {
      name: 'Bitget',
      logo: '/assets/services/bitget.svg'
    },
    'ej': {
      name: 'Edge',
      logo: '/assets/services/edge.svg'
    }
  };

  const knownAddresses = {
    'thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt': 'Reserve',
    'thor1g98cy3n9mmjrpn0sxmn63lztelera37n8n67c0': 'Pool Module',
    'thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv': 'Bond Module',
    'thor1v8ppstuf6e3x0r4glqc68d5jqcs2tf38cg2q6y': 'Synth Module',
    'thor1cqg8pyxnq03d88cl3xfn5wzjkguw5kh9enwte4': 'Binance Cold',
    'thor1t60f02r8jvzjrhtnjgfj4ne6rs5wjnejwmj7fh': 'Binance Hot',
    'thor1nm0rrq86ucezaf8uj35pq9fpwr5r82clphp95t': 'Kraken Hot',
    'thor1t2hav42urasnsvwa6x6fyezaex9f953plh72pq': 'Kraken Cold',
    'thor1mtqtupwgjwn397w3dx9fqmqgzrfzq3240frash': 'Bybit',
    'thor1d8c0wv4y72kmlytegjmgx825xwumt9qt5xe07k': 'Dev Fund',
    // Add more known addresses here as needed
  };

  function formatAddress(address) {
    // Check if it's a known address first
    if (knownAddresses[address]) {
      return knownAddresses[address];
    }
    
    // Otherwise return truncated address
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
  }

  function formatAmount(amount, decimals = 8) {
    // Extract numeric value and denomination
    const match = amount.match(/^(\d+)(.+)$/);
    if (!match) return '0 UNKNOWN';
    
    const [_, value, denom] = match;
    
    // Special case for RUNE - it's always in 1e8 format
    if (denom.toLowerCase().includes('rune')) {
      const numericValue = Number(value) / 1e8;
      return `${numericValue.toFixed(8).replace(/\.?0+$/, '')} ${denom.toUpperCase()}`;
    }
    
    // For other assets, normalize to 1e8 decimals
    const numericValue = (Number(value) * 1e8) / Math.pow(10, decimals);
    
    // Process the denomination
    let formattedDenom = denom.toUpperCase();
    
    // Handle complex asset names with / or ~
    if (formattedDenom.includes('/') || formattedDenom.includes('~')) {
      const separator = formattedDenom.includes('/') ? '/' : '~';
      const [chain, asset] = formattedDenom.split(separator);
      // Remove contract address part (everything after -)
      const cleanAsset = asset.split('-')[0];
      formattedDenom = `${cleanAsset} (${chain.toUpperCase()})`;
    }
    
    // Format the numeric value
    let formattedValue;
    if (numericValue === 0) {
      formattedValue = '0';
    } else if (numericValue < 0.01) {
      formattedValue = numericValue.toFixed(8);
    } else if (numericValue < 1) {
      formattedValue = numericValue.toFixed(4);
    } else {
      formattedValue = numericValue.toFixed(2);
    }
    
    // Remove trailing zeros after decimal point
    formattedValue = formattedValue.replace(/\.?0+$/, '');
    
    return `${formattedValue} ${formattedDenom}`;
  }

  // Add a counter for truly unique keys
  let transactionCounter = 0;

  function getUniqueKey(tx) {
    // Increment counter for each key generation
    transactionCounter++;
    
    if (tx.type === 'transfer') {
      return `transfer-${tx.height}-${tx.sender}-${tx.recipient}-${tx.amount}-${transactionCounter}`;
    } else if (tx.type === 'observed') {
      // Include only essential information and the counter
      return `observed-${tx.height}-${tx.txid}-${transactionCounter}`;
    }
    return `unknown-${Date.now()}-${transactionCounter}`;
  }

  // Update processQueue to handle duplicates differently
  async function processQueue() {
    if (isProcessingQueue || transactionQueue.length === 0 || isPaused) return;
    
    isProcessingQueue = true;
    
    // Filter out duplicates based on transaction ID
    transactionQueue = transactionQueue.filter(tx => {
      // For observed transactions, check the txid
      if (tx.type === 'observed') {
        if (seenTxIds.has(tx.txid)) return false;
        seenTxIds.add(tx.txid);
        return true;
      }
      
      // For other transaction types, use the existing content key approach
      const contentKey = `${tx.height}-${tx.sender}-${tx.recipient}-${tx.amount}`;
      if (seenTxIds.has(contentKey)) return false;
      seenTxIds.add(contentKey);
      return true;
    });
    
    const itemCount = transactionQueue.length;
    if (itemCount === 0) {
      isProcessingQueue = false;
      return;
    }
    
    // Calculate delay - aim to show all items over 4 seconds, leaving 2 seconds buffer
    const delayBetweenItems = 4000 / itemCount;
    
    // Process one item at a time
    for (let i = 0; i < itemCount; i++) {
      const nextItem = transactionQueue[i];
      transactions = [nextItem, ...transactions].slice(0, 100);
      
      // Wait before processing next item
      if (i < itemCount - 1) {  // Don't wait after the last item
        await new Promise(resolve => setTimeout(resolve, delayBetweenItems));
      }
    }
    
    // Clear the queue after processing all items
    transactionQueue = [];
    isProcessingQueue = false;
  }

  function handleScroll(e) {
    if (!feedContainer) return;
    
    // If we're scrolled away from the top, pause updates
    isPaused = feedContainer.scrollTop > 0;
  }

  async function fetchLatestBlock() {
    // Don't fetch if paused
    if (isPaused) return;

    try {
      const response = await fetch('https://thornode.thorchain.liquify.com/thorchain/block');
      const data = await response.json();
      
      if (!lastBlockHeight || data.header.height > lastBlockHeight) {
        lastBlockHeight = data.header.height;
        const blockTime = data.header.time;
        
        let newTransactions = [];

        // Process transfers as before
        const transfers = data.end_block_events
          .filter(event => {
            if (event.type !== 'transfer') return false;
            const isSenderKnown = knownAddresses.hasOwnProperty(event.sender);
            const isRecipientKnown = knownAddresses.hasOwnProperty(event.recipient);
            return !(isSenderKnown && isRecipientKnown);
          })
          .map(transfer => ({
            type: 'transfer',
            height: lastBlockHeight,
            timestamp: blockTime,
            sender: transfer.sender,
            recipient: transfer.recipient,
            amount: transfer.amount,
            formattedAmount: formatAmount(transfer.amount)
          }));

        newTransactions.push(...transfers);

        // Process observed transactions
        if (data.txs) {
          const observedTxs = data.txs
            .filter(tx => {
              const messages = tx.tx?.body?.messages || [];
              return messages.some(msg => 
                msg['@type'] === '/types.MsgObservedTxOut' || 
                msg['@type'] === '/types.MsgObservedTxIn'
              );
            })
            .flatMap(tx => {
              const messages = tx.tx.body.messages;
              return messages
                .filter(msg => 
                  msg['@type'] === '/types.MsgObservedTxOut' || 
                  msg['@type'] === '/types.MsgObservedTxIn'
                )
                .flatMap(msg => msg.txs
                  .filter(observedTx => observedTx.tx.memo !== 'consolidate')
                  .map(observedTx => ({
                    type: 'observed',
                    txType: msg['@type'],
                    height: lastBlockHeight,
                    timestamp: blockTime,
                    txid: observedTx.tx.id,
                    chain: observedTx.tx.chain,
                    from: observedTx.tx.from_address,
                    to: observedTx.tx.to_address,
                    coins: observedTx.tx.coins.map(coin => {
                      const amount = Number(coin.amount) / 1e8;
                      return {
                        asset: coin.asset,
                        amount: amount,
                        formattedAmount: `${amount.toFixed(8).replace(/\.?0+$/, '')} ${coin.asset}`
                      };
                    }),
                    memo: observedTx.tx.memo,
                    inAsset: null,
                    inAmount: null
                  })));
            });

          newTransactions.push(...observedTxs);
        }

        // Add new transactions to queue
        if (newTransactions.length > 0) {
          transactionQueue.push(...newTransactions);
          processQueue();
        }
        
        loading = false;
      }
    } catch (err) {
      console.error('Error fetching block:', err);
      error = 'Failed to fetch latest block';
      loading = false;
    }
  }

  async function fetchAssetPrices() {
    try {
      // Get RUNE price from network endpoint
      const networkResponse = await fetch('https://thornode.ninerealms.com/thorchain/network');
      const networkData = await networkResponse.json();
      const runePrice = Number(networkData.rune_price_in_tor);  // Keep as 1e8
      
      // Get pool prices
      const poolsResponse = await fetch('https://thornode.thorchain.liquify.com/thorchain/pools');
      const pools = await poolsResponse.json();
      
      // Update price map with RUNE price
      assetPrices.set('THOR.RUNE', runePrice);
      
      // Update price map with pool prices
      pools.forEach(pool => {
        const normalizedAsset = normalizeAssetName(pool.asset);
        // Keep asset_tor_price in 1e8 format
        assetPrices.set(normalizedAsset, Number(pool.asset_tor_price));
      });
      
      assetPrices = assetPrices;
      
    } catch (err) {
      console.error('Error fetching asset prices:', err);
    }
  }

  async function fetchTxStatus(txid) {
    // Check cache first
    if (txStatusCache.has(txid)) {
      return txStatusCache.get(txid);
    }
    
    try {
      const response = await fetch(`https://thornode.thorchain.liquify.com/thorchain/tx/status/${txid}`);
      const data = await response.json();
      
      // Clean and normalize the asset name
      let cleanAsset = data.tx.coins[0].asset;
      if (cleanAsset.includes('-')) {
        cleanAsset = cleanAsset.split('-')[0];
      }
      if (cleanAsset.includes('~')) {
        cleanAsset = cleanAsset.split('~')[0] + '.' + cleanAsset.split('~')[1];
      }
      
      const result = {
        inAsset: cleanAsset,
        inAmount: Number(data.tx.coins[0].amount),  // Keep raw amount
        memo: data.tx.memo  // Add memo to the result
      };
      
      // Cache the result
      txStatusCache.set(txid, result);
      return result;
    } catch (err) {
      console.error('Error fetching tx status:', err);
      return null;
    }
  }

  function getTxIdFromMemo(memo) {
    if (!memo || !memo.startsWith('OUT:')) return null;
    return memo.split(':')[1];
  }

  onMount(() => {
    fetchLatestBlock();
    fetchAssetPrices();
    
    // Poll for new blocks and prices
    const blockInterval = setInterval(fetchLatestBlock, 6000);
    const priceInterval = setInterval(fetchAssetPrices, 30000); // Update prices every 30s
    
    return () => {
      clearInterval(blockInterval);
      clearInterval(priceInterval);
    };
  });

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Add this function to get friendly names for transaction types
  function getTransactionTypeName(type) {
    const typeMap = {
      '/types.MsgObservedTxOut': 'Outbound',
      '/types.MsgObservedTxIn': 'Inbound',
      // Add more types as needed
    };
    return typeMap[type] || type;
  }

  // Helper function to format USD value
  function formatUSD(value) {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '< $0.01';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  // Update the coin display components to show prices
  function getAssetPrice(asset) {
    const normalizedAsset = normalizeAssetName(asset);
    const price = assetPrices.get(normalizedAsset);
    
    console.log('Price Lookup:', {
      originalAsset: asset,
      normalizedAsset,
      rawPrice: price,
      usdPrice: price ? price / 1e8 : null
    });
    
    return price || 0;
  }

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

  function getAssetIcon(asset) {
    // Clean the asset name (handle both - and ~ separators)
    let cleanAsset = asset;
    if (asset.includes('-')) {
      cleanAsset = asset.split('-')[0];
    }
    if (asset.includes('~')) {
      cleanAsset = asset.split('~')[0] + '.' + asset.split('~')[1];
    }
    cleanAsset = cleanAsset.toUpperCase();
    
    // Check if we have a specific asset icon
    if (assetIcons[cleanAsset]) {
      return assetIcons[cleanAsset];
    }
    
    // Fall back to chain icon
    const chain = cleanAsset.split('.')[0];
    return chainIcons[chain] || '/assets/coins/fallback-logo.svg';
  }

  // Add this helper function to parse memo for affiliate
  function getAffiliateFromMemo(memo) {
    if (!memo) return null;
    
    const parts = memo.split(':');
    if (parts.length < 5) return null;
    
    // Get the affiliate section (5th part) and take first affiliate if multiple
    const affiliatePart = parts[4].split('/')[0];
    return affiliatePart || null;
  }

  function getOutAssetFromMemo(memo) {
    // Check for any memo starting with =:
    if (!memo?.startsWith('=:')) return null;
    
    const parts = memo.split(':');
    if (parts.length < 2) return null;
    
    // Get the asset part
    let assetPart = parts[1];
    
    // Handle short codes
    const shortCodes = {
      'r': 'THOR.RUNE',
      'a': 'AVAX.AVAX',
      'b': 'BTC.BTC',
      'c': 'BCH.BCH',
      'e': 'ETH.ETH',
      'g': 'GAIA.ATOM',
      's': 'BSC.BNB',
      'd': 'DOGE.DOGE',
      'l': 'LTC.LTC'
    };
    
    // If the asset part is a single letter that matches a short code, replace it
    if (shortCodes[assetPart]) {
      return shortCodes[assetPart];
    }
    
    // Otherwise return the original asset part
    return assetPart;
  }

  // Update the formatAssetName function to handle unknown formats
  function formatAssetName(asset) {
    if (!asset) return '';
    
    // Handle both - and ~ separators
    let cleanAsset = asset;
    if (asset.includes('-')) {
      cleanAsset = asset.split('-')[0];
    }
    if (asset.includes('~')) {
      cleanAsset = asset.split('~')[0] + '.' + asset.split('~')[1];
    }
    
    // If no dots, return as is (for unknown formats)
    if (!cleanAsset.includes('.')) return cleanAsset;
    
    // Split into chain and token parts
    const [chain, token] = cleanAsset.split('.');
    
    // If no token part, just return the chain
    if (!token) return chain;
    
    // Special case for RUNE
    if (token === 'RUNE') return 'RUNE';
    
    // For other assets, return just the token part
    return token;
  }

  // Add this helper function to normalize asset names for price matching
  function normalizeAssetName(asset) {
    if (!asset) return '';
    
    // Handle both - and ~ separators
    let cleanAsset = asset;
    if (asset.includes('-')) {
      cleanAsset = asset.split('-')[0];
    }
    if (asset.includes('~')) {
      cleanAsset = asset.split('~')[0] + '.' + asset.split('~')[1];
    }
    
    // Special case for RUNE
    if (cleanAsset === 'RUNE') {
      return 'THOR.RUNE';
    }
    
    return cleanAsset;
  }

  // Add this new helper function
  function formatMemoDisplay(memo) {
    if (!memo) return '';
    
    const parts = memo.split(':');
    return parts.map(part => {
      // If part is longer than 12 characters, truncate it
      if (part.length > 12) {
        return part.slice(0, 6) + '...' + part.slice(-4);
      }
      return part;
    }).join(':');
  }
</script>

<div 
  class="feed" 
  bind:this={feedContainer}
  on:scroll={handleScroll}
>
  <h2>Transaction Feed</h2>
  
  {#if isPaused}
    <div class="pause-indicator" on:click={() => isPaused = false}>
      ⏸️ Feed paused (click to resume)
    </div>
  {/if}
  
  {#if loading && transactions.length === 0}
    <div class="loading">Loading transaction feed...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="transaction-list">
      {#each transactions as tx (getUniqueKey(tx))}
        <div 
          class="transaction-card" 
          in:slide|local={{ duration: 150, easing: cubicOut }}
          animate:flip={{ duration: 200, easing: cubicOut }}
        >
          <div class="transaction-header">
            <div class="header-left">
              <div class="info-pill">
                Block #{tx.height}
              </div>
              <div class="info-pill">
                {formatTime(tx.timestamp)}
              </div>
              {#if tx.txType}
                <div class="info-pill type" class:inbound={tx.txType === '/types.MsgObservedTxIn'} class:outbound={tx.txType === '/types.MsgObservedTxOut'}>
                  {getTransactionTypeName(tx.txType)}
                </div>
              {/if}
              {#if tx.memo && getAffiliateFromMemo(tx.memo)}
                {#if affiliateInfo[getAffiliateFromMemo(tx.memo)]}
                  <div class="info-pill affiliate">
                    <img 
                      src={affiliateInfo[getAffiliateFromMemo(tx.memo)].logo} 
                      alt={affiliateInfo[getAffiliateFromMemo(tx.memo)].name}
                      class="affiliate-icon"
                      on:error={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/coins/fallback-logo.svg';
                      }}
                    />
                    <span class="affiliate-name">{affiliateInfo[getAffiliateFromMemo(tx.memo)].name}</span>
                  </div>
                {:else}
                  <div class="info-pill affiliate">
                    <span>{getAffiliateFromMemo(tx.memo)}</span>
                  </div>
                {/if}
              {/if}
              {#if tx.txType === '/types.MsgObservedTxOut' && tx.memo && getTxIdFromMemo(tx.memo)}
                {#await fetchTxStatus(getTxIdFromMemo(tx.memo)) then status}
                  {#if status?.memo && getAffiliateFromMemo(status.memo)}
                    {#if affiliateInfo[getAffiliateFromMemo(status.memo)]}
                      <div class="info-pill affiliate">
                        <img 
                          src={affiliateInfo[getAffiliateFromMemo(status.memo)].logo} 
                          alt={affiliateInfo[getAffiliateFromMemo(status.memo)].name}
                          class="affiliate-icon"
                          on:error={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/assets/coins/fallback-logo.svg';
                          }}
                        />
                        <span class="affiliate-name">{affiliateInfo[getAffiliateFromMemo(status.memo)].name}</span>
                      </div>
                    {:else}
                      <div class="info-pill affiliate">
                        <span>{getAffiliateFromMemo(status.memo)}</span>
                      </div>
                    {/if}
                  {/if}
                {/await}
              {/if}
            </div>
            <div class="info-pill">
              {#if tx.type === 'observed'}
                <span 
                  class="txid clickable" 
                  on:click={() => navigator.clipboard.writeText(tx.txid)}
                  title="Click to copy TXID"
                >{tx.txid.slice(-4)}</span>
                <a 
                  href={`https://runescan.io/tx/${tx.txid}`} 
                  target="_blank" 
                  class="tx-link"
                  title="View on RuneScan"
                >
                  <LinkOutIcon size={16} color="#4a90e2" />
                </a>
              {/if}
            </div>
          </div>

          <!-- Transaction details will go here -->
          <div class="transaction-details">
            {#if tx.type === 'transfer'}
              <div class="transfer-info">
                <div class="swap-details">
                  <div class="asset-container">
                    <div class="asset-icon-container">
                      <img 
                        src={getAssetIcon(tx.amount.split(/[^A-Z0-9.]/)[1])} 
                        alt={tx.amount.split(/[^A-Z0-9.]/)[1]}
                        class="asset-icon"
                        on:error={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/coins/fallback-logo.svg';
                        }}
                      />
                    </div>
                    <div class="asset-info">
                      <div class="asset-amount">
                        <span class="amount">{tx.formattedAmount}</span>
                      </div>
                      {#if tx.amount.includes('rune')}
                        <span class="usd-value">
                          {formatUSD((Number(tx.amount.split('rune')[0]) / 1e8) * (getAssetPrice('THOR.RUNE') / 1e8))}
                        </span>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="transfer-addresses">
                    <div class="address">
                      <span class="label">From:</span>
                      <span 
                        class="value clickable" 
                        title="Click to copy address"
                        on:click={() => navigator.clipboard.writeText(tx.sender)}
                      >{formatAddress(tx.sender)}</span>
                    </div>
                    <div class="address">
                      <span class="label">To:</span>
                      <span 
                        class="value clickable" 
                        title="Click to copy address"
                        on:click={() => navigator.clipboard.writeText(tx.recipient)}
                      >{formatAddress(tx.recipient)}</span>
                    </div>
                  </div>
                </div>
              </div>
            {:else if tx.type === 'observed'}
              <div class="swap-details">
                <div class="asset-container">
                  {#if tx.txType === '/types.MsgObservedTxOut' && tx.memo && getTxIdFromMemo(tx.memo)}
                    {#await fetchTxStatus(getTxIdFromMemo(tx.memo)) then status}
                      {#if status?.inAsset && status?.inAmount}
                        <div class="asset-icon-container">
                          <img 
                            src={getAssetIcon(status.inAsset)} 
                            alt={status.inAsset}
                            class="asset-icon"
                            on:error={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/assets/coins/fallback-logo.svg';
                            }}
                          />
                          {#if isERC20(status.inAsset)}
                            <img 
                              src={chainIcons[status.inAsset.split('.')[0]]} 
                              alt={status.inAsset.split('.')[0]}
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
                            <span class="amount">{(status.inAmount / 1e8).toFixed(4)} {formatAssetName(status.inAsset)}</span>
                          </div>
                          {#if getAssetPrice(status.inAsset)}
                            <span class="usd-value">
                              {formatUSD((status.inAmount * (getAssetPrice(status.inAsset) / 1e8)) / 1e8)}
                            </span>
                          {/if}
                        </div>
                        <div class="swap-arrow">→</div>
                      {/if}
                    {/await}
                  {/if}

                  {#each tx.coins as coin}
                    <div class="asset-icon-container">
                      <img 
                        src={getAssetIcon(coin.asset)} 
                        alt={coin.asset}
                        class="asset-icon"
                        on:error={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/coins/fallback-logo.svg';
                        }}
                      />
                      {#if isERC20(coin.asset)}
                        <img 
                          src={chainIcons[coin.asset.split('.')[0]]} 
                          alt={coin.asset.split('.')[0]}
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
                        <span class="amount">
                          {(Number(coin.amount) * 1e8 / Math.pow(10, coin.decimals || 8)).toFixed(4)} {formatAssetName(coin.asset)}
                        </span>
                      </div>
                      {#if getAssetPrice(coin.asset)}
                        <span class="usd-value">
                          {formatUSD((Number(coin.amount) * getAssetPrice(coin.asset)) / 1e8)}
                        </span>
                      {/if}
                    </div>
                  {/each}

                  {#if tx.txType === '/types.MsgObservedTxIn' && tx.memo && getOutAssetFromMemo(tx.memo)}
                    <div class="swap-loader">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path 
                          d="M 4 12 L 20 12 M 13 5 L 20 12 L 13 19" 
                          fill="none" 
                          stroke="currentColor" 
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </div>
                    <div class="asset-icon-container">
                      <img 
                        src={getAssetIcon(getOutAssetFromMemo(tx.memo))} 
                        alt={getOutAssetFromMemo(tx.memo)}
                        class="asset-icon"
                        on:error={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/coins/fallback-logo.svg';
                        }}
                      />
                      {#if isERC20(getOutAssetFromMemo(tx.memo))}
                        <img 
                          src={chainIcons[getOutAssetFromMemo(tx.memo).split('.')[0]]} 
                          alt={getOutAssetFromMemo(tx.memo).split('.')[0]}
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
                        <span class="amount">{formatAssetName(getOutAssetFromMemo(tx.memo))}</span>
                      </div>
                    </div>
                  {/if}
                </div>
                
                {#if tx.memo}
                  <div 
                    class="memo clickable" 
                    on:click={() => navigator.clipboard.writeText(tx.memo)}
                    title="Click to copy full memo"
                  >
                    <span class="label">Memo:</span>
                    <span class="value">{formatMemoDisplay(tx.memo)}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .feed {
    padding: 20px;
    width: 100%;
    max-width: 600px;
    min-width: 300px;
    margin: 0 auto;
    height: calc(100vh - 140px);
    overflow-y: auto;
    position: relative;
    
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: #4a90e2 #2c2c2c;
  }

  /* Chrome, Edge, Safari */
  .feed::-webkit-scrollbar {
    width: 8px;
  }

  .feed::-webkit-scrollbar-track {
    background: #2c2c2c;
    border-radius: 4px;
  }

  .feed::-webkit-scrollbar-thumb {
    background: #4a90e2;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .feed::-webkit-scrollbar-thumb:hover {
    background: #357abd;
  }

  /* Hide scrollbar when not scrolling (optional) */
  .feed::-webkit-scrollbar-thumb:vertical {
    min-height: 30px;
  }

  /* Dark mode optimization */
  @media (prefers-color-scheme: dark) {
    .feed::-webkit-scrollbar-track {
      background: #1c1c1c;
    }
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

  .transaction-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    will-change: transform;
  }

  .transaction-card {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 12px;
    transform-origin: top;
    will-change: transform;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .transaction-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  /* Reuse relevant styles from WhaleWatching.svelte */
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

  /* Add mobile responsiveness */
  @media (max-width: 600px) {
    .feed {
      width: 100%;
      padding: 4px;
    }

    .transaction-card {
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
  }

  .transfer-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .transfer-addresses {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .address {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 0.9em;
  }

  .address .label {
    color: #808080;
    flex-shrink: 0;
    width: 45px;
  }

  .address .value {
    color: #e0e0e0;
  }

  .address .value.clickable {
    cursor: pointer;
    transition: color 0.2s;
  }

  .address .value.clickable:hover {
    color: #4a90e2;
  }

  .address .value.clickable:active {
    color: #2d5f9e;
  }

  @media (max-width: 600px) {
    .transfer-addresses {
      font-size: 0.8em;
    }
  }

  .observed-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }

  .chain-info {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #a0a0a0;
    font-family: monospace;
    font-size: 0.9em;
  }

  .coins {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  .pause-indicator {
    position: sticky;
    top: 0;
    background: #2d5f9e;
    padding: 8px;
    text-align: center;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    z-index: 10;
    color: #e0e0e0;
    box-shadow: 0 2px 8px rgba(45, 95, 158, 0.3);
    transition: background-color 0.2s;
  }

  .pause-indicator:hover {
    background: #357abd;
  }

  /* Add styling for the type pill */
  .info-pill.type {
    font-size: 0.8em;
    white-space: nowrap;
  }

  .info-pill.type.inbound {
    background: #2d5f9e;
  }

  .info-pill.type.outbound {
    background: #9e2d2d;
  }

  /* Add styles for memo display */
  .memo {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 8px;
    background: #3a3a3a;
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.9em;
    word-break: break-word;
    transition: background-color 0.2s;
  }

  .memo.clickable {
    cursor: pointer;
  }

  .memo.clickable:hover {
    background: #444;
  }

  .memo.clickable:active {
    background: #4a4a4a;
  }

  .memo .label {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .memo .value {
    color: #e0e0e0;
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
  }

  .amount-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .usd-value {
    color: #808080;
    font-size: 0.8em;
    font-family: monospace;
  }

  .swap-details {
    background: #3a3a3a;
    border-radius: 8px;
    padding: 4px 8px;
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .asset-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 4px;
    justify-content: center;
    max-width: fit-content;
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

  .header-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
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

  .affiliate-name {
    font-size: 0.9em;
  }

  .swap-arrow {
    color: #4a90e2;
    font-size: 1.5em;
    margin: 0 8px;
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .swap-arrow {
      margin: 0 4px;
      font-size: 1.2em;
    }
  }

  .loading-indicator {
    display: flex;
    gap: 4px;
    align-items: center;
    margin: 0 12px;
  }

  .dot {
    width: 6px;
    height: 6px;
    background: #4a90e2;
    border-radius: 50%;
    animation: pulse 1.4s infinite;
    opacity: 0.4;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  .swap-loader {
    color: #4a90e2;
    margin: 0 8px;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .swap-loader svg {
    width: 24px;
    height: 24px;
    animation: slide-right 1.5s ease-in-out infinite;
  }

  @keyframes slide-right {
    0% {
      transform: translateX(-30%);
      opacity: 0;
    }
    50% {
      transform: translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateX(30%);
      opacity: 0;
    }
  }

  @media (max-width: 600px) {
    .swap-loader {
      margin: 0 4px;
    }
    
    .swap-loader svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Ensure the feed container stays within viewport */
  @media (max-height: 600px) {
    .feed {
      height: calc(100vh - 100px);
    }
  }
</style>
