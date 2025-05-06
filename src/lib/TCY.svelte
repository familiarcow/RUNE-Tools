<script>
  import { onMount } from "svelte";

  let address = "";
  let showData = false;
  let distributions = [];
  let totalDistributed = 0;
  let stakedBalance = 0;
  let unstakedBalance = 0;
  let unstakedRuneBalance = 0;
  let isMobile = false;
  let showAllDistributions = false;
  let runePriceUSD = 0;
  let runePriceInTor = 0;
  let tcyPriceUSD = 0;
  let selectedPeriod = '7d';
  let periodOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '60d', label: '60 Days' },
    { value: '90d', label: '90 Days' },
    { value: '365d', label: '1 Year' },
    { value: 'all', label: 'All Time' }
  ];

  const fetchJSON = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
    return response.json();
  };

  const updateAddressFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAddress = urlParams.get("address");
    if (urlAddress) {
      address = urlAddress;
      showData = true;
      fetchData();
    }
  };

  const fetchTCYPrice = async () => {
    try {
      const poolsData = await fetchJSON("https://thornode.ninerealms.com/thorchain/pools");
      const tcyPool = poolsData.find(pool => pool.asset === "THOR.TCY");
      if (tcyPool) {
        tcyPriceUSD = Number(tcyPool.asset_tor_price) / 1e8;
        console.log('TCY Price Debug:', {
          rawPrice: tcyPool.asset_tor_price,
          convertedPrice: tcyPriceUSD
        });
      }
    } catch (error) {
      console.error("Error fetching TCY price:", error);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch RUNE and TCY prices first
      const networkData = await fetchJSON("https://thornode.ninerealms.com/thorchain/network");
      runePriceInTor = Number(networkData.rune_price_in_tor);
      runePriceUSD = runePriceInTor / 1e8;
      console.log('RUNE Price Debug:', {
        rawPrice: networkData.rune_price_in_tor,
        convertedPrice: runePriceUSD
      });
      await fetchTCYPrice();

      // Fetch distribution history
      try {
        const distributionData = await fetchJSON(`https://midgard.ninerealms.com/v2/tcy/distribution/${address}`);
        distributions = distributionData.distributions;
        totalDistributed = Number(distributionData.total) / 1e8;
      } catch (error) {
        distributions = [];
        totalDistributed = 0;
      }

      // Fetch staked balance
      try {
        const stakedData = await fetchJSON(`https://thornode.ninerealms.com/thorchain/tcy_staker/${address}`);
        console.log('Staked Balance API Response:', stakedData);
        stakedBalance = Number(stakedData.amount) / 1e8;
        console.log('Processed Staked Balance:', stakedBalance);
      } catch (error) {
        console.error('Error fetching staked balance:', error);
        stakedBalance = 0;
      }

      // Fetch unstaked balances (always attempt this, even if staked fetch fails)
      try {
        const unstakedData = await fetchJSON(`https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances/${address}`);
        const tcyBalance = unstakedData.balances.find(b => b.denom === "tcy");
        const runeBalance = unstakedData.balances.find(b => b.denom === "rune");
        unstakedBalance = tcyBalance ? Number(tcyBalance.amount) / 1e8 : 0;
        unstakedRuneBalance = runeBalance ? Number(runeBalance.amount) / 1e8 : 0;
      } catch (error) {
        unstakedBalance = 'ERROR';
        unstakedRuneBalance = 'ERROR';
        console.log('ERROR');
      }

      // Force a reactive update of apyStats after all data is loaded
      apyStats = calculateAPY(distributions);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (address) {
      showData = true;
      updateURL();
      fetchData();
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      address = text;
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const updateURL = () => {
    const url = new URL(window.location);
    url.searchParams.set("address", address);
    window.history.pushState({}, '', url);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const numFormat = (x) => Intl.NumberFormat().format(x);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getRecentDistributions = () => {
    const sevenDaysAgo = Date.now() / 1000 - (7 * 24 * 60 * 60);
    return (distributions || []).filter(d => Number(d.date) >= sevenDaysAgo);
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Amount (RUNE)', 'Amount (USD)'];
    const rows = distributions.map(d => {
      const runeAmount = Number(d.amount) / 1e8;
      const usdAmount = runeAmount * runePriceUSD;
      return [
        formatDate(Number(d.date)),
        runeAmount.toFixed(8),
        usdAmount.toFixed(2)
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tcy-distributions-${address.slice(-4)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRuneAmount = (amount) => {
    const value = Number(amount) / 1e8;
    if (value >= 1) {
      return numFormat(value.toFixed(1));
    } else if (value >= 0.01) {
      return numFormat(value.toFixed(3));
    } else {
      return numFormat(value.toFixed(8));
    }
  };

  const calculateAPY = (distributions) => {
    // If no distributions, return null
    if (distributions.length === 0) {
      return null;
    }

    const totalRune = distributions.reduce((sum, d) => 
      sum + (Number(d.amount) / 1e8), 0
    );

    // Calculate average daily RUNE
    const days = distributions.length;
    const avgDailyRune = totalRune / days;
    
    // Annualize
    const annualRune = avgDailyRune * 365;
    const annualUSD = annualRune * runePriceUSD;
    
    // Calculate staked value in USD using the staked balance and TCY price
    const stakedValueUSD = stakedBalance * tcyPriceUSD;

    console.log('Debug APY Calculation:', {
      totalRune,
      days,
      avgDailyRune,
      annualRune,
      runePriceUSD,
      annualUSD,
      stakedBalance,
      tcyPriceUSD,
      stakedValueUSD
    });

    // Calculate APY using the staked value in USD
    const apy = stakedValueUSD > 0 ? (annualUSD / stakedValueUSD) * 100 : 0;

    return {
      totalRune,
      avgDailyRune,
      annualRune,
      annualUSD,
      apy,
      days
    };
  };

  $: apyStats = (distributions && distributions.length > 0) ? calculateAPY(distributions) : null;

  onMount(() => {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    updateAddressFromURL();
  });
</script>

<div class="tcy-tracker-wrapper">
  <div class="tcy-tracker">
    {#if !showData}
      <div class="address-form-outer">
        <form class="address-form-card" on:submit={handleSubmit}>
          <h2 class="address-form-title">TCY Yield Tracker</h2>
          <div class="address-form-group">
            <label for="address-input" class="address-form-label">THORChain Address</label>
            <div class="input-with-paste">
              <input id="address-input" class="address-form-input" type="text" bind:value={address} required placeholder="eg thor1...wxyz" />
              <button type="button" class="paste-button" on:click={handlePaste} title="Paste from clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </button>
            </div>
          </div>
          <button class="address-form-btn" type="submit">Track TCY Staking</button>
        </form>
      </div>
    {:else}
      <div class="container">
        <div class="tracker-title-box">
          <h2>TCY Yield Tracker - {address.slice(-4)}</h2>
        </div>
        <div class="vertical-grid">
          <div class="top-row">
            <div class="card staked">
              <h3>Staked Balance</h3>
              <div class="main-value">
                {numFormat(stakedBalance.toFixed(1))}
                <img src="/assets/coins/TCY.svg" alt="TCY" class="tcy-icon" />
              </div>
              <div class="sub-values">
                <span class="usd-value">{formatCurrency(stakedBalance * tcyPriceUSD)}</span>
              </div>
            </div>

            <div class="card apy">
              <h3>APY</h3>
              {#if apyStats}
                <div class="main-value">{apyStats.apy.toFixed(2)}%</div>
                <div class="sub-values">
                  <span class="usd-value">
                    {formatRuneAmount(apyStats.annualRune * 1e8)}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon small" />
                    /yr
                  </span>
                </div>
              {:else}
                <div class="main-value">N/A</div>
                <div class="sub-values">
                  <span class="usd-value">No distributions yet</span>
                </div>
              {/if}
            </div>
          </div>

          {#if apyStats}
            <div class="card yield-details">
              <h3>{apyStats.days} days staked</h3>
              <div class="yield-stats">
                <div class="stat-row">
                  <span class="stat-label">Total RUNE Earned</span>
                  <span class="stat-value">
                    {formatRuneAmount(apyStats.totalRune * 1e8)}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Average Daily RUNE</span>
                  <span class="stat-value">
                    {formatRuneAmount(apyStats.avgDailyRune * 1e8)}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Annualized RUNE</span>
                  <span class="stat-value">
                    {formatRuneAmount(apyStats.annualRune * 1e8)}
                    <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  </span>
                </div>
              </div>
            </div>
          {/if}

          <div class="card unstaked">
            <div class="card-header">
              <h3>Wallet Balances</h3>
              <a href={`https://viewblock.io/thorchain/address/${address}`} target="_blank" rel="noopener noreferrer" class="icon-link" title="View on RuneScan">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-up-right" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                  <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                </svg>
              </a>
            </div>
            <div class="balance-table">
              <div class="balance-row">
                <div class="asset-info">
                  <img src="/assets/coins/TCY.svg" alt="TCY" class="tcy-icon" />
                  <span>TCY</span>
                  <span class="asset-price">{tcyPriceUSD ? formatCurrency(tcyPriceUSD) : ''}</span>
                </div>
                <div class="balance-info">
                  <span class="amount">
                    {unstakedBalance === 'ERROR' ? 'ERROR' : numFormat(unstakedBalance.toFixed(1))}
                  </span>
                  <span class="usd-value">
                    {unstakedBalance === 'ERROR' ? 'ERROR' : formatCurrency(unstakedBalance * tcyPriceUSD)}
                  </span>
                </div>
              </div>
              <div class="balance-row">
                <div class="asset-info">
                  <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                  <span>RUNE</span>
                  <span class="asset-price">{runePriceUSD ? formatCurrency(runePriceUSD) : ''}</span>
                </div>
                <div class="balance-info">
                  <span class="amount">
                    {unstakedRuneBalance === 'ERROR' ? 'ERROR' : formatRuneAmount(unstakedRuneBalance * 1e8)}
                  </span>
                  <span class="usd-value">
                    {unstakedRuneBalance === 'ERROR' ? 'ERROR' : formatCurrency(unstakedRuneBalance * runePriceUSD)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="distribution-history">
            <div class="history-header">
              <h3>Distribution History ({distributions && distributions.length ? distributions.length : 0} events)</h3>
              <div class="history-controls">
                <button class="icon-button" on:click={() => showAllDistributions = !showAllDistributions} title={showAllDistributions ? 'Show Last 7 Days' : 'Show All History'}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrows-expand" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8zM7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10z"/>
                  </svg>
                </button>
                <button class="icon-button" on:click={downloadCSV} title="Download CSV">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="distribution-table">
              <div class="distribution-header">
                <div class="dist-cell date">Date</div>
                <div class="dist-cell amount text-center">Amount</div>
                <div class="dist-cell usd text-right">USD Value</div>
              </div>
              <div class="distribution-body">
                {#each (showAllDistributions ? distributions : getRecentDistributions()) as distribution}
                  <div class="distribution-row">
                    <div class="dist-cell date">{formatDate(Number(distribution.date))}</div>
                    <div class="dist-cell amount text-center">
                      <span class="amount-with-icon">
                        {formatRuneAmount(distribution.amount)}
                        <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                      </span>
                    </div>
                    <div class="dist-cell usd text-right">{formatCurrency((Number(distribution.amount) / 1e8) * runePriceUSD)}</div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .tcy-tracker-wrapper {
    position: relative;
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding-bottom: 60px;
  }

  .tcy-tracker {
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding: 20px;
    position: relative;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px;
    background-color: #2c2c2c;
    color: #28f4af;
    font-size: 22px;
    font-weight: 600;
  }

  .vertical-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .card {
    background-color: #1a1a1a;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 120px;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    border-color: rgba(40, 244, 175, 0.1);
  }

  h3 {
    font-size: 14px;
    margin: 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .main-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    position: absolute;
    top: 50%;
    left: 15px;
    right: 15px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .sub-values {
    display: flex;
    justify-content: center;
    font-size: 12px;
    color: #a9a9a9;
    position: absolute;
    bottom: 15px;
    left: 15px;
    right: 15px;
  }

  .tcy-icon, .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
  }

  .yield-details {
    height: auto;
    min-height: 120px;
  }

  .yield-stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .stat-label {
    color: #a9a9a9;
    font-size: 14px;
  }

  .stat-value {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 500;
    color: white;
  }

  .stat-value .rune-icon {
    width: 16px;
    height: 16px;
  }

  .distribution-history {
    padding: 20px;
    background-color: #2c2c2c;
    margin-top: 20px;
    border-radius: 8px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .history-controls {
    display: flex;
    gap: 12px;
  }

  .icon-button {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #a9a9a9;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .icon-button:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }

  .icon-button svg {
    width: 16px;
    height: 16px;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
  }

  .sub-value {
    position: absolute;
    bottom: 15px;
    left: 0;
    right: 0;
    text-align: center;
    color: #a9a9a9;
    font-size: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  .sub-value .rune-icon {
    width: 16px;
    height: 16px;
  }

  .sub-value .usd-value {
    margin-left: 5px;
  }

  .usd-value {
    color: #a9a9a9;
    font-size: 12px;
    margin-top: 2px;
  }

  .amount {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .balance-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }

  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .asset-info img {
    width: 24px;
    height: 24px;
  }

  .asset-info span {
    color: #a9a9a9;
    font-size: 16px;
  }

  .balance-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .balance-info .amount {
    color: white;
    font-size: 16px;
  }

  .balance-info .usd-value {
    color: #a9a9a9;
    font-size: 16px;
  }

  .card {
    background-color: #1a1a1a;
    border-radius: 12px;
    padding: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .distribution-table {
    background-color: #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
    margin-top: 15px;
  }

  .distribution-header {
    display: flex;
    padding: 8px 15px;
    background-color: #2c2c2c;
    border-bottom: 1px solid #333;
  }

  .distribution-body {
    max-height: 300px;
    overflow-y: auto;
  }

  .distribution-row {
    display: flex;
    padding: 6px 15px;
    align-items: center;
    border-bottom: 1px solid rgba(51, 51, 51, 0.5);
  }

  .distribution-row:last-child {
    border-bottom: none;
  }

  .dist-cell {
    flex: 1;
    font-size: 14px;
    color: #e0e0e0;
    padding: 0 5px;
  }

  .dist-cell.date {
    flex: 1;
    color: #a9a9a9;
  }

  .dist-cell.amount {
    flex: 1;
  }

  .dist-cell.usd {
    flex: 1;
    color: #a9a9a9;
  }

  .text-center {
    text-align: center;
  }

  .text-right {
    text-align: right;
  }

  .amount-with-icon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .distribution-body .rune-icon {
    width: 14px;
    height: 14px;
    margin-top: -2px;
  }

  .distribution-header .dist-cell {
    color: #a9a9a9;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .distribution-body::-webkit-scrollbar {
    width: 6px;
  }

  .distribution-body::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .distribution-body::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
  }

  .distribution-body::-webkit-scrollbar-thumb:hover {
    background: #444;
  }

  @media (max-width: 600px) {
    .top-row {
      grid-template-columns: 1fr;
    }

    .card {
      height: auto;
      min-height: 100px;
    }

    .main-value {
      position: static;
      transform: none;
      margin: 10px 0;
    }

    .sub-values {
      position: static;
      margin-top: 5px;
    }
  }

  @media (min-width: 768px) {
    .vertical-grid {
      max-width: 800px;
      margin: 0 auto;
    }
  }

  .card-header {
    position: relative;
    margin-bottom: 12px;
  }

  .card-header h3 {
    text-align: center;
  }

  .icon-link {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    color: #a9a9a9;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .icon-link:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }

  .icon-link svg {
    width: 16px;
    height: 16px;
  }

  .address-form-outer {
    min-height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 60vh;
  }

  .address-form-card {
    background: #232323;
    border-radius: 16px;
    box-shadow: 0 6px 32px rgba(0,0,0,0.18), 0 1.5px 6px rgba(40,244,175,0.04);
    padding: 2.5rem 2rem 2rem 2rem;
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    border: 1.5px solid #282828;
  }

  .address-form-title {
    color: #28f4af;
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    letter-spacing: 0.01em;
    text-align: center;
    border-radius: 12px;
    padding: 0.5rem 1rem;
    background: rgba(40, 244, 175, 0.05);
    border: 1px solid rgba(40, 244, 175, 0.1);
  }

  .address-form-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .address-form-label {
    color: #b0b0b0;
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 0.2rem;
    letter-spacing: 0.01em;
  }

  .address-form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1.5px solid #333;
    background: #181818;
    color: #fff;
    font-size: 1.1rem;
    font-family: inherit;
    transition: border 0.2s, box-shadow 0.2s;
    outline: none;
    box-shadow: 0 1px 2px rgba(40,244,175,0.03);
  }

  .input-with-paste {
    position: relative;
    width: 100%;
  }

  .paste-button {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #a9a9a9;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .paste-button:hover {
    color: #28f4af;
    background: rgba(40, 244, 175, 0.1);
  }

  .paste-button svg {
    width: 16px;
    height: 16px;
  }

  .address-form-input:focus {
    border-color: #28f4af;
    box-shadow: 0 0 0 2px rgba(40,244,175,0.12);
  }

  .address-form-btn {
    margin-top: 0.5rem;
    width: 100%;
    padding: 0.85rem 0;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #28f4af 0%, #1eebeb 100%);
    color: #181818;
    font-size: 1.15rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    box-shadow: 0 2px 8px rgba(40,244,175,0.08);
    letter-spacing: 0.01em;
  }
  .address-form-btn:hover, .address-form-btn:focus {
    background: linear-gradient(90deg, #1eebeb 0%, #28f4af 100%);
    color: #101010;
    box-shadow: 0 4px 16px rgba(40,244,175,0.13);
  }

  .asset-price {
    color: #a9a9a9;
    font-size: 0.95em;
    margin-left: 6px;
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .tracker-title-box {
    background: #232323;
    border-radius: 16px;
    padding: 24px 0;
    margin-bottom: 24px;
    text-align: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    border: 1.5px solid #282828;
  }

  .tracker-title-box h2 {
    color: #28f4af;
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.01em;
  }

  .rune-icon.small {
    width: 14px;
    height: 14px;
    margin-left: 3px;
  }
</style>
