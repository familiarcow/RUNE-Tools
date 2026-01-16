<script>
  import { onMount, onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import Chart from "chart.js/auto";
  import FireIcon from '/assets/fire.svg';
  import { fly, fade } from 'svelte/transition';

  // Shared utilities
  import { formatNumber, formatUSD as formatUSDBase } from '$lib/utils';
  import { fromBaseUnit } from '$lib/utils';
  import { thornode } from '$lib/api';
  import { runePrice, subscribeToRunePrice } from '$lib/stores';
  import { PageHeader } from '$lib/components';

  // Refresh interval in milliseconds (6 seconds)
  const REFRESH_INTERVAL = 6000;

  const tweenedBurnedRune = tweened(0, {
    duration: 1000, // 1 second animation
    easing: t => t * (2 - t) // Ease out quad
  });
  const tweenedMaxSupply = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });
  const tweenedCirculatingSupply = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });
  const tweenedReserveRune = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });
  const tweenedBondedRune = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });
  const tweenedPooledRune = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });
  const tweenedTotalSupply = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });

  let originalSupply = 500000000; // 500 million RUNE
  let maxSupply = 0;
  let currentSupply = 0;
  let burnedRune = 0;
  let burnedPercentage = 0;
  let circulatingSupply = 0;
  let circulatingPercentage = 0;
  let systemIncomeBurnRate = 0;
  let bondedRune = 0;
  let pooledRune = 0;
  let reserveRune = 0;
  let walletRune = 0;
  let chart;

  let exchangeBalances = {
    binance: 0,
    kraken: 0,
    treasury: 0,
    bybit: 0
  };

  let latestBurn = 0;
  let showLatestBurn = false;

  let maxSupplyInterval;

  let displayBurnedRune = 0;  // For display purposes
  let actualBurnedRune = 0;   // Source of truth from MaxSupply

  let showUSD = false;
  let unsubscribeRunePrice;

  // Add this variable to track previous MaxSupply
  let previousMaxSupply = originalSupply;

  let refreshCount = 0; // Add counter for tracking refresh cycles

  // Add this variable to track if it's the first fetch
  let isFirstFetch = true;

  // Add timer variables
  let progress = 0;
  let timerInterval;

  // Loading states
  let isLoading = false;
  let showContent = true;

  function startTimer() {
    progress = 0;
    if (timerInterval) clearInterval(timerInterval);
    
    // Calculate increment to complete progress in REFRESH_INTERVAL
    const INCREMENT = (100 / (REFRESH_INTERVAL / 100));
    
    timerInterval = setInterval(() => {
      progress = (progress + INCREMENT) % 100;
    }, 100); // Update every 100ms for smooth animation
  }

  let dataInterval;

  onMount(async () => {
    // Subscribe to shared RUNE price store
    unsubscribeRunePrice = subscribeToRunePrice();

    // Initial fetch - reserve first for proper circulating supply calculation
    await fetchReserveBalance();
    await fetchSupply();
    await Promise.all([
      fetchMaxSupply(),
      fetchBondedRune(),
      fetchPooledRune(),
      fetchSystemIncomeBurnRate()
    ]);
    await fetchExchangeBalances();

    // Create chart once after initial data load
    walletRune = circulatingSupply - bondedRune - pooledRune;
    createChart();

    // Start the timer
    startTimer();

    // Set up interval - thornode client handles Liquify/NineRealms failover
    // Note: runePrice is handled by the shared store subscription
    dataInterval = setInterval(async () => {
      await fetchReserveBalance();
      await Promise.all([
        fetchMaxSupply(),
        fetchSupply(),
        fetchBondedRune(),
        fetchPooledRune(),
        fetchSystemIncomeBurnRate()
      ]);

      // Reset timer when data refreshes
      progress = 0;
      // Update wallet RUNE
      walletRune = circulatingSupply - bondedRune - pooledRune;
    }, REFRESH_INTERVAL);
  });

  // Cleanup intervals on component destroy
  onDestroy(() => {
    if (dataInterval) clearInterval(dataInterval);
    if (timerInterval) clearInterval(timerInterval);
    if (unsubscribeRunePrice) unsubscribeRunePrice();
  });

  // Unified fetch using thornode client (handles Liquify/NineRealms failover)
  const fetchMaxSupply = async () => {
    try {
      const data = await thornode.getMimir('MaxRuneSupply');
      await processMaxSupplyData(data);
    } catch (error) {
      console.error("Error fetching max supply:", error);
    }
  };

  const processMaxSupplyData = async (data) => {
    const newMaxSupply = fromBaseUnit(data);
    
    // Log if MaxSupply is unchanged
    if (previousMaxSupply === newMaxSupply) {
      console.log('MaxSupply unchanged:', newMaxSupply);
    }
    
    // Only show burn notification if it's not the first fetch and we detect a burn
    if (!isFirstFetch && previousMaxSupply > newMaxSupply) {
      const newBurn = previousMaxSupply - newMaxSupply;
      latestBurn = newBurn;
      showLatestBurn = true;
      setTimeout(() => {
        showLatestBurn = false;
      }, 3000);
    }
    
    previousMaxSupply = newMaxSupply;
    tweenedMaxSupply.set(newMaxSupply);
    maxSupply = newMaxSupply;
    actualBurnedRune = originalSupply - maxSupply;
    tweenedBurnedRune.set(actualBurnedRune);
    burnedPercentage = (actualBurnedRune / originalSupply) * 100;

    // Set isFirstFetch to false after first fetch
    isFirstFetch = false;
  };

  const fetchSupply = async () => {
    try {
      const data = await thornode.fetch('/cosmos/bank/v1beta1/supply/by_denom?denom=rune');
      const totalSupplyInRune = fromBaseUnit(data.amount.amount);
      tweenedTotalSupply.set(totalSupplyInRune);
      currentSupply = totalSupplyInRune;

      // Calculate circulating supply by subtracting reserve
      circulatingSupply = totalSupplyInRune - reserveRune;
      tweenedCirculatingSupply.set(circulatingSupply);
      tweenedReserveRune.set(reserveRune);

      // Update calculation to use circulating / (circulating + reserve)
      circulatingPercentage = (circulatingSupply / (circulatingSupply + reserveRune)) * 100;
    } catch (error) {
      console.error("Error fetching supply data:", error);
    }
  };

  const fetchReserveBalance = async () => {
    try {
      const data = await thornode.getBalance('thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt');
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        reserveRune = fromBaseUnit(runeBalance.amount);
        tweenedReserveRune.set(reserveRune);
      }
    } catch (error) {
      console.error("Error fetching reserve balance:", error);
    }
  };

  const fetchSystemIncomeBurnRate = async () => {
    try {
      const data = await thornode.getMimir('SystemIncomeBurnRateBPS');
      systemIncomeBurnRate = Number(data) / 100; // Convert basis points to percentage
    } catch (error) {
      console.error("Error fetching system income burn rate:", error);
    }
  };

  const fetchBondedRune = async () => {
    try {
      const data = await thornode.getBalance('thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv');
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = fromBaseUnit(runeBalance.amount);
        tweenedBondedRune.set(amount);
        bondedRune = amount;
      }
    } catch (error) {
      console.error("Error fetching bonded RUNE:", error);
    }
  };

  const fetchPooledRune = async () => {
    try {
      const data = await thornode.getBalance('thor1g98cy3n9mmjrpn0sxmn63lztelera37n8n67c0');
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = fromBaseUnit(runeBalance.amount);
        tweenedPooledRune.set(amount);
        pooledRune = amount;
      }
    } catch (error) {
      console.error("Error fetching pooled RUNE:", error);
    }
  };

  const fetchExchangeBalances = async () => {
    const exchanges = {
      binance: ["thor1cqg8pyxnq03d88cl3xfn5wzjkguw5kh9enwte4", "thor1t60f02r8jvzjrhtnjgfj4ne6rs5wjnejwmj7fh"],
      kraken: ["thor1nm0rrq86ucezaf8uj35pq9fpwr5r82clphp95t"],
      treasury: ["thor10qh5272ktq4wes8ex343ky9rsuehcypddjh08k"],
      bybit: ["thor1mtqtupwgjwn397w3dx9fqmqgzrfzq3240frash"]
    };

    for (const [exchange, addresses] of Object.entries(exchanges)) {
      let totalBalance = 0;
      for (const address of addresses) {
        try {
          const data = await thornode.getBalance(address);
          const runeBalance = data.balances.find(balance => balance.denom === "rune");
          if (runeBalance) {
            totalBalance += fromBaseUnit(runeBalance.amount);
          }
        } catch (error) {
          console.error(`Error fetching ${exchange} balance:`, error);
        }
      }
      exchangeBalances[exchange] = totalBalance;
    }
  };

  $: {
    walletRune = circulatingSupply - bondedRune - pooledRune;
  }

  function createChart() {
    const ctx = document.getElementById("supplyDistributionChart");
    if (!ctx) return;
    
    if (chart) {
      chart.destroy();
    }

    const totalExchangeBalance = Object.values(exchangeBalances).reduce((a, b) => a + b, 0);
    const adjustedWalletRune = walletRune - totalExchangeBalance;

    chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ['Bonded RUNE', 'Pooled RUNE', 'Uncirculating (Reserve)', 'RUNE in Wallets', 'Binance', 'Kraken', 'Treasury', 'Bybit'],
        datasets: [{
          data: [
            bondedRune, 
            pooledRune, 
            reserveRune, 
            adjustedWalletRune,
            exchangeBalances.binance,
            exchangeBalances.kraken,
            exchangeBalances.treasury,
            exchangeBalances.bybit
          ],
          backgroundColor: [
            '#FF6384', // Bonded RUNE
            '#36A2EB', // Pooled RUNE
            '#FFCE56', // Uncirculating RUNE
            '#4BC0C0', // RUNE in Wallets
            '#9966FF', // Binance
            '#FF9F40', // Kraken
            '#FF5733', // Treasury
            '#33FF57'  // Bybit
          ],
          hoverBackgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF5733', '#33FF57'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#a9a9a9'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                const value = context.raw;
                const percentage = ((value / currentSupply) * 100).toFixed(2);
                label += `${formatNumber(value)} RUNE (${percentage}%)`;
                return label;
              }
            }
          }
        }
      }
    });
  }

  // Format percentage from decimal (0.15 -> "15.00%")
  const formatPercentage = (num) => {
    return (num * 100).toFixed(2) + '%';
  };

  // Format RUNE amount as USD using shared store price
  const formatUSD = (runeAmount) => {
    const usdAmount = runeAmount * $runePrice;
    return formatUSDBase(usdAmount);
  };

</script>

<div class="supply-tracker">
  <PageHeader title="RUNE Supply">
    <div slot="actions" class="controls">
      <label class="toggle">
        <input type="checkbox" bind:checked={showUSD}>
        <span class="slider">
          <span class="knob">
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="knob-icon rune" />
            <span class="knob-icon dollar">$</span>
          </span>
          <div class="timer" class:timer-left={showUSD}>
            <svg class="progress-ring" width="24" height="24">
              <circle
                class="progress-ring__circle-bg"
                stroke="#2c2c2c"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
              />
              <circle
                class="progress-ring__circle"
                stroke="#4A90E2"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                style="stroke-dashoffset: {(63 * (100 - progress)) / 100}"
              />
            </svg>
          </div>
        </span>
      </label>
    </div>
  </PageHeader>

  <div class="container">
    <div class="grid">
      <div class="card burned">
        <h3>RUNE Burned</h3>
        <div class="main-value-container">
          <div class="main-value">
            {#if showUSD}
              {formatUSD($tweenedBurnedRune)} 🔥
            {:else}
              {formatNumber($tweenedBurnedRune)}
              <img src={FireIcon} alt="Fire" class="fire-icon" />
            {/if}
          </div>
          {#if showLatestBurn}
            <span
              class="burn-notification"
              data-bubble={showUSD ?
                `+$${(latestBurn * $runePrice).toFixed(2)}` :
                `+${latestBurn.toFixed(2)}`}
              in:fly={{ y: 10, duration: 400 }}
              out:fly={{ y: -10, duration: 400 }}
            />
          {/if}
        </div>
        <div class="sub-values">
          <span class="burn-rate">{systemIncomeBurnRate.toFixed(2)}% of all system income is burned</span>
        </div>
      </div>
      <div class="card total-supply">
        <h3>Total Supply</h3>
        <div class="main-value">
          {#if showUSD}
            {formatUSD($tweenedTotalSupply)}
          {:else}
            {formatNumber($tweenedTotalSupply)}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          {/if}
        </div>
        <div class="sub-values">
          <span class="percentage">Maximum supply: {formatNumber(maxSupply)}</span>
        </div>
      </div>
      <div class="card circulating-supply">
        <h3>Circulating Supply</h3>
        <div class="main-value">
          {#if showUSD}
            {formatUSD($tweenedCirculatingSupply)}
          {:else}
            {formatNumber($tweenedCirculatingSupply)}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          {/if}
        </div>
        <div class="sub-values">
          <span class="percentage">{circulatingPercentage.toFixed(3)}% of total supply is circulating</span>
        </div>
      </div>
      <div class="card reserve-rune">
        <h3>Uncirculating (Reserve)</h3>
        <div class="main-value">
          {#if showUSD}
            {formatUSD($tweenedReserveRune)}
          {:else}
            {formatNumber($tweenedReserveRune)}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          {/if}
        </div>
        <div class="sub-values">
          <a href="https://runescan.io/address/thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="percentage-link"
          >
            {(reserveRune / currentSupply * 100).toFixed(2)}% of total supply in the Reserve
          </a>
        </div>
      </div>
      <div class="card bonded-rune">
        <h3>Bonded RUNE</h3>
        <div class="main-value">
          {#if showUSD}
            {formatUSD($tweenedBondedRune)}
          {:else}
            {formatNumber($tweenedBondedRune)}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          {/if}
        </div>
        <div class="sub-values">
          <span class="percentage">{formatPercentage($tweenedBondedRune / circulatingSupply)} of circulating supply</span>
        </div>
      </div>
      <div class="card pooled-rune">
        <h3>Pooled RUNE</h3>
        <div class="main-value">
          {#if showUSD}
            {formatUSD($tweenedPooledRune)}
          {:else}
            {formatNumber($tweenedPooledRune)}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          {/if}
        </div>
        <div class="sub-values">
          <span class="percentage">{formatPercentage($tweenedPooledRune / circulatingSupply)} of circulating supply</span>
        </div>
      </div>
    </div>
  </div>

  <div class="container chart-container">
    <h2>RUNE Supply Distribution</h2>
    <div class="chart-wrapper">
      <canvas id="supplyDistributionChart"></canvas>
    </div>
  </div>
</div>

<style>
  .supply-tracker {
    max-width: 800px;
    width: 95%;
    margin: 0 auto;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    position: relative;
  }

  .container {
    background: linear-gradient(145deg, #1a1a1a 0%, #2c2c2c 100%);
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    margin-bottom: 80px;
  }

  /* Integrated toggle with timer */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
  }

  .toggle input {
    display: none;
  }

  .slider {
    position: relative;
    width: 64px;
    height: 32px;
    background-color: #1a1a1a;
    border-radius: 16px;
    transition: 0.3s;
    border: 1px solid #3a3a3a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px;
  }

  .knob {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    width: 26px;
    left: 3px;
    bottom: 2px;
    background-color: #4A90E2;
    border-radius: 50%;
    transition: 0.3s;
  }

  .knob-icon {
    position: absolute;
    transition: 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .knob-icon.rune {
    color: white;
    font-size: 20px;
    font-weight: 500;
    opacity: 1;
  }

  .knob-icon.dollar {
    color: white;
    font-size: 20px;
    font-weight: 600;
    opacity: 0;
  }

  input:checked + .slider .knob {
    transform: translateX(32px);
  }

  input:checked + .slider .knob-icon.rune {
    opacity: 0;
  }

  input:checked + .slider .knob-icon.dollar {
    opacity: 1;
  }

  .toggle:hover .slider {
    border-color: #4A90E2;
    box-shadow: 0 0 5px rgba(74, 144, 226, 0.2);
  }

  .timer {
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateX(26px);
    transition: transform 0.3s ease;
  }

  .timer-left {
    transform: translateX(0px);
  }

  .progress-ring {
    transform: rotate(-90deg);
    transition: stroke-dashoffset 0.3s ease-in-out;
  }

  .progress-ring__circle-bg {
    stroke-width: 2;
  }

  .progress-ring__circle {
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 63;
    transition: stroke-dashoffset 0.3s ease-in-out;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 20px 16px;
  }

  .card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 120px;
    position: relative;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 20px rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #333333 0%, #404040 100%);
  }

  .card h3 {
    font-size: 12px;
    margin: 0 0 6px 0;
    color: #a0a0a0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .main-value-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    margin-bottom: 15px;
  }

  .main-value {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    position: absolute;
    top: 45%;
    left: 16px;
    right: 16px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    letter-spacing: -0.3px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .sub-values {
    display: flex;
    justify-content: center;
    font-size: 12px;
    color: #c0c0c0;
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    font-weight: 500;
    text-align: center;
  }

  .fire-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
    vertical-align: top;
    position: relative;
    top: 2px;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
    vertical-align: top;
    position: relative;
    top: 2px;
  }

  .burn-notification {
    position: absolute;
    right: 10px;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    height: auto;
  }

  .burn-notification[data-bubble]:after {
    content: attr(data-bubble);
    padding: 4px 8px;
    font-size: 0.9em;
    font-weight: bold;
    background-color: #2c2c2c;
    color: #FF6B6B;
    border: 1px solid #FF6B6B;
    border-radius: 12px;
    white-space: nowrap;
    box-shadow: 0 0 10px rgba(255, 107, 107, 0.3);
    animation: glow 1s ease-in-out infinite alternate;
  }

  @keyframes glow {
    from {
      box-shadow: 0 0 5px #FF6B6B, 0 0 10px #FF6B6B;
    }
    to {
      box-shadow: 0 0 10px #FF6B6B, 0 0 20px #FF6B6B;
    }
  }

  .percentage-link {
    color: #31FD9D;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
    opacity: 0.95;
  }

  .percentage-link:hover {
    opacity: 1;
    text-shadow: 0 0 8px rgba(49, 253, 157, 0.3);
  }

  @media (max-width: 600px) {
    .supply-tracker {
      padding: 12px;
    }

    .grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px 12px;
    }

    .card {
      padding: 16px;
      height: auto;
      min-height: 110px;
    }

    .main-value {
      position: static;
      transform: none;
      margin: 8px 0;
      font-size: 22px;
      left: auto;
      right: auto;
    }

    .sub-values {
      position: static;
      margin-top: 8px;
      left: auto;
      right: auto;
    }
  }

  @media (min-width: 601px) and (max-width: 800px) {
    .supply-tracker {
      width: 98%;
    }

    .grid {
      gap: 15px;
      padding: 15px;
    }

    .main-value {
      font-size: 22px;
    }
  }
</style>
