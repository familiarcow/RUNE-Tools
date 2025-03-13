<script>
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let nodes = [];
  let activeNodes = [];
  let standbyNodes = [];
  let expandedRows = new Set();
  let maxChainHeights = {};
  let uniqueChains = new Set();
  let starredNodes = new Set();
  let lastChurnHeight = 0;
  let currentBlockHeight = 0;
  let isPaused = false;
  let refreshInterval;
  let searchQuery = '';
  let ipInfoMap = new Map(); // Store IP info for reuse

  // Country code to emoji mapping
  const countryToEmoji = {
    'AT': '🇦🇹',
    'AU': '🇦🇺',
    'CA': '🇨🇦',
    'DE': '🇩🇪',
    'FI': '🇫🇮',
    'FR': '🇫🇷',
    'GB': '🇬🇧',
    'IN': '🇮🇳',
    'JP': '🇯🇵',
    'NL': '🇳🇱',
    'PL': '🇵🇱',
    'SG': '🇸🇬',
    'US': '🇺🇸'
  };

  // ISP to logo mapping
  const ispToLogo = {
    // Amazon variants
    'Amazon Technologies Inc.': 'amazon.svg',
    'Amazon.com': 'amazon.svg',
    'Amazon.com, Inc.': 'amazon.svg',
    
    // Microsoft
    'Microsoft Corporation': 'azure.svg',
    
    // Cloud providers
    'RouterHosting LLC': 'cloud.svg',
    'TIMEWARP IT Consulting GmbH': 'cloud.svg',
    'IPAX GmbH': 'cloud.svg',
    'MEVSPACE sp. z o.o': 'cloudzy.png',
    'MEVSPACE sp. z o.o.': 'cloudzy.png',
    
    // Other specific providers
    'Cogent Communications': 'cogent.svg',
    'Comcast Cable Communications, LLC': 'comcast.svg',
    'The Constant Company': 'datacamp.svg',
    'The Constant Company, LLC': 'datacamp.svg',
    'DIGITALOCEAN': 'digitalocean.svg',
    'DigitalOcean, LLC': 'digitalocean.svg',
    'Google LLC': 'google.svg',
    'Hetzner Online GmbH': 'hetzner.svg',
    'HOSTINGER': 'hostinger.svg',
    'Hostinger International Limited': 'hostinger.svg',
    'Level 3 Communications, Inc.': 'ionos.svg',
    'Leaseweb DE': 'leaseweb.png',
    'Leaseweb UK Limited': 'leaseweb.png',
    'Leaseweb USA, Inc.': 'leaseweb.png',
    'OVH SAS': 'ovh.svg',
    'Online S.A.S.': 'ovh.svg',
    'Zenlayer Inc': 'vultr.svg',
    'Choopa': 'vultr.svg',
    'Aussie Broadband': 'cloud.svg'
  };

  // Add sort state
  let sortField = 'total_bond';
  let sortDirection = 'desc';

  // Add tweened stores for animated values
  const tweenedBondedRune = tweened(0, {
    duration: 1000,
    easing: cubicOut
  });

  const tweenedPooledRune = tweened(0, {
    duration: 1000,
    easing: cubicOut
  });

  const tweenedCurrentAward = tweened(0, {
    duration: 1000,
    easing: cubicOut
  });

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

  // Fetch IP information for nodes in batches of 100 - only called once
  const fetchIpInfo = async (nodes) => {
    const batchSize = 100;
    const batches = [];
    
    // Get only IPs we haven't fetched before
    const newIps = nodes
      .filter(node => !ipInfoMap.has(node.ip_address))
      .map(node => node.ip_address);
    
    if (newIps.length === 0) return;
    
    // Split nodes into batches of 100
    for (let i = 0; i < newIps.length; i += batchSize) {
      const batch = newIps.slice(i, i + batchSize)
        .map(ip => ({ query: ip }));
      batches.push(batch);
    }

    // Track unique ISPs and countries
    const uniqueIsps = new Set();
    const uniqueCountries = new Set();

    // Process each batch
    for (const batch of batches) {
      try {
        const response = await fetch('http://ip-api.com/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch)
        });

        if (!response.ok) {
          console.error('Failed to fetch IP info:', response.statusText);
          continue;
        }

        const data = await response.json();
        
        // Store results in the map
        data.forEach((result, index) => {
          if (result.status === 'success') {
            const ip = batch[index].query;
            ipInfoMap.set(ip, {
              isp: result.isp,
              countryCode: result.countryCode
            });
            uniqueIsps.add(result.isp);
            uniqueCountries.add(result.countryCode);
          }
        });
      } catch (error) {
        console.error('Error fetching IP info:', error);
      }
    }

    // Log unique ISPs and countries
    console.log('Unique ISPs:', [...uniqueIsps].sort());
    console.log('Unique Country Codes:', [...uniqueCountries].sort());

    // Log ISP mapping template
    console.log(`
// ISP to image mapping template:
const ispToImage = {
  ${[...uniqueIsps].sort().map(isp => `'${isp}': 'assets/isps/${isp.toLowerCase().replace(/[^a-z0-9]/g, '-')}.svg'`).join(',\n  ')}
};
    `);
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
        return aStarred ? -1 : 1; // Changed from bStarred to aStarred to put starred nodes at top
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

  // Calculate APY for a node
  const calculateAPY = (node) => {
    if (!lastChurnHeight) return null;
    
    const currentTime = Date.now() / 1000;
    const timeDiff = currentTime - lastChurnHeight;
    const timeDiffInYears = timeDiff / (60 * 60 * 24 * 365.25);
    
    if (timeDiffInYears <= 0) return null;
    
    const currentAward = Number(node.current_award);
    const totalBond = Number(node.total_bond);
    
    if (totalBond <= 0) return null;
    
    const APR = currentAward / totalBond / timeDiffInYears;
    return (1 + APR / 365) ** 365 - 1;
  };

  // Sort function for nodes
  const sortNodes = (nodes, field, direction) => {
    return [...nodes].sort((a, b) => {
      let comparison = 0;
      
      switch (field) {
        case 'total_bond':
          comparison = Number(b[field]) - Number(a[field]);
          break;
        case 'current_award':
          comparison = Number(b[field]) - Number(a[field]);
          break;
        case 'operator':
          comparison = a.node_operator_address.localeCompare(b.node_operator_address);
          break;
        case 'isp':
          comparison = (a.isp || '').localeCompare(b.isp || '');
          break;
        case 'country':
          comparison = (a.countryCode || '').localeCompare(b.countryCode || '');
          break;
        case 'apy':
          const aAPY = calculateAPY(a) || 0;
          const bAPY = calculateAPY(b) || 0;
          comparison = bAPY - aAPY;
          break;
        case 'version':
          comparison = a.version.localeCompare(b.version, undefined, { numeric: true });
          break;
        case 'active_since':
          comparison = Number(b.active_block_height) - Number(a.active_block_height);
          break;
        case 'slash':
          comparison = Number(b.slash_points) - Number(a.slash_points);
          break;
        default:
          return 0;
      }
      
      return direction === 'asc' ? -comparison : comparison;
    });
  };

  // Handle sort click
  const handleSort = (field) => {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'desc';
    }
    
    activeNodes = sortNodes(activeNodes, sortField, sortDirection);
    standbyNodes = sortNodes(standbyNodes, sortField, sortDirection);
  };

  // Filter nodes based on search query
  const filterNodes = (nodes, query) => {
    if (!query) return nodes;
    
    const searchTerm = query.toLowerCase().trim();
    return nodes.filter(node => {
      // Check node address
      if (node.node_address.toLowerCase().includes(searchTerm)) return true;
      
      // Check operator address
      if (node.node_operator_address.toLowerCase().includes(searchTerm)) return true;
      
      // Check bond providers
      if (node.bond_providers?.providers?.some(provider => 
        provider.bond_address.toLowerCase().includes(searchTerm)
      )) return true;

      // Check signer membership (vault membership)
      if (node.signer_membership?.some(signer => 
        signer.toLowerCase().includes(searchTerm)
      )) return true;

      return false;
    });
  };

  // Reactive statements for filtered nodes
  $: filteredActiveNodes = filterNodes(activeNodes, searchQuery);
  $: filteredStandbyNodes = filterNodes(standbyNodes, searchQuery);

  // Update fetchNodes to use the stored IP info
  const fetchNodes = async () => {
    if (isPaused) return;
    
    try {
      const [nodesResponse, churnsResponse] = await Promise.all([
        fetch('https://thornode.thorchain.liquify.com/thorchain/nodes'),
        fetch('https://midgard.ninerealms.com/v2/churns')
      ]);

      const [nodesData, churnsData] = await Promise.all([
        nodesResponse.json(),
        churnsResponse.json()
      ]);

      nodes = nodesData;
      lastChurnHeight = Number(churnsData[0].date) / 1e9;

      // Apply stored IP info to nodes
      nodes.forEach(node => {
        const ipInfo = ipInfoMap.get(node.ip_address);
        if (ipInfo) {
          node.isp = ipInfo.isp;
          node.countryCode = ipInfo.countryCode;
        }
      });

      updateChainInfo(nodes);
      
      // First sort by star status and bond
      const activeNodesList = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Active'));
      const standbyNodesList = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Standby'));

      // Then apply any active sort if not the initial load
      if (sortField !== 'total_bond' || sortDirection !== 'desc') {
        activeNodes = sortNodes(activeNodesList, sortField, sortDirection);
        standbyNodes = sortNodes(standbyNodesList, sortField, sortDirection);
      } else {
        activeNodes = activeNodesList;
        standbyNodes = standbyNodesList;
      }

      // Update filtered nodes
      filteredActiveNodes = filterNodes(activeNodes, searchQuery);
      filteredStandbyNodes = filterNodes(standbyNodes, searchQuery);

      // Mark updated nodes with ALL changed fields
      filteredActiveNodes.forEach(node => {
        const oldNode = activeNodes.find(n => n.node_address === node.node_address);
        if (oldNode) {
          node.hasUpdates = {};
          // Track all numeric and status changes
          if (oldNode.total_bond !== node.total_bond) node.hasUpdates.bond = true;
          if (oldNode.current_award !== node.current_award) node.hasUpdates.award = true;
          if (oldNode.slash_points !== node.slash_points) node.hasUpdates.slash = true;
          if (oldNode.version !== node.version) node.hasUpdates.version = true;
          if (oldNode.status !== node.status) node.hasUpdates.status = true;
          if (oldNode.active_block_height !== node.active_block_height) node.hasUpdates.active_since = true;
          
          // Track chain height changes
          node.hasUpdates.chains = {};
          (node.observe_chains || []).forEach(chain => {
            const oldChain = (oldNode.observe_chains || []).find(c => c.chain === chain.chain);
            if (!oldChain || oldChain.height !== chain.height) {
              node.hasUpdates.chains[chain.chain] = true;
            }
          });

          // Track APY changes
          const oldAPY = calculateAPY(oldNode);
          const newAPY = calculateAPY(node);
          if (oldAPY !== newAPY) node.hasUpdates.apy = true;
        }
      });

      // Clear updates after a delay
      const clearUpdates = () => {
        filteredActiveNodes = filteredActiveNodes.map(node => ({
          ...node,
          hasUpdates: undefined
        }));
      };

      setTimeout(clearUpdates, 1000);

    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const togglePause = () => {
    isPaused = !isPaused;
    if (!isPaused) {
      // Immediately fetch when unpausing
      fetchNodes();
      // Reset the interval
      clearInterval(refreshInterval);
      refreshInterval = setInterval(fetchNodes, 6000);
    }
  };

  onMount(() => {
    loadStarredNodes();
    // First fetch nodes and then get IP info
    fetchNodes().then(() => fetchIpInfo(nodes));
    // Refresh data every 6 seconds (without IP info)
    refreshInterval = setInterval(fetchNodes, 6000);
    return () => clearInterval(refreshInterval);
  });

  // Determine leave status for a node
  const getLeaveStatus = (node, allNodes) => {
    // Check for requested_to_leave first
    if (node.requested_to_leave) {
      return { type: 'leaving', description: 'Node has requested to leave' };
    }

    // Find oldest active node
    const oldestNode = allNodes
      .filter(n => n.status === 'Active')
      .reduce((oldest, current) => 
        Number(current.active_block_height) < Number(oldest.active_block_height) ? current : oldest
      );
    
    if (node.node_address === oldestNode.node_address) {
      return { type: 'oldest', description: 'Oldest active node by block height' };
    }

    // Find worst performing node (most slash points)
    const worstNode = allNodes
      .filter(n => n.status === 'Active')
      .reduce((worst, current) => 
        Number(current.slash_points) > Number(worst.slash_points) ? current : worst
      );
    
    if (node.node_address === worstNode.node_address) {
      return { type: 'worst', description: 'Highest slash points' };
    }

    // Find lowest bond node
    const lowestBondNode = allNodes
      .filter(n => n.status === 'Active')
      .reduce((lowest, current) => 
        Number(current.total_bond) < Number(lowest.total_bond) ? current : lowest
      );
    
    if (node.node_address === lowestBondNode.node_address) {
      return { type: 'lowest', description: 'Lowest total bond' };
    }

    return null;
  };
</script>

<div class="nodes-container">
  <div class="header-controls">
    <div class="search-container">
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search by address, operator, bond provider, or vault membership..."
        class="search-input"
      />
      {#if searchQuery}
        <button 
          class="clear-search" 
          on:click={() => searchQuery = ''}
          title="Clear search"
        >
          ×
        </button>
      {/if}
    </div>
    <button class="pause-button" on:click={togglePause} title={isPaused ? "Resume Updates" : "Pause Updates"}>
      {#if isPaused}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      {/if}
    </button>
  </div>
  <h2>Active Nodes ({filteredActiveNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th 
            class="sortable" 
            title="Node operator's THORChain address (showing last 4 characters)"
            on:click={() => handleSort('operator')}
          >
            Operator
            {#if sortField === 'operator'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Internet Service Provider"
            on:click={() => handleSort('isp')}
          >
            ISP
            {#if sortField === 'isp'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Node Country"
            on:click={() => handleSort('country')}
          >
            Country
            {#if sortField === 'country'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Total amount of RUNE bonded to this node"
            on:click={() => handleSort('total_bond')}
          >
            Total Bond
            {#if sortField === 'total_bond'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Current block reward for this node"
            on:click={() => handleSort('current_award')}
          >
            Current Award
            {#if sortField === 'current_award'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Estimated Annual Percentage Yield based on current rewards"
            on:click={() => handleSort('apy')}
          >
            APY
            {#if sortField === 'apy'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="THORNode software version"
            on:click={() => handleSort('version')}
          >
            Version
            {#if sortField === 'version'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Block height when node became active"
            on:click={() => handleSort('active_since')}
          >
            Active Since
            {#if sortField === 'active_since'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Accumulated penalty points for node misbehavior"
            on:click={() => handleSort('slash')}
          >
            Slash Points
            {#if sortField === 'slash'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
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
        {#each filteredActiveNodes as node}
          <tr class="main-row" 
            class:row-leaving={node.requested_to_leave || node.forced_to_leave}
            class:row-oldest={getLeaveStatus(node, nodes)?.type === 'oldest'}
            class:row-worst={getLeaveStatus(node, nodes)?.type === 'worst'}
            class:row-lowest={getLeaveStatus(node, nodes)?.type === 'lowest'}
            class:row-starred={starredNodes.has(node.node_address)}
          >
            <td>
              <div class="status-container">
                {#if node.requested_to_leave}
                  <span class="status-circle leaving" title="Node is Leaving"></span>
                {:else if node.forced_to_leave}
                  <span class="status-circle forced" title="Node is Forced to Leave"></span>
                {:else}
                  <span class="status-circle active" title="Active Node"></span>
                {/if}
                {#if getLeaveStatus(node, nodes)}
                  {@const status = getLeaveStatus(node, nodes)}
                  <div class="leave-status" title={status.description}>
                    {#if status.type === 'oldest'}
                      <span class="leave-emoji">🪦</span>
                    {:else if status.type === 'lowest'}
                      <span class="leave-emoji">💸</span>
                    {:else if status.type === 'worst'}
                      <span class="leave-emoji">😾</span>
                    {:else if status.type === 'leaving'}
                      <span class="leave-emoji">🧳</span>
                    {/if}
                  </div>
                {/if}
              </div>
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
              <span class="providers-count" title="Number of bond providers">
                {node.bond_providers?.providers?.length || 0}
              </span>
            </td>
            <td class="monospace">{node.node_operator_address.slice(-4)}
              <a href="https://runescan.io/address/{node.node_operator_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </td>
            {#if node.isp}
              <td>
                <span class="isp">
                  {#if ispToLogo[node.isp]}
                    <img 
                      src={`assets/isp/${ispToLogo[node.isp]}`} 
                      alt={node.isp}
                      class="isp-logo"
                      title={node.isp}
                    />
                  {:else}
                    {node.isp}
                  {/if}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">Loading...</span>
              </td>
            {/if}
            {#if node.countryCode}
              <td>
                <span class="country-code" title={node.countryCode}>
                  {countryToEmoji[node.countryCode] || node.countryCode}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">Loading...</span>
              </td>
            {/if}
            <td class:cell-update={node.hasUpdates?.bond}>
              <span class="rune-amount" class:value-update={node.hasUpdates?.bond}>
                {formatRune(node.total_bond)}
                <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
              </span>
            </td>
            <td class:cell-update={node.hasUpdates?.award}>
              <span class="rune-amount" class:value-update={node.hasUpdates?.award}>
                {formatRune(node.current_award)}
                <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
              </span>
            </td>
            <td>
              {#if calculateAPY(node) !== null}
                <span class="apy-value">
                  {(calculateAPY(node) * 100).toFixed(2)}%
                </span>
              {:else}
                <span class="apy-value">-</span>
              {/if}
            </td>
            <td>{node.version}</td>
            <td>{formatNumber(node.active_block_height)}</td>
            <td class:cell-update={node.hasUpdates?.slash}>
              <span class="value-transition" class:value-update={node.hasUpdates?.slash}>
                {node.slash_points}
              </span>
            </td>
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
                  <div class="bond-header">
                    <h4>Bond Details</h4>
                    <div class="bond-header-separator"></div>
                  </div>
                  <div class="bond-content">
                    <div class="bond-summary">
                      <div class="summary-item">
                        <span class="label">IP Address:</span>
                        <span class="value monospace">{node.ip_address}</span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Total Bond:</span>
                        <span class="value rune-amount">
                          {formatRune(node.total_bond)}
                          <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator Fee:</span>
                        <span class="value">{(Number(node.bond_providers.node_operator_fee) / 100).toFixed(2)}%</span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Status Since:</span>
                        <span class="value">
                          <span class="block-number">{formatNumber(node.status_since)}</span>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator:</span>
                        <span class="value address">
                          {node.node_operator_address}
                          <a href="https://runescan.io/address/{node.node_operator_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Vault Membership:</span>
                        <span class="value signer-list">
                          {#each node.signer_membership as signer}
                            <span class="signer-pill">{signer.slice(-4)}</span>
                          {/each}
                        </span>
                      </div>
                    </div>
                    <div class="bond-table-container">
                      <div class="table-header">Bond Providers</div>
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
                                <div class="action-buttons">
                                  <a href="http://rune.tools/bond?node_address={node.node_address}&bond_address={provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="track-rewards-btn"
                                    title="Track bond rewards">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M12 2v20M2 12h20"/>
                                    </svg>
                                    Track Rewards
                                  </a>
                                  <a href="https://viewblock.io/thorchain/address/{provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="viewblock-btn"
                                    title="View in Viewblock">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                      <polyline points="15 3 21 3 21 9"/>
                                      <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                  </a>
                                </div>
                              </td>
                              <td>
                                <span class="rune-amount">
                                  {formatRune(provider.bond)}
                                  <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                                </span>
                              </td>
                              <td>{((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <h2>Standby Nodes ({filteredStandbyNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th 
            class="sortable" 
            title="Node operator's THORChain address (showing last 4 characters)"
            on:click={() => handleSort('operator')}
          >
            Operator
            {#if sortField === 'operator'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Internet Service Provider"
            on:click={() => handleSort('isp')}
          >
            ISP
            {#if sortField === 'isp'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Node Country"
            on:click={() => handleSort('country')}
          >
            Country
            {#if sortField === 'country'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Total amount of RUNE bonded to this node"
            on:click={() => handleSort('total_bond')}
          >
            Total Bond
            {#if sortField === 'total_bond'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="THORNode software version"
            on:click={() => handleSort('version')}
          >
            Version
            {#if sortField === 'version'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Accumulated penalty points for node misbehavior"
            on:click={() => handleSort('slash')}
          >
            Slash Points
            {#if sortField === 'slash'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each filteredStandbyNodes as node}
          <tr class="main-row"
            class:row-starred={starredNodes.has(node.node_address)}
          >
            <td>
              <div class="status-container">
                <span class="status-circle standby" title="Standby Node"></span>
              </div>
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
              <span class="providers-count" title="Number of bond providers">
                {node.bond_providers?.providers?.length || 0}
              </span>
            </td>
            <td class="monospace">{node.node_operator_address.slice(-4)}
              <a href="https://runescan.io/address/{node.node_operator_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </td>
            {#if node.isp}
              <td>
                <span class="isp">
                  {#if ispToLogo[node.isp]}
                    <img 
                      src={`assets/isp/${ispToLogo[node.isp]}`} 
                      alt={node.isp}
                      class="isp-logo"
                      title={node.isp}
                    />
                  {:else}
                    {node.isp}
                  {/if}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">Loading...</span>
              </td>
            {/if}
            {#if node.countryCode}
              <td>
                <span class="country-code" title={node.countryCode}>
                  {countryToEmoji[node.countryCode] || node.countryCode}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">Loading...</span>
              </td>
            {/if}
            <td>
              <span class="rune-amount">
                {formatRune(node.total_bond)}
                <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
              </span>
            </td>
            <td>{node.version}</td>
            <td>{node.slash_points}</td>
          </tr>
          {#if expandedRows.has(node.node_address)}
            <tr class="expanded-row">
              <td colspan="7">
                <div class="bond-providers">
                  <div class="bond-header">
                    <h4>Bond Details</h4>
                    <div class="bond-header-separator"></div>
                  </div>
                  <div class="bond-content">
                    <div class="bond-summary">
                      <div class="summary-item">
                        <span class="label">Total Bond:</span>
                        <span class="value rune-amount">
                          {formatRune(node.total_bond)}
                          <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator Fee:</span>
                        <span class="value">{(Number(node.bond_providers.node_operator_fee) / 100).toFixed(2)}%</span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Status Since:</span>
                        <span class="value">
                          <span class="block-number">{formatNumber(node.status_since)}</span>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator:</span>
                        <span class="value address">
                          {node.node_operator_address}
                          <a href="https://runescan.io/address/{node.node_operator_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Signer Membership:</span>
                        <span class="value signer-list">
                          {#each node.signer_membership as signer}
                            <span class="signer-pill">{signer.slice(-4)}</span>
                          {/each}
                        </span>
                      </div>
                    </div>
                    <div class="bond-table-container">
                      <div class="table-header">Bond Providers</div>
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
                                <div class="action-buttons">
                                  <a href="http://rune.tools/bond?node_address={node.node_address}&bond_address={provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="track-rewards-btn"
                                    title="Track bond rewards">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M12 2v20M2 12h20"/>
                                    </svg>
                                    Track Rewards
                                  </a>
                                  <a href="https://viewblock.io/thorchain/address/{provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="viewblock-btn"
                                    title="View in Viewblock">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                      <polyline points="15 3 21 3 21 9"/>
                                      <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                  </a>
                                </div>
                              </td>
                              <td>
                                <span class="rune-amount">
                                  {formatRune(provider.bond)}
                                  <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                                </span>
                              </td>
                              <td>{((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
    padding: 16px 64px;
    max-width: 100%;
    overflow-x: hidden;
    width: 100%;
  }

  /* Add styles for ISP info */
  .isp-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-height: 24px;
  }

  .isp {
    display: flex;
    align-items: center;
  }

  .isp-logo {
    height: 16px;
    width: auto;
    max-width: 80px;
    object-fit: contain;
    vertical-align: middle;
  }

  .country-code {
    color: #4A90E2;
    font-weight: 500;
    font-size: 16px;
    line-height: 1;
    display: flex;
    justify-content: center;
  }

  .loading {
    color: #666;
    font-style: italic;
    font-size: 0.875rem;
  }

  h2 {
    color: #4A90E2;
    margin: 16px 0 12px;
    font-size: 1.25rem;
  }

  .table-container {
    margin-bottom: 32px;
    overflow-x: auto;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    border-radius: 8px;
    background-color: #2c2c2c;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    padding: 0 1px;
    width: 100%;
    min-width: 100%;
  }

  .table-container::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .table-container::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 3px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: #4a4a4a;
    border-radius: 3px;
    transition: background 0.2s;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #5a5a5a;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background-color: #2c2c2c;
    font-size: 0.875rem;
    line-height: 1.4;
    table-layout: fixed;
    min-width: max-content;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 500;
    padding: 8px 8px;
    text-align: left;
    border-bottom: 1px solid #3a3a3c;
    font-size: 0.8125rem;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  th::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -1px;
    width: 100%;
    height: 1px;
    background-color: #3a3a3c;
  }

  td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid #2c2c2c;
    vertical-align: middle;
  }

  /* Alternating row colors */
  tr.main-row:nth-child(4n + 1):not(.row-leaving, .row-oldest, .row-worst, .row-lowest, .row-starred),
  tr.main-row:nth-child(4n + 2):not(.row-leaving, .row-oldest, .row-worst, .row-lowest, .row-starred) {
    background-color: rgba(255, 255, 255, 0.01);
  }

  .main-row:not(.row-leaving, .row-oldest, .row-worst, .row-lowest, .row-starred):hover {
    background-color: rgba(74, 144, 226, 0.05) !important;
  }

  /* Column width controls */
  th:nth-child(1), td:nth-child(1) { width: 50px; min-width: 50px; max-width: 50px; }  /* Status */
  th:nth-child(2), td:nth-child(2) { width: auto; min-width: 105px; }  /* Address */
  th:nth-child(3), td:nth-child(3) { width: auto; min-width: 95px; }   /* Operator */
  th:nth-child(4), td:nth-child(4) { width: 50px; min-width: 50px; max-width: 50px; }  /* ISP */
  th:nth-child(5), td:nth-child(5) { width: 50px; min-width: 50px; max-width: 50px; }  /* Country */
  th:nth-child(6), td:nth-child(6) { width: auto; min-width: 95px; }   /* Total Bond */
  th:nth-child(7), td:nth-child(7) { width: auto; min-width: 95px; }   /* Current Award */
  th:nth-child(8), td:nth-child(8) { width: auto; min-width: 70px; }   /* APY */
  th:nth-child(9), td:nth-child(9) { width: 60px; min-width: 60px; max-width: 60px; }  /* Version */
  th:nth-child(10), td:nth-child(10) { width: auto; min-width: 95px; } /* Active Since */
  th:nth-child(11), td:nth-child(11) { width: auto; min-width: 65px; } /* Slash Points */

  /* Remove any old column width controls if they exist */
  td { width: auto; }

  .expanded-row {
    background-color: #262626 !important;
  }

  .expanded-row td {
    padding: 0;
  }

  .bond-providers {
    padding: 16px;
    background: #262626;
    border: 1px solid #333;
    border-radius: 8px;
    margin: 8px;
  }

  .bond-header {
    margin-bottom: 20px;
  }

  .bond-header h4 {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0 0 8px 0;
  }

  .bond-header-separator {
    height: 2px;
    background: linear-gradient(90deg, #4A90E2 0%, rgba(74, 144, 226, 0.1) 100%);
    border-radius: 1px;
  }

  .bond-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .bond-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 16px;
    background-color: #2a2a2a;
    border-radius: 8px;
    border: 1px solid #333;
  }

  .summary-item {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 250px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .summary-item:hover {
    background-color: rgba(74, 144, 226, 0.05);
  }

  .summary-item .label {
    color: #999;
    font-size: 0.8125rem;
    font-weight: 500;
    min-width: 120px;
  }

  .summary-item .value {
    color: #fff;
    font-weight: 500;
  }

  .bond-table-container {
    background-color: #2a2a2a;
    border-radius: 8px;
    border: 1px solid #333;
    overflow: hidden;
  }

  .table-header {
    padding: 12px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    color: #fff;
    background-color: #303030;
    border-bottom: 1px solid #333;
  }

  .bond-table {
    width: 100%;
    margin: 0;
    background-color: transparent;
  }

  .bond-table th {
    background-color: #303030;
    color: #999;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .bond-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #2c2c2c;
  }

  .bond-table tr:last-child td {
    border-bottom: none;
  }

  .bond-table tr:hover {
    background-color: rgba(74, 144, 226, 0.05);
  }

  .signer-pill {
    background-color: #303030;
    color: #4A90E2;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    border: 1px solid rgba(74, 144, 226, 0.2);
  }

  .block-number {
    color: #4A90E2;
  }

  .summary-item .address {
    color: #4A90E2;
  }

  .expand-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 0 4px;
    font-size: 10px;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .expand-btn:hover {
    opacity: 1;
  }

  .star-btn {
    background: none;
    border: none;
    color: #ffd700;
    cursor: pointer;
    padding: 0 2px;
    font-size: 14px;
    transition: transform 0.15s;
  }

  .star-btn:hover {
    transform: scale(1.15);
  }

  tr:has(.star-btn:has(★)) {
    background-color: rgba(255, 215, 0, 0.03);
  }

  .outlink {
    display: inline-flex;
    align-items: center;
    margin-left: 6px;
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
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    gap: 8px;
  }

  .leave-status {
    display: flex;
    align-items: center;
  }

  .leave-emoji {
    font-size: 14px;
    margin-left: 4px;
  }

  .providers-count {
    display: inline-block;
    background-color: rgba(74, 144, 226, 0.2);
    color: #4A90E2;
    font-size: 0.6875rem;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 6px;
    font-weight: 500;
    min-width: 14px;
    text-align: center;
  }

  .apy-value {
    color: #2ecc71;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 16px;
  }

  .search-container {
    position: relative;
    flex-grow: 1;
    max-width: 600px;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    border-radius: 6px;
    border: 1px solid #3a3a3c;
    background-color: #1a1a1a;
    color: #fff;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .search-input::placeholder {
    color: #666;
  }

  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #666;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  }

  .clear-search:hover {
    color: #fff;
  }

  .pause-button {
    background-color: #4A90E2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .pause-button:hover {
    background-color: #357ABD;
  }

  .cell-update {
    animation: cell-flash 1s ease-out;
  }

  @keyframes cell-flash {
    0% {
      background-color: rgba(74, 144, 226, 0.3);
    }
    100% {
      background-color: transparent;
    }
  }

  .value-transition {
    transition: color 0.3s ease;
  }

  .value-update {
    color: #4A90E2;
  }

  td {
    transition: background-color 0.3s ease;
  }

  .main-row:hover {
    background-color: rgba(74, 144, 226, 0.05) !important;
    transition: background-color 0.3s ease;
  }

  .rune-amount {
    transition: all 0.3s ease;
  }

  .chain-status {
    transition: all 0.3s ease;
  }

  .status {
    transition: all 0.3s ease;
  }

  .apy-value {
    transition: all 0.3s ease;
  }

  .signer-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .signer-pill {
    background-color: rgba(74, 144, 226, 0.15);
    color: #4A90E2;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  }

  .block-number {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .date-separator {
    margin: 0 4px;
    color: #666;
  }

  .block-date {
    color: #888;
    font-size: 0.8125rem;
  }

  .chain-col {
    padding: 2px !important;
    text-align: center !important;
    width: 24px !important;
    min-width: 24px !important;
    max-width: 24px !important;
  }

  .chain-title {
    font-size: 9px;
    font-weight: 500;
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
    width: 14px;
    height: 14px;
    object-fit: contain;
  }

  .chain-status {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 9px;
    display: inline-block;
    min-width: 18px;
    text-align: center;
    background: rgba(74, 144, 226, 0.08);
    padding: 0px 1px;
    border-radius: 2px;
    color: #4A90E2;
  }

  .rune-amount {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .rune-icon {
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .value .rune-icon {
    width: 14px;
    height: 14px;
  }

  .status-container {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .leave-status {
    display: flex;
    align-items: center;
  }

  .leave-emoji {
    font-size: 14px;
    margin-left: 4px;
  }

  .providers-count {
    display: inline-block;
    background-color: rgba(74, 144, 226, 0.2);
    color: #4A90E2;
    font-size: 0.6875rem;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 6px;
    font-weight: 500;
    min-width: 14px;
    text-align: center;
  }

  .apy-value {
    color: #2ecc71;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 16px;
  }

  .search-container {
    position: relative;
    flex-grow: 1;
    max-width: 600px;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    border-radius: 6px;
    border: 1px solid #3a3a3c;
    background-color: #1a1a1a;
    color: #fff;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .search-input::placeholder {
    color: #666;
  }

  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #666;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  }

  .clear-search:hover {
    color: #fff;
  }

  .pause-button {
    background-color: #4A90E2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .pause-button:hover {
    background-color: #357ABD;
  }

  .cell-update {
    animation: cell-flash 1s ease-out;
  }

  @keyframes cell-flash {
    0% {
      background-color: rgba(74, 144, 226, 0.3);
    }
    100% {
      background-color: transparent;
    }
  }

  .value-transition {
    transition: color 0.3s ease;
  }

  .value-update {
    color: #4A90E2;
  }

  td {
    transition: background-color 0.3s ease;
  }

  .main-row:hover {
    background-color: rgba(74, 144, 226, 0.05) !important;
    transition: background-color 0.3s ease;
  }

  .rune-amount {
    transition: all 0.3s ease;
  }

  .chain-status {
    transition: all 0.3s ease;
  }

  .status {
    transition: all 0.3s ease;
  }

  .apy-value {
    transition: all 0.3s ease;
  }

  .signer-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .signer-pill {
    background-color: rgba(74, 144, 226, 0.15);
    color: #4A90E2;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  }

  .block-number {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .date-separator {
    margin: 0 4px;
    color: #666;
  }

  .block-date {
    color: #888;
    font-size: 0.8125rem;
  }

  .status-circle {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .status-circle.active {
    background-color: #2ecc71;
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.4);
  }

  .status-circle.standby {
    background-color: #ffd700;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  }

  .status-circle.leaving {
    background-color: #ff6b6b;
    box-shadow: 0 0 8px rgba(255, 107, 107, 0.4);
  }

  .status-circle.forced {
    background-color: #e74c3c;
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.4);
  }

  .status-container {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Status-based row highlighting */
  .row-starred {
    background-color: rgba(255, 140, 0, 0.1) !important;
  }

  .row-starred:hover {
    background-color: rgba(255, 140, 0, 0.15) !important;
  }

  .row-leaving {
    background-color: rgba(255, 107, 107, 0.1) !important;
  }

  .row-leaving:hover {
    background-color: rgba(255, 107, 107, 0.15) !important;
  }

  .row-oldest {
    background-color: rgba(255, 215, 0, 0.1) !important;
  }

  .row-oldest:hover {
    background-color: rgba(255, 215, 0, 0.15) !important;
  }

  .row-worst {
    background-color: rgba(231, 76, 60, 0.1) !important;
  }

  .row-worst:hover {
    background-color: rgba(231, 76, 60, 0.15) !important;
  }

  .row-lowest {
    background-color: rgba(241, 196, 15, 0.1) !important;
  }

  .row-lowest:hover {
    background-color: rgba(241, 196, 15, 0.15) !important;
  }

  .monospace {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
    position: relative;
    padding-right: 20px !important;
  }

  .sortable:hover {
    background-color: #222;
  }

  .sort-indicator {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    color: #4A90E2;
    font-size: 12px;
  }

  .sortable:hover .sort-indicator {
    opacity: 0.8;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    margin-left: 8px;
    align-items: center;
  }

  .track-rewards-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid #4A90E2;
    border-radius: 4px;
    color: #4A90E2;
    font-size: 0.75rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s ease;
    background: rgba(74, 144, 226, 0.1);
  }

  .track-rewards-btn:hover {
    background: rgba(74, 144, 226, 0.2);
    border-color: #5a9ee8;
  }

  .viewblock-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    color: #666;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .viewblock-btn:hover {
    color: #4A90E2;
    background: rgba(74, 144, 226, 0.1);
  }
</style>
