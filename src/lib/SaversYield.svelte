<script>
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";

  let MAXSYNTHSFORSAVERSYIELD;
  let SYNTHYIELDBASISPOINTS;
  let availablePools = [];
  // Temporary variables for sliders for simulated mimirs
  let tempMAXSYNTHSFORSAVERSYIELD;
  let tempSYNTHYIELDBASISPOINTS;
  let chartInstance;
  let selectedPool = null;

  // Add this near the top of your script section
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
    'BNB.BUSD-BD1': 'assets/coins/binance-usd-busd-logo.svg',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg'
  };

  // Fetch and set constants initially, Initialize the chart
  onMount(async () => {
    const constants = await getConstants();
    MAXSYNTHSFORSAVERSYIELD = constants.MAXSYNTHSFORSAVERSYIELD;
    SYNTHYIELDBASISPOINTS = constants.SYNTHYIELDBASISPOINTS;

    tempMAXSYNTHSFORSAVERSYIELD = MAXSYNTHSFORSAVERSYIELD;
    tempSYNTHYIELDBASISPOINTS = SYNTHYIELDBASISPOINTS;

    availablePools = await getPools();

    // Initialize the chart here
    const ctx = document.getElementById("myChart").getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Savers Yield Share (%) vs. Synth Utilization (%)",
            data: generateChartData(),
            fill: false,
            borderColor: "#33CCFF",
            tension: 0.1,
          },
          {
            label: 'Selected Pool',
            data: [],
            borderColor: '#FF6B6B',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ],
      },
      options: {
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: "% of the pool composed of Synths",
              color: "#FFFFFF",
            },
            ticks: {
              color: "#FFFFFF",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
          },
          y: {
            title: {
              display: true,
              text: "% of yield that goes to Savers",
              color: "#FFFFFF",
            },
            ticks: {
              color: "#FFFFFF",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "#FFFFFF",
              filter: (legendItem) => legendItem.text !== 'Selected Pool'
            },
          },
        },
        backgroundColor: "#1C2128",
        borderColor: "#2F3640",
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    // Set the height of the chart container
    document.querySelector('.chart').style.height = '300px';
  });

  // This reactive statement is necessary to update the chart when sliders change
  $: if (chartInstance) {
    chartInstance.data.datasets[0].data = generateChartData();
    chartInstance.update();
  }

  //to use simulated Mimir values
  async function updateConstantsAndFetchPools() {
    MAXSYNTHSFORSAVERSYIELD = tempMAXSYNTHSFORSAVERSYIELD;
    SYNTHYIELDBASISPOINTS = tempSYNTHYIELDBASISPOINTS;
    availablePools = await getPools(); // Re-fetch pools with updated constants
    updateChart(); //update the chart
    selectedPool = null;
    updateSelectedPoolLine();
  }

  //update the chart with new data
  function updateChart() {
    if (!chartInstance) return;

    const chartData = generateChartData();
    chartInstance.data.datasets[0].data = chartData;
    chartInstance.update();
  }

  //Get relevant mimir values
  async function getConstants() {
    const response = await fetch(
      "https://thornode.ninerealms.com/thorchain/mimir"
    );
    const data = await response.json();
    return {
      MAXSYNTHSFORSAVERSYIELD: data["MAXSYNTHSFORSAVERSYIELD"],
      SYNTHYIELDBASISPOINTS: data["SYNTHYIELDBASISPOINTS"],
    };
  }

  //generate chart data
  function generateChartData() {
    let data = [];
    for (
      let synthUtilization = 0;
      synthUtilization <= 1;
      synthUtilization += 0.01
    ) {
      const { saversYieldShare } = getSaversYield(
        synthUtilization,
        MAXSYNTHSFORSAVERSYIELD,
        SYNTHYIELDBASISPOINTS
      );
      data.push({
        x: synthUtilization * 100,
        y: saversYieldShare * 100,
      });
    }
    return data;
  }

  //get pools with savers balances and their synth utilization
  async function getPools() {
    const response = await fetch(
      "https://thornode.ninerealms.com/thorchain/pools"
    );
    const data = await response.json();
    const availablePools = data
      .filter((pool) => pool.status === "Available" && pool.savers_units > 0)
      .sort((a, b) => b.balance_rune - a.balance_rune)
      .map((pool) => {
        const synthUtilization = getSynthUtilization(pool);
        const { saversYieldShare, lpYieldShare } = getSaversYield(
          synthUtilization,
          MAXSYNTHSFORSAVERSYIELD,
          SYNTHYIELDBASISPOINTS
        );
        return {
          ...pool,
          synthUtilization,
          SaversYieldShare: saversYieldShare,
          LPYieldShare: lpYieldShare,
        };
      });
    return availablePools;
  }

  //math to get synth utilization
  function getSynthUtilization(pool) {
    return pool.synth_units / pool.pool_units;
  }

  //determine the savers yield share
  function getSaversYield(
    synthUtilization,
    MAXSYNTHSFORSAVERSYIELD,
    SYNTHYIELDBASISPOINTS
  ) {
    const synthsPerPool = synthUtilization * 10000;
    const lpYield = 1; // Assuming lpYield represents the total yield (100%)
    let saversYield =
      (lpYield *
        (MAXSYNTHSFORSAVERSYIELD - synthsPerPool) *
        SYNTHYIELDBASISPOINTS) /
      10000 /
      10000;

    // Floor the saversYield at 0
    saversYield = Math.max(saversYield, 0);

    return {
      saversYieldShare: saversYield,
      lpYieldShare: lpYield - saversYield,
    };
  }

  //convert decimal to percentage
  function displayPercentage(value) {
    return (value * 100).toFixed(0) + "%";
  }

  //Use short name. If name contains "US" then keep chain name
  function assetShortName(assetName) {
    if (!assetName.includes("US")) {
      const parts = assetName.split(".");
      if (parts.length > 1) {
        return parts[1];
      }
    }
    return assetName.split("-")[0];
  }

  let activeTooltip = null;

  function toggleTooltip(event, content) {
    event.stopPropagation();
    activeTooltip = activeTooltip === content ? null : content;
  }

  function closeTooltip() {
    activeTooltip = null;
  }

  // Add this function to close the tooltip when clicking outside
  function handleOutsideClick(event) {
    if (event.target.classList.contains('tooltip-overlay')) {
      closeTooltip();
    }
  }

  function selectPool(pool) {
    selectedPool = pool;
    updateSelectedPoolLine();
  }

  function updateSelectedPoolLine() {
    if (!chartInstance) return;

    const selectedPoolDataset = chartInstance.data.datasets[1];
    if (selectedPool) {
      selectedPoolDataset.data = [
        { x: selectedPool.synthUtilization * 100, y: 0 },
        { x: selectedPool.synthUtilization * 100, y: 100 }
      ];
    } else {
      selectedPoolDataset.data = [];
    }
    chartInstance.update();
  }
</script>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #0B0E11;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .chart-container {
    background-color: #1C2128;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
  }

  .chart {
    flex-grow: 1;
    margin-bottom: 20px;
  }

  .table-wrapper {
    overflow-x: visible;
    background-color: #1C2128;
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    grid-column: 1;
    grid-row: 1 / span 3;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.9rem;
  }

  th, td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid #2F3640;
    color: #FFFFFF;
  }

  th {
    background-color: #23B195;
    color: #FFFFFF;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }

  .asset-name {
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .asset-logo {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    vertical-align: middle;
  }

  .percentage-cell {
    text-align: right;
    min-width: 60px;
  }

  .info-container {
    display: inline-flex;
    position: relative;
    margin-left: 2px;
  }

  .info-btn {
    background-color: #33CCFF;
    color: #0B0E11;
    border: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    transition: background-color 0.3s;
  }

  .info-btn:hover {
    background-color: #23B195;
  }

  .tooltip-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    pointer-events: none;
  }

  .tooltip-text {
    visibility: hidden;
    width: 300px;
    background-color: #2F3640;
    color: #FFFFFF;
    text-align: left;
    border-radius: 6px;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.3s, visibility 0.3s;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    font-size: 0.9rem;
    line-height: 1.4;
    pointer-events: auto;
    position: relative;
    padding-top: 30px; /* Make room for close button */
  }

  .tooltip-text::before {
    content: none;
  }

  .tooltip-text.active {
    visibility: visible;
    opacity: 1;
  }

  .tooltip-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9998;
    display: none;
  }

  .tooltip-overlay.active {
    display: block;
  }

  .close-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    border: none;
    color: #FFFFFF;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 5px;
  }

  .close-btn:hover {
    color: #33CCFF;
  }

  @media (max-width: 768px) {
    .container {
      grid-template-columns: 1fr;
      padding: 10px;
    }

    .chart-container {
      grid-column: 1;
      grid-row: auto;
      padding: 10px;
    }

    .table-wrapper {
      grid-column: 1;
      grid-row: auto;
    }

    .chart {
      height: 250px;
    }

    th, td {
      padding: 6px 8px;
      font-size: 0.8rem;
    }

    .asset-name {
      max-width: 100px;
    }

    .percentage-cell {
      min-width: 50px;
    }
  }

  tr {
    cursor: pointer;
  }

  tr.selected {
    background-color: rgba(51, 204, 255, 0.2);
  }
</style>

<div class="container">
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>
            Synth Util.
            <div class="info-container">
              <button 
                class="info-btn" 
                on:click={(e) => toggleTooltip(e, "synth-utilization")}
              >?</button>
            </div>
          </th>
          <th>
            Savers Yield
            <div class="info-container">
              <button 
                class="info-btn" 
                on:click={(e) => toggleTooltip(e, "savers-yield-share")}
              >?</button>
            </div>
          </th>
          <th>
            LP Yield
            <div class="info-container">
              <button 
                class="info-btn" 
                on:click={(e) => toggleTooltip(e, "lp-yield-share")}
              >?</button>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each availablePools as pool}
          <tr 
            on:click={() => selectPool(pool)}
            class:selected={selectedPool === pool}
          >
            <td class="asset-name">
              <img 
                src={assetLogos[pool.asset] || 'assets/coins/fallback-logo.svg'} 
                alt={pool.asset} 
                class="asset-logo"
                on:error={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'assets/coins/fallback-logo.svg';
                }}
              />
              {assetShortName(pool.asset)}
            </td>
            <td class="percentage-cell">{displayPercentage(pool.synthUtilization)}</td>
            <td class="percentage-cell">{displayPercentage(pool.SaversYieldShare)}</td>
            <td class="percentage-cell">{displayPercentage(pool.LPYieldShare)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="chart-container">
    <div class="chart">
      <canvas id="myChart" />
    </div>
    <div class="slider-container">
      <div class="slider-item">
        <label for="maxSynthsSlider">MAX SYNTH FOR SAVER YIELD: {tempMAXSYNTHSFORSAVERSYIELD}</label>
        <input type="range" id="maxSynthsSlider" min="0" max="10000" step="100" bind:value={tempMAXSYNTHSFORSAVERSYIELD} />
      </div>

      <div class="slider-item">
        <label for="synthYieldSlider">SYNTH YIELD BASIS POINTS: {tempSYNTHYIELDBASISPOINTS}</label>
        <input type="range" id="synthYieldSlider" min="0" max="10000" step="100" bind:value={tempSYNTHYIELDBASISPOINTS} />
      </div>

      <button on:click={updateConstantsAndFetchPools}>Update</button>
    </div>
  </div>

  <div class="tooltip-overlay" class:active={activeTooltip !== null} on:click={handleOutsideClick}></div>
  <div class="tooltip-container">
    <div class="tooltip-text" class:active={activeTooltip === "synth-utilization"}>
      <button class="close-btn" on:click={closeTooltip}>&times;</button>
      Synth Utilization is the proportion of the pool that is made of synthetic assets. It affects the yield distribution between Savers and LPs.
    </div>
    <div class="tooltip-text" class:active={activeTooltip === "savers-yield-share"}>
      <button class="close-btn" on:click={closeTooltip}>&times;</button>
      The percentage of the pool's yield that goes to Savers. This share decreases as Synth Utilization increases, incentivizing a balance between synthetic and native assets.
    </div>
    <div class="tooltip-text" class:active={activeTooltip === "lp-yield-share"}>
      <button class="close-btn" on:click={closeTooltip}>&times;</button>
      The percentage of the pool's yield that goes to Liquidity Providers (LPs). This share increases as Synth Utilization increases, compensating LPs for the higher risk associated with synthetic assets.
    </div>
  </div>
</div>
