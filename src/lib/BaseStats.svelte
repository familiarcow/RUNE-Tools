<script>

// Thank you to Rayyyk for the flipside queries
// https://x.com/rykcrypt

  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
  } from 'chart.js';

  // Register Chart.js components
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
  );

  let dailyVolumeCanvas;
  let pieChartCanvas;
  let topAffiliatesCanvas;
  let dailyVolumeChart;
  let pieChart;
  let topAffiliatesChart;
  let isLoading = true;
  let error = null;
  let statsData = [];

  async function fetchData() {
    try {
      console.log('Fetching data...');
      const response = await fetch('https://flipsidecrypto.xyz/api/v1/queries/fc112c00-300f-4aa2-8fcb-7b5e9587c169/data/latest');
      statsData = await response.json();
      console.log('Data fetched:', statsData);
      isLoading = false;
      initCharts();
    } catch (err) {
      console.error('Error fetching data:', err);
      error = err.message;
      isLoading = false;
    }
  }

  function initCharts() {
    if (!statsData.length) {
      console.error('No data available for charts');
      return;
    }

    console.log('Initializing charts...');
    // Add a small delay to ensure DOM elements are ready
    setTimeout(() => {
      console.log('Canvas elements:', {
        dailyVolumeCanvas,
        pieChartCanvas,
        topAffiliatesCanvas
      });
      initDailyVolumeChart();
      initPieChart();
      initTopAffiliatesChart();
    }, 100);
  }

  function initDailyVolumeChart() {
    if (!dailyVolumeCanvas) {
      console.error('Daily volume canvas not found');
      return;
    }

    console.log('Initializing daily volume chart...');
    const ctx = dailyVolumeCanvas.getContext('2d');
    if (dailyVolumeChart) {
      dailyVolumeChart.destroy();
    }

    // Group data by date and affiliate
    const groupedData = {};
    statsData.forEach(entry => {
      const date = new Date(entry.DAY).toLocaleDateString();
      if (!groupedData[date]) {
        groupedData[date] = {};
      }
      groupedData[date][entry.Affiliates] = entry.USD_VOLUME;
    });

    // Get unique affiliates and dates, sort dates chronologically
    const affiliates = [...new Set(statsData.map(d => d.Affiliates))];
    const dates = Object.keys(groupedData).sort((a, b) => new Date(a) - new Date(b));

    // Create datasets
    const datasets = affiliates.map(affiliate => ({
      label: affiliate,
      data: dates.map(date => groupedData[date][affiliate] || 0),
      backgroundColor: getAffiliateColor(affiliate),
    }));

    dailyVolumeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: datasets
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
              callback: value => '$' + value.toLocaleString()
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
              label: context => {
                const value = context.raw;
                return `${context.dataset.label}: $${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  }

  function initPieChart() {
    if (!pieChartCanvas) {
      console.error('Pie chart canvas not found');
      return;
    }

    console.log('Initializing pie chart...');
    const ctx = pieChartCanvas.getContext('2d');
    if (pieChart) {
      pieChart.destroy();
    }

    // Get the latest cumulative volumes for each affiliate
    const affiliateVolumes = new Map();
    statsData.forEach(entry => {
      if (!affiliateVolumes.has(entry.Affiliates) || 
          new Date(entry.DAY) > new Date(affiliateVolumes.get(entry.Affiliates).date)) {
        affiliateVolumes.set(entry.Affiliates, {
          volume: entry.CUMU_USD_VOLUME,
          date: entry.DAY
        });
      }
    });

    // Calculate total volume and percentages
    const totalVolume = Array.from(affiliateVolumes.values()).reduce((sum, entry) => sum + entry.volume, 0);
    const data = Array.from(affiliateVolumes.entries()).map(([affiliate, data]) => ({
      affiliate,
      percentage: (data.volume / totalVolume) * 100
    }));

    pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.map(d => d.affiliate),
        datasets: [{
          data: data.map(d => d.percentage),
          backgroundColor: data.map(d => getAffiliateColor(d.affiliate))
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#888'
            }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = context.raw.toFixed(1);
                return `${context.label}: ${value}%`;
              }
            }
          }
        }
      }
    });
  }

  function initTopAffiliatesChart() {
    if (!topAffiliatesCanvas) {
      console.error('Top affiliates canvas not found');
      return;
    }

    console.log('Initializing top affiliates chart...');
    const ctx = topAffiliatesCanvas.getContext('2d');
    if (topAffiliatesChart) {
      topAffiliatesChart.destroy();
    }

    // Get the latest cumulative volumes for each affiliate
    const affiliateVolumes = new Map();
    statsData.forEach(entry => {
      if (!affiliateVolumes.has(entry.Affiliates) || 
          new Date(entry.DAY) > new Date(affiliateVolumes.get(entry.Affiliates).date)) {
        affiliateVolumes.set(entry.Affiliates, {
          volume: entry.CUMU_USD_VOLUME,
          date: entry.DAY
        });
      }
    });

    // Sort by volume and get top 5
    const topAffiliates = Array.from(affiliateVolumes.entries())
      .map(([affiliate, data]) => ({
        Affiliates: affiliate,
        CUMU_USD_VOLUME: data.volume
      }))
      .sort((a, b) => b.CUMU_USD_VOLUME - a.CUMU_USD_VOLUME)
      .slice(0, 5);

    topAffiliatesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topAffiliates.map(d => d.Affiliates),
        datasets: [{
          data: topAffiliates.map(d => d.CUMU_USD_VOLUME),
          backgroundColor: topAffiliates.map(d => getAffiliateColor(d.Affiliates))
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888',
              callback: value => '$' + value.toLocaleString()
            }
          },
          y: {
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
              label: context => {
                const value = context.raw;
                return `$${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  }

  function getAffiliateColor(affiliate) {
    const colorMap = {
      'THORSwap': '#23DCC8',
      'Asgardex': '#FF6384',
      'Gem Wallet': '#36A2EB',
      'Other': '#4BC0C0'
    };
    return colorMap[affiliate] || '#FFCE56';
  }

  onMount(fetchData);
</script>

<div class="base-stats-container">
  <div class="header">
    <h2>Base Interfaces</h2>
  </div>

  {#if isLoading}
    <div class="loading">Loading interface stats...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else}
    <div class="charts-grid">
      <div class="chart-section">
        <h3>Daily Base Volume by Affiliate</h3>
        <div class="chart-container">
          <canvas bind:this={dailyVolumeCanvas}></canvas>
        </div>
      </div>

      <div class="chart-section">
        <h3>Total Base Volume Distribution</h3>
        <div class="chart-container">
          <canvas bind:this={pieChartCanvas}></canvas>
        </div>
      </div>

      <div class="chart-section">
        <h3>Top 5 Affiliates by Volume</h3>
        <div class="chart-container">
          <canvas bind:this={topAffiliatesCanvas}></canvas>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .base-stats-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
  }

  h2 {
    color: #4A90E2;
    font-size: 24px;
    margin: 0;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 40px;
    margin-top: 20px;
    width: 100%;
  }

  .chart-section {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    min-height: 500px;
  }

  h3 {
    color: #888;
    font-size: 16px;
    margin: 0 0 15px 0;
    text-align: center;
  }

  .chart-container {
    position: relative;
    height: 400px;
    width: 100%;
    margin: 0 auto;
  }

  .loading, .error {
    text-align: center;
    padding: 40px;
    color: #888;
  }

  .error {
    color: #ff4444;
  }

  @media (max-width: 600px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }

    .chart-section {
      padding: 15px;
    }
  }
</style> 