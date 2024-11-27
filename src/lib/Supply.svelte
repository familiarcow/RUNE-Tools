<script>
  import { onMount, onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import Chart from "chart.js/auto";
  import FireIcon from '/assets/fire.svg';
  import { fly, fade } from 'svelte/transition';

  // Refresh interval in milliseconds (10 seconds)
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
  let liquifyFailureCount = 0; // Track failures from liquify endpoint
  const MAX_LIQUIFY_FAILURES = 3; // Max failures before falling back to ninerealms

  let displayBurnedRune = 0;  // For display purposes
  let actualBurnedRune = 0;   // Source of truth from MaxSupply

  let showUSD = false;
  let runePrice = 0;
  let priceInterval;

  // Add this variable to track previous MaxSupply
  let previousMaxSupply = originalSupply;

  let refreshCount = 0; // Add counter for tracking refresh cycles

  // Add this variable to track if it's the first fetch
  let isFirstFetch = true;

  // Add timer variables
  let progress = 0;
  let timerInterval;

  function startTimer() {
    progress = 0;
    if (timerInterval) clearInterval(timerInterval);
    
    // Calculate increment to complete progress in REFRESH_INTERVAL
    const INCREMENT = (100 / (REFRESH_INTERVAL / 100));
    
    timerInterval = setInterval(() => {
      progress = (progress + INCREMENT) % 100;
    }, 100); // Update every 100ms for smooth animation
  }

  onMount(async () => {
    // Initial fetch from ninerealms - in correct order
    await fetchMaxSupplyFromNinerealms();
    await fetchReserveBalance();  // Get reserve first
    await fetchSupply();          // Then calculate circulating supply
    await Promise.all([           // Then fetch remaining data
        fetchBondedRune(),
        fetchPooledRune(),
        fetchRunePrice(),
        fetchSystemIncomeBurnRate()
    ]);
    await fetchExchangeBalances();
    
    // Create chart once after initial data load
    walletRune = circulatingSupply - bondedRune - pooledRune;
    createChart();
    
    // Start the timer
    startTimer();
    
    // Set up interval using REFRESH_INTERVAL
    const dataInterval = setInterval(async () => {
      await fetchReserveBalanceFromLiquify();  // Get reserve first
      await Promise.all([                      // Then fetch everything else
        fetchMaxSupplyFromLiquify(),
        fetchSupplyFromLiquify(),
        fetchBondedRuneFromLiquify(),
        fetchPooledRuneFromLiquify(),
        fetchRunePriceFromLiquify(),
        fetchSystemIncomeBurnRateFromLiquify()
      ]);
      
      // Reset timer when data refreshes
      progress = 0;
      // Update wallet RUNE
      walletRune = circulatingSupply - bondedRune - pooledRune;
    }, REFRESH_INTERVAL);

    // Update cleanup
    onDestroy(() => {
      if (dataInterval) clearInterval(dataInterval);
      if (timerInterval) clearInterval(timerInterval);
    });
  });

  const fetchMaxSupplyFromNinerealms = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/thorchain/mimir/key/MaxRuneSupply");
      const data = await response.text();
      await processMaxSupplyData(data);
      liquifyFailureCount = 0; // Reset failure count on successful ninerealms fetch
    } catch (error) {
      console.error("Error fetching max supply data from ninerealms:", error);
    }
  };

  const fetchMaxSupplyFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/thorchain/mimir/key/MaxRuneSupply");
      const data = await response.text();
      await processMaxSupplyData(data);
      liquifyFailureCount = 0; // Reset failure count on success
    } catch (error) {
      console.error("Error fetching max supply data from liquify:", error);
      liquifyFailureCount++;
      
      // If liquify fails too many times, fall back to ninerealms
      if (liquifyFailureCount >= MAX_LIQUIFY_FAILURES) {
        console.log("Falling back to ninerealms endpoint due to liquify failures");
        await fetchMaxSupplyFromNinerealms();
      }
    }
  };

  const processMaxSupplyData = async (data) => {
    const newMaxSupply = Number(data) / 1e8;
    
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

  const fetchOtherDataFromNinerealms = async () => {
    try {
      await Promise.all([
        fetchSupply(),
        fetchBondedRune(),
        fetchPooledRune(),
        fetchReserveBalance(),
        fetchRunePrice(),
        fetchSystemIncomeBurnRate()
      ]); // Removed fetchExchangeBalances from regular updates

      // Just update walletRune without redrawing chart
      walletRune = circulatingSupply - bondedRune - pooledRune;
    } catch (error) {
      console.error("Error fetching other data:", error);
    }
  };

  const fetchSupply = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/cosmos/bank/v1beta1/supply/rune");
      const data = await response.json();
      const totalSupplyInRune = Number(data.amount.amount) / 1e8;
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

  const fetchSupplyFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/cosmos/bank/v1beta1/supply/rune");
      const data = await response.json();
      const totalSupplyInRune = Number(data.amount.amount) / 1e8;
      tweenedTotalSupply.set(totalSupplyInRune);
      currentSupply = totalSupplyInRune;
      
      // Calculate circulating supply by subtracting reserve
      circulatingSupply = totalSupplyInRune - reserveRune;
      tweenedCirculatingSupply.set(circulatingSupply);
      tweenedReserveRune.set(reserveRune);
      
      // Update calculation to use circulating / (circulating + reserve)
      circulatingPercentage = (circulatingSupply / (circulatingSupply + reserveRune)) * 100;
    } catch (error) {
      console.error("Error fetching supply data from liquify:", error);
      // Fallback to ninerealms if liquify fails
      await fetchSupply();
    }
  };

  const fetchReserveBalance = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances/thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        reserveRune = Number(runeBalance.amount) / 1e8;
        tweenedReserveRune.set(reserveRune);
      }
    } catch (error) {
      console.error("Error fetching reserve balance:", error);
    }
  };

  const fetchSystemIncomeBurnRate = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/thorchain/mimir/key/SystemIncomeBurnRateBPS");
      const data = await response.text();
      systemIncomeBurnRate = Number(data) / 100; // Convert basis points to percentage
    } catch (error) {
      console.error("Error fetching system income burn rate:", error);
    }
  };

  const fetchBondedRune = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances/thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = Number(runeBalance.amount) / 1e8;
        tweenedBondedRune.set(amount);
        bondedRune = amount;
      }
    } catch (error) {
      console.error("Error fetching bonded RUNE:", error);
    }
  };

  const fetchPooledRune = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances/thor1g98cy3n9mmjrpn0sxmn63lztelera37n8n67c0");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = Number(runeBalance.amount) / 1e8;
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
          const response = await fetch(`https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances/${address}`);
          const data = await response.json();
          const runeBalance = data.balances.find(balance => balance.denom === "rune");
          if (runeBalance) {
            totalBalance += Number(runeBalance.amount) / 1e8;
          }
        } catch (error) {
          console.error(`Error fetching ${exchange} balance:`, error);
        }
      }
      exchangeBalances[exchange] = totalBalance;
    }
  };

  const fetchRunePrice = async () => {
    try {
      const response = await fetch("https://thornode.ninerealms.com/thorchain/network");
      const data = await response.json();
      runePrice = Number(data.rune_price_in_tor) / 1e8;
    } catch (error) {
      console.error("Error fetching RUNE price:", error);
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  };

  const formatPercentage = (num) => {
    return (num * 100).toFixed(2) + '%';
  };

  const formatUSD = (runeAmount) => {
    const usdAmount = runeAmount * runePrice;
    return usdAmount < 1 
      ? '$' + usdAmount.toFixed(2)
      : '$' + Math.round(usdAmount).toLocaleString();
  };

  // Liquify endpoint versions
  const fetchBondedRuneFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/cosmos/bank/v1beta1/balances/thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = Number(runeBalance.amount) / 1e8;
        tweenedBondedRune.set(amount);
        bondedRune = amount;
      }
    } catch (error) {
      console.error("Error fetching bonded RUNE from liquify:", error);
    }
  };

  const fetchPooledRuneFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/cosmos/bank/v1beta1/balances/thor1g98cy3n9mmjrpn0sxmn63lztelera37n8n67c0");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        const amount = Number(runeBalance.amount) / 1e8;
        tweenedPooledRune.set(amount);
        pooledRune = amount;
      }
    } catch (error) {
      console.error("Error fetching pooled RUNE from liquify:", error);
    }
  };

  const fetchReserveBalanceFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/cosmos/bank/v1beta1/balances/thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt");
      const data = await response.json();
      const runeBalance = data.balances.find(balance => balance.denom === "rune");
      if (runeBalance) {
        reserveRune = Number(runeBalance.amount) / 1e8;
        tweenedReserveRune.set(reserveRune);
      }
    } catch (error) {
      console.error("Error fetching reserve balance from liquify:", error);
      // Fallback to ninerealms if liquify fails
      await fetchReserveBalance();
    }
  };

  const fetchRunePriceFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/thorchain/network");
      const data = await response.json();
      runePrice = Number(data.rune_price_in_tor) / 1e8;
    } catch (error) {
      console.error("Error fetching RUNE price from liquify:", error);
    }
  };

  const fetchSystemIncomeBurnRateFromLiquify = async () => {
    try {
      const response = await fetch("https://thornode.thorchain.liquify.com/thorchain/mimir/key/SystemIncomeBurnRateBPS");
      const data = await response.text();
      systemIncomeBurnRate = Number(data) / 100;
    } catch (error) {
      console.error("Error fetching system income burn rate from liquify:", error);
    }
  };
</script>

<div class="supply-tracker">
  <div class="header">
    <h2>RUNE Supply</h2>
    <div class="controls">
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
  </div>

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
                `+$${(latestBurn * runePrice).toFixed(2)}` : 
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
    padding: 20px;
    font-family: 'Exo', sans-serif;
    position: relative;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr; /* Creates 3 columns with center being auto-sized */
    align-items: center;
    margin-bottom: 20px;
    background-color: #1a1a1a;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .header h2 {
    margin: 0;
    padding: 0;
    background-color: transparent;
    grid-column: 2; /* Places the title in the center column */
    text-align: center;
  }

  .controls {
    grid-column: 3; /* Places controls in the last column */
    justify-self: end;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    height: 120px;
    transition: all 0.3s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .card h3 {
    font-size: 14px;
    color: #a9a9a9;
    font-weight: 500;
    margin: 0 0 15px 0;
    text-align: center;
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 24px;
    font-weight: bold;
    color: white;
  }

  .sub-values {
    text-align: center;
    font-size: 12px;
    color: #a9a9a9;
    margin-top: auto;
  }

  .fire-icon {
    width: 20px;
    height: 20px;
    margin-left: 5px;
  }

  .rune-icon {
    width: 20px;
    height: 20px;
    margin-left: 5px;
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    border: 0;
  }

  .percentage-link {
    color: #a9a9a9;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .percentage-link:hover {
    color: #4A90E2;
  }

  /* Add mobile styles */
  @media (max-width: 600px) {
    .supply-tracker {
      width: 100%;
      padding: 10px;
    }

    .grid {
      grid-template-columns: 1fr; /* Single column on mobile */
      gap: 15px;
      padding: 15px;
    }

    .card {
      height: 110px; /* Slightly smaller height on mobile */
    }

    .main-value {
      font-size: 20px; /* Smaller font size on mobile */
    }

    .header {
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .header h2 {
      font-size: 18px;
    }
  }

  /* Add tablet styles */
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
</style>
