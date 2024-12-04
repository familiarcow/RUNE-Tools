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

    btcChartInstance.data.labels = labels;
    btcChartInstance.data.datasets[0].data = prices;
    
    btcChartInstance.update('active');
  }

  onMount(async () => {
    try {
      console.log('Starting initialization...');
      isLoading = false;

      // Get initial price data
      await Promise.all([
        fetchRunePrice(),
        fetchPoolsData()
      ]);

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

      // Create initial data points for BTC
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

      initChart();
      initBTCChart();
      
      // Set up interval for updates
      const interval = setInterval(async () => {
        await Promise.all([
          fetchRunePrice(),
          fetchPoolsData()
        ]);
        
        // Reset both notifications after 3 seconds
        setTimeout(() => {
          showLatestChange = false;
          showBtcLatestChange = false;
        }, 3000);
      }, 6000);

      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error during mount:', err);
      error = err.message;
      isLoading = false;
    }
  });
</script>

<div class="rune-container">
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

  <div class="chart-container">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <div class="pool-charts">
    <div class="pool-chart">
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
      <div class="btc-chart-container">
        <canvas bind:this={btcChartCanvas}></canvas>
      </div>
    </div>
  </div>
</div>

<style>
  .rune-container {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .price-display {
    background: #2c2c2c;
    border-radius: 8px;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    margin: 0 auto 20px;
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
    height: 300px;
    background: #2c2c2c;
    border-radius: 8px;
    padding: 10px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
      padding: 12px 15px;
    }

    .price, .loading, .error {
      font-size: 20px;
      gap: 8px;
    }

    .rune-icon {
      width: 24px;
      height: 24px;
    }

    .chart-container {
      height: 250px;
      padding: 15px;
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
    left: calc(100% + 40px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    height: auto;
    white-space: nowrap;
    z-index: 10;
  }

  .change-bubble {
    padding: 6px 16px;
    font-size: 0.9em;
    font-weight: bold;
    background-color: #2c2c2c;
    border-radius: 12px;
    white-space: nowrap;
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
      box-shadow: 0 0 5px #F7931A, 0 0 10px #F7931A;
    }
    to {
      box-shadow: 0 0 10px #F7931A, 0 0 20px #F7931A;
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
      box-shadow: 0 0 5px #4A90E2, 0 0 10px #4A90E2;
    }
    to {
      box-shadow: 0 0 10px #4A90E2, 0 0 20px #4A90E2;
    }
  }

  @keyframes glowRed {
    from {
      box-shadow: 0 0 5px #FF6B6B, 0 0 10px #FF6B6B;
    }
    to {
      box-shadow: 0 0 10px #FF6B6B, 0 0 20px #FF6B6B;
    }
  }

  @keyframes glowNeutral {
    from {
      box-shadow: 0 0 5px #888, 0 0 10px #888;
    }
    to {
      box-shadow: 0 0 10px #888, 0 0 20px #888;
    }
  }

  .pool-charts {
    margin-top: 20px;
    display: grid;
    gap: 20px;
  }

  .pool-chart h3 {
    color: #F7931A;
    margin: 0 0 10px 0;
    font-size: 18px;
  }

  .pool-chart .btc-chart-container {
    height: 200px;
    background: #2c2c2c;
    border-radius: 8px;
    padding: 10px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .pool-chart .btc-chart-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }
</style>
