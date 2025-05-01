<script>
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  let days = 30;
  let swappersData = null;
  let volumeData = null;
  let dexVolumeData = null;
  let isLoading = true;
  let error = null;
  let swappersChartInstance;
  let volumeChartInstance;
  let dexVolumeChartInstance;
  let dominanceChartInstance;
  let moduleBalancesData = null;
  let moduleBalancesChartCanvas;
  let moduleBalancesChartInstance;
  let addressesData = null;
  let addressesChartCanvas;
  let addressesChartInstance;
  let showDexPercentages = false;
  let showTotalBalance = false;
  let showDailyAddresses = false;
  let swappersChartCanvas;
  let volumeChartCanvas;
  let dexVolumeChartCanvas;
  let dominanceChartCanvas;

  // Chain colors
  const chainColors = {
    THOR: '#23DCC8',   // Thor brand teal
    BTC: '#F7931A',    // Bitcoin orange
    ETH: '#627EEA',    // Ethereum blue
    BSC: '#F3BA2F',    // Binance yellow
    AVAX: '#E84142',   // Avalanche red
    GAIA: '#5C4B7A',   // Cosmos purple
    LTC: '#345D9D',    // Litecoin blue
    DOGE: '#C2A633',   // Dogecoin gold
    BCH: '#8DC351'     // Bitcoin Cash green
  };

  // DEX colors
  const dexColors = {
    THORChain: '#23DCC8',    // Thor brand teal
    Uniswap: '#FF007A',      // Uniswap pink
    PancakeSwap: '#D1884F',  // PancakeSwap orange
    Curve: '#FF0000',        // Curve red
    TraderJoe: '#0E8FD9',    // TraderJoe blue
    Dodo: '#FCD403',         // Dodo yellow
    Orca: '#745BDC',         // Orca purple
    Raydium: '#00A3FF',      // Raydium blue
    Others: '#808080'         // Grey for others
  };

  const timeframes = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 180, label: '180 days' },
    { value: 365, label: '1 year' },
    { value: 730, label: '2 years' },
    { value: 99999, label: 'All Time' }
  ];

  async function fetchData() {
    isLoading = true;
    error = null;
    try {
      await Promise.all([
        fetchSwappersData(),
        fetchVolumeData(),
        fetchDexVolumeData(),
        fetchModuleBalancesData(),
        fetchAddressesData()
      ]);
    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function fetchSwappersData() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/581abc71-ae73-4bcf-bd4f-8457e588a7c8/data/latest');
      const data = await response.json();
      swappersData = data.sort((a, b) => new Date(a.DAY) - new Date(b.DAY));
      updateSwappersChart();
    } catch (err) {
      console.error('Error fetching swappers data:', err);
    }
  }

  async function fetchVolumeData() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/19fe66b1-38a5-4c1f-b91a-75da47cebe3f/data/latest');
      const data = await response.json();
      volumeData = data.sort((a, b) => new Date(a.DAY) - new Date(b.DAY));
      updateVolumeChart();
    } catch (err) {
      console.error('Error fetching volume data:', err);
    }
  }

  async function fetchDexVolumeData() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/31594268-05fe-4931-8a03-6c0682feaec4/data/latest');
      const data = await response.json();
      dexVolumeData = data.sort((a, b) => new Date(a.DAY) - new Date(b.DAY));
      if (!dexVolumeChartInstance) {
        initDexVolumeChart();
      }
      if (!dominanceChartInstance) {
        initDominanceChart();
      } else {
        updateDexVolumeChart();
        updateDominanceChart();
      }
    } catch (err) {
      console.error('Error fetching DEX volume data:', err);
    }
  }

  async function fetchModuleBalancesData() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/2a6fcc3f-390b-42fb-99e6-59e54e26cde4/data/latest');
      const data = await response.json();
      moduleBalancesData = data.sort((a, b) => new Date(a.DAY) - new Date(b.DAY));
      if (!moduleBalancesChartInstance) {
        initModuleBalancesChart();
      } else {
        updateModuleBalancesChart();
      }
    } catch (err) {
      console.error('Error fetching module balances data:', err);
    }
  }

  async function fetchAddressesData() {
    try {
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/0fb08229-627a-4472-afb5-c78b48293aed/data/latest');
      const data = await response.json();
      addressesData = data.sort((a, b) => new Date(a.DAY) - new Date(b.DAY));
      if (!addressesChartInstance) {
        initAddressesChart();
      } else {
        updateAddressesChart();
      }
    } catch (err) {
      console.error('Error fetching addresses data:', err);
    }
  }

  function getFilteredSwappersData() {
    if (!swappersData) return [];
    return swappersData.slice(-days);
  }

  function getFilteredVolumeData() {
    if (!volumeData) return [];
    
    // Get last X days of data
    const uniqueDays = [...new Set(volumeData.map(d => d.DAY))];
    const filteredDays = uniqueDays.slice(-days);
    
    // Get all data for those days
    return volumeData.filter(d => filteredDays.includes(d.DAY));
  }

  function getFilteredDexVolumeData() {
    if (!dexVolumeData) return [];
    const uniqueDays = [...new Set(dexVolumeData.map(d => d.DAY))];
    const filteredDays = uniqueDays.slice(-days);
    return dexVolumeData.filter(d => filteredDays.includes(d.DAY));
  }

  function getFilteredModuleBalancesData() {
    if (!moduleBalancesData) return [];
    return moduleBalancesData.slice(-days);
  }

  function getFilteredAddressesData() {
    if (!addressesData) return [];
    return addressesData.slice(-days);
  }

  function processDataForChart(data) {
    // Group by date
    const groupedByDate = {};
    data.forEach(d => {
      if (!groupedByDate[d.DAY]) {
        groupedByDate[d.DAY] = {};
      }
      // Initialize with 0 if not exists
      if (!groupedByDate[d.DAY][d.BLOCKCHAIN]) {
        groupedByDate[d.DAY][d.BLOCKCHAIN] = 0;
      }
      groupedByDate[d.DAY][d.BLOCKCHAIN] += d.VOLUME_USD;
    });

    const dates = Object.keys(groupedByDate);
    const chains = Object.keys(chainColors);

    // Create datasets
    const datasets = chains.map(chain => ({
      label: chain,
      data: dates.map(date => groupedByDate[date][chain] || 0),
      backgroundColor: chainColors[chain],
      borderColor: chainColors[chain],
      borderWidth: 1
    }));

    return {
      labels: dates.map(d => new Date(d).toLocaleDateString()),
      datasets
    };
  }

  function processDexVolumeData(data) {
    const groupedByDate = {};
    data.forEach(d => {
      if (!groupedByDate[d.DAY]) {
        groupedByDate[d.DAY] = {};
      }
      groupedByDate[d.DAY][d.PROTOCOL_NAME] = d.VOLUME_USD;
    });

    const dates = Object.keys(groupedByDate);
    
    // Calculate average volume for each protocol
    const avgVolumes = {};
    Object.keys(dexColors).forEach(protocol => {
      if (protocol !== 'THORChain') {
        avgVolumes[protocol] = dates.reduce((sum, date) => {
          return sum + (groupedByDate[date][protocol] || 0);
        }, 0) / dates.length;
      }
    });

    // Sort protocols by average volume, excluding THORChain
    const sortedProtocols = Object.keys(avgVolumes)
      .sort((a, b) => avgVolumes[b] - avgVolumes[a])
      .reverse();
    
    // Add THORChain at the beginning (bottom of stack)
    const protocols = ['THORChain', ...sortedProtocols];

    // Calculate percentages if needed
    if (showDexPercentages) {
      dates.forEach(date => {
        const total = Object.values(groupedByDate[date]).reduce((sum, val) => sum + val, 0);
        Object.keys(groupedByDate[date]).forEach(protocol => {
          groupedByDate[date][protocol] = (groupedByDate[date][protocol] / total) * 100;
        });
      });
    }

    const datasets = protocols.map(protocol => ({
      label: protocol,
      data: dates.map(date => groupedByDate[date][protocol] || 0),
      backgroundColor: dexColors[protocol],
      borderColor: dexColors[protocol],
      borderWidth: 1
    }));

    return {
      labels: dates.map(d => new Date(d).toLocaleDateString()),
      datasets
    };
  }

  function processDominanceData(data) {
    // Group data by date first
    const byDate = {};
    data.forEach(d => {
      const date = d.DAY;
      if (!byDate[date]) {
        byDate[date] = { total: 0, thor: 0 };
      }
      byDate[date].total += d.VOLUME_USD;
      if (d.PROTOCOL_NAME === 'THORChain') {
        byDate[date].thor = d.VOLUME_USD;
      }
    });
    
    // Sort dates and calculate percentages
    const dates = Object.keys(byDate).sort();
    const percentages = dates.map(date => ({
      date: date,
      percentage: (byDate[date].thor / byDate[date].total) * 100
    }));

    return {
      labels: percentages.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [{
        label: 'THORChain DEX Dominance',
        data: percentages.map(d => d.percentage),
        fill: true,
        backgroundColor: 'rgba(35, 220, 200, 0.2)',
        borderColor: '#23DCC8',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0
      }]
    };
  }

  function processModuleBalancesData(data) {
    const dates = data.map(d => new Date(d.DAY).toLocaleDateString());
    
    // Calculate total for each date
    const totals = data.map(d => 
      d.RESERVE_MODULE_BALANCE + 
      d.BOND_MODULE_BALANCE + 
      d.POOL_MODULE_BALANCE
    );
    
    return {
      labels: dates,
      datasets: [
        {
          label: 'Total Balance',
          data: totals,
          borderColor: '#4A90E2',
          backgroundColor: 'rgba(74, 144, 226, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          order: 0,  // This ensures it's drawn on top
          hidden: !showTotalBalance,
          pointRadius: 0
        },
        {
          label: 'Reserve Module',
          data: data.map(d => d.RESERVE_MODULE_BALANCE),
          borderColor: '#23DCC8',
          backgroundColor: 'rgba(35, 220, 200, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          order: 1
        },
        {
          label: 'Bond Module',
          data: data.map(d => d.BOND_MODULE_BALANCE),
          borderColor: '#FF007A',
          backgroundColor: 'rgba(255, 0, 122, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          order: 1
        },
        {
          label: 'Pool Module',
          data: data.map(d => d.POOL_MODULE_BALANCE),
          borderColor: '#FCD403',
          backgroundColor: 'rgba(252, 212, 3, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          order: 1
        }
      ]
    };
  }

  function initSwappersChart() {
    if (!swappersChartCanvas || !swappersData) return;
    
    const ctx = swappersChartCanvas.getContext('2d');
    if (swappersChartInstance) {
      swappersChartInstance.destroy();
    }
    
    const filteredData = getFilteredSwappersData();
    
    swappersChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: filteredData.map(d => new Date(d.DAY).toLocaleDateString()),
        datasets: [{
          label: 'Daily Unique Swappers',
          data: filteredData.map(d => d.DAILY_UNIQUE_SWAPPER_COUNT),
          backgroundColor: '#4A90E2',
          borderColor: '#4A90E2',
          borderWidth: 1
        },
        {
          label: '30-Day Average',
          data: filteredData.map(d => d.UNIQUE_SWAPPER_COUNT_30D_MA),
          type: 'line',
          borderColor: '#2cbe8c',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderDash: [5, 5],
          hidden: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              maxRotation: 45,
              minRotation: 45
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
                const label = context.dataset.label;
                const value = context.raw.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                });
                return `${label}: ${value}`;
              }
            }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeInOutCubic'
        }
      }
    });
  }

  function initVolumeChart() {
    if (!volumeChartCanvas || !volumeData) return;
    
    const ctx = volumeChartCanvas.getContext('2d');
    if (volumeChartInstance) {
      volumeChartInstance.destroy();
    }
    
    const filteredData = getFilteredVolumeData();
    const chartData = processDataForChart(filteredData);
    
    volumeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                return '$' + (value / 1000000).toFixed(1) + 'M';
              }
            },
            afterDataLimits: (scale) => {
              const chartData = scale.chart.data;
              const visibleDatasets = chartData.datasets.filter(d => !scale.chart.getDatasetMeta(chartData.datasets.indexOf(d)).hidden);
              
              let maxTotal = 0;
              for (let i = 0; i < chartData.labels.length; i++) {
                let dayTotal = 0;
                visibleDatasets.forEach(dataset => {
                  dayTotal += dataset.data[i] || 0;
                });
                maxTotal = Math.max(maxTotal, dayTotal);
              }
              
              scale.max = maxTotal;
            }
          },
          x: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#888'
            },
            onClick: (evt, legendItem, legend) => {
              // Toggle dataset visibility
              const index = legendItem.datasetIndex;
              const chart = legend.chart;
              const meta = chart.getDatasetMeta(index);
              
              meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
              chart.update();
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label;
                const value = '$' + context.raw.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                });
                return `${label}: ${value}`;
              }
            }
          }
        },
        animation: {
          duration: 600,
          easing: 'easeInOutCubic'
        }
      }
    });
  }

  function initDexVolumeChart() {
    if (!dexVolumeChartCanvas || !dexVolumeData) return;
    
    const ctx = dexVolumeChartCanvas.getContext('2d');
    if (dexVolumeChartInstance) {
      dexVolumeChartInstance.destroy();
    }

    const filteredData = getFilteredDexVolumeData();
    const chartData = processDexVolumeData(filteredData);

    dexVolumeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index'
        },
        scales: {
          y: {
            stacked: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                if (showDexPercentages) {
                  return value.toFixed(1) + '%';
                }
                return '$' + (value / 1000000).toFixed(1) + 'M';
              }
            },
            max: showDexPercentages ? 100 : undefined
          },
          x: {
            stacked: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#888'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label;
                const value = showDexPercentages
                  ? context.raw.toFixed(1) + '%'
                  : '$' + context.raw.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    });
                return `${label}: ${value}`;
              }
            }
          }
        }
      }
    });
  }

  function initDominanceChart() {
    if (!dominanceChartCanvas || !dexVolumeData) return;
    
    const ctx = dominanceChartCanvas.getContext('2d');
    if (dominanceChartInstance) {
      dominanceChartInstance.destroy();
    }

    const filteredData = getFilteredDexVolumeData();
    const chartData = processDominanceData(filteredData);

    // Calculate the maximum percentage value and add some padding
    const maxValue = Math.max(...chartData.datasets[0].data);
    const yAxisMax = Math.ceil(maxValue * 1.1); // Add 10% padding

    dominanceChartInstance = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            max: yAxisMax,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                return value.toFixed(1) + '%';
              }
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              maxRotation: 45,
              minRotation: 45
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
                return `Dominance: ${context.raw.toFixed(2)}%`;
              }
            }
          }
        }
      }
    });
  }

  function initModuleBalancesChart() {
    if (!moduleBalancesChartCanvas || !moduleBalancesData) return;
    
    const ctx = moduleBalancesChartCanvas.getContext('2d');
    if (moduleBalancesChartInstance) {
      moduleBalancesChartInstance.destroy();
    }

    const filteredData = getFilteredModuleBalancesData();
    const chartData = processModuleBalancesData(filteredData);
    
    // Calculate max value for y-axis
    const allValues = filteredData.flatMap(d => [
      d.RESERVE_MODULE_BALANCE,
      d.BOND_MODULE_BALANCE,
      d.POOL_MODULE_BALANCE,
      d.RESERVE_MODULE_BALANCE + d.BOND_MODULE_BALANCE + d.POOL_MODULE_BALANCE
    ]);
    const maxValue = Math.max(...allValues);
    const yAxisMax = Math.ceil(maxValue * 1.1);

    moduleBalancesChartInstance = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            max: yAxisMax,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                return (value / 1000000).toFixed(1) + 'M';
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
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                return `${context.dataset.label}: ${(value / 1000000).toFixed(2)}M RUNE`;
              }
            }
          }
        }
      }
    });
  }

  function initAddressesChart() {
    if (!addressesChartCanvas || !addressesData) return;
    
    const ctx = addressesChartCanvas.getContext('2d');
    if (addressesChartInstance) {
      addressesChartInstance.destroy();
    }

    const filteredData = getFilteredAddressesData();
    
    addressesChartInstance = new Chart(ctx, {
      type: showDailyAddresses ? 'bar' : 'line',
      data: {
        labels: filteredData.map(d => new Date(d.DAY).toLocaleDateString()),
        datasets: [{
          label: showDailyAddresses ? 'New Addresses' : 'Total Addresses',
          data: filteredData.map(d => showDailyAddresses ? d.NEW_ADDRESSES : d.NEW_ADDRESSES_CUMULATIVE),
          backgroundColor: showDailyAddresses ? '#4A90E2' : 'rgba(74, 144, 226, 0.1)',
          borderColor: '#4A90E2',
          borderWidth: 2,
          fill: !showDailyAddresses,
          tension: showDailyAddresses ? 0 : 0.4,
          pointRadius: showDailyAddresses ? undefined : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              maxRotation: 45,
              minRotation: 45
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
                const label = context.dataset.label;
                const value = context.raw.toLocaleString();
                return `${label}: ${value}`;
              }
            }
          }
        }
      }
    });
  }

  function updateChart() {
    updateSwappersChart();
    updateVolumeChart();
    updateDexVolumeChart();
    updateDominanceChart();
    updateModuleBalancesChart();
    updateAddressesChart();
  }

  function updateSwappersChart() {
    if (!swappersData) return;
    const filteredData = getFilteredSwappersData();
    if (swappersChartInstance) {
      swappersChartInstance.data.labels = filteredData.map(d => new Date(d.DAY).toLocaleDateString());
      swappersChartInstance.data.datasets[0].data = filteredData.map(d => d.DAILY_UNIQUE_SWAPPER_COUNT);
      swappersChartInstance.data.datasets[1].data = filteredData.map(d => d.UNIQUE_SWAPPER_COUNT_30D_MA);
      swappersChartInstance.update();
    } else {
      initSwappersChart();
    }
  }

  function updateVolumeChart() {
    if (!volumeData) return;
    const filteredData = getFilteredVolumeData();
    if (volumeChartInstance) {
      const chartData = processDataForChart(filteredData);
      volumeChartInstance.data = chartData;
      
      // Update y-axis max
      volumeChartInstance.options.scales.y.max = Math.ceil(
        Object.keys(groupByDate(filteredData)).reduce((max, date) => {
          const dayTotal = Object.values(groupByDate(filteredData)[date]).reduce((sum, val) => sum + val, 0);
          return Math.max(max, dayTotal);
        }, 0) / 1000000
      ) * 1000000;
      
      volumeChartInstance.update();
    } else {
      initVolumeChart();
    }
  }

  function updateDexVolumeChart() {
    const filteredData = getFilteredDexVolumeData();
    if (dexVolumeChartInstance) {
      const chartData = processDexVolumeData(filteredData);
      dexVolumeChartInstance.data = chartData;
      dexVolumeChartInstance.update();
    } else {
      initDexVolumeChart();
    }
  }

  function updateDominanceChart() {
    const filteredData = getFilteredDexVolumeData();
    if (dominanceChartInstance) {
      const chartData = processDominanceData(filteredData);
      
      // Calculate new max value and update y-axis
      const maxValue = Math.max(...chartData.datasets[0].data);
      const yAxisMax = Math.ceil(maxValue * 1.1); // Add 10% padding
      dominanceChartInstance.options.scales.y.max = yAxisMax;
      
      dominanceChartInstance.data = chartData;
      dominanceChartInstance.update();
    } else {
      initDominanceChart();
    }
  }

  function updateModuleBalancesChart() {
    const filteredData = getFilteredModuleBalancesData();
    if (moduleBalancesChartInstance) {
      const chartData = processModuleBalancesData(filteredData);
      
      // Update y-axis max based on visible datasets only
      const visibleDatasets = chartData.datasets.filter((_, i) => 
        !moduleBalancesChartInstance.getDatasetMeta(i).hidden
      );
      const maxValue = Math.max(...visibleDatasets.flatMap(d => d.data));
      const yAxisMax = Math.ceil(maxValue * 1.1);
      moduleBalancesChartInstance.options.scales.y.max = yAxisMax;
      
      moduleBalancesChartInstance.data = chartData;
      moduleBalancesChartInstance.update();
    } else {
      initModuleBalancesChart();
    }
  }

  function updateAddressesChart() {
    const filteredData = getFilteredAddressesData();
    if (addressesChartInstance) {
      // Need to destroy and recreate chart to change type
      addressesChartInstance.destroy();
      initAddressesChart();
    } else {
      initAddressesChart();
    }
  }

  function groupByDate(data) {
    const grouped = {};
    data.forEach(d => {
      if (!grouped[d.DAY]) {
        grouped[d.DAY] = {};
      }
      if (!grouped[d.DAY][d.BLOCKCHAIN]) {
        grouped[d.DAY][d.BLOCKCHAIN] = 0;
      }
      grouped[d.DAY][d.BLOCKCHAIN] += d.VOLUME_USD;
    });
    return grouped;
  }

  function getTimeframeDisplay(days) {
    return days === 99999 ? 'All Time' : `Last ${days} Days`;
  }

  function downloadCSV(data, filename) {
    const csvContent = "data:text/csv;charset=utf-8," + data;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Convert swappers data to CSV
  function getSwappersCSV() {
    if (!swappersData) return;
    
    const headers = ["Date", "Daily Unique Swappers", "30-Day Average"];
    const rows = getFilteredSwappersData().map(d => {
      const date = new Date(d.DAY).toLocaleDateString();
      return [date, d.DAILY_UNIQUE_SWAPPER_COUNT, d.UNIQUE_SWAPPER_COUNT_30D_MA].join(",");
    });
    
    return [headers.join(","), ...rows].join("\n");
  }

  // Convert volume data to CSV
  function getVolumeCSV() {
    if (!volumeData) return;
    
    const headers = ["Date", "Chain", "Volume (USD)"];
    const rows = getFilteredVolumeData().map(d => {
      const date = new Date(d.DAY).toLocaleDateString();
      return [date, d.BLOCKCHAIN, d.VOLUME_USD].join(",");
    });
    
    return [headers.join(","), ...rows].join("\n");
  }

  // Convert DEX volume data to CSV
  function getDexVolumeCSV() {
    if (!dexVolumeData) return;
    
    const headers = ["Date", "Protocol", "Volume (USD)"];
    const rows = getFilteredDexVolumeData().map(d => {
      const date = new Date(d.DAY).toLocaleDateString();
      return [date, d.PROTOCOL_NAME, d.VOLUME_USD].join(",");
    });
    
    return [headers.join(","), ...rows].join("\n");
  }

  // Convert module balances data to CSV
  function getModuleBalancesCSV() {
    if (!moduleBalancesData) return;
    
    const headers = ["Date", "Reserve Module", "Bond Module", "Pool Module", "Total"];
    const rows = getFilteredModuleBalancesData().map(d => {
      const date = new Date(d.DAY).toLocaleDateString();
      const total = d.RESERVE_MODULE_BALANCE + d.BOND_MODULE_BALANCE + d.POOL_MODULE_BALANCE;
      return [date, d.RESERVE_MODULE_BALANCE, d.BOND_MODULE_BALANCE, d.POOL_MODULE_BALANCE, total].join(",");
    });
    
    return [headers.join(","), ...rows].join("\n");
  }

  // Convert addresses data to CSV
  function getAddressesCSV() {
    if (!addressesData) return;
    
    const headers = ["Date", "New Addresses", "Total Addresses"];
    const rows = getFilteredAddressesData().map(d => {
      const date = new Date(d.DAY).toLocaleDateString();
      return [date, d.NEW_ADDRESSES, d.NEW_ADDRESSES_CUMULATIVE].join(",");
    });
    
    return [headers.join(","), ...rows].join("\n");
  }

  onMount(async () => {
    isLoading = true;
    try {
      await Promise.all([
        fetchData()
      ]);
    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="growth-container">
  <div class="header">
    <div class="controls">
      <div class="timeframe-select">
        <select bind:value={days} on:change={updateChart}>
          {#each timeframes as timeframe}
            <option value={timeframe.value}>{timeframe.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Daily Unique Swappers ({getTimeframeDisplay(days)})</h2>
      <button 
        class="download-button" 
        on:click={() => downloadCSV(getSwappersCSV(), `thorchain_swappers_${days}days.csv`)}
        title="Download CSV"
      >
        <img src="/assets/icons/download.svg" alt="Download CSV" />
      </button>
    </div>
    <div class="chart-container">
      <canvas bind:this={swappersChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Daily Volume by Chain ({getTimeframeDisplay(days)})</h2>
      <button 
        class="download-button" 
        on:click={() => downloadCSV(getVolumeCSV(), `thorchain_volume_${days}days.csv`)}
        title="Download CSV"
      >
        <img src="/assets/icons/download.svg" alt="Download CSV" />
      </button>
    </div>
    <div class="chart-container">
      <canvas bind:this={volumeChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Daily DEX Volume Comparison ({getTimeframeDisplay(days)})</h2>
      <div class="chart-controls">
        <button 
          class="download-button" 
          on:click={() => downloadCSV(getDexVolumeCSV(), `thorchain_dex_volume_${days}days.csv`)}
          title="Download CSV"
        >
          <img src="/assets/icons/download.svg" alt="Download CSV" />
        </button>
        <label class="toggle">
          <input 
            type="checkbox" 
            bind:checked={showDexPercentages}
            on:change={updateDexVolumeChart}
          >
          <span class="slider">
            <span class="knob">
              <img src="/assets/coins/RUNE-ICON.svg" alt="Amount" class="knob-icon rune" />
              <span class="knob-icon dollar">%</span>
            </span>
          </span>
        </label>
      </div>
    </div>
    <div class="chart-container">
      <canvas bind:this={dexVolumeChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>THORChain DEX Dominance ({getTimeframeDisplay(days)})</h2>
      <button 
        class="download-button" 
        on:click={() => downloadCSV(getDexVolumeCSV(), `thorchain_dex_dominance_${days}days.csv`)}
        title="Download CSV"
      >
        <img src="/assets/icons/download.svg" alt="Download CSV" />
      </button>
    </div>
    <div class="chart-container">
      <canvas bind:this={dominanceChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>Module Balances ({getTimeframeDisplay(days)})</h2>
      <button 
        class="download-button" 
        on:click={() => downloadCSV(getModuleBalancesCSV(), `thorchain_module_balances_${days}days.csv`)}
        title="Download CSV"
      >
        <img src="/assets/icons/download.svg" alt="Download CSV" />
      </button>
    </div>
    <div class="chart-container">
      <canvas bind:this={moduleBalancesChartCanvas}></canvas>
    </div>
  </div>

  <div class="chart-section">
    <div class="section-header">
      <h2>THORChain Addresses ({getTimeframeDisplay(days)})</h2>
      <div class="chart-controls">
        <button 
          class="download-button" 
          on:click={() => downloadCSV(getAddressesCSV(), `thorchain_addresses_${days}days.csv`)}
          title="Download CSV"
        >
          <img src="/assets/icons/download.svg" alt="Download CSV" />
        </button>
        <label class="toggle">
          <input 
            type="checkbox" 
            bind:checked={showDailyAddresses}
            on:change={updateAddressesChart}
          >
          <span class="slider">
            <span class="knob">
              <span class="knob-icon rune">Σ</span>
              <span class="knob-icon dollar">Δ</span>
            </span>
          </span>
        </label>
      </div>
    </div>
    <div class="chart-container">
      <canvas bind:this={addressesChartCanvas}></canvas>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">Loading volume data...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {/if}
</div>

<style>
  .growth-container {
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

  .chart-container {
    position: relative;
    height: 400px;
    padding: 20px;
    background: #2c2c2c;
    border-radius: 8px;
    margin-top: 20px;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 0 20px;
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

  @media (max-width: 600px) {
    .growth-container {
      padding: 10px;
    }

    .chart-container {
      height: 300px;
      padding: 10px;
    }

    h2 {
      font-size: 18px;
      padding: 10px;
    }
  }

  .chart-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .download-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.2s;
    border-radius: 4px;
  }

  .download-button:hover {
    opacity: 1;
    background: rgba(74, 144, 226, 0.1);
  }

  .download-button img {
    width: 16px;
    height: 16px;
    filter: invert(60%) sepia(12%) saturate(1352%) hue-rotate(177deg) brightness(91%) contrast(87%);
  }
</style>
