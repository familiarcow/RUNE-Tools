<script>
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  let days = 30;
  let earningsData = null;
  let isLoading = true;
  let error = null;
  let showUSD = false;
  let chartInstance;
  let chartCanvas;
  let feesChartCanvas;
  let feesChartInstance;
  let showProportions = false;
  let poolCharts = new Map();
  let poolsData = null;
  let showAPYInfo = false;
  let showSystemIncomeInfo = false;
  let showTotalEarningsInfo = false;
  let showBondEarningsInfo = false;
  let showLiquidityEarningsInfo = false;
  let showEarningsProportions = false;

  const timeframes = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days' },
    { value: 180, label: '180 days' },
    { value: 365, label: '365 days' },
    { value: 400, label: '400 days' }
  ];

  async function fetchEarnings() {
    try {
      isLoading = true;
      const response = await fetch(`https://midgard.ninerealms.com/v2/history/earnings?interval=day&count=${days}`);
      const data = await response.json();
      earningsData = data.intervals;
      isLoading = false;
    } catch (err) {
      error = err.message;
      isLoading = false;
    }
  }

  async function fetchPoolsData() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      const data = await response.json();
      poolsData = data.reduce((acc, pool) => {
        acc[pool.asset] = {
          runeDepth: (Number(pool.balance_rune) / 1e8) * 2,
          usdDepth: (Number(pool.balance_asset) / 1e8) * 2 * (Number(pool.asset_tor_price) / 1e8)
        };
        return acc;
      }, {});
    } catch (err) {
      console.error('Error fetching pools data:', err);
    }
  }

  function formatNumber(num) {
    return new Intl.NumberFormat().format(Math.round(num / 1e8));
  }

  function formatUSD(rune, price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format((rune / 1e8) * price);
  }

  function calculateAnnualizedEarnings(data, days) {
    if (!data || data.length === 0) return 0;
    
    const totalEarnings = data.reduce((sum, interval) => {
      const bondingEarnings = Number(interval.bondingEarnings) || 0;
      const liquidityEarnings = Number(interval.liquidityEarnings) || 0;
      return sum + bondingEarnings + liquidityEarnings;
    }, 0);
    
    // Annualize the earnings
    const annualizedEarnings = (totalEarnings / days) * 365;
    return annualizedEarnings;
  }

  function calculateAnnualizedLiquidityFees(data, days) {
    if (!data || data.length === 0) return 0;
    
    const totalFees = data.reduce((sum, interval) => {
      return sum + (Number(interval.liquidityFees) || 0);
    }, 0);
    
    // Annualize the fees
    const annualizedFees = (totalFees / days) * 365;
    return annualizedFees;
  }

  function calculateAnnualizedBondingEarnings(data, days) {
    if (!data || data.length === 0) return 0;
    
    const totalBondingEarnings = data.reduce((sum, interval) => {
      return sum + (Number(interval.bondingEarnings) || 0);
    }, 0);
    
    return (totalBondingEarnings / days) * 365;
  }

  function calculateAnnualizedLiquidityEarnings(data, days) {
    if (!data || data.length === 0) return 0;
    
    const totalLiquidityEarnings = data.reduce((sum, interval) => {
      return sum + (Number(interval.liquidityEarnings) || 0);
    }, 0);
    
    return (totalLiquidityEarnings / days) * 365;
  }

  $: annualizedEarnings = calculateAnnualizedEarnings(earningsData, days);
  $: annualizedLiquidityFees = calculateAnnualizedLiquidityFees(earningsData, days);
  $: annualizedBondingEarnings = calculateAnnualizedBondingEarnings(earningsData, days);
  $: annualizedLiquidityEarnings = calculateAnnualizedLiquidityEarnings(earningsData, days);

  function initChart() {
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    if (chartInstance) {
      chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Bonding Earnings',
            data: [],
            backgroundColor: '#4A90E2',
            borderColor: '#4A90E2',
            borderWidth: 1
          },
          {
            label: 'Liquidity Earnings',
            data: [],
            backgroundColor: '#2cbe8c',
            borderColor: '#2cbe8c',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888'
            }
          },
          y: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            max: showEarningsProportions ? 100 : undefined,
            ticks: {
              color: '#888',
              callback: function(value) {
                if (showEarningsProportions) {
                  return value + '%';
                }
                if (showUSD) {
                  return '$' + value.toLocaleString();
                }
                return value.toLocaleString() + ' ᚱ';
              }
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#888'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let value = context.raw;
                if (showEarningsProportions) {
                  return context.dataset.label + ': ' + value.toFixed(1) + '%';
                }
                if (showUSD) {
                  return context.dataset.label + ': $' + value.toLocaleString();
                }
                return context.dataset.label + ': ' + value.toLocaleString() + ' ᚱ';
              }
            }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeInOutCubic',
          mode: 'active'
        },
        transitions: {
          active: {
            animation: {
              duration: 600,
              easing: 'easeInOutCubic'
            }
          }
        }
      }
    });
  }

  function initFeesChart() {
    if (!feesChartCanvas) return;
    
    const ctx = feesChartCanvas.getContext('2d');
    if (feesChartInstance) {
      feesChartInstance.destroy();
    }
    
    feesChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Block Rewards',
            data: [],
            backgroundColor: '#4A90E2',
            borderColor: '#4A90E2',
            borderWidth: 1
          },
          {
            label: 'Liquidity Fees',
            data: [],
            backgroundColor: '#2cbe8c',
            borderColor: '#2cbe8c',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888'
            }
          },
          y: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                if (showProportions) {
                  return value + '%';
                }
                if (showUSD) {
                  return '$' + value.toLocaleString();
                }
                return value.toLocaleString() + ' ᚱ';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let value = context.raw;
                if (showProportions) {
                  return context.dataset.label + ': ' + value.toFixed(1) + '%';
                }
                if (showUSD) {
                  return context.dataset.label + ': $' + value.toLocaleString();
                }
                return context.dataset.label + ': ' + value.toLocaleString() + ' ᚱ';
              }
            }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeInOutCubic',
          mode: 'active'
        },
        transitions: {
          active: {
            animation: {
              duration: 600,
              easing: 'easeInOutCubic'
            }
          }
        }
      }
    });
  }

  $: {
    if (earningsData && (chartInstance || feesChartInstance)) {
      // Update main earnings chart
      if (chartInstance) {
        const intervals = earningsData.slice(0, -1).concat(
          earningsData.slice(-1).filter(interval => 
            Number(interval.bondingEarnings) !== 0 || 
            Number(interval.liquidityEarnings) !== 0
          )
        );

        const labels = intervals.map(interval => 
          new Date(interval.startTime * 1000).toLocaleDateString()
        );
        
        const bondingData = intervals.map(interval => {
          if (showEarningsProportions) {
            const total = Number(interval.bondingEarnings) + Number(interval.liquidityEarnings);
            return total > 0 ? (Number(interval.bondingEarnings) / total) * 100 : 0;
          }
          return showUSD ? 
            (Number(interval.bondingEarnings) / 1e8) * Number(interval.runePriceUSD) :
            Number(interval.bondingEarnings) / 1e8;
        });
        
        const liquidityData = intervals.map(interval => {
          if (showEarningsProportions) {
            const total = Number(interval.bondingEarnings) + Number(interval.liquidityEarnings);
            return total > 0 ? (Number(interval.liquidityEarnings) / total) * 100 : 0;
          }
          return showUSD ? 
            (Number(interval.liquidityEarnings) / 1e8) * Number(interval.runePriceUSD) :
            Number(interval.liquidityEarnings) / 1e8;
        });

        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = bondingData;
        chartInstance.data.datasets[1].data = liquidityData;
        chartInstance.update();
      }

      // Update fees chart
      if (feesChartInstance) {
        const intervals = earningsData.slice(0, -1).concat(
          earningsData.slice(-1).filter(interval => 
            Number(interval.blockRewards) !== 0 || 
            Number(interval.liquidityFees) !== 0
          )
        );

        const labels = intervals.map(interval => 
          new Date(interval.startTime * 1000).toLocaleDateString()
        );

        const blockRewardsData = intervals.map(interval => {
          if (showProportions) {
            const total = Number(interval.blockRewards) + Number(interval.liquidityFees);
            return (Number(interval.blockRewards) / total) * 100;
          }
          return showUSD ? 
            (Number(interval.blockRewards) / 1e8) * Number(interval.runePriceUSD) :
            Number(interval.blockRewards) / 1e8;
        });
        
        const liquidityFeesData = intervals.map(interval => {
          if (showProportions) {
            const total = Number(interval.blockRewards) + Number(interval.liquidityFees);
            return (Number(interval.liquidityFees) / total) * 100;
          }
          return showUSD ? 
            (Number(interval.liquidityFees) / 1e8) * Number(interval.runePriceUSD) :
            Number(interval.liquidityFees) / 1e8;
        });

        feesChartInstance.data.labels = labels;
        feesChartInstance.data.datasets[0].data = blockRewardsData;
        feesChartInstance.data.datasets[1].data = liquidityFeesData;
        feesChartInstance.update();
      }
    }
  }

  $: if (earningsData) {
    // Re-render pool charts when data changes
    const canvases = document.querySelectorAll('.pool-chart canvas');
    canvases.forEach((canvas, index) => {
      const poolName = getUniquePools(earningsData)[index];
      if (canvas && poolName) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
          existingChart.destroy();
        }
        initPoolChart(canvas, poolName);
      }
    });
  }

  $: if (showUSD !== undefined && earningsData) {
    // Update pool charts
    const canvases = document.querySelectorAll('.pool-chart canvas');
    canvases.forEach((canvas, index) => {
      const poolName = getUniquePools(earningsData)[index];
      if (canvas && poolName) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
          const poolData = getPoolData(poolName);
          
          existingChart.data.datasets[0].label = showUSD ? 'Earnings (USD)' : 'Earnings (RUNE)';
          existingChart.data.datasets[0].data = poolData.map(d => {
            const runeAmount = Number(d.earnings) / 1e8;
            return showUSD ? runeAmount * Number(d.runePrice) : runeAmount;
          });

          existingChart.options.scales.y.ticks.callback = function(value) {
            if (showUSD) {
              return '$' + value.toLocaleString();
            }
            return value.toLocaleString() + ' ᚱ';
          };

          existingChart.options.plugins.tooltip.callbacks.label = function(context) {
            let value = context.raw;
            if (showUSD) {
              return 'Earnings: $' + value.toLocaleString();
            }
            return 'Earnings: ' + value.toLocaleString() + ' ᚱ';
          };

          existingChart.update();
        }
      }
    });
  }

  onMount(async () => {
    isLoading = true;
    try {
      // Wait for both data fetches to complete
      await Promise.all([fetchEarnings(), fetchPoolsData()]);
      
      // Add a small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (earningsData) {
        initChart();
        initFeesChart();
        
        // Initialize pool charts sequentially
        const uniquePools = getUniquePools(earningsData);
        for (const poolName of uniquePools) {
          const canvas = document.querySelector(`.pool-chart canvas[data-pool="${poolName}"]`);
          if (canvas) {
            await new Promise(resolve => setTimeout(resolve, 50));
            initPoolChart(canvas, poolName);
          }
        }
      }
    } catch (err) {
      console.error('Error initializing charts:', err);
      error = 'Failed to load charts';
    } finally {
      isLoading = false;
    }
  });

  async function handleTimeframeChange(event) {
    days = parseInt(event.target.value);
    isLoading = true;
    error = null;
    
    // Clean up all charts
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (feesChartInstance) {
      feesChartInstance.destroy();
      feesChartInstance = null;
    }
    poolCharts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    poolCharts.clear();
    
    try {
      // Fetch new data
      await Promise.all([fetchEarnings(), fetchPoolsData()]);
      
      // Wait a bit for DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (earningsData) {
        // Initialize main charts
        initChart();
        initFeesChart();
        
        // Initialize pool charts sequentially
        const uniquePools = getUniquePools(earningsData);
        for (const poolName of uniquePools) {
          const canvas = document.querySelector(`.pool-chart canvas[data-pool="${poolName}"]`);
          if (canvas) {
            await new Promise(resolve => setTimeout(resolve, 50));
            initPoolChart(canvas, poolName);
          }
        }
      }
    } catch (err) {
      console.error('Error updating timeframe:', err);
      error = 'Failed to update charts';
    } finally {
      isLoading = false;
    }
  }

  function getUniquePools(data) {
    if (!data) return [];
    
    const SPECIAL_POOLS = ['dev_fund_reward', 'income_burn'];
    const INACTIVE_DAYS_THRESHOLD = 7;
    
    // Create a map to store the most recent non-zero earnings and last active day for each pool
    const poolInfo = new Map();
    
    // Go through intervals from newest to oldest
    let daysFromLatest = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      const interval = data[i];
      interval.pools?.forEach(pool => {
        if (!poolInfo.has(pool.pool) && Number(pool.earnings) > 0) {
          poolInfo.set(pool.pool, {
            earnings: Number(pool.earnings),
            daysInactive: daysFromLatest
          });
        }
      });
      daysFromLatest++;
    }
    
    // Filter out pools that have been inactive for too long
    // and separate special pools from regular pools
    const specialPools = [];
    const regularPools = [];
    
    poolInfo.forEach((info, poolName) => {
      // Check if pool has been inactive for too long
      if (info.daysInactive < INACTIVE_DAYS_THRESHOLD) {
        if (SPECIAL_POOLS.includes(poolName)) {
          specialPools.push([poolName, info.earnings]);
        } else if (!poolName.startsWith('THOR.')) {
          regularPools.push([poolName, info.earnings]);
        }
      }
    });
    
    // Sort regular pools by earnings and combine with special pools
    return [
      ...regularPools
        .sort((a, b) => b[1] - a[1])
        .map(([poolName]) => poolName),
      ...specialPools
        .sort((a, b) => b[1] - a[1])
        .map(([poolName]) => poolName)
    ];
  }

  function getPoolData(poolName) {
    const data = earningsData.map(interval => ({
      date: new Date(interval.startTime * 1000).toLocaleDateString(),
      earnings: interval.pools.find(p => p.pool === poolName)?.earnings || 0,
      runePrice: interval.runePriceUSD
    }));

    if (data.length > 0 && Number(data[data.length - 1].earnings) === 0) {
      return data.slice(0, -1);
    }
    return data;
  }

  // Add brand color mapping
  const assetColors = {
    'BTC': '#F7931A',  // Bitcoin orange
    'ETH': '#627EEA',  // Ethereum blue
    'USDC': '#2775CA', // USDC blue
    'USDT': '#26A17B', // Tether green
    'AVAX': '#E84142', // Avalanche red
    'BNB': '#F3BA2F',  // Binance yellow
    'ATOM': '#6F7390', // Cosmos purple
    'DOGE': '#C2A633', // Dogecoin yellow
    'BCH': '#8DC351',  // Bitcoin Cash green
    'LTC': '#345D9D',  // Litecoin blue
    'DAI': '#F5AC37',  // DAI orange
    'WBTC': '#F7931A', // Same as BTC
    'LUSD': '#745DDF', // Liquity purple
    'GUSD': '#00DCFA', // Gemini blue
    'USDP': '#00856F', // Paxos green
    'SOL': '#14F195',  // Solana green
    'LINK': '#2A5ADA', // Chainlink blue
    'AAVE': '#B6509E', // Aave pink
    'DPI': '#7A48D6',  // DPI purple
    'FOX': '#C5312E',  // FOX red
    'TGT': '#1FC9A8',  // TGT teal
    'XRUNE': '#374B6E', // XRUNE blue
    'VTHOR': '#2A5ADA', // VTHOR blue
    'SNX': '#00D1FF',  // Synthetix cyan
  };

  // Helper function to get color for an asset
  function getAssetColor(poolName) {
    // First try to get the base token
    const baseToken = poolName.split('.')[1]?.split('-')[0];
    if (assetColors[baseToken]) {
      return assetColors[baseToken];
    }
    
    // If no base token color, try the chain
    const chain = poolName.split('.')[0];
    if (assetColors[chain]) {
      return assetColors[chain];
    }
    
    // Default color if no match found
    return '#4A90E2';
  }

  // Update initPoolChart to use bar chart
  function initPoolChart(node, poolName) {
    // If there's already a chart for this canvas, destroy it
    const existingChart = Chart.getChart(node);
    if (existingChart) {
      existingChart.destroy();
    }

    if (!node || !poolName || !earningsData) return;
    
    const ctx = node.getContext('2d');
    if (!ctx) return;
    
    const poolData = getPoolData(poolName);
    if (!poolData || poolData.length === 0) return;
    
    const assetColor = getAssetColor(poolName);
    
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: poolData.map(d => d.date),
        datasets: [{
          label: showUSD ? 'Earnings (USD)' : 'Earnings (RUNE)',
          data: poolData.map(d => {
            const runeAmount = Number(d.earnings) / 1e8;
            return showUSD ? runeAmount * Number(d.runePrice) : runeAmount;
          }),
          backgroundColor: assetColor,
          borderColor: assetColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                if (showUSD) {
                  return '$' + value.toLocaleString();
                }
                return value.toLocaleString() + ' ᚱ';
              }
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let value = context.raw;
                if (showUSD) {
                  return 'Earnings: $' + value.toLocaleString();
                }
                return 'Earnings: ' + value.toLocaleString() + ' ᚱ';
              }
            }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeInOutCubic',
          mode: 'active'
        },
        transitions: {
          active: {
            animation: {
              duration: 600,
              easing: 'easeInOutCubic'
            }
          }
        }
      }
    });

    // Store the chart instance
    poolCharts.set(node, chart);

    return {
      destroy() {
        if (chart) {
          chart.destroy();
          poolCharts.delete(node);
        }
      }
    };
  }

  function formatPoolName(poolName) {
    // Handle special cases first
    const specialCases = {
      'dev_fund_reward': 'Dev Fund',
      'income_burn': 'Income Burn'
    };
    
    if (specialCases[poolName]) {
      return specialCases[poolName];
    }

    // Handle normal pool names
    const [chain, assetPart] = poolName.split('.');
    
    // If there's no dot, return as-is
    if (!assetPart) {
      return poolName;
    }
    
    // Split asset part into base asset and contract
    const [asset, contract] = assetPart.split('-');
    
    // If there's a contract, show chain in parentheses
    if (contract) {
      return `${asset} (${chain})`;
    }
    
    // For native assets without contract, just show the asset name
    return asset;
  }

  // Add this function near the other calculation functions
  function calculatePoolProfitToDepthRatios(earningsData, poolsData) {
    if (!earningsData || !poolsData) return [];
    
    // Get the list of valid pools first
    const validPools = new Set(getUniquePools(earningsData));
    
    // Calculate total earnings for each pool during the timeframe
    const poolEarnings = earningsData.reduce((acc, interval) => {
      interval.pools?.forEach(pool => {
        // Only include pools that are in our valid pools list
        if (validPools.has(pool.pool)) {
          if (!acc[pool.pool]) acc[pool.pool] = 0;
          acc[pool.pool] += Number(pool.earnings);
        }
      });
      return acc;
    }, {});

    // Calculate APY for each pool
    const ratios = Object.entries(poolEarnings)
      .map(([poolName, earnings]) => {
        const pool = poolsData[poolName];
        if (!pool || pool.runeDepth === 0) return null;
        
        // Convert earnings to RUNE (from thor.cents)
        const earningsInRune = earnings / 1e8;
        
        // Calculate APY: (earnings / depth) * (365 / days) * 100
        const apy = (earningsInRune / pool.runeDepth) * (365 / days) * 100;
        
        return {
          poolName,
          apy,
          earnings: earningsInRune,
          depth: pool.runeDepth
        };
      })
      .filter(item => item !== null && !isNaN(item.apy) && isFinite(item.apy));

    // Sort by APY in descending order and take top 8
    return ratios
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 9);
  }

  // Update these reactive statements to allow animations
  $: {
    if (chartInstance && showEarningsProportions !== undefined) {
      chartInstance.options.scales.y.max = showEarningsProportions ? 100 : undefined;
      chartInstance.update();
    }

    if (feesChartInstance && showProportions !== undefined) {
      feesChartInstance.options.scales.y.max = showProportions ? 100 : undefined;
      feesChartInstance.update();
    }

    if (chartInstance && showUSD !== undefined) {
      chartInstance.update();
    }

    if (feesChartInstance && showUSD !== undefined) {
      feesChartInstance.update();
    }

    if (showUSD !== undefined && poolCharts) {
      poolCharts.forEach(chart => {
        if (chart) {
          chart.update();
        }
      });
    }
  }
</script>

<div class="earnings-container">
  <div class="header">
    <div class="controls">
      <div class="timeframe-select">
        <select value={days} on:change={handleTimeframeChange}>
          {#each timeframes as timeframe}
            <option value={timeframe.value}>
              {timeframe.label}
            </option>
          {/each}
        </select>
      </div>

      <label class="toggle">
        <input 
          type="checkbox" 
          bind:checked={showUSD}
        >
        <span class="slider">
          <span class="knob">
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="knob-icon rune" />
            <span class="knob-icon dollar">$</span>
          </span>
        </span>
      </label>
    </div>
  </div>

  <div class="stats-container">
    <div class="stat-box">
      <div class="stat-header">
        <h3>Annualized Liquidity Fees</h3>
        <button class="info-button" on:click={() => showSystemIncomeInfo = !showSystemIncomeInfo}>
          <span class="info-icon">ⓘ</span>
        </button>
      </div>
      <p class="stat-value">
        {#if showUSD && earningsData?.[0]?.runePriceUSD}
          {formatUSD(annualizedLiquidityFees, Number(earningsData[0].runePriceUSD))}
        {:else}
          {formatNumber(annualizedLiquidityFees)} ᚱ
        {/if}
      </p>
    </div>

    <div class="stat-box">
      <div class="stat-header">
        <h3>Annualized Total Earnings</h3>
        <button class="info-button" on:click={() => showTotalEarningsInfo = !showTotalEarningsInfo}>
          <span class="info-icon">ⓘ</span>
        </button>
      </div>
      <p class="stat-value">
        {#if showUSD && earningsData?.[0]?.runePriceUSD}
          {formatUSD(annualizedEarnings, Number(earningsData[0].runePriceUSD))}
        {:else}
          {formatNumber(annualizedEarnings)} ᚱ
        {/if}
      </p>
    </div>

    <div class="stat-box">
      <div class="stat-header">
        <h3>Annualized Bond Earnings</h3>
        <button class="info-button" on:click={() => showBondEarningsInfo = !showBondEarningsInfo}>
          <span class="info-icon">ⓘ</span>
        </button>
      </div>
      <p class="stat-value">
        {#if showUSD && earningsData?.[0]?.runePriceUSD}
          {formatUSD(annualizedBondingEarnings, Number(earningsData[0].runePriceUSD))}
        {:else}
          {formatNumber(annualizedBondingEarnings)} ᚱ
        {/if}
      </p>
    </div>

    <div class="stat-box">
      <div class="stat-header">
        <h3>Annualized Liquidity Earnings</h3>
        <button class="info-button" on:click={() => showLiquidityEarningsInfo = !showLiquidityEarningsInfo}>
          <span class="info-icon">ⓘ</span>
        </button>
      </div>
      <p class="stat-value">
        {#if showUSD && earningsData?.[0]?.runePriceUSD}
          {formatUSD(annualizedLiquidityEarnings, Number(earningsData[0].runePriceUSD))}
        {:else}
          {formatNumber(annualizedLiquidityEarnings)} ᚱ
        {/if}
      </p>
    </div>
  </div>

  {#if showSystemIncomeInfo || showTotalEarningsInfo || showBondEarningsInfo || showLiquidityEarningsInfo}
    <div class="stats-info-container">
      {#if showSystemIncomeInfo}
        <div class="stats-info">
          Annualized Liquidity Fees: Income from liquidity fees over the last {days} days which are paid to Nodes and LPs, annualized to 1 year
        </div>
      {/if}
      {#if showTotalEarningsInfo}
        <div class="stats-info">
          Annualized Total Earnings: Total amount of rewards paid over the last {days} days to Nodes and LPs, annualized to 1 year
        </div>
      {/if}
      {#if showBondEarningsInfo}
        <div class="stats-info">
          Annualized Bond Earnings: Total amount of rewards earned by Nodes in the last {days} days, annualized to 1 year
        </div>
      {/if}
      {#if showLiquidityEarningsInfo}
        <div class="stats-info">
          Annualized Liquidity Earnings: Total amount of rewards earned by Liquidity Pools in the last {days} days, annualized to 1 year
        </div>
      {/if}
    </div>
  {/if}

  <div class="chart-section">
    <div class="section-header">
      <h2>Bond & Liquidity Earnings (Last {days} Days)</h2>
      <label class="toggle">
        <input 
          type="checkbox" 
          bind:checked={showEarningsProportions}
        >
        <span class="slider">
          <span class="knob">
            <img src="/assets/coins/RUNE-ICON.svg" alt="Amount" class="knob-icon rune" />
            <span class="knob-icon dollar">%</span>
          </span>
        </span>
      </label>
    </div>
    <div class="chart-container">
      <canvas bind:this={chartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Earnings Source (Last {days} Days)</h2>
      <label class="toggle">
        <input 
          type="checkbox" 
          bind:checked={showProportions}
        >
        <span class="slider">
          <span class="knob">
            <img src="/assets/coins/RUNE-ICON.svg" alt="Amount" class="knob-icon rune" />
            <span class="knob-icon dollar">%</span>
          </span>
        </span>
      </label>
    </div>
    <div class="chart-container">
      <canvas bind:this={feesChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Pool Earnings</h2>
    </div>

    {#if earningsData && poolsData}
      <div class="top-pools">
        <div class="top-pools-header">
          <h3>Top Performing Pools (last {days} Days)</h3>
          <button class="info-button" on:click={() => showAPYInfo = !showAPYInfo}>
            <span class="info-icon">ⓘ</span>
          </button>
        </div>
        <div class="top-pools-grid">
          {#each calculatePoolProfitToDepthRatios(earningsData, poolsData) as pool, i}
            <div class="top-pool-item">
              <span class="rank">#{i + 1}</span>
              <span class="pool-name">{formatPoolName(pool.poolName)}</span>
              <span class="ratio">{pool.apy.toFixed(1)}% APY</span>
            </div>
          {/each}
        </div>
        {#if showAPYInfo}
          <div class="apy-info">
            APY is an estimate of the income over the specified time period as a ratio of the pool's depth. It measures income only and does not account for impermanent loss or future asset price changes. Past performance is not indicative of future results.
          </div>
        {/if}
      </div>
    {/if}

    <div class="pools-grid">
      {#each getUniquePools(earningsData) as poolName (poolName)}
        <div class="pool-chart-container">
          <div class="pool-header">
            <h3>{formatPoolName(poolName)}</h3>
            {#if poolsData && poolsData[poolName]}
              <div class="pool-depth-info">
                <span class="depth-label">Pool Depth:</span>
                <span class="depth-value">
                  {#if showUSD}
                    ${Math.round(poolsData[poolName].usdDepth).toLocaleString()}
                  {:else}
                    {formatNumber(poolsData[poolName].runeDepth * 1e8)} ᚱ
                  {/if}
                </span>
              </div>
            {/if}
          </div>
          <div class="pool-chart">
            <canvas data-pool={poolName} use:initPoolChart={poolName}></canvas>
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if isLoading}
    <div class="loading">Loading earnings data...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {/if}
</div>

<style>
  .earnings-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .chart-section {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 20px;
    margin-bottom: 40px;
  }

  .toggle-container {
    display: flex;
    justify-content: center;
    margin: 20px 0;
  }

  .toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
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

  .chart-container {
    position: relative;
    height: 400px;
    padding: 20px;
    background: #2c2c2c;
    border-radius: 8px;
    margin-top: 20px;
  }

  .chart-container + .chart-container {
    margin-top: 40px;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  .loading, .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px;
    color: #888;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
  }

  .error {
    color: #ff4444;
  }

  .header {
    display: flex;
    justify-content: flex-end;
    padding: 0 20px;
    margin-bottom: 20px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .timeframe-select select {
    background-color: #2c2c2c;
    color: #fff;
    border: 1px solid #4a4a4a;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .timeframe-select select:hover {
    border-color: #4A90E2;
  }

  .timeframe-select select:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .timeframe-select select option {
    background-color: #2c2c2c;
    color: #fff;
  }

  .view-toggle {
    display: flex;
    justify-content: center;
    margin: 10px 0;
  }

  .view-toggle .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-toggle .label-text {
    font-size: 12px;
  }

  .section-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    margin-bottom: 20px;
  }

  .section-header h2 {
    margin: 0;
    padding: 0;
    grid-column: 2;
    text-align: center;
  }

  .section-header .toggle {
    grid-column: 3;
    justify-self: end;
  }

  .pools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    padding: 20px;
  }

  .pool-chart-container {
    background: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
  }

  .pool-chart-container h3 {
    margin: 0 0 15px 0;
    color: #4A90E2;
    font-size: 16px;
  }

  .pool-chart {
    height: 200px;
  }

  @media (max-width: 600px) {
    .pools-grid {
      grid-template-columns: 1fr;
      padding: 10px;
      gap: 15px;
    }

    .pool-chart-container {
      width: 100%;
      min-width: 0;
    }

    .pool-chart {
      height: 200px;
      width: 100%;
      overflow: hidden;
    }

    .top-pools-grid {
      grid-template-columns: 1fr;
    }

    .pool-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }

    .pool-depth {
      font-size: 12px;
      width: 100%;
      text-align: left;
    }

    .pool-depth span {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .top-pools {
    max-width: 100%;
    overflow: hidden;
  }

  .top-pools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 15px;
    padding: 15px;
    max-width: 100%;
  }

  .top-pool-item {
    display: flex;
    align-items: center;
    padding: 10px;
    background: rgba(44, 190, 140, 0.1);
    border-radius: 6px;
    min-width: 0;
  }

  .rank {
    color: #4A90E2;
    font-weight: bold;
    min-width: 40px;
  }

  .pool-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 10px;
  }

  .ratio {
    white-space: nowrap;
    min-width: 100px;
    text-align: right;
    color: #2cbe8c;
    font-weight: bold;
  }

  .top-pools-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;
    gap: 8px;
  }

  .top-pools-header h3 {
    margin: 0;
    text-align: center;
  }

  .top-pools-header .info-button {
    font-size: 18px;
    padding: 4px;
    opacity: 1;
  }

  .info-button {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 2px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    opacity: 0.7;
  }

  .info-button:hover {
    color: #6AA9E9;
    opacity: 1;
  }

  .apy-info {
    margin-top: 15px;
    padding: 15px;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 6px;
    color: #888;
    font-size: 14px;
    line-height: 1.4;
    text-align: center;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 10px;
    position: relative;
  }

  .stat-header h3 {
    margin: 0;
    font-size: 15px;
    color: #888;
    line-height: 1.2;
  }

  .stats-info-container {
    padding: 0 20px;
    margin-bottom: 20px;
  }

  .stats-info {
    background: rgba(74, 144, 226, 0.1);
    border-radius: 6px;
    padding: 15px;
    color: #888;
    font-size: 14px;
    line-height: 1.4;
    text-align: center;
    margin-bottom: 10px;
  }

  .stat-box .info-button {
    font-size: 10px;
    padding: 1px;
    opacity: 0.7;
    margin-top: 1px;
  }

  .stat-box .info-button:hover {
    opacity: 1;
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
    padding: 0 20px;
  }

  .stat-box {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .stat-box h3 {
    color: #888;
    font-size: 16px;
    margin: 0 0 10px 0;
  }

  .stat-value {
    color: #4A90E2;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }

  @media (max-width: 600px) {
    .stats-container {
      grid-template-columns: repeat(2, 1fr); /* Keep 2 columns on mobile */
      gap: 15px;
      padding: 10px;
    }

    .stat-box {
      padding: 15px;
      height: 100px;
    }

    .stat-box h3 {
      font-size: 14px;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 18px;
    }
  }

  .pool-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 15px;
  }

  .pool-header h3 {
    margin: 0;
    color: #4A90E2;
    font-size: 16px;
    font-weight: 600;
  }

  .pool-depth-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    padding: 4px 8px;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 4px;
    width: fit-content;
  }

  .depth-label {
    color: #888;
    font-weight: 500;
  }

  .depth-value {
    color: #4A90E2;
    font-weight: 600;
  }
</style>
