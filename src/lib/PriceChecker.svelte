<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';
  import { PageHeader, LoadingBar, Toast } from '$lib/components';
  import { formatNumber, formatUSD } from '$lib/utils/formatting';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import { getPoolsWithTradeData } from '$lib/utils/liquidity';
  import { getAssetLogo, getChainLogo, getAssetDisplayName } from '$lib/constants/assets';

  // Refresh intervals
  const THORNODE_REFRESH_INTERVAL = 6000; // ~1 block
  const COINGECKO_REFRESH_BLOCKS = 5; // Refresh CoinGecko every 5 blocks (30 seconds)

  const pools = writable([]);
  const currentTab = writable('prices');
  const externalPrices = writable({});
  const showPoolInfo = writable(false);
  const showTradeBalanceInUSD = writable(false);

  // Auto-refresh state
  let isPaused = false;
  let dataInterval;
  let timerInterval;
  let progress = 0;
  let blockCount = 0; // Track blocks for CoinGecko refresh timing

  // CoinGecko rate limit handling
  let rateLimitToast = false;
  let rateLimitRetryCount = 0;
  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000; // 5 seconds base delay for backoff

  // Starred and ignored assets (persisted to localStorage)
  const STORAGE_KEY = 'pricechecker-preferences';
  const DEFAULT_IGNORED = [
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C',
    'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E',
    'THOR.TCY',
    'THOR.RUJI'
  ];
  let starredAssets = new Set();
  let ignoredAssets = new Set(DEFAULT_IGNORED);

  function loadPreferences() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { starred = [], ignored = [] } = JSON.parse(saved);
        starredAssets = new Set(starred);
        ignoredAssets = new Set(ignored);
      }
      // ignoredAssets defaults to DEFAULT_IGNORED if nothing was saved
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        starred: [...starredAssets],
        ignored: [...ignoredAssets]
      }));
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  }

  function toggleStar(asset) {
    if (starredAssets.has(asset)) {
      starredAssets.delete(asset);
    } else {
      starredAssets.add(asset);
      ignoredAssets.delete(asset); // Can't be both starred and ignored
    }
    starredAssets = starredAssets; // Trigger reactivity
    ignoredAssets = ignoredAssets;
    savePreferences();
  }

  function toggleIgnore(asset) {
    if (ignoredAssets.has(asset)) {
      ignoredAssets.delete(asset);
    } else {
      ignoredAssets.add(asset);
      starredAssets.delete(asset); // Can't be both starred and ignored
    }
    starredAssets = starredAssets; // Trigger reactivity
    ignoredAssets = ignoredAssets;
    savePreferences();
  }

  function resetPreferences() {
    starredAssets = new Set();
    ignoredAssets = new Set();
    savePreferences();
  }

  const bitcoinAssets = [
    'BTC.BTC',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF'
  ];

  const stablecoinAssets = [
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913'
  ];

  const assetToCoinGeckoMap = {
    'BTC.BTC': 'bitcoin',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'wrapped-bitcoin',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'usd-coin',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'tether',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580': 'usd-coin',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'tether',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'gemini-dollar',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'liquity-usd',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'usd-coin',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'paxos-standard',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'tether',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'dai',
    'BCH.BCH': 'bitcoin-cash',
    'BSC.BNB': 'binancecoin',
    'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': 'solana',
    'DOGE.DOGE': 'dogecoin',
    'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'aave',
    'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': 'defipulse-index',
    'ETH.ETH': 'ethereum',
    'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'chainlink',
    'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': 'havven',
    'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': 'thorwallet',
    'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'fox-token',
    'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'shapeshift',
    'GAIA.ATOM': 'cosmos',
    'LTC.LTC': 'litecoin',
    'AVAX.AVAX': 'avalanche-2',
    'BASE.ETH': 'ethereum',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDAA02913': 'usd-coin',
    'BASE.CBTC-0XCB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'coinbase-wrapped-btc',
    'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': 'trust-wallet-token',
    'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'thorswap',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'coinbase-wrapped-btc',
    'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'shapeshift-fox-token',
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'thorstarter',
    'TRON.TRX': 'tron',
    'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56': 'binance-usd',
    'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C': 'bitcoin',
    'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8': 'ethereum',
    'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': 'yearn-finance'
  };

  async function getPools() {
    try {
      const poolsData = await getPoolsWithTradeData({ availableOnly: true });
      return poolsData
        .map(pool => ({
          asset: pool.asset,
          usd_price: pool.usd_price,
          rune_depth: Number(pool.balance_rune),
          asset_depth: Number(pool.balance_asset),
          trade_asset_depth: pool.trade_asset_depth,
          balance_asset: Number(pool.balance_asset)
        }))
        .sort((a, b) => b.rune_depth - a.rune_depth);
    } catch (error) {
      console.error('Failed to fetch pools:', error);
      return [];
    }
  }

  async function getExternalPrices(assets, retryCount = 0) {
    const uniqueAssets = [...new Set(assets.map(asset => assetToCoinGeckoMap[asset] || asset.split('.')[1].toLowerCase()))];
    const ids = uniqueAssets.join(',');
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

      // Check for rate limiting (429) or service unavailable (503)
      if (response.status === 429 || response.status === 503 || !response.ok) {
        // Rate limited - show toast and retry with exponential backoff
        rateLimitToast = true;
        rateLimitRetryCount = retryCount + 1;
        console.warn(`CoinGecko returned status ${response.status}`);

        if (retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retryCount);
          console.warn(`CoinGecko rate limited. Retrying in ${delay/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return getExternalPrices(assets, retryCount + 1);
        } else {
          console.error('CoinGecko rate limit: max retries exceeded');
          return $externalPrices; // Return existing prices if we have them
        }
      }

      // Success - clear toast and reset retry count
      rateLimitToast = false;
      rateLimitRetryCount = 0;

      const data = await response.json();

      // Check if CoinGecko returned an error in the JSON response
      if (data.status?.error_code) {
        console.warn('CoinGecko API error:', data.status);
        rateLimitToast = true;
        return $externalPrices;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch external prices:', error);
      // Show toast on network errors too
      rateLimitToast = true;
      rateLimitRetryCount = retryCount + 1;

      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        console.warn(`Network error. Retrying in ${delay/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getExternalPrices(assets, retryCount + 1);
      }

      return $externalPrices; // Return existing prices on error
    }
  }


  function getExternalPrice(asset) {
    const coinGeckoId = assetToCoinGeckoMap[asset] || asset.split('.')[1].toLowerCase();
    let price = $externalPrices[coinGeckoId]?.usd;

    // If the price is not found, check for USDC or USDT alternatives
    if (!price && (asset.includes('USDC') || asset.includes('USDT'))) {
      price = $externalPrices['usd-coin']?.usd || $externalPrices['tether']?.usd;
    }

    return price || null;
  }


  // Show data even without external prices
  // Filter ignored, sort starred to top, then by difference or rune depth
  $: combinedPoolData = $pools.length > 0
    ? $pools
        .filter(pool => !ignoredAssets.has(pool.asset)) // Filter out ignored
        .map(pool => {
          const externalPrice = getExternalPrice(pool.asset);
          const difference = externalPrice ? ((pool.usd_price - externalPrice) / externalPrice) * 100 : null;
          const tradeBalanceUSD = (pool.trade_asset_depth / 1e8) * pool.usd_price;
          const totalPoolDepthUSD = (pool.balance_asset / 1e8) * 2 * pool.usd_price;
          const tradePoolRatio = (pool.trade_asset_depth / (2 * pool.balance_asset)) * 100;

          return {
            ...pool,
            externalPrice,
            difference,
            tradeBalanceUSD,
            totalPoolDepthUSD,
            tradePoolRatio,
            isStarred: starredAssets.has(pool.asset)
          };
        })
        .sort((a, b) => {
          // Starred assets always come first
          if (a.isStarred && !b.isStarred) return -1;
          if (!a.isStarred && b.isStarred) return 1;

          // Then sort by absolute difference if available
          if (a.difference !== null && b.difference !== null) {
            return Math.abs(b.difference) - Math.abs(a.difference);
          }
          // Otherwise sort by rune depth
          return b.rune_depth - a.rune_depth;
        })
    : [];

  // Count of ignored assets for UI feedback
  $: ignoredCount = ignoredAssets.size;

  function startTimer() {
    progress = 0;
    if (timerInterval) clearInterval(timerInterval);

    const INCREMENT = (100 / (THORNODE_REFRESH_INTERVAL / 100));

    timerInterval = setInterval(() => {
      if (!isPaused) {
        progress = (progress + INCREMENT) % 100;
      }
    }, 100);
  }

  async function fetchThorNodeData() {
    const poolsData = await getPools();
    pools.set(poolsData);
    return poolsData;
  }

  async function fetchCoinGeckoData(assets) {
    if (!assets || assets.length === 0) {
      console.warn('CoinGecko: No assets to fetch');
      return;
    }
    console.log('CoinGecko: Fetching prices for', assets.length, 'assets');
    const prices = await getExternalPrices(assets);
    if (Object.keys(prices).length > 0) {
      console.log('CoinGecko: Got prices for', Object.keys(prices).length, 'assets');
      externalPrices.set(prices);
    }
  }

  async function fetchData(forceCoinGecko = false) {
    const poolsData = await fetchThorNodeData();
    const assets = poolsData.map(pool => pool.asset);

    // Only fetch CoinGecko on first load or every COINGECKO_REFRESH_BLOCKS
    if (forceCoinGecko || blockCount % COINGECKO_REFRESH_BLOCKS === 0) {
      if (forceCoinGecko) {
        // Await on initial load so we have prices immediately
        await fetchCoinGeckoData(assets);
      } else {
        // Run in background on subsequent refreshes
        fetchCoinGeckoData(assets);
      }
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    if (!isPaused) {
      progress = 0;
    }
  }

  onMount(() => {
    // Load starred/ignored preferences from localStorage
    loadPreferences();

    // Initial fetch - force CoinGecko on first load, then start timer
    (async () => {
      await fetchData(true);

      // Only start the refresh interval after initial data is loaded
      startTimer();
      dataInterval = setInterval(() => {
        if (!isPaused) {
          blockCount++;
          fetchData();
          progress = 0;
        }
      }, THORNODE_REFRESH_INTERVAL);
    })();
  });

  onDestroy(() => {
    if (dataInterval) clearInterval(dataInterval);
    if (timerInterval) clearInterval(timerInterval);
  });


  // Use shared formatUSD with 2 decimal places
  function formatNumberUSD(number) {
    return formatUSD(number, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function filterAssets(pools, assetList) {
    return pools.filter(pool => assetList.includes(pool.asset));
  }

  function getColorForDifference(difference) {
    const absDifference = Math.abs(difference);
    if (absDifference < 1) return 'inherit';
    if (absDifference < 5) {
      const t = (absDifference - 1) / 4;
      return `rgb(255, ${255 - Math.floor(t * 255)}, 0)`;
    }
    if (absDifference < 10) {
      const t = (absDifference - 5) / 5;
      return `rgb(255, ${Math.floor((1 - t) * 255)}, 0)`;
    }
    return 'rgb(255, 0, 0)';
  }

  function formatPriceDifference(difference) {
    if (difference === null) return { text: 'N/A', color: 'inherit' };
    const text = difference.toFixed(2) + '%';
    const color = getColorForDifference(difference);
    return { text, color };
  }

  function flipScroll(node, { duration = 400, delay = 0 }) {
    return {
      delay,
      duration,
      css: (t, u) => {
        const eased = cubicOut(t);
        return `
          transform: rotateX(${90 * u}deg);
          transform-origin: center top;
          opacity: ${t};
          transform-style: preserve-3d;
          backface-visibility: hidden;
        `;
      }
    };
  }
</script>

<main>
  <Toast
    message="CoinGecko unavailable. Using THORChain prices only.{rateLimitRetryCount > 0 ? ` (Retry ${rateLimitRetryCount}/${MAX_RETRIES})` : ''}"
    visible={rateLimitToast}
    duration={0}
    variant="warning"
    on:hide={() => rateLimitToast = false}
  />

  <div class="container">
    <PageHeader title="Price Checker">
      <div slot="actions" class="header-actions">
        <div class="header-tabs">
          <button
            class="header-tab {$currentTab === 'prices' ? 'active' : ''}"
            on:click={() => currentTab.set('prices')}
          >
            All Prices
          </button>
          <button
            class="header-tab {$currentTab === 'likeAssetComparison' ? 'active' : ''}"
            on:click={() => currentTab.set('likeAssetComparison')}
          >
            Compare
          </button>
        </div>

        <div class="header-controls">
          <button
            class="icon-button"
            class:active={$showPoolInfo}
            on:click={() => showPoolInfo.update(v => !v)}
            title={$showPoolInfo ? 'Hide pool info' : 'Show pool info'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>

          {#if $showPoolInfo}
            <button
              class="icon-button"
              class:active={$showTradeBalanceInUSD}
              on:click={() => showTradeBalanceInUSD.update(v => !v)}
              title={$showTradeBalanceInUSD ? 'Show in asset units' : 'Show in USD'}
            >
              <span class="icon-text">$</span>
            </button>
          {/if}

          {#if starredAssets.size > 0 || ignoredAssets.size > 0}
            <button
              class="icon-button reset-button"
              on:click={resetPreferences}
              title="Reset starred and hidden assets"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          {/if}

          <button
            class="refresh-button"
            class:paused={isPaused}
            on:click={togglePause}
            title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            <svg class="progress-ring" width="28" height="28">
              <circle
                class="progress-ring__circle-bg"
                stroke-width="2"
                fill="transparent"
                r="12"
                cx="14"
                cy="14"
              />
              <circle
                class="progress-ring__circle"
                stroke-width="2"
                fill="transparent"
                r="12"
                cx="14"
                cy="14"
                style="stroke-dashoffset: {(75.4 * (100 - progress)) / 100}"
              />
            </svg>
            <span class="button-icon">
              {#if isPaused}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              {:else}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              {/if}
            </span>
          </button>
        </div>
      </div>
    </PageHeader>

    {#key $currentTab}
      <div class="tab-content" in:flipScroll>
        {#if $currentTab === 'prices'}
          {#if combinedPoolData.length > 0}
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th class="actions-col"></th>
                    <th>Asset</th>
                    <th><span class="th-full">THORChain Price</span><span class="th-short">TC</span></th>
                    <th><span class="th-full">External Price</span><span class="th-short">Ext</span></th>
                    <th><span class="th-full">Difference</span><span class="th-short">Diff</span></th>
                    {#if $showPoolInfo}
                      <th><span class="th-full">Trade Balance {$showTradeBalanceInUSD ? '(USD)' : '(Asset)'}</span><span class="th-short">Trade</span></th>
                      <th><span class="th-full">Pool Depth USD</span><span class="th-short">Depth</span></th>
                      <th><span class="th-full">Trade/Pool Ratio</span><span class="th-short">Ratio</span></th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each combinedPoolData as pool (pool.asset)}
                    {@const difference = formatPriceDifference(pool.difference)}
                    {@const chain = pool.asset.split('.')[0]}
                    {@const assetLogo = getAssetLogo(pool.asset)}
                    {@const chainLogo = getChainLogo(chain)}
                    {@const displayName = getAssetDisplayName(pool.asset)}
                    <tr animate:flip={{ duration: 300 }} class:starred={pool.isStarred}>
                      <td class="actions-cell">
                        <button
                          class="row-action star"
                          class:active={pool.isStarred}
                          on:click={() => toggleStar(pool.asset)}
                          title={pool.isStarred ? 'Unstar' : 'Star to top'}
                        >
                          ★
                        </button>
                        <button
                          class="row-action ignore"
                          on:click={() => toggleIgnore(pool.asset)}
                          title="Hide asset"
                        >
                          ✕
                        </button>
                      </td>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogo}
                            <img
                              src={assetLogo}
                              alt={displayName}
                              class="asset-icon"
                              on:error={(e) => e.target.style.display = 'none'}
                            />
                            {#if chainLogo}
                              <div class="chain-logo-container">
                                <img
                                  src={chainLogo}
                                  alt={chain}
                                  class="chain-icon"
                                  on:error={(e) => e.target.style.display = 'none'}
                                />
                              </div>
                            {/if}
                          {/if}
                        </div>
                        {displayName}
                      </td>
                      <td class="price-cell">{formatNumberUSD(pool.usd_price)}</td>
                      <td class="price-cell">{pool.externalPrice ? formatNumberUSD(pool.externalPrice) : 'N/A'}</td>
                      <td class="difference-cell" style="color: {difference.color}">{difference.text}</td>
                      {#if $showPoolInfo}
                        <td class="balance-cell">
                          {$showTradeBalanceInUSD
                            ? formatNumberUSD(fromBaseUnit(pool.trade_asset_depth) * pool.usd_price)
                            : formatNumber(fromBaseUnit(pool.trade_asset_depth), { maximumFractionDigits: 8 })}
                        </td>
                        <td class="price-cell">{formatNumberUSD(pool.totalPoolDepthUSD)}</td>
                        <td class="ratio-cell">{pool.tradePoolRatio.toFixed(2)}%</td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="loading">Loading data...</div>
          {/if}
        {:else}
          {#if combinedPoolData.length > 0}
          <section class="comparison-section">
            <h3>Bitcoin Assets</h3>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th><span class="th-full">THORChain Price</span><span class="th-short">TC</span></th>
                    <th><span class="th-full">External Price</span><span class="th-short">Ext</span></th>
                    <th><span class="th-full">Difference</span><span class="th-short">Diff</span></th>
                  </tr>
                </thead>
                <tbody>
                  {#each filterAssets(combinedPoolData, bitcoinAssets) as pool (pool.asset)}
                    {@const difference = formatPriceDifference(pool.difference)}
                    {@const chain = pool.asset.split('.')[0]}
                    {@const assetLogo = getAssetLogo(pool.asset)}
                    {@const chainLogo = getChainLogo(chain)}
                    {@const displayName = getAssetDisplayName(pool.asset)}
                    <tr animate:flip={{ duration: 300 }}>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogo}
                            <img
                              src={assetLogo}
                              alt={displayName}
                              class="asset-icon"
                              on:error={(e) => e.target.style.display = 'none'}
                            />
                            {#if chainLogo}
                              <div class="chain-logo-container">
                                <img
                                  src={chainLogo}
                                  alt={chain}
                                  class="chain-icon"
                                  on:error={(e) => e.target.style.display = 'none'}
                                />
                              </div>
                            {/if}
                          {/if}
                        </div>
                        {displayName}
                      </td>
                      <td class="price-cell">{formatNumberUSD(pool.usd_price)}</td>
                      <td class="price-cell">{pool.externalPrice ? formatNumberUSD(pool.externalPrice) : 'N/A'}</td>
                      <td class="difference-cell" style="color: {difference.color}">{difference.text}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </section>

          <section class="comparison-section">
            <h3>Stablecoins</h3>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th><span class="th-full">THORChain Price</span><span class="th-short">TC</span></th>
                    <th><span class="th-full">External Price</span><span class="th-short">Ext</span></th>
                    <th><span class="th-full">Difference</span><span class="th-short">Diff</span></th>
                  </tr>
                </thead>
                <tbody>
                  {#each filterAssets(combinedPoolData, stablecoinAssets) as pool (pool.asset)}
                    {@const difference = formatPriceDifference(pool.difference)}
                    {@const chain = pool.asset.split('.')[0]}
                    {@const assetLogo = getAssetLogo(pool.asset)}
                    {@const chainLogo = getChainLogo(chain)}
                    {@const displayName = getAssetDisplayName(pool.asset)}
                    <tr animate:flip={{ duration: 300 }}>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogo}
                            <img
                              src={assetLogo}
                              alt={displayName}
                              class="asset-icon"
                              on:error={(e) => e.target.style.display = 'none'}
                            />
                            {#if chainLogo}
                              <div class="chain-logo-container">
                                <img
                                  src={chainLogo}
                                  alt={chain}
                                  class="chain-icon"
                                  on:error={(e) => e.target.style.display = 'none'}
                                />
                              </div>
                            {/if}
                          {/if}
                        </div>
                        {displayName}
                      </td>
                      <td class="price-cell">{formatNumberUSD(pool.usd_price)}</td>
                      <td class="price-cell">{pool.externalPrice ? formatNumberUSD(pool.externalPrice) : 'N/A'}</td>
                      <td class="difference-cell" style="color: {difference.color}">{difference.text}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </section>
        {:else}
          <div class="loading">Loading data...</div>
          {/if}
        {/if}
      </div>
    {/key}
  </div>
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    color: #FFFFFF;
    background-color: #1a1a1a;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    color: #FFFFFF;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-tabs {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .header-tab {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .header-tab:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .header-tab.active {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.2s ease;
  }

  .icon-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .icon-button.active {
    background: rgba(74, 144, 226, 0.2);
    color: #4A90E2;
    border-color: rgba(74, 144, 226, 0.4);
  }

  .icon-text {
    font-size: 14px;
    font-weight: 700;
  }

  .refresh-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(74, 144, 226, 0.4);
  }

  .refresh-button.paused {
    border-color: rgba(49, 253, 157, 0.3);
  }

  .refresh-button.paused:hover {
    border-color: rgba(49, 253, 157, 0.6);
  }

  .button-icon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4A90E2;
    z-index: 1;
  }

  .refresh-button.paused .button-icon {
    color: #31FD9D;
  }

  .progress-ring {
    position: absolute;
    transform: rotate(-90deg);
  }

  .progress-ring__circle-bg {
    stroke: rgba(255, 255, 255, 0.1);
  }

  .progress-ring__circle {
    stroke: #4A90E2;
    stroke-linecap: round;
    stroke-dasharray: 75.4;
    transition: stroke-dashoffset 0.1s ease-out;
  }

  .refresh-button.paused .progress-ring__circle {
    stroke: rgba(255, 255, 255, 0.3);
  }

  .reset-button {
    color: #ff6b6b !important;
  }

  .reset-button:hover {
    background: rgba(255, 107, 107, 0.15) !important;
    border-color: rgba(255, 107, 107, 0.4) !important;
  }

  /* Actions column */
  .actions-col {
    width: 50px;
    padding: 0 !important;
  }

  .actions-cell {
    width: 50px;
    padding: 8px 4px !important;
    text-align: center;
  }

  .row-action {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    opacity: 0.3;
    transition: all 0.2s ease;
    color: #a0a0a0;
  }

  .row-action:hover {
    opacity: 1;
  }

  .row-action.star {
    color: #ffc107;
  }

  .row-action.star.active {
    opacity: 1;
    color: #ffc107;
    text-shadow: 0 0 8px rgba(255, 193, 7, 0.5);
  }

  .row-action.ignore:hover {
    color: #ff6b6b;
  }

  tr.starred {
    background: rgba(255, 193, 7, 0.08) !important;
  }

  tr.starred:hover {
    background: rgba(255, 193, 7, 0.12) !important;
  }

  /* Mobile: Stack header controls */
  @media (max-width: 500px) {
    .header-actions {
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
    }

    .header-tabs {
      order: 2;
    }

    .header-controls {
      order: 1;
    }
  }

  .table-wrapper {
    background-color: #1a1a1a;
    border-radius: 16px;
    overflow-x: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    margin-bottom: 30px;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background-color: #1a1a1a;
    table-layout: fixed;
  }

  th {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 20px 16px;
    text-align: left;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
  }

  th:last-child {
    border-right: none;
  }

  tbody tr {
    background: #2c2c2c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  tbody tr:nth-child(even) {
    background: #252525;
  }

  tbody tr:hover {
    background: #3a3a3a !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  tbody tr:last-child {
    border-bottom: none;
  }

  td {
    padding: 16px 12px;
    vertical-align: middle;
    color: #ffffff;
    font-weight: 500;
  }

  .chain-cell {
    width: 40px;
    padding: 12px 0;
    text-align: center;
  }

  .chain-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .asset-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    width: auto;
  }

  .logo-container {
    position: relative;
    display: flex;
    align-items: center;
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

  .chain-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    border: none;
    pointer-events: none;
  }

  .price-cell {
    width: 120px;
  }

  .balance-cell {
    width: 140px;
    font-family: monospace;
  }

  .difference-cell {
    width: 100px;
  }

  .ratio-cell {
    width: 100px;
    text-align: right;
    font-family: monospace;
  }

  .comparison-section {
    margin-bottom: 40px;
  }

  h3 {
    color: #4A90E2;
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.3px;
  }

  .loading {
    text-align: center;
    color: #a0a0a0;
    font-size: 18px;
    font-weight: 600;
    padding: 40px;
  }

  /* Responsive column headers */
  .th-full {
    display: inline;
  }

  .th-short {
    display: none;
  }

  @media (max-width: 600px) {
    .th-full {
      display: none;
    }

    .th-short {
      display: inline;
    }

    .container {
      padding: 12px;
    }

    table {
      table-layout: auto;
    }

    th {
      padding: 10px 6px;
      font-size: 11px;
      letter-spacing: 0;
    }

    td {
      padding: 8px 6px;
      font-size: 12px;
    }

    .actions-col {
      width: 36px;
    }

    .actions-cell {
      width: 36px;
      padding: 6px 2px !important;
    }

    .row-action {
      padding: 2px;
      font-size: 12px;
    }

    .asset-cell {
      gap: 4px;
    }

    .logo-container {
      height: 24px;
    }

    .asset-icon {
      width: 24px;
      height: 24px;
    }

    .chain-logo-container {
      width: 12px;
      height: 12px;
    }

    .chain-icon {
      width: 12px;
      height: 12px;
    }

    .price-cell {
      font-size: 11px;
    }

    .difference-cell {
      font-size: 11px;
    }
  }

  @media (max-width: 400px) {
    .container {
      padding: 12px;
    }

    h3 {
      font-size: 18px;
    }

    .asset-cell {
      width: 30%;
    }

    .price-cell {
      width: 35%;
    }

    .difference-cell {
      width: 35%;
    }

    td, th {
      padding: 10px;
    }
  }
</style>
