<script>
  import { onMount } from 'svelte';

  let nodes = [];
  let activeNodes = [];
  let standbyNodes = [];
  let expandedRows = new Set();
  let maxChainHeights = {};
  let uniqueChains = new Set();
  let starredNodes = new Set();

  // Load starred nodes from localStorage
  const loadStarredNodes = () => {
    const saved = localStorage.getItem('thorchain-starred-nodes');
    if (saved) {
      starredNodes = new Set(JSON.parse(saved));
    }
  };

  // Save starred nodes to localStorage
  const saveStarredNodes = () => {
    localStorage.setItem('thorchain-starred-nodes', JSON.stringify([...starredNodes]));
  };

  // Toggle star status for a node
  const toggleStar = (nodeAddress) => {
    if (starredNodes.has(nodeAddress)) {
      starredNodes.delete(nodeAddress);
    } else {
      starredNodes.add(nodeAddress);
    }
    starredNodes = starredNodes; // Trigger reactivity
    saveStarredNodes();
  };

  // Sort nodes by star status and bond
  const sortNodesByStarAndBond = (nodes) => {
    return [...nodes].sort((a, b) => {
      // First sort by star status
      const aStarred = starredNodes.has(a.node_address);
      const bStarred = starredNodes.has(b.node_address);
      if (aStarred !== bStarred) {
        return bStarred ? 1 : -1;
      }
      // Then sort by bond amount
      return Number(b.total_bond) - Number(a.total_bond);
    });
  };

  $: sortedChains = [...uniqueChains].sort();

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Format RUNE amount (divide by 1e8)
  const formatRune = (amount) => {
    return formatNumber((Number(amount) / 1e8).toFixed(2));
  };

  // Calculate chain height difference
  const getHeightDiff = (nodeHeight, maxHeight) => {
    if (!nodeHeight) return '?';
    if (nodeHeight === maxHeight) return '✓';
    const diff = nodeHeight - maxHeight;
    // Format negative numbers compactly, limit to 3 digits + minus sign
    if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (absDiff > 999) return '-1k+';
      return diff.toString();
    }
    // Positive differences (shouldn't happen often, but handle just in case)
    if (diff > 999) return '+1k+';
    return '+' + diff.toString();
  };

  // Update max chain heights and unique chains
  const updateChainInfo = (nodes) => {
    maxChainHeights = {};
    uniqueChains = new Set(); // Create new Set instance to trigger reactivity
    
    // Collect all unique chains and their maximum heights
    nodes.forEach(node => {
      (node.observe_chains || []).forEach(chain => {
        uniqueChains.add(chain.chain);
        const currentMax = maxChainHeights[chain.chain] || 0;
        maxChainHeights[chain.chain] = Math.max(currentMax, chain.height);
      });
    });
    
    // Force reactivity update
    uniqueChains = uniqueChains;
    console.log('Unique chains:', [...uniqueChains]);
    console.log('Max chain heights:', maxChainHeights);
  };

  // Get chain height for a specific node and chain
  const getChainHeight = (node, chainName) => {
    const chain = (node.observe_chains || []).find(c => c.chain === chainName);
    return chain ? chain.height : null;
  };

  // Toggle row expansion
  const toggleRow = (nodeAddress) => {
    if (expandedRows.has(nodeAddress)) {
      expandedRows.delete(nodeAddress);
    } else {
      expandedRows.add(nodeAddress);
    }
    expandedRows = expandedRows; // Trigger reactivity
  };

  // Format date from block height (assuming 6 second blocks)
  const formatDate = (blockHeight) => {
    const now = Date.now();
    const timestamp = now - (blockHeight * 6 * 1000);
    return new Date(timestamp).toLocaleDateString();
  };

  // Fetch nodes data
  const fetchNodes = async () => {
    try {
      const response = await fetch('https://thornode.thorchain.liquify.com/thorchain/nodes');
      const data = await response.json();
      console.log('Sample node data:', data[0]?.observe_chains);
      nodes = data;
      updateChainInfo(nodes);
      activeNodes = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Active'));
      standbyNodes = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Standby'));
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  onMount(() => {
    loadStarredNodes();
    fetchNodes();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchNodes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="nodes-container">
  <h2>Active Nodes ({activeNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th title="Total amount of RUNE bonded to this node">Total Bond</th>
          <th title="Current block reward for this node">Current Award</th>
          <th title="Number of bond providers for this node">Providers</th>
          <th title="Node's IP address">IP Address</th>
          <th title="THORNode software version">Version</th>
          <th title="Block height when node became active">Active Since</th>
          <th title="Accumulated penalty points for node misbehavior">Slash Points</th>
          {#each sortedChains as chain}
            <th class="chain-col">
              <div class="chain-title" title="Block height difference for {chain}. ✓ means synced, negative numbers show blocks behind, ? means unknown">
                <img 
                  src={`assets/chains/${chain}.svg`}
                  alt={chain}
                  class="chain-header-icon"
                />
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each activeNodes as node}
          <tr class="main-row">
            <td>
              {#if node.requested_to_leave}
                <span class="status leaving">Leaving</span>
              {:else if node.forced_to_leave}
                <span class="status forced">Forced</span>
              {:else}
                <span class="status active">Active</span>
              {/if}
            </td>
            <td>
              <button class="expand-btn" on:click={() => toggleRow(node.node_address)}>
                {expandedRows.has(node.node_address) ? '▼' : '▶'}
              </button>
              <button 
                class="star-btn" 
                on:click={() => toggleStar(node.node_address)}
                title={starredNodes.has(node.node_address) ? "Unstar node" : "Star node"}
              >
                {#if starredNodes.has(node.node_address)}
                  ★
                {:else}
                  ☆
                {/if}
              </button>
              {node.node_address.slice(-4)}
            </td>
            <td>{formatRune(node.total_bond)} RUNE</td>
            <td>{formatRune(node.current_award)} RUNE</td>
            <td>{node.bond_providers?.providers?.length || 0}</td>
            <td>{node.ip_address}</td>
            <td>{node.version}</td>
            <td>{formatNumber(node.active_block_height)}</td>
            <td>{node.slash_points}</td>
            {#each sortedChains as chain}
              <td class="chain-col">
                <span class="chain-status">
                  {getHeightDiff(getChainHeight(node, chain), maxChainHeights[chain])}
                </span>
              </td>
            {/each}
          </tr>
          {#if expandedRows.has(node.node_address)}
            <tr class="expanded-row">
              <td colspan="{9 + sortedChains.length}">
                <div class="bond-providers">
                  <h4>Bond Details</h4>
                  <div class="bond-summary">
                    <div class="summary-item">
                      <span class="label">Total Bond:</span>
                      <span class="value">{formatRune(node.total_bond)} RUNE</span>
                    </div>
                    <div class="summary-item">
                      <span class="label">Node Operator Fee:</span>
                      <span class="value">{(Number(node.bond_providers.node_operator_fee) / 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <table class="bond-table">
                    <thead>
                      <tr>
                        <th>Provider Address</th>
                        <th>Bond Amount</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each node.bond_providers.providers as provider}
                        <tr>
                          <td class="address">
                            {provider.bond_address}
                            <a href="https://runescan.io/address/{provider.bond_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          </td>
                          <td>{formatRune(provider.bond)} RUNE</td>
                          <td>{((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <h2>Standby Nodes ({standbyNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th title="Total amount of RUNE bonded to this node">Total Bond</th>
          <th title="Number of bond providers for this node">Providers</th>
          <th title="Node's IP address">IP Address</th>
          <th title="THORNode software version">Version</th>
          <th title="Accumulated penalty points for node misbehavior">Slash Points</th>
        </tr>
      </thead>
      <tbody>
        {#each standbyNodes as node}
          <tr>
            <td>
              <span class="status standby">Standby</span>
            </td>
            <td>
              <button class="expand-btn" on:click={() => toggleRow(node.node_address)}>
                {expandedRows.has(node.node_address) ? '▼' : '▶'}
              </button>
              <button 
                class="star-btn" 
                on:click={() => toggleStar(node.node_address)}
                title={starredNodes.has(node.node_address) ? "Unstar node" : "Star node"}
              >
                {#if starredNodes.has(node.node_address)}
                  ★
                {:else}
                  ☆
                {/if}
              </button>
              {node.node_address.slice(-4)}
            </td>
            <td>{formatRune(node.total_bond)} RUNE</td>
            <td>{node.bond_providers?.providers?.length || 0}</td>
            <td>{node.ip_address}</td>
            <td>{node.version}</td>
            <td>{node.slash_points}</td>
          </tr>
          {#if expandedRows.has(node.node_address)}
            <tr class="expanded-row">
              <td colspan="7">
                <div class="bond-providers">
                  <h4>Bond Details</h4>
                  <div class="bond-summary">
                    <div class="summary-item">
                      <span class="label">Total Bond:</span>
                      <span class="value">{formatRune(node.total_bond)} RUNE</span>
                    </div>
                    <div class="summary-item">
                      <span class="label">Node Operator Fee:</span>
                      <span class="value">{(Number(node.bond_providers.node_operator_fee) / 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <table class="bond-table">
                    <thead>
                      <tr>
                        <th>Provider Address</th>
                        <th>Bond Amount</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each node.bond_providers.providers as provider}
                        <tr>
                          <td class="address">
                            {provider.bond_address}
                            <a href="https://runescan.io/address/{provider.bond_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          </td>
                          <td>{formatRune(provider.bond)} RUNE</td>
                          <td>{((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .nodes-container {
    padding: 20px;
    max-width: 100%;
    overflow-x: auto;
  }

  h2 {
    color: #4A90E2;
    margin: 20px 0;
  }

  .table-container {
    margin-bottom: 40px;
    overflow-x: auto;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    border-radius: 12px;
    background-color: #2c2c2c;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  /* Webkit (Chrome, Safari, Edge) scrollbar styling */
  .table-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .table-container::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: #4a4a4a;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #5a5a5a;
  }

  /* Firefox scrollbar styling */
  .table-container {
    scrollbar-width: thin;
    scrollbar-color: #4a4a4a #1a1a1a;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background-color: #2c2c2c;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #3a3a3c;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  /* Add a pseudo-element to create a shadow effect under the sticky header */
  th::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 100%;
    height: 2px;
    background-color: #3a3a3c;
  }

  tbody tr:first-child td {
    padding-top: 12px;
  }

  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #2c2c2c;
  }

  .expand-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 0 8px;
    font-size: 12px;
  }

  .star-btn {
    background: none;
    border: none;
    color: #ffd700;
    cursor: pointer;
    padding: 0 4px;
    font-size: 16px;
    transition: transform 0.2s;
  }

  .star-btn:hover {
    transform: scale(1.2);
  }

  tr:has(.star-btn:has(★)) {
    background-color: rgba(255, 215, 0, 0.05);
  }

  .expanded-row {
    background-color: #2c2c2c;
  }

  .bond-providers {
    padding: 20px;
  }

  .outlink {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    color: #4A90E2;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .outlink:hover {
    opacity: 1;
  }

  .address {
    display: flex;
    align-items: center;
  }

  .bond-summary {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    padding: 15px;
    background-color: #2c2c2c;
    border-radius: 6px;
  }

  .summary-item {
    display: flex;
    gap: 10px;
  }

  .summary-item .label {
    color: #888;
  }

  .summary-item .value {
    color: #4A90E2;
    font-weight: 600;
  }

  .bond-table {
    width: 100%;
    margin-top: 10px;
    background-color: #1a1a1a;
  }

  .bond-table th,
  .bond-table td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #2c2c2c;
  }

  .bond-table th {
    background-color: #2c2c2c;
    color: #ffffff;
    font-weight: 600;
  }

  .bond-table .address {
    font-family: monospace;
    font-size: 14px;
  }

  .status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .status.active {
    background-color: #28a745;
    color: white;
  }

  .status.standby {
    background-color: #ffc107;
    color: black;
  }

  .status.leaving {
    background-color: #dc3545;
    color: white;
  }

  .status.forced {
    background-color: #dc3545;
    color: white;
  }

  .status.ready {
    background-color: #28a745;
    color: white;
  }

  .status.standby {
    background-color: #ffc107;
    color: black;
  }

  .chain-col {
    padding: 2px 1px !important;
    text-align: center !important;
    width: 28px !important;
    min-width: 28px !important;
    max-width: 28px !important;
  }

  .chain-title {
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #ffffff;
    padding: 1px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .chain-header-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .chain-status {
    font-family: monospace;
    font-size: 10px;
    display: inline-block;
    min-width: 20px;
    text-align: center;
    background: rgba(74, 144, 226, 0.1);
    padding: 0px 1px;
    border-radius: 2px;
  }

  @media (max-width: 1200px) {
    .chain-heights {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .provider-list {
      grid-template-columns: 1fr;
    }
  }

  .chain-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .chain-icon {
    font-size: 10px;
  }
</style>
