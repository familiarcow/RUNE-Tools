<script>
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import { fetchMimirValue } from '$lib/utils/api';
  import { getAddressSuffix } from '$lib/utils/formatting';
  import { fromBaseUnit } from '$lib/utils/blockchain';
  import {
    getNodes,
    filterNodesByStatus,
    getActiveNodeAddresses,
    NODE_STATUS
  } from '$lib/utils/nodes';
  import {
    getMimirVotesForKey,
    calculateVoteStats,
    groupVotesByValue
  } from '$lib/utils/voting';

  // Provider mapping with colors
  const SOL_RPC_PROVIDERS = {
    1: { name: 'Self Hosted', color: '#2ecc71' },      // Green
    2: { name: 'Liquify', color: '#9b59b6' },          // Purple
    3: { name: 'QuickNode', color: '#e74c3c' },        // Red
    4: { name: 'Alchemy', color: '#3498db' },          // Blue
    5: { name: 'Chainstack', color: '#e67e22' },       // Orange
    6: { name: 'Ankr', color: '#1abc9c' },             // Turquoise
    7: { name: 'Blockdaemon', color: '#f1c40f' },      // Yellow
    8: { name: 'Helius', color: '#e84393' }            // Pink
  };

  const NOT_VOTED_COLOR = '#95a5a6'; // Grey
  const WARNING_THRESHOLD = 0.25; // 25%
  const MIMIR_KEY = 'SOL-RPC-PROVIDER';

  // State
  let nodes = [];
  let activeNodes = [];
  let standbyNodes = [];
  let eligibleStandbyNodes = [];
  let mimirVotes = new Map(); // node address -> provider value
  let minimumBondInRune = 300000; // Default 300k RUNE
  let dataLoaded = false;
  let chartInstance = null;
  let chartCanvas;
  let showInfo = false;
  let searchTerm = '';

  onMount(async () => {
    await Promise.all([
      fetchNodeData(),
      fetchMimirVotes(),
      fetchMinBond()
    ]);
    dataLoaded = true;

    // Wait for next tick to ensure canvas is ready
    setTimeout(() => {
      renderChart();
    }, 100);
  });

  onDestroy(() => {
    if (chartInstance) {
      chartInstance.destroy();
    }
  });

  async function fetchNodeData() {
    try {
      nodes = await getNodes({ cache: false });
      activeNodes = filterNodesByStatus(nodes, NODE_STATUS.ACTIVE);
      standbyNodes = filterNodesByStatus(nodes, NODE_STATUS.STANDBY);
    } catch (error) {
      console.error('Error fetching node data:', error);
    }
  }

  async function fetchMimirVotes() {
    try {
      mimirVotes = await getMimirVotesForKey(MIMIR_KEY);
    } catch (error) {
      console.error('Error fetching mimir votes:', error);
    }
  }

  async function fetchMinBond() {
    try {
      const minBond = await fetchMimirValue('MINIMUMBONDINRUNE');
      if (minBond) {
        minimumBondInRune = fromBaseUnit(minBond);
      }
    } catch (error) {
      console.error('Error fetching minimum bond:', error);
    }
  }

  // Calculate provider distribution for active nodes
  function calculateDistribution(nodeList, votes) {
    const distribution = {};

    // Initialize all known providers with 0 count
    Object.entries(SOL_RPC_PROVIDERS).forEach(([value, provider]) => {
      distribution[value] = {
        ...provider,
        value: parseInt(value),
        count: 0,
        nodes: [],
        percentage: 0
      };
    });

    // Add "Not Voted" category
    distribution['notVoted'] = {
      name: 'Not Voted',
      color: NOT_VOTED_COLOR,
      value: null,
      count: 0,
      nodes: [],
      percentage: 0
    };

    // Count votes
    nodeList.forEach(node => {
      const vote = votes.get(node.node_address);
      if (vote && distribution[vote]) {
        distribution[vote].count++;
        distribution[vote].nodes.push(node);
      } else {
        distribution['notVoted'].count++;
        distribution['notVoted'].nodes.push(node);
      }
    });

    // Calculate percentages
    const total = nodeList.length;
    Object.values(distribution).forEach(provider => {
      provider.percentage = total > 0 ? (provider.count / total) * 100 : 0;
    });

    return distribution;
  }

  // Calculate standby provider distribution
  function calculateStandbyDistribution(standbyList, votes, minBond) {
    // Filter to eligible standby nodes (bond >= minimum)
    const eligible = standbyList.filter(node => {
      const totalBond = fromBaseUnit(node.total_bond || 0);
      return totalBond >= minBond;
    });

    const distribution = {};

    Object.entries(SOL_RPC_PROVIDERS).forEach(([value, provider]) => {
      distribution[value] = {
        ...provider,
        value: parseInt(value),
        count: 0,
        nodes: []
      };
    });

    distribution['notVoted'] = {
      name: 'Not Voted',
      color: NOT_VOTED_COLOR,
      value: null,
      count: 0,
      nodes: []
    };

    eligible.forEach(node => {
      const vote = votes.get(node.node_address);
      if (vote && distribution[vote]) {
        distribution[vote].count++;
        distribution[vote].nodes.push(node);
      } else {
        distribution['notVoted'].count++;
        distribution['notVoted'].nodes.push(node);
      }
    });

    return { distribution, eligible };
  }

  // Computed values
  $: activeDistribution = calculateDistribution(activeNodes, mimirVotes);
  $: standbyResult = calculateStandbyDistribution(standbyNodes, mimirVotes, minimumBondInRune);
  $: standbyDistribution = standbyResult.distribution;
  $: eligibleStandbyNodes = standbyResult.eligible;

  $: activeAddresses = getActiveNodeAddresses(activeNodes);
  $: voteStats = calculateVoteStats(mimirVotes, activeAddresses);

  // Warning calculations
  $: warnings = Object.values(activeDistribution).filter(
    p => p.percentage > WARNING_THRESHOLD * 100 && p.name !== 'Not Voted'
  );
  $: hasWarning = warnings.length > 0;

  // Vote threshold - need 80% of active nodes to have voted
  const VOTE_THRESHOLD = 0.8;
  $: votesNeededForQuorum = Math.ceil(activeNodes.length * VOTE_THRESHOLD);
  $: hasEnoughVotes = voteStats.votedCount >= votesNeededForQuorum;
  $: votesRemaining = Math.max(0, votesNeededForQuorum - voteStats.votedCount);

  // Sorted providers for display (by count, descending, but Not Voted always last)
  $: sortedProviders = Object.values(activeDistribution)
    .filter(p => p.count > 0 || p.name !== 'Not Voted')
    .sort((a, b) => {
      if (a.name === 'Not Voted') return 1;
      if (b.name === 'Not Voted') return -1;
      return b.count - a.count;
    });

  // Chart rendering
  function renderChart() {
    if (!chartCanvas || !dataLoaded) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d');

    // Prepare data - exclude providers with 0 active votes
    const chartProviders = sortedProviders.filter(p => p.count > 0);

    const labels = chartProviders.map(p => p.name);
    const activeData = chartProviders.map(p => p.count);
    const activeColors = chartProviders.map(p => p.color);

    // Standby data (ghost overlay)
    const standbyData = chartProviders.map(p => {
      if (p.name === 'Not Voted') {
        return standbyDistribution['notVoted']?.count || 0;
      }
      return standbyDistribution[p.value]?.count || 0;
    });
    const standbyColors = chartProviders.map(p => {
      const hex = p.color;
      // Convert hex to rgba with 0.3 opacity
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    });

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Active Nodes',
            data: activeData,
            backgroundColor: activeColors,
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Eligible Standby',
            data: standbyData,
            backgroundColor: standbyColors,
            borderWidth: 1,
            borderColor: activeColors,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
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
              display: false
            },
            ticks: {
              color: '#fff'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#888',
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const provider = chartProviders[context.dataIndex];
                if (context.datasetIndex === 0) {
                  return `Active: ${context.raw} nodes (${provider.percentage.toFixed(1)}%)`;
                } else {
                  return `+${context.raw} eligible standby`;
                }
              }
            }
          }
        }
      }
    });
  }

  // Re-render chart when data changes
  $: if (dataLoaded && chartCanvas && sortedProviders) {
    renderChart();
  }

  function getProviderName(value) {
    if (value === null || value === undefined) return 'Not Voted';
    return SOL_RPC_PROVIDERS[value]?.name || `Unknown (${value})`;
  }

  function getProviderColor(value) {
    if (value === null || value === undefined) return NOT_VOTED_COLOR;
    return SOL_RPC_PROVIDERS[value]?.color || '#666';
  }

  function toggleInfo() {
    showInfo = !showInfo;
  }

  // Search filter function
  function filterNodesBySearch(nodeList, term, votes) {
    if (!term || term.trim() === '') return nodeList;

    const searchLower = term.toLowerCase().trim();

    return nodeList.filter(node => {
      // Check node address
      if (node.node_address?.toLowerCase().includes(searchLower)) return true;

      // Check operator address
      if (node.node_operator_address?.toLowerCase().includes(searchLower)) return true;

      // Check provider name
      const vote = votes.get(node.node_address);
      const providerName = getProviderName(vote).toLowerCase();
      if (providerName.includes(searchLower)) return true;

      return false;
    });
  }

  // Sort nodes by operator so nodes with the same operator appear together
  function sortByOperator(nodeList) {
    return [...nodeList].sort((a, b) => {
      const opA = a.node_operator_address || '';
      const opB = b.node_operator_address || '';
      return opA.localeCompare(opB);
    });
  }

  // Color palette for multi-node operators (from voting.js)
  const OPERATOR_COLORS = [
    '#9b59b6', '#3498db', '#e67e22', '#1abc9c', '#e84393',
    '#f1c40f', '#2ecc71', '#e74c3c', '#16a085', '#8e44ad'
  ];

  // Get operators with multiple nodes and assign colors
  function getMultiNodeOperatorColors(nodeList) {
    const operatorCounts = {};
    nodeList.forEach(node => {
      const op = node.node_operator_address || '';
      operatorCounts[op] = (operatorCounts[op] || 0) + 1;
    });

    const colorMap = {};
    let colorIndex = 0;
    Object.entries(operatorCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([operator]) => {
        colorMap[operator] = OPERATOR_COLORS[colorIndex % OPERATOR_COLORS.length];
        colorIndex++;
      });

    return colorMap;
  }

  // Filtered and sorted nodes based on search
  $: sortedActiveNodes = sortByOperator(activeNodes);
  $: filteredActiveNodes = filterNodesBySearch(sortedActiveNodes, searchTerm, mimirVotes);
  $: sortedStandbyNodes = sortByOperator(eligibleStandbyNodes);
  $: filteredStandbyNodes = filterNodesBySearch(sortedStandbyNodes, searchTerm, mimirVotes);

  // Get color maps for multi-node operators
  $: activeOperatorColors = getMultiNodeOperatorColors(filteredActiveNodes);
  $: standbyOperatorColors = getMultiNodeOperatorColors(filteredStandbyNodes);

  function clearSearch() {
    searchTerm = '';
  }

  // Get background color for operator (returns color if multi-node operator, null otherwise)
  function getOperatorBgColor(operatorAddress, colorMap) {
    return colorMap[operatorAddress] || null;
  }
</script>

<div class="container">
  <div class="app-header">
    <img src="/assets/chains/SOL.svg" alt="Solana Logo" class="header-icon">
    <h2>Solana RPC Provider Diversity</h2>
    <div class="info-icon" on:click={toggleInfo} on:keypress={toggleInfo} role="button" tabindex="0">ⓘ</div>
  </div>

  {#if showInfo}
    <div class="info-panel">
      <p>
        Before THORChain launches Solana support, node operators must select their RPC provider via mimir voting.
        <strong>For network security, no single provider should exceed 25% of the validator set.</strong>
        This page tracks the current distribution and highlights any concentration risks.
      </p>
      <div class="provider-legend">
        <h4>Provider Options:</h4>
        <div class="legend-grid">
          {#each Object.entries(SOL_RPC_PROVIDERS) as [value, provider]}
            <div class="legend-item">
              <span class="legend-color" style="background-color: {provider.color}"></span>
              <span class="legend-name">{value} = {provider.name}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if dataLoaded}
    <!-- Statistics Cards -->
    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-header">
          <h3>Active Nodes</h3>
        </div>
        <p class="stat-value">{activeNodes.length}</p>
      </div>

      <div class="stat-box">
        <div class="stat-header">
          <h3>Voted</h3>
        </div>
        <p class="stat-value">{voteStats.votedCount}</p>
        <p class="stat-sub">{voteStats.votedPercentage}%</p>
      </div>

      <div class="stat-box">
        <div class="stat-header">
          <h3>Not Voted</h3>
        </div>
        <p class="stat-value">{voteStats.notVotedCount}</p>
        <p class="stat-sub">{voteStats.notVotedPercentage}%</p>
      </div>

      {#if !hasEnoughVotes}
        <div class="stat-box pending-box">
          <div class="stat-header">
            <h3>Status</h3>
          </div>
          <p class="stat-value pending-value">⏳ Waiting</p>
          <p class="stat-sub pending-sub">{votesRemaining} more vote{votesRemaining !== 1 ? 's' : ''} needed</p>
        </div>
      {:else if hasWarning}
        <div class="stat-box warning-box">
          <div class="stat-header">
            <h3>⚠️ Warning</h3>
          </div>
          <p class="stat-value warning-value">
            {warnings.map(w => w.name).join(', ')}
          </p>
          <p class="stat-sub warning-sub">&gt;25% concentration</p>
        </div>
      {:else}
        <div class="stat-box success-box">
          <div class="stat-header">
            <h3>Status</h3>
          </div>
          <p class="stat-value success-value">✓ Diverse</p>
          <p class="stat-sub">No provider &gt;25%</p>
        </div>
      {/if}
    </div>

    <!-- Chart -->
    <div class="chart-section">
      <div class="section-header">
        <h3>Provider Distribution</h3>
      </div>
      <div class="chart-container">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    </div>

    <!-- Provider Breakdown Table -->
    <div class="table-section">
      <div class="section-header">
        <h3>Provider Breakdown</h3>
      </div>
      <div class="table-scroll">
      <table class="provider-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Active Nodes</th>
            <th>Percentage</th>
            <th>Standby</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedProviders as provider}
            <tr class:warning-row={provider.percentage > WARNING_THRESHOLD * 100 && provider.name !== 'Not Voted'}>
              <td>
                <span class="provider-badge" style="background-color: {provider.color}">
                  {provider.name}
                </span>
              </td>
              <td>{provider.count}</td>
              <td>
                <div class="percentage-cell">
                  <div class="mini-bar-container">
                    <div
                      class="mini-bar"
                      style="width: {provider.percentage}%; background-color: {provider.color}"
                    ></div>
                  </div>
                  <span>{provider.percentage.toFixed(1)}%</span>
                </div>
              </td>
              <td>
                {#if provider.name === 'Not Voted'}
                  +{standbyDistribution['notVoted']?.count || 0}
                {:else}
                  +{standbyDistribution[provider.value]?.count || 0}
                {/if}
              </td>
              <td>
                {#if provider.name === 'Not Voted'}
                  <span class="status-badge neutral">-</span>
                {:else if provider.percentage > WARNING_THRESHOLD * 100}
                  <span class="status-badge danger">⚠️ &gt;25%</span>
                {:else}
                  <span class="status-badge success">✓</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </div>

    <!-- Active Nodes Table -->
    <div class="table-section">
      <div class="section-header">
        <h3>Active Nodes ({filteredActiveNodes.length}{searchTerm ? ` of ${activeNodes.length}` : ''})</h3>
      </div>
      <div class="search-container">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Search by node address, operator, or provider..."
          class="search-input"
        />
        {#if searchTerm}
          <button class="clear-btn" on:click={clearSearch} title="Clear search">×</button>
        {/if}
      </div>
      <div class="table-scroll">
        <table class="nodes-table">
          <thead>
            <tr>
              <th>Node Address</th>
              <th>Operator</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredActiveNodes as node, i}
              {@const vote = mimirVotes.get(node.node_address)}
              {@const providerInfo = activeDistribution[vote] || activeDistribution['notVoted']}
              {@const operatorColor = getOperatorBgColor(node.node_operator_address, activeOperatorColors)}
              <tr
                class:warning-row={providerInfo.percentage > WARNING_THRESHOLD * 100 && vote !== undefined}
                style={operatorColor ? `background-color: ${operatorColor}22;` : ''}
              >
                <td class="address-cell">
                  <span class="address">{getAddressSuffix(node.node_address, 4)}</span>
                </td>
                <td class="address-cell">
                  <span
                    class="address"
                    style={operatorColor ? `background-color: ${operatorColor}40;` : ''}
                  >
                    {getAddressSuffix(node.node_operator_address || '', 4)}
                  </span>
                </td>
                <td>
                  <span
                    class="provider-badge small"
                    style="background-color: {getProviderColor(vote)}"
                  >
                    {getProviderName(vote)}
                  </span>
                </td>
              </tr>
            {/each}
            {#if filteredActiveNodes.length === 0 && searchTerm}
              <tr>
                <td colspan="3" class="no-results">No nodes match your search</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Eligible Standby Nodes -->
    {#if eligibleStandbyNodes.length > 0 && (!searchTerm || filteredStandbyNodes.length > 0)}
      <div class="table-section">
        <div class="section-header">
          <h3>Eligible Standby Nodes ({filteredStandbyNodes.length}{searchTerm ? ` of ${eligibleStandbyNodes.length}` : ''})</h3>
          <p class="section-sub">Nodes with bond ≥ {minimumBondInRune.toLocaleString()} RUNE</p>
        </div>
        <div class="table-scroll">
          <table class="nodes-table">
            <thead>
              <tr>
                <th>Node Address</th>
                <th>Operator</th>
                <th>Bond</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredStandbyNodes as node, i}
                {@const vote = mimirVotes.get(node.node_address)}
                {@const totalBond = fromBaseUnit(node.total_bond || 0)}
                {@const operatorColor = getOperatorBgColor(node.node_operator_address, standbyOperatorColors)}
                <tr style={operatorColor ? `background-color: ${operatorColor}22;` : ''}>
                  <td class="address-cell">
                    <span class="address">{getAddressSuffix(node.node_address, 4)}</span>
                  </td>
                  <td class="address-cell">
                    <span
                      class="address"
                      style={operatorColor ? `background-color: ${operatorColor}40;` : ''}
                    >
                      {getAddressSuffix(node.node_operator_address || '', 4)}
                    </span>
                  </td>
                  <td>{totalBond.toLocaleString(undefined, { maximumFractionDigits: 0 })} ᚱ</td>
                  <td>
                    <span
                      class="provider-badge small"
                      style="background-color: {getProviderColor(vote)}"
                    >
                      {getProviderName(vote)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {:else}
    <div class="loading">
      <div class="loading-bar"></div>
      <p>Loading provider data...</p>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
  }

  .app-header {
    background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 30px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }

  .app-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: shimmer 5s infinite;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .header-icon {
    width: 40px;
    height: 40px;
    position: relative;
    z-index: 1;
  }

  .app-header h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #FFFFFF;
    background: transparent;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    z-index: 1;
  }

  .info-icon {
    position: absolute;
    right: 20px;
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    transition: opacity 0.2s;
    z-index: 1;
  }

  .info-icon:hover {
    opacity: 1;
  }

  .info-panel {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    color: #888;
    line-height: 1.5;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .info-panel strong {
    color: #e74c3c;
  }

  .provider-legend {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #3a3a3a;
  }

  .provider-legend h4 {
    margin: 0 0 10px 0;
    color: #a0a0a0;
    font-size: 14px;
  }

  .legend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .legend-name {
    font-size: 13px;
    color: #c0c0c0;
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-box {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    height: 120px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stat-box:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .stat-header h3 {
    color: #a0a0a0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
    position: absolute;
    top: 16px;
    left: 16px;
  }

  .stat-value {
    color: #ffffff;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.3px;
    margin: 0;
    position: absolute;
    top: 45%;
    left: 16px;
    transform: translateY(-50%);
  }

  .stat-sub {
    color: #a0a0a0;
    font-size: 14px;
    margin: 0;
    position: absolute;
    bottom: 16px;
    left: 16px;
  }

  .warning-box {
    border-color: rgba(231, 76, 60, 0.6);
  }

  .warning-value {
    color: #e74c3c;
    font-size: 18px;
  }

  .warning-sub {
    color: #e74c3c;
  }

  .success-box {
    border-color: rgba(46, 204, 113, 0.6);
  }

  .success-value {
    color: #2ecc71;
  }

  .pending-box {
    border-color: rgba(241, 196, 15, 0.6);
  }

  .pending-value {
    color: #f1c40f;
    font-size: 20px;
  }

  .pending-sub {
    color: #f1c40f;
  }

  .chart-section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .section-header {
    margin-bottom: 16px;
  }

  .section-header h3 {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .section-sub {
    color: #a0a0a0;
    font-size: 13px;
    margin: 4px 0 0 0;
  }

  .chart-container {
    height: 300px;
    position: relative;
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .legend-item-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #888;
  }

  .legend-square {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  .legend-square.solid {
    background-color: #3498db;
  }

  .legend-square.ghost {
    background-color: rgba(52, 152, 219, 0.3);
    border: 1px dashed #3498db;
  }

  .table-section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    overflow: hidden;
  }

  .search-container {
    position: relative;
    margin-bottom: 16px;
  }

  .search-input {
    width: 100%;
    padding: 12px 40px 12px 12px;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #9945FF;
    box-shadow: 0 0 0 2px rgba(153, 69, 255, 0.2);
  }

  .search-input::placeholder {
    color: #666;
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #888;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .no-results {
    text-align: center;
    color: #666;
    padding: 24px !important;
    font-style: italic;
  }

  .table-scroll {
    overflow-x: auto;
    width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  .provider-table,
  .nodes-table {
    width: 100%;
    min-width: 500px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .provider-table th,
  .nodes-table th {
    text-align: left;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    color: #a0a0a0;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .provider-table td,
  .nodes-table td {
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: #c0c0c0;
  }

  .provider-table tr:hover,
  .nodes-table tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .warning-row {
    background: rgba(231, 76, 60, 0.1);
  }

  .warning-row:hover {
    background: rgba(231, 76, 60, 0.15);
  }

  .provider-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .provider-badge.small {
    padding: 2px 8px;
    font-size: 12px;
  }

  .percentage-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mini-bar-container {
    width: 80px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .mini-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.success {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }

  .status-badge.danger {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
  }

  .status-badge.neutral {
    background: rgba(149, 165, 166, 0.2);
    color: #95a5a6;
  }

  .status-indicator {
    font-size: 14px;
  }

  .status-indicator.success {
    color: #2ecc71;
  }

  .status-indicator.warning {
    color: #e74c3c;
  }

  .status-indicator.neutral {
    color: #95a5a6;
  }

  .address-cell {
    font-family: monospace;
  }

  .address {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .loading {
    text-align: center;
    padding: 60px 20px;
  }

  .loading-bar {
    width: 200px;
    height: 6px;
    margin: 0 auto 20px;
    background: linear-gradient(90deg, #3a3a3a 25%, #5a5a5a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer-bar 1.5s infinite ease-in-out;
    border-radius: 3px;
  }

  @keyframes shimmer-bar {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .loading p {
    color: #888;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .container {
      padding: 15px;
    }

    .app-header {
      padding: 16px;
      flex-direction: column;
      text-align: center;
    }

    .app-header h2 {
      font-size: 20px;
    }

    .stats-container {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .stat-box {
      height: 100px;
      padding: 12px;
    }

    .stat-value {
      font-size: 20px;
    }

    .chart-container {
      height: 250px;
    }

    .provider-table,
    .nodes-table {
      font-size: 12px;
    }

    .provider-table th,
    .nodes-table th,
    .provider-table td,
    .nodes-table td {
      padding: 8px;
    }
  }

  @media (max-width: 480px) {
    .stats-container {
      grid-template-columns: 1fr;
    }

    .legend-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
