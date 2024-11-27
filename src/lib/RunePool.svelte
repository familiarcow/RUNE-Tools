<script>
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";

  let value, currentDeposit, pnl, depositorCount;
  let runeAddress = "";
  let userValue, userDeposit, userPnL, blocksRemaining, timeToMaturity;
  let allPositions = [];
  let poolBreakdown = [];
  let chart;
  let activeTab = "overview";
  let searchTerm = "";
  let sortCriteria = "default";
  let filteredPositions = [];

  const chainIcons = {
    BTC: '/assets/coins/bitcoin-btc-logo.svg',
    ETH: '/assets/coins/ethereum-eth-logo.svg',
    BCH: '/assets/coins/bitcoin-cash-bch-logo.svg',
    LTC: '/assets/coins/litecoin-ltc-logo.svg',
    DOGE: '/assets/coins/dogecoin-doge-logo.svg',
    AVAX: '/assets/coins/avalanche-avax-logo.svg',
    BNB: '/assets/coins/binance-coin-bnb-logo.svg',
    GAIA: '/assets/coins/cosmos-atom-logo.svg',
    THOR: '/assets/coins/RUNE-ICON.svg'
  };

  const updateAddressFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAddress = urlParams.get("address");
    if (urlAddress) {
      runeAddress = urlAddress;
      activeTab = "myPosition";
      fetchUserPosition(runeAddress);
    }
  };

  const updateURL = () => {
    const url = new URL(window.location);
    if (runeAddress) {
      url.searchParams.set("address", runeAddress);
    } else {
      url.searchParams.delete("address");
    }
    window.history.pushState({}, '', url);
  };

  onMount(async () => {
    await fetchRunepoolData();
    await fetchDepositorCount();
    await fetchPoolBreakdown();
    updateAddressFromURL();
  });

  async function fetchRunepoolData() {
    const response = await fetch("https://thornode.ninerealms.com/thorchain/runepool");
    const data = await response.json();
    const providers = data.providers;

    value = formatRuneAmount(providers.value / 1e8);
    currentDeposit = formatRuneAmount(providers.current_deposit / 1e8);
    pnl = formatRuneAmount(providers.pnl / 1e8);

    createChart(providers.value / 1e8, providers.current_deposit / 1e8);
  }

  async function fetchDepositorCount() {
    const response = await fetch("https://thornode.ninerealms.com/thorchain/rune_providers");
    const data = await response.json();
    depositorCount = data.length;
  }

  async function fetchUserPosition(address) {
    if (!address) return;

    const response = await fetch(`https://thornode.ninerealms.com/thorchain/rune_provider/${address}`);
    const data = await response.json();

    userValue = formatRuneAmount(data.value / 1e8);
    userDeposit = formatRuneAmount(data.deposit_amount / 1e8);
    userPnL = formatRuneAmount(data.pnl / 1e8);

    const constantsResponse = await fetch("https://thornode-v1.ninerealms.com/thorchain/mimir");
    const constantsData = await constantsResponse.json();
    const maturityBlocks = constantsData.RUNEPOOLDEPOSITMATURITYBLOCKS;

    const blockResponse = await fetch("https://thornode.ninerealms.com/thorchain/lastblock");
    const blockData = await blockResponse.json();
    const currentBlock = blockData.find((block) => block.chain === "AVAX").thorchain;

    const lastDepositHeight = data.last_deposit_height;
    blocksRemaining = lastDepositHeight + maturityBlocks - currentBlock;
    timeToMaturity = convertBlocksToTime(blocksRemaining);
  }

  async function fetchAllPositions() {
    const response = await fetch("https://thornode.ninerealms.com/thorchain/rune_providers");
    const data = await response.json();

    allPositions = data.map((position) => {
      const depositValue = position.deposit_amount / 1e8;
      const pnlValue = position.pnl / 1e8;
      const pnlPercent = (pnlValue / depositValue) * 100;
      
      return {
        runeAddress: position.rune_address,
        deposit: formatRuneAmount(depositValue),
        depositValue: depositValue,
        pnl: formatRuneAmount(pnlValue),
        pnlValue: pnlValue,
        pnlPercent: pnlPercent.toFixed(2)
      };
    });
    filterPositions();
  }

  async function fetchPoolBreakdown() {
    try {
        // First get all pools data
        const poolsResponse = await fetch("https://thornode.ninerealms.com/thorchain/pools");
        const poolsData = await poolsResponse.json();
        
        // Create a map of pool balances
        const poolBalances = poolsData.reduce((acc, pool) => {
            const poolName = pool.asset;
            acc[poolName] = Number(pool.balance_rune) / 1e8;
            return acc;
        }, {});

        // Get POL-enabled pools from Mimir
        const mimirResponse = await fetch("https://thornode.thorchain.liquify.com/thorchain/mimir");
        const mimirData = await mimirResponse.json();
        
        const polPools = Object.entries(mimirData)
            .filter(([key, value]) => key.startsWith('POL-') && value === 1)
            .map(([key]) => {
                const asset = key.substring(4);
                return asset;
            });

        // Fetch LP positions for each pool
        const lpPromises = polPools.map(async (asset) => {
            try {
                const [chain, ...rest] = asset.split('-');
                const poolName = `${chain}.${rest.join('-')}`;
                
                const response = await fetch(`https://thornode.thorchain.liquify.com/thorchain/pool/${poolName}/liquidity_provider/thor1dheycdevq39qlkxs2a6wuuzyn4aqxhve4qxtxt`);
                const data = await response.json();
                const runeValue = Number(data.rune_redeem_value) / 1e8;
                
                // Calculate ownership percentage
                const totalPoolRune = poolBalances[poolName] || 0;
                const ownershipPercent = totalPoolRune ? (runeValue / totalPoolRune * 100).toFixed(2) : '0.00';
                
                return {
                    pool: asset,
                    runeValue: runeValue,
                    ownershipPercent: ownershipPercent
                };
            } catch (error) {
                console.error(`Failed to fetch LP data for ${asset}:`, error);
                return null;
            }
        });

        const lpPositions = (await Promise.all(lpPromises)).filter(Boolean);
        const totalRuneValue = lpPositions.reduce((sum, pos) => sum + pos.runeValue, 0);

        // Calculate percentages and format pool names
        poolBreakdown = lpPositions
            .map(pos => ({
                pool: formatCryptoName(pos.pool),
                weight: ((pos.runeValue / totalRuneValue) * 100).toFixed(2),
                runeValue: pos.runeValue,
                ownershipPercent: pos.ownershipPercent
            }))
            .filter(pos => Number(pos.weight) > 0)
            .sort((a, b) => b.runeValue - a.runeValue);

        // Update the pie chart
        setTimeout(() => {
            createPieChart(poolBreakdown);
        }, 0);

    } catch (error) {
        console.error('Failed to fetch pool breakdown:', error);
    }
  }

  function formatCryptoName(cryptoName) {
    const parts = cryptoName.split(/\.|-/);
    const [chain, asset, identifier] = parts;
    if (["ETH", "BSC", "AVAX"].includes(chain) && identifier) {
      return `${asset} (${chain})`;
    } else {
      return asset;
    }
  }

  function formatRuneAmount(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function createChart(value, deposit) {
    const ctx = document.getElementById("myChart");
    if (!ctx) return;
    
    if (chart) {
      chart.destroy();
    }
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Current Value", "Deposited"],
        datasets: [{
          data: [value, deposit],
          backgroundColor: ["#4CAF50", "#2196F3"],
          borderColor: ["#45a049", "#1e87db"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.y.toLocaleString() + " RUNE";
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString() + " RUNE";
              }
            }
          }
        }
      }
    });
  }

  // Update the coinColors object with official brand colors
  const coinColors = {
    'BTC': '#F7931A',   // Bitcoin orange
    'ETH': '#627EEA',   // Ethereum blue
    'AVAX': '#E84142',  // Avalanche red
    'BNB': '#F3BA2F',   // Binance yellow
    'USDT': '#26A17B',  // Tether green
    'USDC': '#2775CA',  // USDC blue
    'BUSD': '#F0B90B',  // BUSD gold
    'DOGE': '#BA9F33',  // Dogecoin gold
    'LTC': '#345D9D',   // Litecoin blue
    'BCH': '#8DC351',   // Bitcoin Cash green
    'ATOM': '#2E3148',  // Cosmos dark blue
    'MAYA': '#FFB236',  // Maya yellow
  };

  function createPieChart(data) {
    const ctx = document.getElementById("myChart");
    if (!ctx) return;
    
    if (chart) {
      chart.destroy();
    }

    // Map colors to data while maintaining sort order
    const colors = data.map(item => {
      // Extract base asset name (remove chain prefix if exists)
      const baseAsset = item.pool.split(' ')[0];
      return coinColors[baseAsset] || '#808080'; // Fallback to gray for unknown assets
    });

    // Create gradient backgrounds
    const ctx2d = ctx.getContext('2d');
    const gradients = colors.map(color => {
      const gradient = ctx2d.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, adjustColor(color, -20)); // Darker version of the color
      return gradient;
    });

    chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: data.map((d) => d.pool),
        datasets: [
          {
            data: data.map((d) => d.weight),
            backgroundColor: gradients,
            borderColor: '#1a1a1a', // Darker border for contrast
            borderWidth: 2,
            hoverBorderColor: '#ffffff',
            hoverBorderWidth: 3,
            hoverOffset: 10
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 20
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#fff',
              font: {
                size: 12,
                family: "'Exo 2', sans-serif",
                weight: '500'
              },
              padding: 15,
              boxWidth: 15,
              boxHeight: 15,
              borderRadius: 3
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 14,
              family: "'Exo 2', sans-serif",
              weight: '600'
            },
            bodyFont: {
              size: 13,
              family: "'Exo 2', sans-serif"
            },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                return `${context.label}: ${value.toFixed(2)}%`;
              },
            },
          },
        },
        elements: {
          arc: {
            borderWidth: 2,
            borderRadius: 5,
          }
        },
      },
    });
  }

  // Helper function to adjust color brightness
  function adjustColor(color, amount) {
    const clamp = (val) => Math.min(Math.max(val, 0), 255);
    
    // Convert hex to RGB
    let hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Adjust brightness
    r = clamp(r + amount);
    g = clamp(g + amount);
    b = clamp(b + amount);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function convertBlocksToTime(blocks) {
    const seconds = blocks * 6;
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    return `${days} days and ${hours} hours`;
  }

  function setActiveTab(tab) {
    activeTab = tab;
    if (tab === 'allPositions') {
      fetchAllPositions();
    } else if (tab === 'overview') {
      fetchRunepoolData();
      fetchPoolBreakdown();
      const url = new URL(window.location);
      url.searchParams.delete("address");
      window.history.pushState({}, '', url);
    }
    setTimeout(() => {
      if (tab === 'overview' && poolBreakdown.length > 0) {
        createPieChart(poolBreakdown);
      }
    }, 0);
  }

  $: {
    if (allPositions.length > 0) {
      if (!searchTerm) {
        filteredPositions = [...allPositions];
      } else {
        filteredPositions = allPositions.filter(position =>
          position.runeAddress.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      // Apply sorting after filtering
      switch (sortCriteria) {
        case "sizeAsc":
          filteredPositions.sort((a, b) => a.depositValue - b.depositValue);
          break;
        case "sizeDesc":
          filteredPositions.sort((a, b) => b.depositValue - a.depositValue);
          break;
        case "pnlAsc":
          filteredPositions.sort((a, b) => a.pnlValue - b.pnlValue);
          break;
        case "pnlDesc":
          filteredPositions.sort((a, b) => b.pnlValue - a.pnlValue);
          break;
        case "pnlPercentAsc":
          filteredPositions.sort((a, b) => parseFloat(a.pnlPercent) - parseFloat(b.pnlPercent));
          break;
        case "pnlPercentDesc":
          filteredPositions.sort((a, b) => parseFloat(b.pnlPercent) - parseFloat(a.pnlPercent));
          break;
      }
      
      // Ensure reactivity
      filteredPositions = [...filteredPositions];
    }
  }

  async function handlePositionLookup() {
    if (runeAddress) {
      await fetchUserPosition(runeAddress);
      updateURL();
    }
  }

  function getColorForPnL(pnl, positions) {
    const pnlValue = parseFloat(pnl);
    
    // Define colors
    const red = { r: 239, g: 83, b: 80 };     // #ef5350 - for negative values
    const neutral = { r: 255, g: 235, b: 59 }; // #ffeb3b - for zero
    const green = { r: 102, g: 187, b: 106 };  // #66bb6a - for positive values
    
    // If PnL is positive, interpolate between neutral and green
    if (pnlValue > 0) {
      // Find max positive value for scaling
      const maxPnL = Math.max(...positions.map(p => parseFloat(p.pnlPercent)));
      const normalizedValue = pnlValue / maxPnL;
      
      return `rgb(${
        Math.round(neutral.r + normalizedValue * (green.r - neutral.r))}, ${
        Math.round(neutral.g + normalizedValue * (green.g - neutral.g))}, ${
        Math.round(neutral.b + normalizedValue * (green.b - neutral.b))
      })`;
    }
    
    // If PnL is negative, interpolate between red and neutral
    if (pnlValue < 0) {
      // Find min negative value for scaling
      const minPnL = Math.min(...positions.map(p => parseFloat(p.pnlPercent)));
      const normalizedValue = pnlValue / minPnL; // Will be between 0 and 1
      
      return `rgb(${
        Math.round(red.r + (1 - normalizedValue) * (neutral.r - red.r))}, ${
        Math.round(red.g + (1 - normalizedValue) * (neutral.g - red.g))}, ${
        Math.round(red.b + (1 - normalizedValue) * (neutral.b - red.b))
      })`;
    }
    
    // If PnL is exactly 0, return neutral color
    return `rgb(${neutral.r}, ${neutral.g}, ${neutral.b})`;
  }
</script>

<div class="container">
  <div class="app-header">
    
    <h2>Rune Pool</h2>
    <div class="info-icon" on:click={() => alert('View and manage THORChain Rune Pool positions')}>ⓘ</div>
  </div>

  <div class="tabs">
    <button 
      class="tab-button {activeTab === 'overview' ? 'active' : ''}" 
      on:click={() => setActiveTab('overview')}
    >
      Overview
    </button>
    <button 
      class="tab-button {activeTab === 'allPositions' ? 'active' : ''}" 
      on:click={() => setActiveTab('allPositions')}
    >
      All Positions
    </button>
    <button 
      class="tab-button {activeTab === 'myPosition' ? 'active' : ''}" 
      on:click={() => setActiveTab('myPosition')}
    >
      My Position
    </button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'overview'}
      <div class="stats-grid">
        <div class="stat-box">
          <h3>Current Value</h3>
          <p class="mono-value">{value} <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" /></p>
        </div>
        <div class="stat-box">
          <h3>Deposited</h3>
          <p class="mono-value">{currentDeposit} <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" /></p>
        </div>
        <div class="stat-box">
          <h3>PnL</h3>
          <p class="mono-value">{pnl} <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" /></p>
        </div>
        <div class="stat-box">
          <h3>Number of Depositors</h3>
          <p class="mono-value">{depositorCount || '...'}</p>
        </div>
      </div>

      {#if poolBreakdown.length > 0}
        <div class="pool-breakdown-container">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th class="pool-column">Pool</th>
                  <th class="weight-column">Weight</th>
                  <th class="weight-column">Pool Ownership</th>
                </tr>
              </thead>
              <tbody>
                {#each poolBreakdown as pool}
                  <tr>
                    <td class="pool-cell">
                      <div class="pool-name-with-icon">
                        <img 
                          src={chainIcons[pool.pool.includes('(') ? pool.pool.split(' ')[1].slice(1, -1) : pool.pool]} 
                          alt={pool.pool}
                          class="chain-icon"
                          on:error={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/assets/coins/fallback-logo.svg';
                          }}
                        />
                        <span>{pool.pool}</span>
                      </div>
                    </td>
                    <td class="weight-cell">{pool.weight}%</td>
                    <td class="weight-cell">{pool.ownershipPercent}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="chart-wrapper">
            <canvas id="myChart"></canvas>
          </div>
        </div>
      {/if}
    {:else if activeTab === 'myPosition'}
      <div class="position-lookup">
        <input 
          type="text" 
          bind:value={runeAddress} 
          placeholder="Enter RUNE Address"
          class="search-input"
        />
        <button class="action-button" on:click={handlePositionLookup}>
          Fetch Position
        </button>
      </div>

      {#if userValue}
        <div class="stats-grid">
          <div class="stat-box">
            <h3>Your Current Value</h3>
            <p>{userValue} ᚱ</p>
          </div>
          <div class="stat-box">
            <h3>Your Deposit</h3>
            <p>{userDeposit} ᚱ</p>
          </div>
          <div class="stat-box">
            <h3>Your PnL</h3>
            <p>{userPnL} ᚱ</p>
          </div>
          <div class="stat-box">
            <h3>Time to Maturity</h3>
            <p>{blocksRemaining <= 0 ? 'Eligible for Withdrawal' : timeToMaturity}</p>
          </div>
        </div>
      {/if}
    {:else if activeTab === 'allPositions'}
      <div class="controls">
        <input 
          type="text" 
          bind:value={searchTerm} 
          placeholder="Search by RUNE address"
          class="search-input"
        />
        <div class="select-wrapper">
          <select bind:value={sortCriteria}>
            <option value="default">Sort by: Default</option>
            <option value="sizeDesc">Sort by: Deposit Size (High to Low)</option>
            <option value="sizeAsc">Sort by: Deposit Size (Low to High)</option>
            <option value="pnlDesc">Sort by: PnL (High to Low)</option>
            <option value="pnlAsc">Sort by: PnL (Low to High)</option>
            <option value="pnlPercentDesc">Sort by: PnL % (High to Low)</option>
            <option value="pnlPercentAsc">Sort by: PnL % (Low to High)</option>
          </select>
        </div>
      </div>

      <div class="positions-table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="address-column">RUNE Address</th>
              <th class="number-column">Deposit</th>
              <th class="number-column">PnL</th>
              <th class="number-column">PnL %</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredPositions as position}
              <tr class:highlight={position.runeAddress === runeAddress}>
                <td class="address-cell">{position.runeAddress}</td>
                <td class="number-cell">
                  {position.deposit} <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                </td>
                <td class="number-cell">
                  {position.pnl} <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                </td>
                <td class="number-cell">
                  <span style="color: {getColorForPnL(position.pnlPercent, filteredPositions)}">
                    {position.pnlPercent}%
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
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

  .info-icon {
    position: absolute;
    right: 0;
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

  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: 30px;
    justify-content: center;
    background: #2c2c2c;
    padding: 6px;
    border-radius: 12px;
  }

  .tab-button {
    background: transparent;
    border: none;
    color: #888;
    padding: 12px 24px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    position: relative;
    min-width: 140px;
  }

  .tab-button:hover {
    color: #4A90E2;
  }

  .tab-button.active {
    background: #1a1a1a;
    color: #4A90E2;
    border-radius: 8px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-box {
    background: #2c2c2c;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .stat-box h3 {
    color: #888;
    font-size: 14px;
    margin: 0 0 10px 0;
  }

  .mono-value {
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
    margin: 0;
    font-family: monospace;
    white-space: nowrap;
  }

  .position-lookup {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
  }

  .search-input {
    width: 100%;
    padding: 12px;
    background-color: #2c2c2c;
    border: 1px solid #3a3a3c;
    border-radius: 6px;
    color: #fff;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .action-button {
    background: #4A90E2;
    color: #fff;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .action-button:hover {
    background: #357abd;
    transform: translateY(-1px);
  }

  .controls {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
  }

  .search-input {
    flex: 1;
  }

  .select-wrapper {
    position: relative;
    width: 300px;
  }

  .select-wrapper select {
    width: 100%;
    padding: 12px;
    background-color: #2c2c2c;
    border: 1px solid #3a3a3c;
    border-radius: 6px;
    color: #f8f8f8;
    font-size: 16px;
    appearance: none;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .select-wrapper::after {
    content: '▼';
    font-size: 12px;
    color: #888;
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .select-wrapper select:hover {
    border-color: #4A90E2;
  }

  .select-wrapper select:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .select-wrapper select option {
    background-color: #2c2c2c;
    color: #f8f8f8;
    padding: 12px;
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: fit-content;
    height: fit-content;
    overflow: hidden;
  }

  thead tr:first-child th:first-child {
    border-top-left-radius: 12px;
  }

  thead tr:first-child th:last-child {
    border-top-right-radius: 12px;
  }

  tbody tr:last-child td:first-child {
    border-bottom-left-radius: 12px;
  }

  tbody tr:last-child td:last-child {
    border-bottom-right-radius: 12px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    white-space: nowrap;
  }

  thead {
    background-color: #1a1a1a;
  }

  th {
    padding: 12px 16px;
    text-align: left;
    color: #888;
    font-weight: normal;
    font-size: 16px;
    background-color: #1a1a1a;
    border-bottom: 1px solid #3a3a3c;
  }

  tr {
    border-bottom: 1px solid #3a3a3c;
  }

  tr:last-child {
    border-bottom: none;
  }

  .address-column {
    width: 40%;
  }

  .number-column {
    width: 20%;
    text-align: right;
  }

  .address-cell {
    padding: 12px 16px;
    color: #4A90E2;
    font-family: monospace;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .number-cell {
    padding: 12px 16px;
    text-align: right;
    font-family: monospace;
    font-size: 14px;
    white-space: nowrap;
  }

  .highlight {
    background: rgba(74, 144, 226, 0.1);
  }

  @media (max-width: 768px) {
    .controls {
      flex-direction: column;
      gap: 10px;
    }

    .select-wrapper {
      width: 100%;
    }

    .address-cell {
      max-width: 150px;
    }
  }

  .pool-cell {
    padding: 12px 16px;
    color: #4A90E2;
    white-space: nowrap;
  }

  .weight-cell {
    padding: 12px 16px;
    text-align: right;
    white-space: nowrap;
  }

  .pool-column {
    min-width: 120px;
  }

  .weight-column {
    min-width: 100px;
    text-align: right;
  }

  .chart-wrapper {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    height: 100%;
    position: relative;
  }

  .chart-wrapper canvas {
    position: absolute;
    top: 15px;
    left: 15px;
    right: 15px;
    bottom: 15px;
    width: calc(100% - 30px) !important;
    height: calc(100% - 30px) !important;
  }

  .pool-breakdown-container {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 20px;
    margin-bottom: 30px;
    min-height: 400px; /* Minimum height to accommodate chart */
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: fit-content;
    height: fit-content;
    overflow: hidden;
  }

  thead tr:first-child th:first-child {
    border-top-left-radius: 12px;
  }

  thead tr:first-child th:last-child {
    border-top-right-radius: 12px;
  }

  tbody tr:last-child td:first-child {
    border-bottom-left-radius: 12px;
  }

  tbody tr:last-child td:last-child {
    border-bottom-right-radius: 12px;
  }

  .chart-wrapper {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    position: relative;
    min-height: 400px; /* Match container min-height */
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }

  @media (max-width: 1024px) {
    .pool-breakdown-container {
      grid-template-columns: 1fr;
      height: auto;
    }

    .chart-wrapper {
      min-height: 300px;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .tabs {
      flex-direction: column;
    }

    .tab-button {
      width: 100%;
    }

    .position-lookup {
      flex-direction: column;
    }

    .controls {
      flex-direction: column;
    }

    .select-wrapper {
      width: 100%;
    }

    .stat-box p {
      font-size: 20px;
    }

    th, td {
      padding: 10px;
      font-size: 14px;
    }

    .number-cell {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .app-header h2 {
      font-size: 20px;
    }

    .stat-box {
      padding: 15px;
    }

    .stat-box h3 {
      font-size: 12px;
    }

    .stat-box p {
      font-size: 18px;
    }

    .address-cell, .number-cell {
      font-size: 12px;
    }
  }

  .rune-icon {
    height: 14px;
    width: 14px;
    vertical-align: middle;
    margin-left: 2px;
    margin-bottom: 2px;
  }

  .mono-value .rune-icon {
    height: 18px;
    width: 18px;
  }

  .pool-name-with-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chain-icon {
    width: 20px;
    height: 20px;
    min-width: 20px; /* Prevents icon from shrinking */
  }

  .positions-table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    overflow: hidden;
  }
</style>
  