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

  // Modify fetchNodes to track all value changes
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

      updateChainInfo(nodes);
      
      // Update active and standby nodes with data-update attributes
      const newActiveNodes = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Active'));
      const newStandbyNodes = sortNodesByStarAndBond(nodes.filter(node => node.status === 'Standby'));

      // Mark updated nodes with ALL changed fields
      newActiveNodes.forEach(node => {
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
        activeNodes = activeNodes.map(node => ({
          ...node,
          hasUpdates: undefined
        }));
      };

      activeNodes = newActiveNodes;
      standbyNodes = newStandbyNodes;

      // Schedule cleanup of update markers
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
    fetchNodes();
    // Refresh data every 6 seconds
    refreshInterval = setInterval(fetchNodes, 6000);
    return () => clearInterval(refreshInterval);
  });

  // Component for displaying RUNE amount with icon
  const RuneAmount = ({ amount }) => `
    <span class="rune-amount">
      ${amount}
      <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
    </span>
  `;

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
  <h2>Active Nodes ({activeNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th title="Node's IP address">IP Address</th>
          <th title="Total amount of RUNE bonded to this node">Total Bond</th>
          <th title="Current block reward for this node">Current Award</th>
          <th title="Estimated Annual Percentage Yield based on current rewards">APY</th>
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
          <tr class="main-row" 
            class:row-leaving={node.requested_to_leave || node.forced_to_leave}
            class:row-oldest={getLeaveStatus(node, nodes)?.type === 'oldest'}
            class:row-worst={getLeaveStatus(node, nodes)?.type === 'worst'}
            class:row-lowest={getLeaveStatus(node, nodes)?.type === 'lowest'}
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
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="leave-icon oldest">
                        <path d="M10,2.5c0-1.381,1.119-2.5,2.5-2.5s2.5,1.119,2.5,2.5-1.119,2.5-2.5,2.5-2.5-1.119-2.5-2.5Zm10,11.5v9c0,.552-.448,1-1,1s-1-.448-1-1V14.599c-1.368-.779-2.816-1.941-4.017-3.196-.063,1.363-.041,3.026-.015,4.879l.021,1.681c.008,.809-.301,1.571-.87,2.146-.32,.323-.704,.555-1.118,.704v2.187c0,.552-.448,1-1,1s-1-.448-1-1v-2h-2v2c0,.552-.448,1-1,1s-1-.448-1-1v-2.188c-.427-.154-.819-.394-1.144-.732-.573-.597-.871-1.382-.837-2.212,.307-7.653,2.608-11.868,6.481-11.868,1.73-.109,2.959,1.409,3.808,2.709,1.264,1.707,3.377,3.515,5.14,4.396,.339,.169,.553,.553,.553,.895Zm-8.311-5.465c-.304-.346-.728-.535-1.189-.535-3.789,0-4.389,7.615-4.483,9.948-.034,.557,.44,1.064,1,1.052h3.971c.541,.012,1.019-.476,1-1.016l-.021-1.675c-.036-2.675-.065-4.789,.129-6.452,.056-.485-.092-.966-.407-1.322Z"/>
                      </svg>
                    {:else if status.type === 'lowest'}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="leave-icon lowest">
                        <path d="m24.008,19.906l-3.603,3.517c-.384.384-.893.577-1.402.577-.513,0-1.026-.195-1.417-.586l-3.567-3.567,1.414-1.414,2.567,2.567V0h2v21.024l2.611-2.549,1.396,1.432ZM12.409,7.006c.372.457.591.962.591,1.494v12c0,2.298-3.27,3.5-6.5,3.5s-6.5-1.202-6.5-3.5v-12c0-.532.219-1.038.591-1.494-.055-.328-.091-.662-.091-1.006C.5,2.686,3.186,0,6.5,0s6,2.686,6,6c0,.344-.035.678-.091,1.006ZM3.205,4.374c0,1.033.734,1.929,1.747,2.131l2.791.559c.268.054.462.291.462.563,0,.316-.258.574-.574.574h-2.126c-.316,0-.585-.211-.671-.5h-1.62c.102,1.175,1.09,2.1,2.291,2.1h.2v1.2h1.6v-1.2h.326c1.199,0,2.174-.975,2.174-2.173,0-1.033-.734-1.929-1.747-2.131l-2.792-.559c-.267-.054-.461-.291-.461-.562,0-.316.257-.574.573-.574h2.127c.316,0,.585.211.671.5h1.62c-.102-1.175-1.09-2.1-2.291-2.1h-.2v-1.2h-1.6v1.2h-.327c-1.198,0-2.173.975-2.173,2.173Zm7.795,16.126v-1.409c-1.226.601-2.867.909-4.5.909s-3.274-.308-4.5-.909v1.409c0,.436,1.577,1.5,4.5,1.5s4.5-1.064,4.5-1.5Zm0-4v-1.409c-1.226.601-2.867.909-4.5.909s-3.274-.308-4.5-.909v1.409c0,.436,1.577,1.5,4.5,1.5s4.5-1.064,4.5-1.5Zm0-4v-1.409c-1.226.601-2.867.909-4.5.909s-3.274-.308-4.5-.909v1.409c0,.436,1.577,1.5,4.5,1.5s4.5-1.064,4.5-1.5Z"/>
                      </svg>
                    {:else if status.type === 'worst'}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="leave-icon worst">
                        <path d="M22.834,6.874l1.149-5.689c.069-.367-.072-.741-.366-.972-.293-.231-.692-.278-1.03-.123l-4.033,1.87c-1.886-1.235-4.135-1.96-6.554-1.96S7.333,.725,5.446,1.96L1.414,.09C1.076-.065,.677-.019,.383,.089,.089,.443-.052,.817,.017,1.185L1.166,6.873c-.74,1.557-1.166,3.291-1.166,5.127,0,6.617,5.383,12,12,12s12-5.383,12-12c0-1.836-.426-3.569-1.166-5.126Zm-10.834,15.126c-5.514,0-10-4.486-10-10S6.486,2,12,2s10,4.486,10,10-4.486,10-10,10Zm5.666-5.746c.412,.368,.448,1,.08,1.412-.197,.222-.471,.334-.746,.334-.237,0-.475-.084-.666-.254-.018-.016-2.003-1.746-4.334-1.746s-4.316,1.73-4.336,1.747c-.412,.367-1.044,.33-1.411-.084-.366-.412-.331-1.042,.081-1.409,.103-.092,2.559-2.254,5.666-2.254s5.563,2.162,5.666,2.254Zm1.133-8.855c.332,.44,.244,1.068-.197,1.4l-1.675,1.262c.043,.14,.073,.285,.073,.439,0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5c0-.466,.217-.878,.551-1.153,0,0,0-.001,.002-.002l2.846-2.145c.442-.333,1.068-.244,1.4,.197Zm-11.726,2.662l-1.675-1.262c-.441-.332-.529-.96-.197-1.4,.333-.441,.958-.529,1.4-.197l2.846,2.145s0,.001,.002,.002c.334,.275,.551,.686,.551,1.153,0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5c0-.154,.03-.3,.073-.439Z"/>
                      </svg>
                    {:else if status.type === 'leaving'}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="leave-icon leaving">
                        <path d="M21.99,10.01v8.99c0,2.76-2.24,5-5,5H7s0,0,0,0c-1.33,0-2.59-.52-3.54-1.46-.94-.94-1.46-2.2-1.46-3.54V10c0-2.76,2.24-5,5-5,0,0,1.87,0,4,0V15.43l-3.31-3.15c-.4-.38-1.03-.37-1.41,.03-.38,.4-.37,1.03,.04,1.41l3.57,3.4c.59,.59,1.36,.88,2.13,.88s1.52-.29,2.1-.86l3.59-3.41c.4-.38,.42-1.01,.04-1.41-.38-.4-1.01-.42-1.41-.03l-3.31,3.15V5c2.12,0,3.99,0,4,0,1.33,0,2.59,.52,3.53,1.46,.95,.94,1.47,2.2,1.47,3.54ZM13,1c0-.55-.45-1-1-1s-1,.45-1,1V5c.66,0,1.34,0,2,0V1Z"/>
                      </svg>
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
            <td>{node.ip_address}</td>
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
                                <a href="https://runescan.io/address/{provider.bond_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                  </svg>
                                </a>
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

  <h2>Standby Nodes ({standbyNodes.length})</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Current status of the node">Status</th>
          <th title="Node's unique THORChain address (showing last 4 characters)">Address</th>
          <th title="Node's IP address">IP Address</th>
          <th title="Total amount of RUNE bonded to this node">Total Bond</th>
          <th title="THORNode software version">Version</th>
          <th title="Accumulated penalty points for node misbehavior">Slash Points</th>
        </tr>
      </thead>
      <tbody>
        {#each standbyNodes as node}
          <tr>
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
            <td>{node.ip_address}</td>
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
                                <a href="https://runescan.io/address/{provider.bond_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                  </svg>
                                </a>
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
    padding: 16px 32px;
    max-width: 100%;
    overflow-x: auto;
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
    max-width: 1600px;
    margin: 0 auto;
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
  tr.main-row:nth-child(4n + 1):not(.row-leaving, .row-oldest, .row-worst, .row-lowest),
  tr.main-row:nth-child(4n + 2):not(.row-leaving, .row-oldest, .row-worst, .row-lowest) {
    background-color: rgba(255, 255, 255, 0.01);
  }

  .main-row:not(.row-leaving, .row-oldest, .row-worst, .row-lowest):hover {
    background-color: rgba(74, 144, 226, 0.05) !important;
  }

  /* Adjust specific column widths */
  td:nth-child(1) { width: auto; min-width: 75px; }  /* Status */
  td:nth-child(2) { width: auto; min-width: 105px; } /* Address */
  td:nth-child(3) { width: auto; min-width: 95px; } /* Total Bond */
  td:nth-child(4) { width: auto; min-width: 95px; } /* Current Award */
  td:nth-child(5) { width: auto; min-width: 70px; } /* APY */
  td:nth-child(6) { width: auto; min-width: 95px; max-width: 130px; } /* IP Address */
  td:nth-child(7) { width: auto; min-width: 65px; } /* Version */
  td:nth-child(8) { width: auto; min-width: 95px; } /* Active Since */
  td:nth-child(9) { width: auto; min-width: 65px; } /* Slash Points */

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
  }

  .leave-status {
    display: flex;
    align-items: center;
  }

  .leave-icon {
    width: 14px;
    height: 14px;
    margin-left: 4px;
  }

  .leave-icon.oldest,
  .leave-icon.lowest {
    fill: #ffd700;
  }

  .leave-icon.worst,
  .leave-icon.leaving {
    fill: #ff6b6b;
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
    justify-content: flex-end;
    margin-bottom: 16px;
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

  .leave-icon {
    width: 14px;
    height: 14px;
    margin-left: 4px;
  }

  .leave-icon.oldest,
  .leave-icon.lowest {
    fill: #ffd700;
  }

  .leave-icon.worst,
  .leave-icon.leaving {
    fill: #ff6b6b;
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
    justify-content: flex-end;
    margin-bottom: 16px;
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
</style>
