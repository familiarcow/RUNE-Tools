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

  // Add tweened value for smooth price updates
  const tweenedPrice = tweened(0, {
    duration: 1000,
    easing: t => t * (2 - t) // Ease out quad
  });

  async function fetchRunePrice() {
    try {
      const response = await fetch('https://thornode.thorchain.liquify.com/thorchain/network');
      const data = await response.json();
      const newPrice = Number(data.rune_price_in_tor) / 1e8;
      
      // If this is the first fetch, create two initial points
      if (priceHistory.length === 0) {
        const now = new Date();
        const previousTime = new Date(now.getTime() - 6000); // 6 seconds ago
        priceHistory = [
          { price: newPrice, timestamp: previousTime },
          { price: newPrice, timestamp: now }
        ];
        console.log('Price history after initialization:', priceHistory);
      } else {
        // Calculate price change if we have a previous price
        if (runePrice !== null) {
          latestChange = newPrice - runePrice;
          const percentChange = (latestChange / runePrice) * 100;
          showLatestChange = true;
          
          latestChange = {
            absolute: latestChange,
            percentage: percentChange
          };
          
          setTimeout(() => {
            showLatestChange = false;
          }, 3000);
        }
        
        // Add new data point
        const timestamp = new Date();
        priceHistory = [...priceHistory, { price: newPrice, timestamp }];
        console.log('Price history after update:', priceHistory);
      }
      
      // Update current price with tweening
      tweenedPrice.set(newPrice);
      runePrice = newPrice;
      
      // Update chart if it exists
      if (chartInstance) {
        updateChart();
      }
      
      isLoading = false;
    } catch (err) {
      console.error('Error fetching rune price:', err);
      error = err.message;
      isLoading = false;
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
          tension: 0.2,
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
          duration: 600,
          easing: 'easeOutQuart',
          animations: {
            y: {
              duration: 600,
              easing: 'easeOutQuart',
              from: (ctx) => {
                if (ctx.type === 'data') {
                  if (ctx.mode === 'default' && !ctx.dropped) {
                    ctx.dropped = true;
                    const prevValue = ctx.dataset.data[ctx.dataIndex - 1];
                    // For first point, use the same value
                    return prevValue ?? ctx.dataset.data[ctx.dataIndex];
                  }
                }
                return ctx.chart.scales.y.getPixelForValue(ctx.dataset.data[ctx.dataIndex]);
              }
            },
            x: {
              duration: 0  // Instant x-axis update for clearer movement
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
    
    // Update with directional animation
    chartInstance.update({
      duration: 600,
      easing: 'easeOutQuart'
    });
  }

  // Helper function to format the change display
  function formatChangeDisplay(change) {
    if (!change) return '-';
    
    const absValue = Math.abs(change.absolute).toFixed(6);
    const absPercent = Math.abs(change.percentage).toFixed(2);
    const prefix = change.absolute > 0 ? '+' : '-';
    
    return `${prefix}$${absValue} <span class="percent">(${prefix}${absPercent}%)</span>`;
  }

  async function fetchInitialHistory() {
    try {
      // Get last hour of minute-by-minute data from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/thorchain/market_chart?vs_currency=usd&days=0.042&interval=minutely'
      );
      const data = await response.json();
      
      // Transform CoinGecko data to our format
      // CoinGecko returns [timestamp, price] pairs
      const initialHistory = data.prices.map(([timestamp, price]) => ({
        timestamp: new Date(timestamp),
        price: price
      }));

      // Set our price history with this data
      priceHistory = initialHistory;
      
      // Set initial price for delta calculations
      if (initialHistory.length > 0) {
        runePrice = initialHistory[initialHistory.length - 1].price;
      }

      return initialHistory;
    } catch (err) {
      console.error('Error fetching historical data:', err);
      return null;
    }
  }

  onMount(async () => {
    try {
      // First try to get historical data
      const history = await fetchInitialHistory();
      
      if (!history) {
        // If historical data fails, fallback to our original two-point initialization
        await fetchRunePrice();
      }
      
      // Initialize chart
      initChart();
      
      // Set up interval for updates
      const interval = setInterval(fetchRunePrice, 6000);
      return () => {
        clearInterval(interval);
        if (chartInstance) {
          chartInstance.destroy();
        }
      };
    } catch (err) {
      console.error('Error during mount:', err);
    }
  });
</script>

<div class="rune-container">
  <div class="price-display">
    {#if isLoading}
      <div class="loading">
        <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
        <span>Loading...</span>
      </div>
    {:else if error}
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
    margin-bottom: 20px;
    display: inline-flex;
    align-items: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
  }

  .price-display:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .price, .loading, .error {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 600;
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
    gap: 12px;
    font-size: 24px;
    font-weight: 600;
  }

  .change-notification {
    position: absolute;
    left: calc(100% + 30px);
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
    color: #4A90E2;
    border: 1px solid #4A90E2;
    border-radius: 12px;
    white-space: nowrap;
    box-shadow: 0 0 10px rgba(74, 144, 226, 0.3);
    animation: glow 1s ease-in-out infinite alternate;
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
</style>
