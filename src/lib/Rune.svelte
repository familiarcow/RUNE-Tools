<script>
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { fly, fade } from 'svelte/transition';
  import Chart from 'chart.js/auto';

  let runePrice = null;
  let isLoading = true;
  let error = null;
  let priceHistory = [];
  let chartInstance;
  let chartCanvas;
  let latestChange = 0;
  let showLatestChange = false;
  let isChartReady = false;

  let poolsData = [];
  let btcPriceHistory = [];
  let btcChartInstance;
  let btcChartCanvas;

  let thorNodePriceHistory = [];
  let thorNodeBTCPriceHistory = [];

  let btcLatestChange = 0;
  let showBtcLatestChange = false;
  let lastBtcPrice = null;

  let marketCapRank = null;
  let isLoadingRank = true;

  // Add tweened value for smooth price updates
  const tweenedPrice = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t) // Ease out quad
  });

  // Add another tweened value for BTC
  const tweenedBtcPrice = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t)
  });

  // Add this new variable
  let lastRankFetch = 0;
  const RANK_FETCH_INTERVAL = 120000; // 2 minutes in milliseconds

  async function fetchRunePrice() {
    try {
      const response = await fetch('https://thornode.thorchain.liquify.com/thorchain/network');
      const data = await response.json();
      const newPrice = Number(data.rune_price_in_tor) / 1e8;
      
      // Calculate price change if we have a previous price
      if (runePrice !== null) {
        const priceChange = newPrice - runePrice;
        const percentChange = (priceChange / runePrice) * 100;
        
        // Always show change notification, even for zero change
        latestChange = {
          absolute: priceChange,
          percentage: percentChange
        };
        showLatestChange = true;
        setTimeout(() => {
          showLatestChange = false;
        }, 3000);
      }
      
      tweenedPrice.set(newPrice);
      runePrice = newPrice;
      
      const timestamp = new Date();
      thorNodePriceHistory = [...thorNodePriceHistory, { price: newPrice, timestamp }];
      
      // Keep only the last hour of data points (600 points at 6-second intervals)
      const oneHourAgo = new Date(timestamp.getTime() - 3600000);
      thorNodePriceHistory = thorNodePriceHistory.filter(point => point.timestamp > oneHourAgo);
      priceHistory = thorNodePriceHistory;
      
      if (chartInstance) {
        updateChart();
      }
      
    } catch (err) {
      console.error('Error fetching rune price:', err);
      error = err.message;
    }
  }

  function initChart() {
    if (!chartCanvas || priceHistory.length < 2) return;
    
    const ctx = chartCanvas.getContext('2d');
    if (chartInstance) {
      chartInstance.destroy();
    }
    
    const labels = priceHistory.map(entry => entry.timestamp);
    const prices = priceHistory.map(entry => entry.price);
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: prices,
          borderColor: '#4A90E2',
          backgroundColor: 'rgba(74, 144, 226, 0.05)',
          borderWidth: 3,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 400,
          easing: 'easeOutExpo',
          x: {
            duration: 400,
            easing: 'easeOutExpo'
          },
          y: {
            duration: 0
          }
        },
        transitions: {
          active: {
            animation: {
              duration: 400,
              easing: 'easeOutExpo'
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 4,
              color: '#666',
              font: {
                size: 11
              },
              callback: function(value, index) {
                const time = this.getLabelForValue(value);
                if (!time) return '';
                return new Date(time).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
            }
          },
          y: {
            display: true,
            position: 'right',
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 5,
              color: '#666',
              font: {
                size: 11
              },
              callback: function(value) {
                return '$' + Number(value.toFixed(6)).toString();
              }
            },
            beginAtZero: false,
            suggestedMin: Math.min(...prices) * 0.9999,
            suggestedMax: Math.max(...prices) * 1.0001
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(44, 44, 44, 0.9)',
            titleColor: '#888',
            bodyColor: '#4A90E2',
            borderColor: '#4A90E2',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: function(tooltipItems) {
                const time = new Date(tooltipItems[0].label);
                return time.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              },
              label: function(context) {
                return '$' + Number(context.raw.toFixed(6)).toString();
              }
            }
          }
        }
      }
    });

    // Force immediate render
    chartInstance.render();
  }

  function updateChart() {
    if (!chartInstance) return;

    const labels = priceHistory.map(entry => entry.timestamp);
    const prices = priceHistory.map(entry => entry.price);

    // Check if there's a price change
    const hasChange = Math.abs(latestChange.absolute) >= 0.000001;

    // Update animation configuration based on price change
    chartInstance.options.animation.y = {
      duration: hasChange ? 400 : 0,
      easing: 'easeOutExpo'
    };

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = prices;
    
    chartInstance.update('active');
  }

  // Helper function to format the change display
  function formatChangeDisplay(change) {
    if (!change) return '-';
    
    const absValue = Math.abs(change.absolute).toFixed(6);
    const absPercent = Math.abs(change.percentage).toFixed(2);
    const prefix = change.absolute > 0 ? '+' : '-';
    
    return `${prefix}$${absValue} <span class="percent">(${prefix}${absPercent}%)</span>`;
  }

  async function fetchPoolsData() {
    try {
      const response = await fetch('https://thornode.thorchain.liquify.com/thorchain/pools');
      const data = await response.json();
      poolsData = data;

      const btcPool = data.find(pool => pool.asset === 'BTC.BTC');
      if (btcPool) {
        const btcPrice = Number(btcPool.asset_tor_price) / 1e8;
        
        // Calculate price change if we have a previous price
        if (lastBtcPrice !== null) {
          const priceChange = btcPrice - lastBtcPrice;
          const percentChange = (priceChange / lastBtcPrice) * 100;
          
          // Always show change notification, even for zero change
          btcLatestChange = {
            absolute: priceChange,
            percentage: percentChange
          };
          showBtcLatestChange = true;
          setTimeout(() => {
            showBtcLatestChange = false;
          }, 3000);
        }
        
        tweenedBtcPrice.set(btcPrice);
        lastBtcPrice = btcPrice;
        
        const timestamp = new Date();
        thorNodeBTCPriceHistory = [...thorNodeBTCPriceHistory, { price: btcPrice, timestamp }];
        
        // Keep only the last hour of data
        const oneHourAgo = new Date(timestamp.getTime() - 3600000);
        thorNodeBTCPriceHistory = thorNodeBTCPriceHistory.filter(point => point.timestamp > oneHourAgo);
        btcPriceHistory = thorNodeBTCPriceHistory;
        
        updateBTCChart();
      }
    } catch (err) {
      console.error('Error fetching pools data:', err);
    }
  }

  function initBTCChart() {
    console.log('Initializing BTC chart...', { btcChartCanvas, historyLength: btcPriceHistory.length });
    if (!btcChartCanvas || btcPriceHistory.length < 2) {
      console.log('Skipping BTC chart initialization - missing requirements');
      return;
    }
    
    const ctx = btcChartCanvas.getContext('2d');
    if (btcChartInstance) {
      btcChartInstance.destroy();
    }
    
    const labels = btcPriceHistory.map(entry => entry.timestamp);
    const prices = btcPriceHistory.map(entry => entry.price);
    
    btcChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: prices,
          borderColor: '#F7931A', // Bitcoin orange
          backgroundColor: 'rgba(247, 147, 26, 0.05)',
          borderWidth: 3,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 400,
          easing: 'easeOutExpo',
          x: {
            duration: 400,
            easing: 'easeOutExpo'
          },
          y: {
            duration: 0
          }
        },
        transitions: {
          active: {
            animation: {
              duration: 400,
              easing: 'easeOutExpo'
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 4,
              color: '#666',
              font: {
                size: 11
              },
              callback: function(value, index) {
                const time = this.getLabelForValue(value);
                if (!time) return '';
                return new Date(time).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
            }
          },
          y: {
            display: true,
            position: 'right',
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 5,
              color: '#666',
              font: {
                size: 11
              },
              callback: function(value) {
                return '$' + Number(value.toFixed(2)).toString();
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(44, 44, 44, 0.9)',
            titleColor: '#888',
            bodyColor: '#F7931A',
            borderColor: '#F7931A',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: function(tooltipItems) {
                const time = new Date(tooltipItems[0].label);
                return time.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              },
              label: function(context) {
                return '$' + Number(context.raw.toFixed(2)).toString();
              }
            }
          }
        }
      }
    });
  }

  function updateBTCChart() {
    if (!btcChartInstance) return;

    const labels = btcPriceHistory.map(entry => entry.timestamp);
    const prices = btcPriceHistory.map(entry => entry.price);

    // Check if there's a price change
    const hasChange = Math.abs(btcLatestChange.absolute) >= 0.01;

    // Update animation configuration based on price change
    btcChartInstance.options.animation.y = {
      duration: hasChange ? 400 : 0,
      easing: 'easeOutExpo'
    };

    btcChartInstance.data.labels = labels;
    btcChartInstance.data.datasets[0].data = prices;
    
    btcChartInstance.update('active');
  }

  async function fetchMarketCapRank() {
    // Check if enough time has passed since last fetch
    const now = Date.now();
    if (now - lastRankFetch < RANK_FETCH_INTERVAL) {
        return;
    }
    
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/thorchain?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
        const data = await response.json();
        marketCapRank = data.market_cap_rank;
        lastRankFetch = now;
        isLoadingRank = false;
    } catch (err) {
        console.error('Error fetching market cap rank:', err);
        isLoadingRank = false;
    }
  }

  onMount(async () => {
    try {
      console.log('Starting initialization...');
      isLoading = true;
      isLoadingRank = true;
      
      // Remove duplicate initialization block and simplify the flow
      await Promise.all([
        fetchRunePrice(),
        fetchPoolsData(),
        fetchMarketCapRank()
      ]).catch(err => {
        console.error('Initial data fetch failed:', err);
        throw err;
      });

      // Only proceed if we have valid RUNE price
      if (!runePrice) {
        throw new Error('Failed to load initial RUNE price');
      }

      // Create initial data points for RUNE
      const currentTime = new Date();
      const sixSecondsAgo = new Date(currentTime - 6000);
      const twelveSecondsAgo = new Date(currentTime - 12000);
      
      priceHistory = [
        { price: runePrice, timestamp: twelveSecondsAgo },
        { price: runePrice, timestamp: sixSecondsAgo },
        { price: runePrice, timestamp: currentTime }
      ];
      thorNodePriceHistory = [...priceHistory];

      // Create initial data points for BTC if available
      const btcPool = poolsData.find(pool => pool.asset === 'BTC.BTC');
      if (btcPool) {
        const btcPrice = Number(btcPool.asset_tor_price) / 1e8;
        btcPriceHistory = [
          { price: btcPrice, timestamp: twelveSecondsAgo },
          { price: btcPrice, timestamp: sixSecondsAgo },
          { price: btcPrice, timestamp: currentTime }
        ];
        thorNodeBTCPriceHistory = [...btcPriceHistory];
      }

      // Initialize charts after ensuring we have data
      await Promise.all([
        new Promise(resolve => setTimeout(() => {
          initChart();
          resolve();
        }, 100)),
        new Promise(resolve => setTimeout(() => {
          initBTCChart();
          resolve();
        }, 100))
      ]);

      isLoading = false;
      
      // Set up interval for price updates
      const interval = setInterval(async () => {
        try {
          await Promise.all([
            fetchRunePrice(),
            fetchPoolsData()
          ]);
          
          fetchMarketCapRank();
          
          setTimeout(() => {
            showLatestChange = false;
            showBtcLatestChange = false;
          }, 3000);
        } catch (err) {
          console.error('Update interval error:', err);
          // Don't set error state here to allow recovery
        }
      }, 6000);

      return () => {
        clearInterval(interval);
        if (chartInstance) chartInstance.destroy();
        if (btcChartInstance) btcChartInstance.destroy();
      };
    } catch (err) {
      console.error('Error during mount:', err);
      error = `Failed to initialize: ${err.message}`;
      isLoading = false;
      runeError = error;
    }
  });
</script>

<div class="rune-container">
  <div class="top-line">
    <div class="rank-container">
      {#if !isLoadingRank && marketCapRank}
        <span class="rank-bubble">#{marketCapRank}</span>
      {/if}
    </div>
    <div class="price-display">
      {#if error}
        <div class="error">
          <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          <span>Error: {error}</span>
        </div>
      {:else}
        <div class="price">
          <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          <span class="price-value">${$tweenedPrice.toFixed(6)}</span>
          {#if showLatestChange}
            <span 
              class="change-notification" 
              data-change-type={
                Math.abs(latestChange.absolute) < 0.000001 ? 'neutral' :
                latestChange.absolute > 0 ? 'positive' : 'negative'
              }
              in:fly={{ y: 10, duration: 400 }}
              out:fly={{ y: -10, duration: 400 }}
            >
              <span class="change-bubble">
                {#if Math.abs(latestChange.absolute) < 0.000001}
                  -
                {:else}
                  <span class="value">
                    {latestChange.absolute > 0 ? '+' : '-'}
                    ${Math.abs(latestChange.absolute).toFixed(6)}
                  </span>
                  <span class="percent">
                    ({latestChange.absolute > 0 ? '+' : '-'}
                    {Math.abs(latestChange.percentage).toFixed(2)}%)
                  </span>
                {/if}
              </span>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="chart-container">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <div class="price-display">
    <div class="price">
      <img src="/assets/coins/bitcoin-btc-logo.svg" alt="BTC" class="btc-icon" />
      <span class="price-value btc-price">${$tweenedBtcPrice.toFixed(2)}</span>
      {#if showBtcLatestChange}
        <span 
          class="change-notification" 
          data-change-type={
            Math.abs(btcLatestChange.absolute) < 0.01 ? 'neutral' :
            btcLatestChange.absolute > 0 ? 'positive' : 'negative'
          }
          in:fly={{ y: 10, duration: 400 }}
          out:fly={{ y: -10, duration: 400 }}
        >
          <span class="change-bubble">
            {#if Math.abs(btcLatestChange.absolute) < 0.01}
              -
            {:else}
              <span class="value">
                {btcLatestChange.absolute > 0 ? '+' : '-'}
                ${Math.abs(btcLatestChange.absolute).toFixed(2)}
              </span>
              <span class="percent">
                ({btcLatestChange.absolute > 0 ? '+' : '-'}
                {Math.abs(btcLatestChange.percentage).toFixed(2)}%)
              </span>
            {/if}
          </span>
        </span>
      {/if}
    </div>
  </div>

  <div class="chart-container">
    <canvas bind:this={btcChartCanvas}></canvas>
  </div>
</div>

<style>
  .rune-container {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .price-display {
    background: #2c2c2c;
    border-radius: 8px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    margin: 0 auto 15px;
    width: fit-content;
  }

  .price-display:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .btc-icon {
    width: 28px;
    height: 28px;
    transition: transform 0.3s ease;
  }

  .price-display:hover .btc-icon {
    transform: rotate(360deg);
  }

  .btc-price {
    color: #F7931A;
    text-shadow: 0 0 20px rgba(247, 147, 26, 0.3);
  }

  .rune-icon {
    width: 28px;
    height: 28px;
    transition: transform 0.3s ease;
  }

  .price-display:hover .rune-icon {
    transform: rotate(360deg);
  }

  .price-value {
    color: #4A90E2;
    text-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
  }

  .loading {
    color: #888;
  }

  .error {
    color: #ff4444;
  }

  .chart-container {
    height: 200px;
    background: #2c2c2c;
    border-radius: 8px;
    padding: 10px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    width: 100%;
  }

  .chart-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 600px) {
    .rune-container {
      padding: 15px;
    }

    .price-display {
      padding: 10px 15px;
    }

    .price, .loading, .error {
      font-size: 20px;
      gap: 8px;
    }

    .rune-icon, .btc-icon {
      width: 24px;
      height: 24px;
    }

    .chart-container {
      height: 200px;
      padding: 15px;
    }

    .change-notification {
      left: calc(100% + 10px);
    }

    .change-bubble {
      padding: 4px 12px;
      font-size: 0.8em;
    }
  }

  .price {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 600;
    margin: 0 auto;
  }

  .change-notification {
    position: absolute;
    left: 50%;
    top: calc(100% + 50px);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    height: auto;
    white-space: nowrap;
    z-index: 100;
  }

  .change-bubble {
    padding: 6px 16px;
    font-size: 0.9em;
    font-weight: bold;
    background-color: rgba(44, 44, 44, 0);
    border-radius: 12px;
    white-space: nowrap;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .price-value + .change-notification .change-bubble {
    color: #4A90E2;
    border: 1px solid #4A90E2;
    box-shadow: 0 0 10px rgba(74, 144, 226, 0.3);
    animation: glow 1s ease-in-out infinite alternate;
  }

  .btc-price + .change-notification .change-bubble {
    color: #F7931A;
    border: 1px solid #F7931A;
    box-shadow: 0 0 10px rgba(247, 147, 26, 0.3);
    animation: glowBtc 1s ease-in-out infinite alternate;
  }

  @keyframes glowBtc {
    from {
      box-shadow: 0 0 5px rgba(247, 147, 26, 0.5), 0 0 10px rgba(247, 147, 26, 0.3);
    }
    to {
      box-shadow: 0 0 10px rgba(247, 147, 26, 0.5), 0 0 20px rgba(247, 147, 26, 0.3);
    }
  }

  .change-notification[data-change-type="negative"] .change-bubble {
    color: #FF6B6B;
    border-color: #FF6B6B;
    box-shadow: 0 0 10px rgba(255, 107, 107, 0.3);
    animation: glowRed 1s ease-in-out infinite alternate;
  }

  .change-notification[data-change-type="neutral"] .change-bubble {
    color: #888;
    border-color: #888;
    box-shadow: 0 0 10px rgba(136, 136, 136, 0.3);
    animation: glowNeutral 1s ease-in-out infinite alternate;
  }

  .change-notification .percent {
    font-size: 0.8em;
    opacity: 0.8;
    margin-left: 4px;
  }

  @keyframes glow {
    from {
      box-shadow: 0 0 5px rgba(74, 144, 226, 0.5), 0 0 10px rgba(74, 144, 226, 0.3);
    }
    to {
      box-shadow: 0 0 10px rgba(74, 144, 226, 0.5), 0 0 20px rgba(74, 144, 226, 0.3);
    }
  }

  @keyframes glowRed {
    from {
      box-shadow: 0 0 5px rgba(255, 107, 107, 0.5), 0 0 10px rgba(255, 107, 107, 0.3);
    }
    to {
      box-shadow: 0 0 10px rgba(255, 107, 107, 0.5), 0 0 20px rgba(255, 107, 107, 0.3);
    }
  }

  @keyframes glowNeutral {
    from {
      box-shadow: 0 0 5px rgba(136, 136, 136, 0.5), 0 0 10px rgba(136, 136, 136, 0.3);
    }
    to {
      box-shadow: 0 0 10px rgba(136, 136, 136, 0.5), 0 0 20px rgba(136, 136, 136, 0.3);
    }
  }

  /* Add a margin-top to create space between RUNE chart and BTC price */
  .chart-container + .price-display {
    margin-top: 20px;  /* Adjust this value to get the desired spacing */
  }

  @media (max-width: 600px) {
    .chart-container + .price-display {
      margin-top: 15px;  /* Slightly less spacing on mobile */
    }
  }

  /* Update mobile styles */
  @media (max-width: 600px) {
    .change-notification {
      left: 50%;  /* Keep centered on mobile */
      top: calc(100% + 30px);  /* Changed from 10px to 40px */
      transform: translateX(-50%);
    }

    /* Remove this */
    /* .price-display {
      margin-bottom: 60px;
    } */
  }

  .top-line {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
    margin-bottom: 15px;
  }

  .rank-container {
    position: absolute;
    left: 0;
    display: flex;
    align-items: center;
  }

  .rank-bubble {
    background: #2c2c2c;
    color: #4A90E2;
    border: 1px solid #4A90E2;
    border-radius: 12px;
    padding: 4px 12px;
    font-size: 0.9em;
    font-weight: bold;
    box-shadow: 0 0 10px rgba(74, 144, 226, 0.1);
    min-width: 44px;
    text-align: center;
  }

  .price-display {
    margin: 0 auto;  /* This centers the price display */
  }

  @media (max-width: 600px) {
    .rank-bubble {
      font-size: 0.8em;
      padding: 3px 8px;
      min-width: 36px;
    }
  }

  /* Add margin between BTC price and chart */
  .price-display + .chart-container {
    margin-top: 15px;
  }

  @media (max-width: 600px) {
    .price-display + .chart-container {
      margin-top: 15px;
    }
  }

  /* Add responsive height adjustments */
  @media (min-height: 800px) {
    .chart-container {
      height: 250px; /* Larger height for taller screens */
    }
  }

  @media (max-height: 700px) {
    .chart-container {
      height: 180px; /* Even smaller for shorter screens */
    }
    
    .price-display {
      padding: 8px 20px;
    }
    
    .chart-container + .price-display {
      margin-top: 15px;
    }
  }
</style>
