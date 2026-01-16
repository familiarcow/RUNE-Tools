<script>
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { formatNumber as sharedFormatNumber } from '$lib/utils/formatting';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import {
    getTCYPrice,
    getRunePrice,
    getPrices,
    getTCYPool,
    getTCYLiquidity,
    getTotalStakedTCY,
    getTCYMarketCap,
    getRuneSupplyAndMarketCap,
    getTCYClaimers,
    getRemainingClaimAddresses
  } from '$lib/utils/tcy';

  const claims = writable([]);
  const remainingClaims = writable(new Set());
  const showMethodology = writable(false);
  const searchQuery = writable('');
  const sortBy = writable({ column: 'claimed', direction: 'desc' });
  let tcyPriceUSD = 0;
  let runePriceUSD = 0;
  let stakedTCY = writable(0);
  let tcyLiquidity = writable(0);
  let tcyMarketCap = writable(0);
  let runeMarketCap = writable(0);

  // Create a derived store for the market cap percentage
  const tcyMarketCapPercentage = derived(
    [tcyMarketCap, runeMarketCap],
    ([$tcyMarketCap, $runeMarketCap]) => {
      if ($runeMarketCap === 0) return 0;
      return ($tcyMarketCap / $runeMarketCap) * 100;
    }
  );

  const fetchTCYPriceData = async () => {
    try {
      const prices = await getPrices();
      tcyPriceUSD = prices.tcyPriceUSD;
      runePriceUSD = prices.runePriceUSD;
    } catch (error) {
      console.error("Error fetching TCY price:", error);
    }
  };

  const fetchStakedTCYData = async () => {
    try {
      const totalStaked = await getTotalStakedTCY();
      stakedTCY.set(totalStaked);
    } catch (error) {
      console.error("Error fetching staked TCY:", error);
    }
  };

  const fetchTCYLiquidityData = async () => {
    try {
      const liquidity = await getTCYLiquidity();
      tcyLiquidity.set(liquidity);
    } catch (error) {
      console.error("Error fetching TCY liquidity:", error);
    }
  };

  const fetchTCYMarketCapData = async () => {
    try {
      const marketCap = await getTCYMarketCap();
      tcyMarketCap.set(marketCap);
    } catch (error) {
      console.error("Error fetching TCY market cap:", error);
    }
  };

  const fetchRuneMarketCapData = async () => {
    try {
      const runeData = await getRuneSupplyAndMarketCap();
      runeMarketCap.set(runeData.marketCap);
    } catch (error) {
      console.error("Error fetching RUNE market cap:", error);
    }
  };

  // Create a derived store for filtered claims
  const filteredClaims = derived(
    [claims, searchQuery, remainingClaims, sortBy],
    ([$claims, $searchQuery, $remainingClaims, $sortBy]) => {
      let filtered = $claims;
      
      // Apply search filter if query exists
      if ($searchQuery) {
        const query = $searchQuery.toLowerCase();
        filtered = filtered.filter(claim => claim.address.toLowerCase().includes(query));
      }

      // Add claimed status
      filtered = filtered.map(claim => ({
        ...claim,
        hasClaimed: !$remainingClaims.has(claim.address)
      }));

      // Apply sorting
      filtered.sort((a, b) => {
        if ($sortBy.column === 'claimed') {
          // Only sort by claimed status if that column is selected
          if (a.hasClaimed !== b.hasClaimed) {
            return $sortBy.direction === 'desc' 
              ? (a.hasClaimed ? -1 : 1)
              : (a.hasClaimed ? 1 : -1);
          }
        }
        // Always sort by amount
        return $sortBy.direction === 'desc' 
          ? b.amount - a.amount
          : a.amount - b.amount;
      });

      return filtered;
    }
  );

  // Add a derived store for the total amount
  const totalAmount = derived(claims, $claims => 
    $claims.reduce((sum, claim) => sum + claim.amount, 0)
  );

  // Add a derived store for claimed amount
  const claimedAmount = derived([claims, remainingClaims], ([$claims, $remainingClaims]) => 
    $claims
      .filter(claim => !$remainingClaims.has(claim.address))
      .reduce((sum, claim) => sum + claim.amount, 0)
  );

  // Add a derived store for remaining amount
  const remainingAmount = derived([claims, remainingClaims], ([$claims, $remainingClaims]) => 
    $claims
      .filter(claim => $remainingClaims.has(claim.address))
      .reduce((sum, claim) => sum + claim.amount, 0)
  );

  const methodologyText = {
    title: "TCY Claims Collector",
    description: "A Python script to collect and process TCY claim data for affected ThorFi users at node pause height 19562016.",
    codeLink: "https://replit.com/@Orion9R/TCY-Claim-Calculation-Process?v=1#main.py",
    dataSources: [
      {
        title: "Data Sources:",
        items: [
          {
            text: "ThorNode API",
            url: "https://thornode.ninerealms.com/",
            subItems: [
              "Pools data",
              "Savers positions",
              "Borrower positions"
            ]
          },
          {
            text: "Flipside API",
            url: "https://flipsidecrypto.xyz/api/v1/queries/29f988ed-34dd-44ea-8cb3-5eb74d94a705/data/latest",
            description: "(for outstanding synths)"
          }
        ]
      },
      {
        title: "Key Information:",
        items: [
          "Asset prices are taken from the node pause height",
          "Borrower positions are calculated as: (collateral_current * asset_price) - debt_current",
          "Node Pause Height: 19562016"
        ]
      }
    ]
  };

  onMount(async () => {
    try {
      // Fetch TCY price and calculate RUNE price using shared utility
      await fetchTCYPriceData();

      // Fetch all metrics using shared utilities
      await Promise.all([
        fetchStakedTCYData(),
        fetchTCYLiquidityData(),
        fetchTCYMarketCapData(),
        fetchRuneMarketCapData()
      ]);

      // Fetch initial claims data
      const response = await fetch('/tcy_claims.json');
      const data = await response.json();

      // Process the data to use THOR address if present, otherwise L1Address
      const processedClaims = data.map(claim => ({
        address: claim.thor_address || claim.L1Address,
        amount: fromBaseUnit(claim.tcyClaim)
      })).sort((a, b) => b.amount - a.amount); // Sort by amount descending

      claims.set(processedClaims);

      // Fetch remaining claims data using shared utility
      const remainingSet = await getRemainingClaimAddresses();
      remainingClaims.set(remainingSet);
    } catch (error) {
      console.error('Failed to fetch TCY claims:', error);
    }
  });

  // Use shared formatNumber utility
  function formatNumber(number) {
    return sharedFormatNumber(number, { maximumFractionDigits: 0 });
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

  function handleSort(column) {
    sortBy.update(current => {
      if (current.column === column) {
        // Toggle direction if clicking same column
        return {
          column,
          direction: current.direction === 'desc' ? 'asc' : 'desc'
        };
      }
      // Set new column with default direction
      return {
        column,
        direction: 'desc'
      };
    });
  }

  function getSortIcon(column) {
    const $sortBy = sortBy;
    if ($sortBy.column !== column) return '↕️';
    return $sortBy.direction === 'desc' ? '↓' : '↑';
  }
</script>

<main>
  <div class="container">
    <div class="app-header">
      <h2>TCY Claims</h2>
      <div class="header-right">
        <div class="tcy-price">
          <img src="/assets/coins/TCY.svg" alt="TCY" class="tcy-icon" />
          {tcyPriceUSD ? `$${tcyPriceUSD.toFixed(2)}` : '...'}
        </div>
        <div class="info-icon" on:click={() => showMethodology.update(v => !v)}>ⓘ</div>
      </div>
    </div>

    <div class="metrics-container">
      <div class="metric-card">
        <h3>
          <img src="/assets/coins/TCY.svg" alt="TCY" class="metric-icon" />
          Staked TCY
        </h3>
        <div class="metric-value">
          {formatNumber($stakedTCY)} TCY
        </div>
        <div class="metric-usd">
          ${formatNumber($stakedTCY * tcyPriceUSD)}
        </div>
      </div>
      <div class="metric-card">
        <h3>TCY Liquidity</h3>
        <div class="metric-value">
          ${formatNumber($tcyLiquidity)}
        </div>
      </div>
      <div class="metric-card">
        <h3>TCY Market Cap</h3>
        <div class="metric-value">
          ${formatNumber($tcyMarketCap)}
        </div>
      </div>
      <div class="metric-card">
        <h3>vs RUNE Market Cap</h3>
        <div class="metric-value">
          {$tcyMarketCapPercentage.toFixed(2)}%
        </div>
        <div class="metric-usd">
          ${formatNumber($runeMarketCap)}
        </div>
      </div>
    </div>

    {#if $showMethodology}
      <div class="methodology" in:flipScroll>
        <h3>{methodologyText.title}</h3>
        <p>{methodologyText.description}</p>
        <a href={methodologyText.codeLink} target="_blank" rel="noopener noreferrer" class="code-link">
          View Calculation Code
        </a>
        
        {#each methodologyText.dataSources as section}
          <div class="methodology-section">
            <h4>{section.title}</h4>
            <ul>
              {#each section.items as item}
                <li>
                  {#if item.url}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" class="api-link">
                      {item.text}
                    </a>
                    {#if item.description}
                      {item.description}
                    {/if}
                    {#if item.subItems}
                      <ul class="sub-items">
                        {#each item.subItems as subItem}
                          <li>{subItem}</li>
                        {/each}
                      </ul>
                    {/if}
                  {:else}
                    {item}
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}

        <button class="close-button" on:click={() => showMethodology.set(false)}>Close</button>
      </div>
    {/if}

    <div class="amounts-container">
      <div class="total-amount">
        Claimable: {formatNumber($totalAmount)}
      </div>
      <div class="claimed-amount">
        Claimed: {formatNumber($claimedAmount)}
      </div>
      <div class="remaining-amount">
        Unclaimed: {formatNumber($remainingAmount)}
      </div>
    </div>

    <div class="search-container">
      <input 
        type="text" 
        placeholder="Search by address..." 
        bind:value={$searchQuery}
        class="search-input"
      />
    </div>

    {#if $claims.length > 0}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th on:click={() => handleSort('amount')} class="sortable">
                TCY Claim Amount {getSortIcon('amount')}
              </th>
              <th on:click={() => handleSort('claimed')} class="sortable">
                Claimed {getSortIcon('claimed')}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each $filteredClaims as claim}
              <tr>
                <td class="address-cell">{claim.address}</td>
                <td class="amount-cell">{formatNumber(claim.amount)}</td>
                <td class="status-cell">{claim.hasClaimed ? '✅' : '⏳'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="results-count">
        Showing {$filteredClaims.length} of {$claims.length} claims
      </div>
    {:else}
      <div class="loading">Loading claims data...</div>
    {/if}
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

  .header-right {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .tcy-price {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #a9a9a9;
    font-size: 14px;
    font-weight: 500;
  }

  .tcy-icon {
    width: 20px;
    height: 20px;
  }

  .info-icon {
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

  .methodology {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    position: relative;
  }

  .methodology h3 {
    color: #4A90E2;
    margin: 0 0 15px 0;
  }

  .methodology p {
    margin: 0;
    line-height: 1.5;
  }

  .close-button {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }

  .close-button:hover {
    color: #4A90E2;
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow-x: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

  .address-cell {
    font-family: monospace;
    font-size: 14px;
  }

  .amount-cell {
    font-family: monospace;
    text-align: right;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  .search-container {
    margin-bottom: 20px;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid #3a3a3c;
    border-radius: 8px;
    background-color: #2c2c2c;
    color: #fff;
    font-family: 'Exo 2', sans-serif;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
  }

  .search-input::placeholder {
    color: #888;
  }

  .results-count {
    margin-top: 10px;
    text-align: right;
    color: #888;
    font-size: 14px;
  }

  .amounts-container {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }

  .total-amount, .claimed-amount, .remaining-amount {
    flex: 1;
    background: #2c2c2c;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    font-family: monospace;
    font-size: 18px;
  }

  .total-amount {
    color: #4A90E2;
  }

  .claimed-amount {
    color: #4CAF50;
  }

  .remaining-amount {
    color: #FFA726;
  }

  .status-cell {
    text-align: center;
    font-size: 18px;
  }

  .methodology-section {
    margin-top: 20px;
  }

  .methodology-section h4 {
    color: #4A90E2;
    margin: 0 0 10px 0;
    font-size: 16px;
  }

  .methodology-section ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: none;
  }

  .methodology-section li {
    margin-bottom: 8px;
    line-height: 1.4;
    color: #f8f8f8;
  }

  .methodology-section li:last-child {
    margin-bottom: 0;
  }

  .code-link {
    display: inline-block;
    margin: 15px 0;
    padding: 8px 16px;
    background-color: #4A90E2;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .code-link:hover {
    background-color: #357abd;
  }

  .api-link {
    color: #4A90E2;
    text-decoration: none;
    transition: color 0.2s;
  }

  .api-link:hover {
    color: #357abd;
    text-decoration: underline;
  }

  .sub-items {
    margin-top: 5px;
    margin-bottom: 0;
    padding-left: 20px;
  }

  .sub-items li {
    margin-bottom: 4px;
    color: #f8f8f8;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .app-header h2 {
      font-size: 20px;
    }

    td, th {
      padding: 10px;
      font-size: 14px;
    }

    .address-cell {
      font-size: 12px;
      word-break: break-all;
    }

    .search-input {
      font-size: 14px;
      padding: 10px;
    }

    .amounts-container {
      flex-direction: column;
      gap: 10px;
    }

    .metrics-container {
      flex-direction: column;
      gap: 10px;
    }

    .metric-card {
      font-size: 16px;
    }

    .metric-card h3 {
      font-size: 14px;
    }

    .metric-usd {
      font-size: 12px;
    }
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    background-color: rgba(74, 144, 226, 0.1);
  }

  .metrics-container {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }

  .metric-card {
    flex: 1;
    background: #2c2c2c;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    font-family: monospace;
    font-size: 18px;
  }

  .metric-card h3 {
    color: #4A90E2;
    margin: 0 0 10px 0;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .metric-icon {
    width: 20px;
    height: 20px;
  }

  .metric-value {
    margin-bottom: 10px;
  }

  .metric-usd {
    color: #888;
    font-size: 14px;
  }
</style>
