<script>
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import ipInfoData from '../../public/ip-info.json';

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
  let isLoading = false;
  let isLoadingIpInfo = false;
  let refreshInterval;
  let searchQuery = '';
  let ipInfoMap = new Map(); // Store IP info for reuse
  let useApiFallback = false; // Flag to control API usage
  let newNodesPerChurn = 4; // Default value
  let minimumBondInRune = 3000000; // Default value 300k RUNE
  let nodesLeavingCount = 0;
  let baseUrl = window.location.origin;

  // Add new state variables for churn countdown
  let nextChurnTime = 0;
  let countdown = "";
  let churnInterval = 0;
  let recentChurnTimestamp = 0;

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
    if (isLoadingIpInfo) return; // Prevent multiple concurrent fetches
    
    const batchSize = 100;
    const batches = [];
    
    // Get only IPs we haven't fetched before
    const newIps = nodes
      .filter(node => !ipInfoMap.has(node.ip_address))
      .map(node => node.ip_address);
    
    if (newIps.length === 0) return;
    
    isLoadingIpInfo = true;

    // First try to get info from the JSON file
    newIps.forEach(ip => {
      const ipInfo = ipInfoData[ip];
      if (ipInfo) {
        ipInfoMap.set(ip, ipInfo);
        
        // Update any nodes with this IP immediately
        nodes = nodes.map(node => {
          if (node.ip_address === ip) {
            return { ...node, ...ipInfo };
          }
          return node;
        });
        
        // Update active and standby nodes immediately
        activeNodes = activeNodes.map(node => {
          if (node.ip_address === ip) {
            return { ...node, ...ipInfo };
          }
          return node;
        });
        
        standbyNodes = standbyNodes.map(node => {
          if (node.ip_address === ip) {
            return { ...node, ...ipInfo };
          }
          return node;
        });
      }
    });

    // If we're using API fallback or have missing IPs, fetch from API
    if (useApiFallback) {
      // Split remaining IPs into batches of 100
      const remainingIps = newIps.filter(ip => !ipInfoMap.has(ip));
      if (remainingIps.length > 0) {
        for (let i = 0; i < remainingIps.length; i += batchSize) {
          const batch = remainingIps.slice(i, i + batchSize)
            .map(ip => ({ query: ip }));
          batches.push(batch);
        }

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
            
            // Log the data in the format we need for the JSON file
            const ipInfoForJson = {};
            data.forEach((result, index) => {
              if (result.status === 'success') {
                const ip = batch[index].query;
                ipInfoForJson[ip] = {
                  isp: result.isp,
                  countryCode: result.countryCode
                };
              }
            });
            console.log('IP Info for JSON:', JSON.stringify(ipInfoForJson, null, 2));
            
            // Store results in the map and update nodes immediately
            data.forEach((result, index) => {
              if (result.status === 'success') {
                const ip = batch[index].query;
                const ipInfo = {
                  isp: result.isp,
                  countryCode: result.countryCode
                };
                ipInfoMap.set(ip, ipInfo);
                
                // Update any nodes with this IP immediately
                nodes = nodes.map(node => {
                  if (node.ip_address === ip) {
                    return { ...node, ...ipInfo };
                  }
                  return node;
                });
                
                // Update active and standby nodes immediately
                activeNodes = activeNodes.map(node => {
                  if (node.ip_address === ip) {
                    return { ...node, ...ipInfo };
                  }
                  return node;
                });
                
                standbyNodes = standbyNodes.map(node => {
                  if (node.ip_address === ip) {
                    return { ...node, ...ipInfo };
                  }
                  return node;
                });
              }
            });
          } catch (error) {
            console.error('Error fetching IP info:', error);
          }
        }
      }
    }
    
    // Force UI updates
    nodes = [...nodes];
    activeNodes = [...activeNodes];
    standbyNodes = [...standbyNodes];
    isLoadingIpInfo = false;
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
        case 'status':
          // Count extra status indicators for each node
          const getStatusCount = (node) => {
            let count = 0;
            if (node.requested_to_leave || node.forced_to_leave) count++;
            const status = getLeaveStatus(node, nodes);
            if (status?.type === 'oldest') count++;
            if (status?.type === 'worst') count++;
            if (status?.type === 'lowest') count++;
            if (node.jail && node.jail.release_height > currentBlockHeight) count++;
            return count;
          };
          const aCount = getStatusCount(a);
          const bCount = getStatusCount(b);
          comparison = bCount - aCount;
          break;
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
          comparison = Number(a.active_block_height) - Number(b.active_block_height);
          break;
        case 'slash':
          comparison = Number(b.slash_points) - Number(a.slash_points);
          break;
        case 'vault':
          // Get last vault membership or empty string for sorting
          const aVault = a.signer_membership?.length > 0 ? a.signer_membership[a.signer_membership.length - 1] : '';
          const bVault = b.signer_membership?.length > 0 ? b.signer_membership[b.signer_membership.length - 1] : '';
          // Sort empty values to the end
          if (!aVault && bVault) return 1;
          if (aVault && !bVault) return -1;
          if (!aVault && !bVault) return 0;
          // Compare vault IDs
          comparison = aVault.localeCompare(bVault);
          break;
        default:
          return 0;
      }
      
      return direction === 'asc' ? comparison : -comparison;
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

  // API endpoints with fallback
  const API_ENDPOINTS = {
    primary: 'https://thornode.thorchain.liquify.com',
    fallback: 'https://thornode.ninerealms.com'
  };

  // Fetch data from API with automatic fallback
  const fetchWithFallback = async (endpoint, options = {}) => {
    const primaryUrl = `${API_ENDPOINTS.primary}${endpoint}`;
    const fallbackUrl = `${API_ENDPOINTS.fallback}${endpoint}`;
    
    try {
      // Try primary endpoint first
      const response = await fetch(primaryUrl, options);
      if (response.ok) {
        return response;
      }
      throw new Error(`Primary endpoint failed: ${response.status}`);
    } catch (error) {
      console.warn(`Primary endpoint failed, trying fallback: ${error.message}`);
      
      try {
        // Try fallback endpoint
        const fallbackResponse = await fetch(fallbackUrl, options);
        if (fallbackResponse.ok) {
          console.log(`Using fallback endpoint for: ${endpoint}`);
          return fallbackResponse;
        }
        throw new Error(`Fallback endpoint failed: ${fallbackResponse.status}`);
      } catch (fallbackError) {
        console.error(`Both endpoints failed for ${endpoint}:`, fallbackError);
        throw fallbackError;
      }
    }
  };

  // Add function to fetch latest block height
  const fetchLatestBlock = async () => {
    try {
      const response = await fetchWithFallback('/thorchain/lastblock');
      const data = await response.json();
      const thorchainBlock = data.find(item => item.chain === 'AVAX')?.thorchain || 0;
      currentBlockHeight = thorchainBlock;
    } catch (error) {
      console.error('Error fetching latest block:', error);
    }
  };

  // Update fetchNodes to include block height fetch
  const fetchNodes = async () => {
    if (isPaused) return;
    
    try {
      isLoading = true;
      const [nodesResponse, churnsResponse] = await Promise.all([
        fetchWithFallback('/thorchain/nodes'),
        fetch('https://midgard.ninerealms.com/v2/churns'),
        fetchLatestBlock(),
        fetchMimirValues()
      ]);

      const [nodesData, churnsData] = await Promise.all([
        nodesResponse.json(),
        churnsResponse.json()
      ]);

      nodes = nodesData;
      lastChurnHeight = Number(churnsData[0].date) / 1e9;
      recentChurnTimestamp = lastChurnHeight;
      updateNextChurnTime();

      // Apply any stored IP info immediately
      nodes.forEach(node => {
        const ipInfo = ipInfoMap.get(node.ip_address);
        if (ipInfo) {
          node.isp = ipInfo.isp;
          node.countryCode = ipInfo.countryCode;
        }
      });

      updateChainInfo(nodes);
      
      // Calculate nodes that will be churned out
      const activeNodesList = nodes.filter(node => node.status === 'Active');
      nodesLeavingCount = calculateNodesLeaving(activeNodesList);
      
      // Get standby nodes and mark those likely to join
      const standbyNodesList = nodes
        .filter(node => node.status === 'Standby')
        .sort((a, b) => Number(b.total_bond) - Number(a.total_bond))
        .map((node, index) => ({
          ...node,
          likelyToJoin: isLikelyToJoin(node, index)
        }));

      // First sort by star status and bond
      activeNodes = sortNodesByStarAndBond(activeNodesList);
      standbyNodes = sortNodesByStarAndBond(standbyNodesList);

      // Then apply any active sort if not the initial load
      if (sortField !== 'total_bond' || sortDirection !== 'desc') {
        activeNodes = sortNodes(activeNodes, sortField, sortDirection);
        standbyNodes = sortNodes(standbyNodes, sortField, sortDirection);
      }
      
      isLoading = false;
    } catch (error) {
      console.error('Error fetching nodes:', error);
      isLoading = false;
    }
  };

  const togglePause = () => {
    isPaused = !isPaused;
    if (!isPaused && !isLoading) { // Only unpause if not currently loading
      // Immediately fetch when unpausing
      fetchNodes();
      // Reset the interval
      clearInterval(refreshInterval);
      refreshInterval = setInterval(fetchNodes, 6000);
    }
  };

  onMount(async () => {
    // Load starred nodes from localStorage
    loadStarredNodes();
    
    // Load IP info from JSON file
    ipInfoMap = new Map(Object.entries(ipInfoData));

    // Start fetching data
    await fetchNodes();
    refreshInterval = setInterval(fetchNodes, 6000);

    // Add interval to update countdown every minute
    const countdownInterval = setInterval(updateCountdown, 60000);

    // Cleanup function
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
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

  // Add copyToClipboard function
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here in the future
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Add vault color mapping
  let vaultColorMap = new Map();
  const colors = [
    'rgba(74, 144, 226, 0.2)',   // Blue
    'rgba(46, 204, 113, 0.2)',   // Green
    'rgba(155, 89, 182, 0.2)',   // Purple
    'rgba(241, 196, 15, 0.2)',   // Yellow
    'rgba(231, 76, 60, 0.2)',    // Red
    'rgba(52, 152, 219, 0.2)',   // Light Blue
    'rgba(230, 126, 34, 0.2)',   // Orange
    'rgba(26, 188, 156, 0.2)',   // Turquoise
  ];
  let nextColorIndex = 0;

  // Function to get consistent color for a vault
  const getVaultColor = (vaultId) => {
    if (!vaultId) return 'transparent';
    if (!vaultColorMap.has(vaultId)) {
      vaultColorMap.set(vaultId, colors[nextColorIndex % colors.length]);
      nextColorIndex++;
    }
    return vaultColorMap.get(vaultId);
  };

  // Add function to fetch mimir values
  const fetchMimirValues = async () => {
    try {
      const [newNodesResponse, minBondResponse, churnIntervalResponse] = await Promise.all([
        fetchWithFallback('/thorchain/mimir/key/NUMBEROFNEWNODESPERCHURN'),
        fetchWithFallback('/thorchain/mimir/key/MinimumBondInRune'),
        fetchWithFallback('/thorchain/mimir/key/CHURNINTERVAL')
      ]);
      
      if (newNodesResponse.ok) {
        const newNodesValue = await newNodesResponse.text();
        newNodesPerChurn = Number(newNodesValue) || 4;
      }
      
      if (minBondResponse.ok) {
        const minBondValue = await minBondResponse.text();
        minimumBondInRune = Number(minBondValue) / 1e8;
      }

      if (churnIntervalResponse.ok) {
        const churnIntervalValue = await churnIntervalResponse.text();
        churnInterval = Number(churnIntervalValue);
        updateNextChurnTime();
      }
    } catch (error) {
      console.error('Error fetching mimir values:', error);
    }
  };

  const updateNextChurnTime = () => {
    if (churnInterval && recentChurnTimestamp) {
      const churnIntervalSeconds = churnInterval * 6;
      nextChurnTime = recentChurnTimestamp + churnIntervalSeconds;
      updateCountdown();
    }
  };

  const updateCountdown = () => {
    const now = Date.now() / 1000;
    const secondsLeft = nextChurnTime - now;
    if (secondsLeft <= 0) {
      countdown = "Churning...";
    } else {
      const days = Math.floor(secondsLeft / (3600 * 24));
      const hours = Math.floor((secondsLeft % (3600 * 24)) / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      countdown = `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m`;
    }
  };

  // Function to calculate nodes that will be churned out
  const calculateNodesLeaving = (nodes) => {
    return nodes.filter(node => 
      node.requested_to_leave || 
      node.forced_to_leave ||
      getLeaveStatus(node, nodes)?.type === 'oldest' ||
      getLeaveStatus(node, nodes)?.type === 'worst' ||
      getLeaveStatus(node, nodes)?.type === 'lowest'
    ).length;
  };

  // Function to determine if a standby node is likely to join
  const isLikelyToJoin = (node) => {
    // First check if node has valid preflight status
    if (!node.preflight_status || node.preflight_status.code !== 0) {
      return false;
    }

    // Get all eligible nodes sorted by bond
    const eligibleNodes = standbyNodes
      .filter(n => n.preflight_status && n.preflight_status.code === 0)
      .sort((a, b) => Number(b.total_bond) - Number(a.total_bond));
    
    // Find index of current node in eligible nodes
    const nodeIndex = eligibleNodes.findIndex(n => n.node_address === node.node_address);
    
    // Check if node is within the available spots
    return nodeIndex < (nodesLeavingCount + newNodesPerChurn);
  };

  $: eligibleStandbyNodes = standbyNodes.filter(node => 
    node.preflight_status && 
    node.preflight_status.code === 0
  ).length;
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
    <div class="controls-right">
      <div class="block-height-display" title="Current THORChain block height">
        <img src="assets/chains/THOR.svg" alt="THOR" class="chain-header-icon" />
        <span class="block-number">{formatNumber(currentBlockHeight)}</span>
      </div>
      <div class="churn-countdown-display" title="Time until next churn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="countdown">{countdown}</span>
      </div>
      <div class="active-nodes-display" title="Number of Active Nodes">
        <span class="active-count">{filteredActiveNodes.length}</span>
        <span class="active-label">Active</span>
      </div>
      <div class="eligible-nodes-display" title="Number of Eligible Nodes">
        <span class="eligible-count">{eligibleStandbyNodes}</span>
        <span class="eligible-label">Eligible</span>
      </div>
      <div class="total-bond-display" title="Total Bond of Active Nodes">
        <span class="bond-amount">{formatNumber((activeNodes.reduce((sum, node) => sum + Number(node.total_bond), 0) / 1e8).toFixed(0))}</span>
        <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
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
  </div>
    <h2>Active Nodes</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Node number">#</th>
          <th title="Star node to track it">★</th>
          <th title="Current status of the node" 
            class="sortable"
            on:click={() => handleSort('status')}
          >
            Status
            {#if sortField === 'status'}
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
            🏳️
            {#if sortField === 'country'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
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
            title="Age of the node in days"
            on:click={() => handleSort('active_since')}
          >
            Age
            {#if sortField === 'active_since'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Accumulated penalty points for node misbehavior"
            on:click={() => handleSort('slash')}
          >
            Slash
            {#if sortField === 'slash'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
          <th 
            class="sortable" 
            title="Current vault the node is a signer for (last 4 digits)"
            on:click={() => handleSort('vault')}
          >
            Vault
            {#if sortField === 'vault'}
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
        {#each filteredActiveNodes as node, i}
          <tr class="main-row" 
            class:row-leaving={node.requested_to_leave || node.forced_to_leave}
            class:row-oldest={getLeaveStatus(node, nodes)?.type === 'oldest'}
            class:row-worst={getLeaveStatus(node, nodes)?.type === 'worst'}
            class:row-lowest={getLeaveStatus(node, nodes)?.type === 'lowest'}
            class:row-jailed={getLeaveStatus(node, nodes)?.type === 'jailed'}
            class:row-starred={starredNodes.has(node.node_address)}
          >
            <td class="number-cell">{i + 1}</td>
            <td>
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
            </td>
            <td>
              <div class="status-container">
                <div class="status-indicators">
                  <span 
                    class:status-circle-ready={node.preflight_status?.code === 0}
                    class:status-circle-version={node.preflight_status?.reason?.startsWith('node account does not meet min version requirement')}
                    class:status-circle-bond={node.preflight_status?.reason?.startsWith('node account does not have minimum bond requirement')}
                    class:status-circle-other={node.preflight_status?.code !== 0 && 
                      !node.preflight_status?.reason?.startsWith('node account does not meet min version requirement') &&
                      !node.preflight_status?.reason?.startsWith('node account does not have minimum bond requirement')}
                    class="status-circle"
                    title={node.preflight_status ? 
                      `Status: ${node.preflight_status.status}
Code: ${node.preflight_status.code}${node.preflight_status.reason ? `
Reason: ${node.preflight_status.reason}` : ''}` : 
                      "No preflight status available"}
                  ></span>
                  {#if node.requested_to_leave}
                    <span class="leave-emoji" title="Node has requested to leave">🧳</span>
                  {/if}
                  {#if node.forced_to_leave}
                    <span class="leave-emoji" title="Node is forced to leave">🧳</span>
                  {/if}
                  {#key node}
                  {#if true}
                    {@const status = getLeaveStatus(node, nodes)}
                    {#if status?.type === 'oldest'}
                      <span class="leave-emoji" title="Oldest active node by block height">🪦</span>
                    {/if}
                    {#if status?.type === 'worst'}
                      <span class="leave-emoji" title="Highest slash points">😾</span>
                    {/if}
                    {#if status?.type === 'lowest'}
                      <span class="leave-emoji" title="Lowest total bond">💸</span>
                    {/if}
                  {/if}
                  {/key}
                  {#if node.jail && node.jail.release_height > currentBlockHeight}
                    <span class="leave-emoji" title={`Jailed: ${node.jail.reason}`}>👮</span>
                  {/if}
                </div>
              </div>
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
                      loading="lazy"
                    />
                  {:else}
                    {node.isp}
                  {/if}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">
                  {#if isLoadingIpInfo}Loading...{:else}?{/if}
                </span>
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
                <span class="loading">
                  {#if isLoadingIpInfo}Loading...{:else}?{/if}
                </span>
              </td>
            {/if}
            <td>{node.node_address.slice(-4)}
              <span class="providers-count" title="Number of bond providers">
                {(node.bond_providers?.providers || []).length}
              </span>
              <button 
                class="expand-btn" 
                on:click={() => toggleRow(node.node_address)}
                title={expandedRows.has(node.node_address) ? "Hide details" : "Show details"}
              >
                {expandedRows.has(node.node_address) ? '▼' : '▶'}
              </button>
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
            <td>{((currentBlockHeight - node.active_block_height) / 14400).toFixed(1)}</td>
            <td class:cell-update={node.hasUpdates?.slash}>
              <span class="value-transition" class:value-update={node.hasUpdates?.slash}>
                {node.slash_points}
              </span>
            </td>
            <td class="monospace">
              {#if node.signer_membership?.length > 0}
                <span class="vault-id" style="background-color: {getVaultColor(node.signer_membership[node.signer_membership.length - 1])}">
                  {node.signer_membership[node.signer_membership.length - 1].slice(-4)}
                </span>
              {:else}
                -
              {/if}
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
              <td colspan="{10 + sortedChains.length}">
                <div class="bond-providers">
                  <div class="bond-header">
                    <h4>Node Details - {node.node_address.slice(-4)}</h4>
                    <div class="bond-header-separator"></div>
                  </div>
                  <div class="bond-content">
                    <div class="bond-summary">
                      <div class="summary-item">
                        <span class="label">IP Address:</span>
                        <span class="value monospace">
                          <span class="inline-value">{node.ip_address}</span>
                          <button 
                            class="copy-btn" 
                            title="Copy IP address"
                            on:click={() => copyToClipboard(node.ip_address)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        </span>
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
                          <span class="inline-value block-number">{formatNumber(node.status_since)}</span>
                          <button 
                            class="copy-btn" 
                            title="Copy status since block height"
                            on:click={() => copyToClipboard(node.status_since.toString())}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Address:</span>
                        <span class="value address">
                          {node.node_address}
                          <button 
                            class="copy-btn" 
                            title="Copy node address"
                            on:click={() => copyToClipboard(node.node_address)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                          <a href="https://runescan.io/address/{node.node_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                          <a href="/voting?key={node.node_address}" class="voting-link" title="View Node Voting">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M12 20V10" />
                              <path d="M18 20V4" />
                              <path d="M6 20v-4" />
                            </svg>
                          </a>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator:</span>
                        <span class="value address">
                          {node.node_operator_address}
                          <button 
                            class="copy-btn" 
                            title="Copy node operator address"
                            on:click={() => copyToClipboard(node.node_operator_address)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
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
                      {#if node.jail}
                      <div class="summary-item jail-info">
                        <span class="label">Jail Status:</span>
                        <span class="value">
                          {#if node.jail.release_height > currentBlockHeight}
                            <span class="jail-reason">Currently Jailed: {node.jail.reason}</span>
                            <span class="jail-release">Will be released at block {formatNumber(node.jail.release_height)} ({formatNumber(node.jail.release_height - currentBlockHeight)} blocks remaining)</span>
                          {:else}
                            <span class="jail-reason unjailed">Unjailed {formatNumber(currentBlockHeight - node.jail.release_height)} blocks ago</span>
                            <span class="jail-history">Previous reason: {node.jail.reason}</span>
                          {/if}
                        </span>
                      </div>
                      {/if}
                    </div>
                    <div class="bond-table-container">
                      <div class="table-header">Bond Providers</div>
                      <table class="bond-table">
                        <thead>
                          <tr>
                            <th>Provider Address</th>
                            <th>Bond Amount</th>
                            <th>Share</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each (node.bond_providers?.providers || []) as provider}
                            <tr>
                              <td class="address-cell">
                                <div class="address-container">
                                  <div class="address-text-container">
                                    {provider.bond_address.slice(-4)}
                                  </div>
                                  <button 
                                    class="copy-btn" 
                                    title="Copy full address"
                                    on:click={() => copyToClipboard(provider.bond_address)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                              <td class="bond-amount-cell">
                                <span class="rune-amount">
                                  {formatRune(provider.bond)}
                                  <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                                </span>
                              </td>
                              <td class="share-cell">
                                {((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%
                              </td>
                              <td class="actions-cell">
                                <div class="action-buttons">
                                  <a href="{baseUrl}/bond?node_address={node.node_address}&bond_address={provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="track-rewards-btn"
                                    title="Track bond rewards">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M12 2v20M2 12h20"/>
                                    </svg>
                                    Track
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

  <h2>Standby Nodes</h2>
  {#if nodesLeavingCount > 0 || newNodesPerChurn > 0}
    <div class="churn-summary">
      <div class="churn-info">
        <span class="churn-label">Total Standby:</span>
        <span class="churn-value">{filteredStandbyNodes.length}</span>
      </div>
      <div class="churn-info">
        <span class="churn-label">Eligible Nodes:</span>
        <span class="churn-value eligible">{eligibleStandbyNodes}</span>
      </div>
      <div class="churn-info">
        <span class="churn-label">Nodes Leaving:</span>
        <span class="churn-value">{nodesLeavingCount}</span>
      </div>
      <div class="churn-info">
        <span class="churn-label">New Nodes Per Churn:</span>
        <span class="churn-value">{newNodesPerChurn}</span>
      </div>
      <div class="churn-info">
        <span class="churn-label">Total Spots Available:</span>
        <span class="churn-value">{nodesLeavingCount + newNodesPerChurn}</span>
      </div>
      <div class="churn-info">
        <span class="churn-label">Minimum Bond:</span>
        <span class="churn-value">{Math.floor(minimumBondInRune)} RUNE</span>
      </div>
    </div>
  {/if}
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th title="Node number">#</th>
          <th title="Star node to track it">★</th>
          <th title="Current status of the node" 
            class="sortable"
            on:click={() => handleSort('status')}
          >
            Status
            {#if sortField === 'status'}
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
            🏳️
            {#if sortField === 'country'}
              <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
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
        {#each filteredStandbyNodes as node, i}
          <tr class="main-row"
            class:row-starred={starredNodes.has(node.node_address)}
            class:row-jailed={node.jail && node.jail.release_height > currentBlockHeight}
            class:row-joining={node.preflight_status?.code === 0 && isLikelyToJoin(node)}
            class:row-eligible={node.preflight_status?.code === 0 && !isLikelyToJoin(node)}
            class:row-ineligible={!node.preflight_status || node.preflight_status.code !== 0}
          >
            <td class="number-cell">{i + 1}</td>
            <td>
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
            </td>
            <td>
              <div class="status-container">
                <div class="status-indicators">
                  <span 
                    class:status-circle-ready={node.preflight_status?.code === 0}
                    class:status-circle-version={node.preflight_status?.reason?.startsWith('node account does not meet min version requirement')}
                    class:status-circle-bond={node.preflight_status?.reason?.startsWith('node account does not have minimum bond requirement')}
                    class:status-circle-other={node.preflight_status?.code !== 0 && 
                      !node.preflight_status?.reason?.startsWith('node account does not meet min version requirement') &&
                      !node.preflight_status?.reason?.startsWith('node account does not have minimum bond requirement')}
                    class="status-circle"
                    title={node.preflight_status ? 
                      `Status: ${node.preflight_status.status}
Code: ${node.preflight_status.code}${node.preflight_status.reason ? `
Reason: ${node.preflight_status.reason}` : ''}` : 
                      "No preflight status available"}
                  ></span>
                  {#if node.requested_to_leave}
                    <span class="leave-emoji" title="Node has requested to leave">🧳</span>
                  {/if}
                  {#if node.forced_to_leave}
                    <span class="leave-emoji" title="Node is forced to leave">🧳</span>
                  {/if}
                  {#key node}
                  {#if true}
                    {@const status = getLeaveStatus(node, nodes)}
                    {#if status?.type === 'oldest'}
                      <span class="leave-emoji" title="Oldest active node by block height">🪦</span>
                    {/if}
                    {#if status?.type === 'worst'}
                      <span class="leave-emoji" title="Highest slash points">😾</span>
                    {/if}
                    {#if status?.type === 'lowest'}
                      <span class="leave-emoji" title="Lowest total bond">💸</span>
                    {/if}
                  {/if}
                  {/key}
                  {#if node.jail && node.jail.release_height > currentBlockHeight}
                    <span class="leave-emoji" title={`Jailed: ${node.jail.reason}`}>👮</span>
                  {/if}
                </div>
              </div>
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
                      loading="lazy"
                    />
                  {:else}
                    {node.isp}
                  {/if}
                </span>
              </td>
            {:else}
              <td>
                <span class="loading">
                  {#if isLoadingIpInfo}Loading...{:else}?{/if}
                </span>
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
                <span class="loading">
                  {#if isLoadingIpInfo}Loading...{:else}?{/if}
                </span>
              </td>
            {/if}
            <td>{node.node_address.slice(-4)}
              <span class="providers-count" title="Number of bond providers">
                {(node.bond_providers?.providers || []).length}
              </span>
              <button 
                class="expand-btn" 
                on:click={() => toggleRow(node.node_address)}
                title={expandedRows.has(node.node_address) ? "Hide details" : "Show details"}
              >
                {expandedRows.has(node.node_address) ? '▼' : '▶'}
              </button>
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
              <td colspan="11">
                <div class="bond-providers">
                  <div class="bond-header">
                    <h4>Node Details - {node.node_address.slice(-4)}</h4>
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
                          <span class="inline-value block-number">{formatNumber(node.status_since)}</span>
                          <button 
                            class="copy-btn" 
                            title="Copy status since block height"
                            on:click={() => copyToClipboard(node.status_since.toString())}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Address:</span>
                        <span class="value address">
                          {node.node_address}
                          <button 
                            class="copy-btn" 
                            title="Copy node address"
                            on:click={() => copyToClipboard(node.node_address)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                          <a href="https://runescan.io/address/{node.node_address}" target="_blank" rel="noopener noreferrer" class="outlink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                          <a href="/voting?key={node.node_address}" class="voting-link" title="View Node Voting">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M12 20V10" />
                              <path d="M18 20V4" />
                              <path d="M6 20v-4" />
                            </svg>
                          </a>
                        </span>
                      </div>
                      <div class="summary-item">
                        <span class="label">Node Operator:</span>
                        <span class="value address">
                          {node.node_operator_address}
                          <button 
                            class="copy-btn" 
                            title="Copy node operator address"
                            on:click={() => copyToClipboard(node.node_operator_address)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
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
                          {#each (node.signer_membership || []) as signer}
                            <span class="signer-pill">{signer.slice(-4)}</span>
                          {/each}
                        </span>
                      </div>
                      {#if node.jail}
                      <div class="summary-item jail-info">
                        <span class="label">Jail Status:</span>
                        <span class="value">
                          {#if node.jail.release_height > currentBlockHeight}
                            <span class="jail-reason">Currently Jailed: {node.jail.reason}</span>
                            <span class="jail-release">Will be released at block {formatNumber(node.jail.release_height)} ({formatNumber(node.jail.release_height - currentBlockHeight)} blocks remaining)</span>
                          {:else}
                            <span class="jail-reason unjailed">Unjailed {formatNumber(currentBlockHeight - node.jail.release_height)} blocks ago</span>
                            <span class="jail-history">Previous reason: {node.jail.reason}</span>
                          {/if}
                        </span>
                      </div>
                      {/if}
                    </div>
                    <div class="bond-table-container">
                      <div class="table-header">Bond Providers</div>
                      <table class="bond-table">
                        <thead>
                          <tr>
                            <th>Provider Address</th>
                            <th>Bond Amount</th>
                            <th>Share</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each (node.bond_providers?.providers || []) as provider}
                            <tr>
                              <td class="address-cell">
                                <div class="address-container">
                                  <div class="address-text-container">
                                    {provider.bond_address.slice(-4)}
                                  </div>
                                  <button 
                                    class="copy-btn" 
                                    title="Copy full address"
                                    on:click={() => copyToClipboard(provider.bond_address)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                              <td class="bond-amount-cell">
                                <span class="rune-amount">
                                  {formatRune(provider.bond)}
                                  <img src="assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
                                </span>
                              </td>
                              <td class="share-cell">
                                {((Number(provider.bond) / Number(node.total_bond)) * 100).toFixed(2)}%
                              </td>
                              <td class="actions-cell">
                                <div class="action-buttons">
                                  <a href="{baseUrl}/bond?node_address={node.node_address}&bond_address={provider.bond_address}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="track-rewards-btn"
                                    title="Track bond rewards">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <path d="M12 2v20M2 12h20"/>
                                    </svg>
                                    Track
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
  /* Update container padding to double the bezels */
  .nodes-container {
    padding: 16px 128px;
    max-width: 100%;
    width: 100%;
  }

  /* Remove side padding below 1462px */
  @media (max-width: 1462px) {
    .nodes-container {
      padding: 16px 0;
    }
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
    margin: 32px 0 12px;
    font-size: 1.25rem;
  }

  /* First h2 should have less top margin */
  h2:first-of-type {
    margin-top: 16px;
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
    display: block;
    -webkit-overflow-scrolling: touch;
  }

  /* Webkit (Chrome, Safari, Edge) scrollbar styles */
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
    border: 2px solid #1a1a1a;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #666;
  }

  .table-container::-webkit-scrollbar-corner {
    background: #1a1a1a;
  }

  /* Firefox scrollbar styles */
  .table-container {
    scrollbar-width: thin;
    scrollbar-color: #4a4a4a #1a1a1a;
  }

  /* Mobile-specific scrollbar adjustments */
  @media (max-width: 768px) {
    .table-container::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    
    .table-container::-webkit-scrollbar-thumb {
      border-width: 1px;
    }
  }

  table {
    width: max-content; /* Change from fixed percentage to max-content */
    min-width: 100%;    /* Ensure table is at least as wide as container */
    border-collapse: separate;
    border-spacing: 0;
    background-color: #2c2c2c;
    font-size: 0.875rem;
    line-height: 1.4;
    table-layout: fixed;  /* Keep fixed layout for predictable column widths */
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
    text-align: center;
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

  /* Column width controls - make them more strict */
  th:nth-child(1), td:nth-child(1) { 
    width: 30px !important; 
    min-width: 30px !important; 
    max-width: 30px !important;
    padding: 6px 0 !important;
    text-align: center !important;
  }  /* Number */
  th:nth-child(2), td:nth-child(2) { 
    width: 24px !important; 
    min-width: 24px !important; 
    max-width: 24px !important;
    padding: 6px 0 !important;
    text-align: center !important;
  }  /* Star */
  th:nth-child(3), td:nth-child(3) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }  /* Status */
  th:nth-child(4), td:nth-child(4) { width: 40px !important; min-width: 40px !important; max-width: 40px !important; }  /* ISP */
  th:nth-child(5), td:nth-child(5) { width: 40px !important; min-width: 40px !important; max-width: 40px !important; }  /* Country */
  th:nth-child(6), td:nth-child(6) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }  /* Address */
  th:nth-child(7), td:nth-child(7) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }  /* Operator */
  th:nth-child(8), td:nth-child(8) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }  /* Total Bond */
  th:nth-child(9), td:nth-child(9) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }  /* Current Award */
  th:nth-child(10), td:nth-child(10) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }  /* APY */
  th:nth-child(11), td:nth-child(11) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; }  /* Version */
  th:nth-child(12), td:nth-child(12) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; }  /* Active Since */
  th:nth-child(13), td:nth-child(13) { width: 70px !important; min-width: 70px !important; max-width: 70px !important; }  /* Slash Points */
  th:nth-child(14), td:nth-child(14) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; }  /* Vault */

  /* Force all cells to maintain their layout */
  th, td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
  }

  /* Add mobile-specific styles */
  @media (max-width: 768px) {
    .nodes-container {
      padding: 8px;
    }

    .table-container {
      margin: 0 -8px 32px -8px;
      border-radius: 0;
      max-height: none;
      width: 100vw;  /* Use viewport width */
      position: relative;
      left: 50%;
      transform: translateX(-50%);
    }

    table {
      font-size: 0.8125rem;
    }

    th, td {
      padding: 6px 4px;
    }

    /* Ensure expanded rows don't break layout */
    .expanded-row td {
      white-space: normal;
    }
  }

  /* iOS specific fixes */
  @supports (-webkit-touch-callout: none) {
    .table-container {
      overflow-x: scroll;
      -webkit-overflow-scrolling: touch;
    }
    
    table {
      transform: translateZ(0);  /* Force GPU acceleration */
    }
  }

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
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .summary-item .inline-value {
    white-space: nowrap;
  }

  .bond-table-container {
    background-color: #2a2a2a;
    border-radius: 8px;
    border: 1px solid #333;
    overflow-x: auto; /* Add horizontal scroll if needed */
    max-width: 100%;
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
    table-layout: fixed; /* Change to fixed for strict column widths */
  }

  .bond-table th,
  .bond-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #2c2c2c;
    vertical-align: middle;
  }

  .bond-table th {
    background-color: #303030;
    color: #999;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #333;
    text-align: left;
  }

  /* Update bond table column styles */
  .bond-table .address-cell {
    width: 45%;
    min-width: 200px;
  }

  .bond-table .bond-amount-cell {
    width: 25%;
    text-align: left;
    white-space: nowrap;
  }

  .bond-table .share-cell {
    width: 15%;
    text-align: right;
    white-space: nowrap;
  }

  .bond-table .actions-cell {
    width: 15%;
    text-align: right;
    white-space: nowrap;
  }

  /* Mobile adjustments for bond table */
  @media (max-width: 768px) {
    .bond-table .address-cell {
      min-width: 120px;
    }
    
    .bond-table td,
    .bond-table th {
      padding: 8px;
    }
    
    .bond-table .actions-cell {
      width: 20%;
    }
  }

  .address-cell {
    width: 50%;
  }

  .bond-amount-cell {
    width: 30%;
    white-space: nowrap;
  }

  .share-cell {
    width: 20%;
    text-align: center;
  }

  .actions-cell {
    width: 25%;
    white-space: nowrap;
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .address-text-container {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    word-break: break-all;
    color: #4A90E2;
  }

  .copy-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
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
    width: 20px !important;
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

  .status-circle-ready {
    background-color: #2ecc71;
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.4);
  }

  .status-circle-version {
    background-color: #9b59b6;
    box-shadow: 0 0 8px rgba(155, 89, 182, 0.4);
  }

  .status-circle-bond {
    background-color: #e74c3c;
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.4);
  }

  .status-circle-other {
    background-color: #f1c40f;
    box-shadow: 0 0 8px rgba(241, 196, 15, 0.4);
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

  .row-jailed {
    background-color: rgba(142, 68, 173, 0.1) !important;
  }

  .row-jailed:hover {
    background-color: rgba(142, 68, 173, 0.15) !important;
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
    text-align: center !important;
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

  /* Restore star button styles */
  .star-btn {
    background: none;
    border: none;
    color: #ffd700;
    cursor: pointer;
    padding: 0;
    margin: 0;
    font-size: 14px;
    transition: transform 0.15s;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .star-btn:hover {
    transform: scale(1.15);
  }

  tr:has(.star-btn:has(★)) {
    background-color: rgba(255, 215, 0, 0.03);
  }

  /* Restore expand button styles */
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

  /* Bond table styles */
  .bond-table {
    width: 100%;
    margin: 0;
    background-color: transparent;
    table-layout: fixed;
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
    text-align: left;
  }

  .bond-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #2c2c2c;
    vertical-align: middle;
  }

  .bond-table tr:last-child td {
    border-bottom: none;
  }

  .bond-table tr:hover {
    background-color: rgba(74, 144, 226, 0.05);
  }

  .address-cell {
    min-width: 120px;
    max-width: 200px;
    width: 25%;
  }

  .bond-amount-cell {
    width: 30%;
    white-space: nowrap;
  }

  .share-cell {
    width: 20%;
    text-align: right;
    white-space: nowrap;
  }

  .actions-cell {
    width: 25%;
    white-space: nowrap;
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .address-text-container {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    color: #4A90E2;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .copy-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .bond-table {
      font-size: 0.8125rem;
    }

    .bond-table td,
    .bond-table th {
      padding: 8px;
    }

    .address-text-container {
      font-size: 0.75rem;
    }

    .action-buttons {
      flex-direction: column;
      gap: 4px;
    }

    .address-cell {
      min-width: 100px;
    }
  }

  .jail-info {
    border-radius: 4px;
  }

  .jail-info:hover {
    background-color: rgba(231, 76, 60, 0.15);
  }

  .jail-reason {
    color: #e74c3c;
    font-weight: 500;
    margin-right: 12px;
  }

  .jail-release {
    color: #666;
    font-size: 0.875rem;
  }

  .summary-item .inline-value {
    white-space: nowrap;
  }

  /* Add styles for block height display */
  .controls-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .block-height-display {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    font-size: 0.875rem;
  }

  .block-height-display svg {
    color: #4A90E2;
  }

  .block-height-display .block-number {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  }

  /* Add these styles to the existing styles section */
  .jail-history {
    color: #666;
    font-size: 0.875rem;
    margin-left: 12px;
    font-style: italic;
  }

  .unjailed {
    color: #2ecc71;
  }

  .vault-id {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    transition: all 0.2s ease;
  }

  .active-nodes-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    font-size: 0.875rem;
  }

  .active-count {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .active-label {
    font-weight: 500;
  }

  /* Add styles for nodes likely to join */
  .row-joining {
    background-color: rgba(46, 204, 113, 0.1) !important;
  }

  .row-joining:hover {
    background-color: rgba(46, 204, 113, 0.15) !important;
  }

  /* Add styles for eligible but not joining nodes */
  .row-eligible {
    background-color: rgba(128, 128, 128, 0.1) !important;
  }

  .row-eligible:hover {
    background-color: rgba(128, 128, 128, 0.15) !important;
  }

  /* Update ineligible node styling */
  .row-ineligible {
    background-color: rgba(231, 76, 60, 0.1) !important;
  }

  .row-ineligible:hover {
    background-color: rgba(231, 76, 60, 0.15) !important;
  }

  /* Add styles for churn summary */
  .churn-summary {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background-color: #1a1a1a;
    border-radius: 8px;
    border: 1px solid #3a3a3c;
  }

  .churn-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .churn-label {
    color: #888;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .churn-value {
    color: #4A90E2;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
  }

  /* Mobile adjustments for churn summary */
  @media (max-width: 768px) {
    .churn-summary {
      flex-direction: column;
      gap: 12px;
    }
  }

  /* Add these styles to the existing style section */
  .eligible-nodes-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    font-size: 0.875rem;
  }

  .eligible-count {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .eligible-label {
    font-weight: 500;
  }

  .total-bond-display {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    font-size: 0.875rem;
  }

  .bond-amount {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }

  .total-bond-display .rune-icon {
    width: 14px;
    height: 14px;
  }

  /* Add these styles to the existing style section */
  .voting-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #4A90E2;
    padding: 2px;
    border-radius: 4px;
    transition: all 0.2s;
    margin-left: 4px;
  }

  .voting-link:hover {
    background-color: rgba(74, 144, 226, 0.1);
    color: #5a9ee8;
  }

  .voting-link svg {
    width: 14px;
    height: 14px;
  }

  /* Add mobile styles for controls-right */
  @media (max-width: 768px) {
    .header-controls {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .controls-right {
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
    }

    .block-height-display,
    .churn-countdown-display,
    .active-nodes-display,
    .eligible-nodes-display,
    .total-bond-display {
      flex: 1 1 calc(50% - 4px);
      min-width: 140px;
      font-size: 0.75rem;
    }

    .pause-button {
      margin-left: auto;
    }

    .block-number,
    .countdown,
    .active-count,
    .eligible-count,
    .bond-amount {
      font-size: 0.75rem;
    }
  }

  .churn-countdown-display {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #1a1a1a;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #3a3a3c;
    color: #4A90E2;
    font-size: 0.875rem;
  }

  .churn-countdown-display svg {
    color: #4A90E2;
  }

  .churn-countdown-display .countdown {
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  }
</style>
