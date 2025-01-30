<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';

  const pools = writable([]);
  const saversPositions = writable([]);
  const lendingPositions = writable([]);
  const currentTab = writable('savers');
  const assetPrices = writable({});
  const searchQuery = writable('');
  const selectedAsset = writable('all');

  const BLOCK_HEIGHT = 19562016;
  const LENDING_POOLS = ['BTC.BTC', 'ETH.ETH'];

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

  async function fetchPools() {
    try {
      const response = await fetch(`https://thornode.thorchain.liquify.com/thorchain/pools?height=${BLOCK_HEIGHT}`);
      const data = await response.json();
      const prices = {};
      data.forEach(pool => {
        prices[pool.asset] = Number(pool.asset_tor_price) / 1e8;
      });
      assetPrices.set(prices);
      pools.set(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch pools:', error);
      return [];
    }
  }

  async function fetchSaversForAsset(asset) {
    try {
      const response = await fetch(`https://thornode.thorchain.liquify.com/thorchain/pool/${asset}/savers`);
      const data = await response.json();
      return data.map(position => ({
        ...position,
        asset,
        asset_amount: Number(position.asset_redeem_value) / 1e8
      }));
    } catch (error) {
      console.error(`Failed to fetch savers for ${asset}:`, error);
      return [];
    }
  }

  async function fetchBorrowersForAsset(asset) {
    try {
      const response = await fetch(`https://thornode.thorchain.liquify.com/thorchain/pool/${asset}/borrowers`);
      const data = await response.json();
      return data.map(position => ({
        ...position,
        asset,
        collateral_amount: Number(position.collateral_current) / 1e8,
        debt_amount: Number(position.debt_current) / 1e8
      }));
    } catch (error) {
      console.error(`Failed to fetch borrowers for ${asset}:`, error);
      return [];
    }
  }

  async function fetchAllData() {
    const poolsData = await fetchPools();
    
    // Fetch savers for all available pools
    const saversPromises = poolsData
      .filter(pool => pool.status === "Available")
      .map(pool => fetchSaversForAsset(pool.asset));
    const saversResults = await Promise.all(saversPromises);
    const allSavers = saversResults.flat();
    saversPositions.set(allSavers);

    // Fetch borrowers for lending pools
    const borrowersPromises = LENDING_POOLS.map(asset => fetchBorrowersForAsset(asset));
    const borrowersResults = await Promise.all(borrowersPromises);
    const allBorrowers = borrowersResults.flat();
    lendingPositions.set(allBorrowers);
  }

  onMount(() => {
    fetchAllData();
  });

  function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatNumberUSD(number, showDecimals = true) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(number);
  }

  function formatNumber(number, decimals = 8) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(number);
  }

  function formatAssetName(asset) {
    if (!asset) return '';
    const parts = asset.split('-');
    return parts[0];
  }

  function getBlockExplorerUrl(asset, address) {
    const chain = asset.split('.')[0];
    
    const explorers = {
      'BTC': `https://mempool.space/address/${address}`,
      'ETH': `https://etherscan.io/address/${address}`,
      'AVAX': `https://snowtrace.io/address/${address}`,
      'BSC': `https://bscscan.com/address/${address}`,
      'BCH': `https://blockchair.com/bitcoin-cash/address/${address}`,
      'LTC': `https://blockchair.com/litecoin/address/${address}`,
      'DOGE': `https://blockchair.com/dogecoin/address/${address}`,
      'GAIA': `https://www.mintscan.io/cosmos/address/${address}`,
      'BASE': `https://basescan.org/address/${address}`
    };

    return explorers[chain] || null;
  }

  $: processedSavers = $saversPositions.map(position => {
    const usdPrice = $assetPrices[position.asset] || 0;
    const usdValue = position.asset_amount * usdPrice;
    return {
      ...position,
      usd_value: usdValue
    };
  }).sort((a, b) => b.usd_value - a.usd_value);

  $: processedLending = $lendingPositions.map(position => {
    const usdPrice = $assetPrices[position.asset] || 0;
    const collateralValue = position.collateral_amount * usdPrice;
    const netLiability = collateralValue - position.debt_amount;
    return {
      ...position,
      collateral_value: collateralValue,
      net_liability: netLiability
    };
  }).sort((a, b) => b.collateral_value - a.collateral_value);

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

  function filterPositions(positions, query, selectedAsset) {
    return positions.filter(position => {
      const matchesSearch = query === '' || 
        position.asset_address?.toLowerCase().includes(query.toLowerCase()) ||
        position.owner?.toLowerCase().includes(query.toLowerCase());
      
      const matchesAsset = selectedAsset === 'all' || formatAssetName(position.asset) === selectedAsset;
      
      return matchesSearch && matchesAsset;
    });
  }

  $: availableAssets = [...new Set($pools
    .filter(pool => pool.status === "Available")
    .map(pool => formatAssetName(pool.asset))
  )].sort();

  $: filteredSavers = filterPositions(processedSavers, $searchQuery, $selectedAsset);
  $: filteredLending = filterPositions(processedLending, $searchQuery, $selectedAsset);

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }
</script>

<main>
  <div class="container">
    <div class="app-header">
      <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
      <h2>THORChain Debt Dashboard</h2>
      <div class="info-icon" on:click={() => alert('View THORChain Savers and Lending positions dollarized at the THORFi halt height.')}>ⓘ</div>
    </div>

    <div class="tabs">
      <button
        class="tab-button {$currentTab === 'savers' ? 'active' : ''}"
        on:click={() => currentTab.set('savers')}
      >
        Savers Positions
      </button>
      <button
        class="tab-button {$currentTab === 'lending' ? 'active' : ''}"
        on:click={() => currentTab.set('lending')}
      >
        Lending Positions
      </button>
    </div>

    <div class="filters">
      <div class="search-container">
        <input
          type="text"
          placeholder="Search by address..."
          bind:value={$searchQuery}
          class="search-input"
        />
      </div>
      <div class="asset-filter">
        <select
          bind:value={$selectedAsset}
          class="asset-select"
        >
          <option value="all">All assets</option>
          {#each availableAssets as asset}
            <option value={asset}>
              {asset}
            </option>
          {/each}
        </select>
      </div>
    </div>

    {#key $currentTab}
      <div class="tab-content" in:flipScroll>
        {#if $currentTab === 'savers'}
          {#if processedSavers.length > 0}
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Address</th>
                    <th>Asset Amount</th>
                    <th>USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredSavers as position}
                    <tr>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogos[position.asset]}
                            <img 
                              src={assetLogos[position.asset]} 
                              alt={position.asset}
                              class="asset-icon"
                            />
                          {/if}
                        </div>
                        {formatAssetName(position.asset)}
                      </td>
                      <td class="address-cell">
                        <div class="address-container">
                          <span 
                            on:click={() => copyToClipboard(position.asset_address)}
                            title="Click to copy full address"
                          >
                            {formatAddress(position.asset_address)}
                          </span>
                          {#if getBlockExplorerUrl(position.asset, position.asset_address)}
                            <a 
                              href={getBlockExplorerUrl(position.asset, position.asset_address)} 
                              target="_blank"
                              rel="noopener noreferrer"
                              class="explorer-link"
                              title="View in explorer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          {/if}
                        </div>
                      </td>
                      <td class="asset-amount-cell">
                        {formatNumber(position.asset_amount)}
                        {#if assetLogos[position.asset]}
                          <img 
                            src={assetLogos[position.asset]} 
                            alt={position.asset}
                            class="asset-icon-small"
                          />
                        {/if}
                      </td>
                      <td>{formatNumberUSD(position.usd_value, false)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="loading">Loading Savers data...</div>
          {/if}
        {:else}
          {#if processedLending.length > 0}
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Address</th>
                    <th>Net Position</th>
                    <th>Collateral</th>
                    <th>USD Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredLending as position}
                    <tr>
                      <td class="asset-cell">
                        <div class="logo-container">
                          {#if assetLogos[position.asset]}
                            <img 
                              src={assetLogos[position.asset]} 
                              alt={position.asset}
                              class="asset-icon"
                            />
                          {/if}
                        </div>
                        {formatAssetName(position.asset)}
                      </td>
                      <td class="address-cell">
                        <div class="address-container">
                          <span 
                            on:click={() => copyToClipboard(position.owner)}
                            title="Click to copy full address"
                          >
                            {formatAddress(position.owner)}
                          </span>
                          {#if getBlockExplorerUrl(position.asset, position.owner)}
                            <a 
                              href={getBlockExplorerUrl(position.asset, position.owner)} 
                              target="_blank"
                              rel="noopener noreferrer"
                              class="explorer-link"
                              title="View in explorer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          {/if}
                        </div>
                      </td>
                      <td class:negative={position.net_liability < 0}>
                        {formatNumberUSD(position.net_liability)}
                      </td>
                      <td class="asset-amount-cell">
                        {formatNumber(position.collateral_amount)}
                        {#if assetLogos[position.asset]}
                          <img 
                            src={assetLogos[position.asset]} 
                            alt={position.asset}
                            class="asset-icon-small"
                          />
                        {/if}
                      </td>
                      <td>{formatNumberUSD(position.debt_amount)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="loading">Loading Lending data...</div>
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
    max-width: 1200px;
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
    padding: 12px 16px;
    vertical-align: middle;
  }

  .asset-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-container {
    display: flex;
    align-items: center;
  }

  .asset-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  .negative {
    color: #ff4444;
  }

  .asset-amount-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .asset-icon-small {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .filters {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .search-container {
    flex: 1;
    min-width: 250px;
  }

  .search-input {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #3a3a3c;
    background: #2c2c2c;
    color: #fff;
    font-size: 16px;
  }

  .search-input::placeholder {
    color: #888;
  }

  .asset-filter {
    width: 200px;
  }

  .asset-select {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #3a3a3c;
    background: #2c2c2c;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
  }

  .asset-select option {
    background: #2c2c2c;
    color: #fff;
    padding: 8px;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .tabs {
      flex-direction: column;
    }

    .tab-button {
      width: 100%;
    }

    td, th {
      padding: 10px;
      font-size: 14px;
    }
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .explorer-link {
    color: #4A90E2;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .explorer-link:hover {
    opacity: 1;
  }

  .address-cell span {
    cursor: pointer;
  }
</style>
