<script>
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';

  const pools = writable([]);
  const currentTab = writable('prices');
  const externalPrices = writable({});
  const showPoolInfo = writable(false);
  const showTradeBalanceInUSD = writable(false);

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
    'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'thorstarter'
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

  async function getTradeAssets() {
    try {
      const response = await fetch("https://thornode.ninerealms.com/thorchain/trade/units");
      const data = await response.json();
      return data.reduce((acc, item) => {
        const formattedAsset = item.asset.replace('~', '.');
        acc[formattedAsset] = Number(item.depth);
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to fetch trade assets:', error);
      return {};
    }
  }

  async function getPools() {
    try {
      const tradeAssets = await getTradeAssets();
      const response = await fetch("https://thornode.ninerealms.com/thorchain/pools");
      const data = await response.json();
      return data
        .filter(pool => pool.status === "Available")
        .map(pool => ({
          asset: pool.asset,
          usd_price: Number(pool.asset_tor_price) / 1e8,
          rune_depth: Number(pool.rune_depth),
          asset_depth: Number(pool.asset_depth),
          trade_asset_depth: Number(tradeAssets[pool.asset] || 0),
          balance_asset: Number(pool.balance_asset)
        }))
        .sort((a, b) => b.rune_depth - a.rune_depth);
    } catch (error) {
      console.error('Failed to fetch pools:', error);
      return [];
    }
  }

  async function getExternalPrices(assets) {
    const uniqueAssets = [...new Set(assets.map(asset => assetToCoinGeckoMap[asset] || asset.split('.')[1].toLowerCase()))];
    const ids = uniqueAssets.join(',');
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch external prices:', error);
      return {};
    }
  }

  function getExternalPrice(asset) {
    const coinGeckoId = assetToCoinGeckoMap[asset] || asset.split('.')[1].toLowerCase();
    let price = $externalPrices[coinGeckoId]?.usd;

    // If the price is not found, check for USDC or USDT alternatives
    if (!price && (asset.includes('USDC') || asset.includes('USDT'))) {
      price = $externalPrices['usd-coin']?.usd || $externalPrices['tether']?.usd;
    }

    console.log(`Asset: ${asset}, CoinGecko ID: ${coinGeckoId}, Price: ${price}`);
    return price || null;
  }

  $: combinedPoolData = $pools.length > 0 && Object.keys($externalPrices).length > 0
    ? $pools.map(pool => {
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
          tradePoolRatio
        };
      }).sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0))
    : [];

  async function fetchData() {
    const poolsData = await getPools();
    console.log('Pools data:', poolsData);
    pools.set(poolsData);
    const assets = poolsData.map(pool => pool.asset);
    const prices = await getExternalPrices(assets);
    console.log('External prices:', prices);
    externalPrices.set(prices);
  }

  onMount(() => {
    fetchData();
  });

  function formatCryptoName(cryptoName) {
    const parts = cryptoName.split(/\.|-/);
    const [chain, asset] = parts;
    if (asset === 'ETH') {
      return `${asset} (${chain})`;
    } else if (["ETH", "BSC", "AVAX", "BASE"].includes(chain) && parts[2]) {
      return `${asset} (${chain})`;
    } else {
      return asset;
    }
  }

  function formatNumberUSD(number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  function formatNumber(number, decimals = 8) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(number);
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
  <div class="container">
    <div class="app-header">
      <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
      <h2>THORChain Price Checker</h2>
      <div class="info-icon" on:click={() => alert('Compare THORChain prices with external market prices (from CoinGecko)')}>ⓘ</div>
    </div>

    <div class="settings-bar">
      <button class="settings-button" on:click={() => showPoolInfo.update(v => !v)}>
        ⚙️ {$showPoolInfo ? 'Hide' : 'Show'} Pool Info
      </button>
      {#if $showPoolInfo}
        <button class="settings-button" on:click={() => showTradeBalanceInUSD.update(v => !v)}>
          💱 Show Trade Balance in {$showTradeBalanceInUSD ? 'Asset' : 'USD'}
        </button>
      {/if}
    </div>

    <div class="tabs">
      <button
        class="tab-button {$currentTab === 'prices' ? 'active' : ''}"
        on:click={() => currentTab.set('prices')}
      >
        All Prices
      </button>
      <button
        class="tab-button {$currentTab === 'likeAssetComparison' ? 'active' : ''}"
        on:click={() => currentTab.set('likeAssetComparison')}
      >
        Like Asset Comparison
      </button>
    </div>

    {#key $currentTab}
      <div class="tab-content" in:flipScroll>
        {#if $currentTab === 'prices'}
          {#if combinedPoolData.length > 0}
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>THORChain Price</th>
                    <th>External Price</th>
                    <th>Difference</th>
                    {#if $showPoolInfo}
                      <th>Trade Balance {$showTradeBalanceInUSD ? '(USD)' : '(Asset)'}</th>
                      <th>Total Pool Depth USD</th>
                      <th>Trade/Pool Ratio</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each combinedPoolData as pool}
                    {@const difference = formatPriceDifference(pool.difference)}
                    {@const balanceUSD = pool.balance_asset * pool.usd_price}
                    {@const totalPoolDepthUSD = pool.balance_asset * 2 * pool.usd_price}
                    <tr>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogos[pool.asset]}
                            <img 
                              src={assetLogos[pool.asset]} 
                              alt={formatCryptoName(pool.asset)}
                              class="asset-icon"
                            />
                            <div class="chain-logo-container">
                              <img 
                                src={`assets/chains/${pool.asset.split('.')[0]}.svg`}
                                alt={pool.asset.split('.')[0]}
                                class="chain-icon"
                              />
                            </div>
                          {/if}
                        </div>
                        {formatCryptoName(pool.asset)}
                      </td>
                      <td class="price-cell">{formatNumberUSD(pool.usd_price)}</td>
                      <td class="price-cell">{pool.externalPrice ? formatNumberUSD(pool.externalPrice) : 'N/A'}</td>
                      <td class="difference-cell" style="color: {difference.color}">{difference.text}</td>
                      {#if $showPoolInfo}
                        <td class="balance-cell">
                          {$showTradeBalanceInUSD 
                            ? formatNumberUSD((pool.trade_asset_depth / 1e8) * pool.usd_price)
                            : formatNumber(pool.trade_asset_depth / 1e8)}
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
                    <th>THORChain Price</th>
                    <th>External Price</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filterAssets(combinedPoolData, bitcoinAssets) as pool}
                    {@const difference = formatPriceDifference(pool.difference)}
                    <tr>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogos[pool.asset]}
                            <img 
                              src={assetLogos[pool.asset]} 
                              alt={formatCryptoName(pool.asset)}
                              class="asset-icon"
                            />
                            <div class="chain-logo-container">
                              <img 
                                src={`assets/chains/${pool.asset.split('.')[0]}.svg`}
                                alt={pool.asset.split('.')[0]}
                                class="chain-icon"
                              />
                            </div>
                          {/if}
                        </div>
                        {formatCryptoName(pool.asset)}
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
                    <th>THORChain Price</th>
                    <th>External Price</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filterAssets(combinedPoolData, stablecoinAssets) as pool}
                    {@const difference = formatPriceDifference(pool.difference)}
                    <tr>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogos[pool.asset]}
                            <img 
                              src={assetLogos[pool.asset]} 
                              alt={formatCryptoName(pool.asset)}
                              class="asset-icon"
                            />
                            <div class="chain-logo-container">
                              <img 
                                src={`assets/chains/${pool.asset.split('.')[0]}.svg`}
                                alt={pool.asset.split('.')[0]}
                                class="chain-icon"
                              />
                            </div>
                          {/if}
                        </div>
                        {formatCryptoName(pool.asset)}
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
    color: #fff;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo 2', sans-serif;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
    gap: 15px;
    position: relative;
  }

  .app-header img {
    width: 40px;
    height: 40px;
  }

  .app-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #f8f8f8;
  }

  .info-icon {
    position: absolute;
    right: 0;
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .info-icon:hover {
    opacity: 1;
  }

  .settings-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .settings-button {
    background: #2c2c2c;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
  }

  .settings-button:hover {
    border-color: #4A90E2;
    background: #1a1a1a;
  }

  .settings-toggle, .balance-toggle {
    display: none;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    justify-content: center;
  }

  .tab-button {
    background: #2c2c2c;
    border: 1px solid #3a3a3c;
    color: #888;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  .tab-button:hover {
    border-color: #4A90E2;
    color: #4A90E2;
  }

  .tab-button.active {
    background: #4A90E2;
    color: #fff;
    border-color: #4A90E2;
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow-x: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-bottom: 30px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #2c2c2c;
    table-layout: fixed;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #3a3a3c;
  }

  tr {
    border-bottom: 1px solid #3a3a3c;
  }

  tr:last-child {
    border-bottom: none;
  }

  td {
    padding: 12px 8px;
    vertical-align: middle;
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
    font-weight: 600;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .settings-bar {
      flex-direction: column;
      gap: 8px;
    }

    .settings-button {
      width: 100%;
    }

    .info-icon {
      position: static;
      margin-top: 10px;
    }

    .tabs {
      flex-direction: column;
    }

    .tab-button {
      width: 100%;
    }

    table {
      table-layout: auto;
    }

    td, th {
      padding: 10px;
      font-size: 14px;
    }

    .price-cell {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .app-header h2 {
      font-size: 20px;
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
  }
</style>
