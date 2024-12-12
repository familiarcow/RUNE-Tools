<script>
  import { onMount } from 'svelte';

  let mimirData = [];
  let activeKeys = {};
  let filteredKeys = {};
  let searchTerm = '';
  let currentMimirValues = {};
  let nodeData = [];
  let activeNodeCount = 0;
  let dataLoaded = false;

  let expandedKeys = {};
  const initialVisibleSigners = 3;

  let votesToPass = 0;

  let keyBlacklist = ['HALTRADING', 'STOP-NEW-SAVERS', 'ADR012', 'ADR18', 'ADR013', 'ALTGAIACHAIN', 'BAREMETALBADASS', 'BSCREADY', 'DEPRECATEILP', 'ELROND', 'ENABLEAVAXCHAIN', 'ENABLEBSC', 'ENABLEDASHCHAIN', 'ENABLEDOFM', 'ENABLEUPDATEMEMOTERRA', 'FULLIMPLOSSPROTECTIONBLOCKS', 'KILLSWITCHSTART', 'L1MINSLIPBPS', 'MAXBONDPROVIDES', 'MAXRUNESUPPLY', 'MULTIPARTITEFORPRESIDENT', 'NEXTCHAIN', 'NEXTFEATUREPERPRS', 'NEXTFEATUREPERPS', 'RAGNAROK-BNB-AVA-645', 'RAGNAROK-BNB-BAT-07A', 'RAGNAROK-BNB-BNB', 'RAGNAROK-BNB-BTCB-1DE', 'RAGNAROK-BNB-BUSD-BD1', 'RAGNAROK-BNB-CAKE-435', 'RAGNAROK-BNB-EQL-586', 'RAGNAROK-BNB-ETH-1C9', 'RAGNAROK-BNB-ETHBULL-D33', 'RAGNAROK-BNB-NEXO-A84', 'RAGNAROK-BNB-RUNE', 'RAGNAROK-BNB-TWT-8C2', 'RAGNAROK-BNB-USDT-6D8', 'RAGNAROK-BNB-XRP-BF2', 'RAGNAROK-TERRA', 'RAGNAROK-TERRA-LUNA', 'RAGNAROK-TERRA-USD', 'RAGNAROK-TERRA-UST', 'RAGNAROK-BSC', 'REMOVESNXPOOL', 'SUPPORTTHORCHAINDOTNETWORK', 'TEST', 'THISISANEWMIMIR', 'VOTEDOFM', 'VOTELENDING', 'VOTEMAXBONDPROVIDERS', 'VOTEMAXSYNTHSFORSAVERSYIELD', 'VOTESTREAMINGSWAPS', 'ENABLEVAXCHAIN', 'MAXSYNTHPERASSETDEPTH', 'MINIMUM1OUTBOUNDFEEUSD', 'RAGNAROKBSC' , 'VALIDATORMAXREWARDRATIO', 'NODEOPERATORFEE' , 'MINBPAFFILIATEFEERATE', 'ENABLESAVINGSVAULTS', 'SYSTEMINCOMEBURNRATEBP'];

  let activeNodeAddresses = [];

  let isMobile = false;

  let nodeOperators = {};

  let expandedOperators = {};

  let showOperators = {};

  let showMimirExplanation = false;

  let signersContainerRef;

  let signersContainerWidth = 0;

  onMount(async () => {
    updateSearchFromURL();
    window.addEventListener('popstate', updateSearchFromURL);
    await Promise.all([
      fetchMimirData(),
      fetchCurrentMimirValues(),
      fetchNodeData()
    ]);
    filterActiveVotes(); // Add this line
    votesToPass = Math.ceil((2/3) * activeNodeCount);
    dataLoaded = true;

    const checkMobile = () => {
      isMobile = window.innerWidth <= 768;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('popstate', updateSearchFromURL);
      window.removeEventListener('resize', checkMobile);
    };
  });

  async function fetchMimirData() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/mimir/nodes_all');
      const data = await response.json();
      mimirData = data.mimirs;
      processData();
    } catch (error) {
      console.error('Error fetching mimir data:', error);
    }
  }

  async function fetchCurrentMimirValues() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/mimir');
      currentMimirValues = await response.json();
    } catch (error) {
      console.error('Error fetching current mimir values:', error);
    }
  }

  async function fetchNodeData() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/nodes');
      nodeData = await response.json();
      activeNodeCount = nodeData.filter(node => node.status === 'Active').length;
      activeNodeAddresses = nodeData
        .filter(node => node.status === 'Active')
        .map(node => node.node_address);
      
      // Group nodes by operator
      nodeOperators = nodeData.reduce((acc, node) => {
        if (!acc[node.node_operator_address]) {
          acc[node.node_operator_address] = [];
        }
        acc[node.node_operator_address].push(node.node_address);
        return acc;
      }, {});

      console.log('Active node count:', activeNodeCount);
    } catch (error) {
      console.error('Error fetching node data:', error);
      activeNodeCount = 1; // Fallback to avoid division by zero
      activeNodeAddresses = [];
      nodeOperators = {};
    }
  }

  function processData() {
    activeKeys = {};
    mimirData.forEach(mimir => {
      if (!keyBlacklist.includes(mimir.key)) {
        if (!activeKeys[mimir.key]) {
          activeKeys[mimir.key] = {};
        }
        if (!activeKeys[mimir.key][mimir.value]) {
          activeKeys[mimir.key][mimir.value] = [];
        }
        activeKeys[mimir.key][mimir.value].push(mimir.signer);
      }
    });
    filterActiveVotes();
    filterKeys();
  }

  function getGroupedValues(key, values) {
    const totalVotes = Object.values(values).reduce((sum, signers) => sum + signers.length, 0);
    const groupedValues = Object.entries(values).map(([value, signers]) => ({
      value: value === 'undefined' || value === '' ? 'No Vote' : value,
      count: signers.length,
      signers: signers.map(signer => signer.slice(-4)),
      isPassed: currentMimirValues[key] === parseInt(value),
      totalVotes,
    }));

    // Combine all "No Vote" entries
    const noVoteEntry = groupedValues.find(entry => entry.value === 'No Vote');
    const otherVotes = groupedValues.filter(entry => entry.value !== 'No Vote');
    
    const noVoteSigners = activeNodeAddresses.filter(address => 
      !Object.values(values).flat().includes(address)
    );

    if (noVoteEntry || noVoteSigners.length > 0) {
      const combinedNoVote = {
        value: 'Not Voted',
        count: (noVoteEntry ? noVoteEntry.count : 0) + noVoteSigners.length,
        signers: [...(noVoteEntry ? noVoteEntry.signers : []), ...noVoteSigners.map(signer => signer.slice(-4))],
        isPassed: false,
        totalVotes: totalVotes + noVoteSigners.length,
      };
      otherVotes.push(combinedNoVote);
    }

    // Sort with passed values first, then by vote count, and "Not Voted" last
    otherVotes.sort((a, b) => {
      // Always put "Not Voted" at the bottom
      if (a.value === 'Not Voted') return 1;
      if (b.value === 'Not Voted') return -1;
      
      // Then sort by passed status
      if (a.isPassed !== b.isPassed) {
        return b.isPassed ? 1 : -1; // Passed values go first
      }
      
      // Finally sort by vote count
      return b.count - a.count;
    });

    // Rank after sorting
    let rank = 1;
    otherVotes.forEach((group, index) => {
      if (index > 0 && group.count < otherVotes[index - 1].count) {
        rank++;
      }
      group.popularityRank = group.isPassed ? 0 : rank;
    });

    return otherVotes;
  }

  function toggleShowOperators(key, value) {
    if (!showOperators[key]) {
      showOperators[key] = {};
    }
    showOperators[key][value] = !showOperators[key][value];
    showOperators = {...showOperators}; // Trigger reactivity
  }

  function getOperatorsForValue(key, value, signers) {
    const groupedOperators = {};
    for (const [operator, nodes] of Object.entries(nodeOperators)) {
      const matchingNodes = nodes.filter(node => signers.includes(node.slice(-4)));
      if (matchingNodes.length > 0) {
        groupedOperators[operator] = matchingNodes.map(node => node.slice(-4));
      }
    }
    return groupedOperators;
  }

  function filterKeys() {
    if (!searchTerm) {
      filteredKeys = Object.entries(activeKeys).reduce((acc, [key, values]) => {
        if (!keyBlacklist.includes(key)) {
          acc[key] = values;
        }
        return acc;
      }, {});
      return;
    }

    filteredKeys = Object.entries(activeKeys).reduce((acc, [key, values]) => {
      if (!keyBlacklist.includes(key)) {
        const matchesKey = key.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesNode = Object.values(values).some(signers => 
          signers.some(signer => signer.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (matchesKey || matchesNode) {
          acc[key] = values;
        }
      }
      return acc;
    }, {});
  }

  function toggleExpand(key) {
    expandedKeys[key] = !expandedKeys[key];
    expandedKeys = {...expandedKeys}; // Trigger reactivity
  }

  function toggleExpandOperator(operator) {
    expandedOperators[operator] = !expandedOperators[operator];
    expandedOperators = {...expandedOperators}; // Trigger reactivity
  }

  function calculateVisibleBubbles(containerWidth, signers, hasExpandButton) {
    if (!containerWidth) return 3; // fallback to default
    
    const BUBBLE_WIDTH = 65; // Reduced from 85 to 65px
    const EXPAND_BUTTON_WIDTH = hasExpandButton ? 80 : 0; // Reduced from 100 to 80px
    const availableWidth = containerWidth - EXPAND_BUTTON_WIDTH;
    
    const maxBubbles = Math.floor(availableWidth / BUBBLE_WIDTH);
    return Math.min(maxBubbles, signers.length);
  }

  function updateSearchFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get("key");
    if (urlKey) {
      searchTerm = urlKey;
      filterKeys();
    }
  }

  function updateURL() {
    const url = new URL(window.location);
    if (searchTerm) {
      url.searchParams.set("key", searchTerm);
    } else {
      url.searchParams.delete("key");
    }
    window.history.pushState({}, '', url);
  }

  function handleSearch() {
    filterKeys();
    updateURL();
  }

  function handleRowClick(key) {
    searchTerm = key;
    filterKeys();
    updateURL();
  }

  $: {
    if (activeKeys) {
      filterKeys();
    }
  }

  function filterActiveVotes() {
    if (!activeNodeAddresses.length || !activeKeys) return;

    Object.keys(activeKeys).forEach(key => {
      Object.keys(activeKeys[key]).forEach(value => {
        activeKeys[key][value] = activeKeys[key][value].filter(signer => 
          activeNodeAddresses.includes(signer)
        );
        // Remove the value if there are no active signers
        if (activeKeys[key][value].length === 0) {
          delete activeKeys[key][value];
        }
      });
      // Remove the key if there are no values left
      if (Object.keys(activeKeys[key]).length === 0) {
        delete activeKeys[key];
      }
    });

    // Trigger reactivity
    activeKeys = {...activeKeys};
    filteredKeys = {...filteredKeys};
  }

  function handleSignerClick(signer) {
    searchTerm = signer;
    filterKeys();
    updateURL();
  }

  function getColorForVote(isPassed, popularityRank, value) {
    if (isPassed) return '#2ecc71'; // Green for passed votes
    if (value === 'Not Voted') return '#95a5a6'; // Grey for not voted
    
    // Expanded color palette for different vote options
    const colors = [
      '#3498db', // Blue
      '#9b59b6', // Purple
      '#e84393', // Pink
      '#e67e22', // Orange
      '#e74c3c', // Red
      '#f1c40f', // Yellow
      '#1abc9c', // Turquoise
      '#16a085', // Dark Turquoise
      '#27ae60', // Dark Green
      '#2980b9', // Dark Blue
      '#8e44ad', // Dark Purple
      '#c0392b', // Dark Red
      '#d35400', // Dark Orange
      '#00a8ff', // Light Blue
      '#9c88ff', // Light Purple
      '#ffa502', // Light Orange
      '#ff6b6b', // Light Red
      '#4cd137', // Lime
      '#00d2d3', // Cyan
      '#a8e6cf'  // Mint
    ];

    // Use modulo to cycle through colors if we have more ranks than colors
    return colors[(popularityRank - 1) % colors.length];
  }

  function toggleMimirExplanation() {
    showMimirExplanation = !showMimirExplanation;
  }
</script>

<div class="container">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
    <h2>THORChain Node Voting</h2>
    <div class="info-icon" on:click={toggleMimirExplanation}>ⓘ</div>
  </div>

  {#if dataLoaded}
    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-header">
          <h3>Active Nodes</h3>
        </div>
        <p class="stat-value">{activeNodeCount}</p>
      </div>

      <div class="stat-box">
        <div class="stat-header">
          <h3>Votes Required for Change</h3>
        </div>
        <p class="stat-value">{votesToPass}</p>
      </div>
    </div>

    {#if showMimirExplanation}
      <div class="info-panel">
        <p>
          Mimir is THORChain's governance system to change system constants. To change any constant on the network, > 2/3 of validators must agree to change the constant to a new value. Voting happens continuously. When a new value achieves consensus, that value is now <span class="passed">Passed ✅</span>. The new value is active indefinitely until another value achieves a > 2/3 consensus.
        </p>
      </div>
    {/if}

    <div class="search-container">
      <input 
        type="text" 
        bind:value={searchTerm} 
        placeholder="Search by mimir key or node address"
        on:input={handleSearch}
      />
    </div>
    {#if !isMobile}
      <!-- Desktop table layout -->
      <table>
        <thead>
          <tr>
            <th>Mimir Voting Key</th>
            <th>Values and Votes</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(filteredKeys) as [key, values]}
            <tr class="clickable-row">
              <td class="key-cell" on:click={() => handleRowClick(key)}>
                <div class="key-name">{key}</div>
                {#if currentMimirValues[key] !== undefined}
                  <div class="current-value">Current: {currentMimirValues[key]}</div>
                {/if}
              </td>
              <td class="votes-cell">
                {#each getGroupedValues(key, values) as {value, count, signers, isPassed, popularityRank}}
                  <div class="vote-group" style="border-left: 4px solid {getColorForVote(isPassed, popularityRank, value)}">
                    <div class="vote-header">
                      <div class="vote-value">
                        <span class="value-label">Value:</span>
                        <span class="value-number">{value}</span>
                      </div>
                      <div class="vote-count">
                        {#if isPassed}
                          <span class="passed">✓ Active</span>
                        {:else if value !== 'Not Voted'}
                          <div class="progress-bar-container">
                            <div 
                              class="progress-bar" 
                              style="width: {(count/activeNodeCount) * 100}%; background-color: {getColorForVote(isPassed, popularityRank, value)}"
                            ></div>
                          </div>
                          <span class="vote-fraction">{count}/{votesToPass} needed</span>
                        {:else}
                          <span class="not-voted-count">{count} nodes</span>
                        {/if}
                      </div>
                    </div>
                    
                    <div class="vote-details">
                      <div class="toggle-and-signers">
                        <div 
                          class="signers-preview"
                          bind:this={signersContainerRef}
                          bind:clientWidth={signersContainerWidth}
                        >
                          {#if !expandedKeys[key]}
                            {#if showOperators[key]?.[value]}
                              {#each Object.entries(getOperatorsForValue(key, value, signers))
                                .slice(0, calculateVisibleBubbles(signersContainerWidth, signers, signers.length > 3)) as [operator, nodes]}
                                <span class="operator-bubble" title="Operating {nodes.length} node{nodes.length > 1 ? 's' : ''}">
                                  {operator.slice(-4)} ({nodes.length})
                                </span>
                              {/each}
                            {:else}
                              {#each signers
                                .slice(0, calculateVisibleBubbles(signersContainerWidth, signers, signers.length > 3)) as signer}
                                <span 
                                  class="signer-bubble" 
                                  style="background-color: {getColorForVote(isPassed, popularityRank, value)}"
                                  on:click|stopPropagation={() => handleSignerClick(signer)}
                                >
                                  {signer}
                                </span>
                              {/each}
                            {/if}
                            {#if signers.length > calculateVisibleBubbles(signersContainerWidth, signers, true)}
                              <button 
                                on:click|stopPropagation={() => toggleExpand(key)} 
                                class="expand-btn"
                              >
                                +{signers.length - calculateVisibleBubbles(signersContainerWidth, signers, true)} more
                              </button>
                            {/if}
                          {:else}
                            <label class="toggle" title="Toggle between Node Addresses & Operator Addresses">
                              <input 
                                type="checkbox" 
                                checked={showOperators[key]?.[value]} 
                                on:change={() => toggleShowOperators(key, value)}
                              >
                              <span class="slider">
                                <span class="knob">
                                  <span class="knob-icon nodes">N</span>
                                  <span class="knob-icon ops">O</span>
                                </span>
                              </span>
                            </label>

                            <div class="signers-list">
                              {#if showOperators[key]?.[value]}
                                {#each Object.entries(getOperatorsForValue(key, value, signers)) as [operator, nodes]}
                                  <span class="operator-bubble" title="Operating {nodes.length} node{nodes.length > 1 ? 's' : ''}">
                                    {operator.slice(-4)} ({nodes.length})
                                  </span>
                                {/each}
                              {:else}
                                {#each signers as signer}
                                  <span 
                                    class="signer-bubble" 
                                    style="background-color: {getColorForVote(isPassed, popularityRank, value)}"
                                    on:click|stopPropagation={() => handleSignerClick(signer)}
                                  >
                                    {signer}
                                  </span>
                                {/each}
                              {/if}
                              <button 
                                on:click|stopPropagation={() => toggleExpand(key)} 
                                class="collapse-btn"
                              >
                                Show less
                              </button>
                            </div>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <!-- Mobile card layout -->
      <div class="mobile-cards">
        {#each Object.entries(filteredKeys) as [key, values]}
          <div class="mobile-card">
            <div class="mobile-key-section">
              <h3 class="mobile-key">{key}</h3>
              {#if currentMimirValues[key] !== undefined}
                <div class="mobile-current-value">Current: {currentMimirValues[key]}</div>
              {/if}
            </div>

            {#each getGroupedValues(key, values) as {value, count, signers, isPassed, popularityRank}}
              <div class="mobile-vote-group" style="border-left: 4px solid {getColorForVote(isPassed, popularityRank, value)}">
                <div class="mobile-vote-header">
                  <div class="mobile-vote-value">
                    <span class="mobile-value-number">{value}</span>
                  </div>
                  
                  {#if isPassed}
                    <span class="mobile-passed">✓ Active</span>
                  {:else if value !== 'Not Voted'}
                    <div class="mobile-vote-progress">
                      <div class="mobile-progress-bar-container">
                        <div 
                          class="mobile-progress-bar" 
                          style="width: {(count/activeNodeCount) * 100}%; background-color: {getColorForVote(isPassed, popularityRank, value)}"
                        ></div>
                      </div>
                      <span class="mobile-vote-count">{count}/{votesToPass}</span>
                    </div>
                  {:else}
                    <div class="mobile-not-voted">
                      <span class="mobile-vote-count">{count} nodes</span>
                    </div>
                  {/if}
                </div>

                <div class="mobile-vote-details">
                  <div class="toggle-and-signers">
                    <div 
                      class="signers-preview"
                      bind:this={signersContainerRef}
                      bind:clientWidth={signersContainerWidth}
                    >
                      {#if !expandedKeys[key]}
                        {#if showOperators[key]?.[value]}
                          {#each Object.entries(getOperatorsForValue(key, value, signers))
                            .slice(0, calculateVisibleBubbles(signersContainerWidth, signers, signers.length > 3)) as [operator, nodes]}
                            <span class="mobile-operator-bubble" title="Operating {nodes.length} node{nodes.length > 1 ? 's' : ''}">
                              {operator.slice(-4)} ({nodes.length})
                            </span>
                          {/each}
                        {:else}
                          {#each signers
                            .slice(0, calculateVisibleBubbles(signersContainerWidth, signers, signers.length > 3)) as signer}
                            <span 
                              class="mobile-signer-bubble" 
                              style="background-color: {getColorForVote(isPassed, popularityRank, value)}"
                              on:click={() => handleSignerClick(signer)}
                            >
                              {signer}
                            </span>
                          {/each}
                        {/if}
                        {#if signers.length > calculateVisibleBubbles(signersContainerWidth, signers, true)}
                          <button 
                            on:click={() => toggleExpand(key)} 
                            class="mobile-expand-btn"
                          >
                            +{signers.length - calculateVisibleBubbles(signersContainerWidth, signers, true)} more
                          </button>
                        {/if}
                      {:else}
                        <label class="toggle" title="Toggle between Node Addresses & Operator Addresses">
                          <input 
                            type="checkbox" 
                            checked={showOperators[key]?.[value]} 
                            on:change={() => toggleShowOperators(key, value)}
                          >
                          <span class="slider">
                            <span class="knob">
                              <span class="knob-icon nodes">N</span>
                              <span class="knob-icon ops">O</span>
                            </span>
                          </span>
                        </label>

                        <div class="signers-list">
                          {#if showOperators[key]?.[value]}
                            {#each Object.entries(getOperatorsForValue(key, value, signers)) as [operator, nodes]}
                              <span class="mobile-operator-bubble" title="Operating {nodes.length} node{nodes.length > 1 ? 's' : ''}">
                                {operator.slice(-4)} ({nodes.length})
                              </span>
                            {/each}
                          {:else}
                            {#each signers as signer}
                              <span 
                                class="mobile-signer-bubble" 
                                style="background-color: {getColorForVote(isPassed, popularityRank, value)}"
                                on:click={() => handleSignerClick(signer)}
                              >
                                {signer}
                              </span>
                            {/each}
                          {/if}
                          <button 
                            on:click|stopPropagation={() => toggleExpand(key)} 
                            class="mobile-collapse-btn"
                          >
                            Show less
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="loading">Loading data...</div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
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

  .stat-header h3 {
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

  .info-panel {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    color: #888;
    line-height: 1.5;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .search-container {
    margin-bottom: 30px;
  }

  .search-container input {
    width: 100%;
    padding: 12px;
    background-color: #2c2c2c;
    border: 1px solid #3a3a3c;
    border-radius: 6px;
    color: #fff;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  .search-container input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  table {
    width: 100%;
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-bottom: 30px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .key-cell {
    padding: 20px;
    width: 1%;
    white-space: nowrap;
    vertical-align: middle;
    border-right: 1px solid #3a3a3c;
    text-align: center;
    background-color: #2c2c2c;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .key-cell:hover {
    background-color: #3a3a3c;
  }

  .votes-cell {
    padding: 15px;
    width: auto;
    vertical-align: top;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 15px 20px;
    text-align: center;
    vertical-align: middle;
  }

  th:first-child {
    width: 1%;
    white-space: nowrap;
    border-right: 1px solid #3a3a3c;
  }

  td {
    border-top: 1px solid #3a3a3c;
  }

  .vote-group {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .vote-group:last-child {
    margin-bottom: 0;
  }

  .value-group {
    background-color: #1a1a1a;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
  }

  .passed {
    background-color: rgba(46, 204, 113, 0.1);
    color: #2cbe8c;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .signer-bubble {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 14px;
    color: #fff;
    margin: 2px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .signer-bubble:hover {
    transform: scale(1.05);
  }

  .toggle-btn {
    background-color: #4A90E2;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .toggle-btn:hover {
    background-color: #357abd;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    margin-top: 40px;
  }

  /* Add responsive styles */
  @media (max-width: 768px) {
    .container {
      padding: 20px 10px;
    }

    .stats-container {
      grid-template-columns: 1fr;
      gap: 15px;
    }

    .stat-box {
      height: 100px;
    }

    .mobile-card {
      background-color: #2c2c2c;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
  }

  .key-cell {
    padding: 20px;
    width: 1%;  /* This makes the column as narrow as possible */
    white-space: nowrap;  /* Prevents text wrapping */
  }

  .key-name {
    font-size: 16px;
    font-weight: 600;
    color: #4A90E2;
    margin-bottom: 8px;
  }

  .current-value {
    font-size: 14px;
    color: #888;
    padding: 4px 8px;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 4px;
    display: inline-block;
  }

  .votes-cell {
    padding: 15px;
    width: auto;  /* This column takes up remaining space */
  }

  .vote-group {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .vote-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .vote-value {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .value-label {
    color: #888;
    font-size: 14px;
  }

  .value-number {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .vote-count {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-bar-container {
    width: 150px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .vote-fraction {
    font-size: 14px;
    color: #888;
    min-width: 100px;
    text-align: right;
  }

  .not-voted-count {
    color: #888;
    font-size: 14px;
  }

  .vote-details {
    margin-top: 10px;
  }

  .toggle-and-signers {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .signers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    flex: 1;
  }

  .signer-bubble {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
  }

  .signer-bubble:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }

  .operator-bubble {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: #fff;
    background: #AD4469;
    cursor: help;
  }

  .passed {
    background: rgba(46, 204, 113, 0.1);
    color: #2cbe8c;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
  }

  .toggle-btn {
    align-self: flex-start;
    background: #2c2c2c;
    border: 1px solid #3a3a3c;
    color: #fff;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: #3a3a3c;
    border-color: #4A90E2;
  }

  .expand-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    text-decoration: underline;
  }

  .expand-btn:hover {
    color: #357abd;
  }

  .mobile-cards {
    padding: 0 10px;
  }

  .mobile-card {
    background-color: #2c2c2c;
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .mobile-key-section {
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #3a3a3c;
  }

  .mobile-key {
    color: #4A90E2;
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .mobile-current-value {
    display: inline-block;
    font-size: 14px;
    color: #888;
    padding: 4px 8px;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 4px;
  }

  .mobile-vote-group {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .mobile-vote-header {
    margin-bottom: 12px;
  }

  .mobile-vote-value {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .mobile-value-number {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .mobile-passed {
    background: rgba(46, 204, 113, 0.1);
    color: #2cbe8c;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
  }

  .mobile-vote-progress {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mobile-progress-bar-container {
    flex-grow: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .mobile-progress-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .mobile-vote-count {
    font-size: 14px;
    color: #888;
    min-width: 70px;
    text-align: right;
  }

  .mobile-vote-details {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mobile-toggle-btn {
    align-self: flex-start;
    background: #2c2c2c;
    border: 1px solid #3a3a3c;
    color: #fff;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .mobile-toggle-btn:hover {
    background: #3a3a3c;
    border-color: #4A90E2;
  }

  .mobile-signers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mobile-signer-bubble {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
  }

  .mobile-operator-bubble {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: #fff;
    background: #AD4469;
    cursor: help;
  }

  .mobile-expand-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    text-decoration: underline;
    align-self: flex-start;
  }

  .mobile-not-voted {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 480px) {
    .mobile-vote-header {
      flex-direction: column;
      gap: 8px;
    }

    .mobile-vote-progress {
      width: 100%;
    }

    .mobile-vote-count {
      min-width: 60px;
      font-size: 13px;
    }

    .stat-box {
      height: auto;
      padding: 15px;
    }

    .stat-value {
      font-size: 20px;
    }
  }

  .toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
    align-self: flex-start;
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
    border: 1px solid #3a3a3c;
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
    color: white;
    font-size: 14px;
    font-weight: 600;
  }

  .knob-icon.nodes {
    opacity: 1;
  }

  .knob-icon.ops {
    opacity: 0;
  }

  input:checked + .slider .knob {
    transform: translateX(32px);
  }

  input:checked + .slider .knob-icon.nodes {
    opacity: 0;
  }

  input:checked + .slider .knob-icon.ops {
    opacity: 1;
  }

  .toggle:hover .slider {
    border-color: #4A90E2;
    box-shadow: 0 0 5px rgba(74, 144, 226, 0.2);
  }

  .collapse-btn {
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    text-decoration: underline;
  }

  .collapse-btn:hover {
    color: #357abd;
  }

  .signers-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  th:first-child {
    width: 1%;  /* Match the key-cell width */
    white-space: nowrap;
  }

  /* Update/add these styles */
  tr {
    background-color: #2c2c2c;
  }

  tr:not(:last-child) {
    border-bottom: 8px solid #1a1a1a;  /* Add spacing between rows */
  }

  .key-cell {
    padding: 20px;
    width: 1%;
    white-space: nowrap;
    vertical-align: middle;
    border-right: 1px solid #3a3a3c;
    text-align: center;
    background-color: #2c2c2c;  /* Ensure background color is consistent */
  }

  .votes-cell {
    padding: 15px;
    width: auto;
    vertical-align: top;
    background-color: #2c2c2c;  /* Ensure background color is consistent */
  }

  table {
    background-color: #1a1a1a;  /* Change table background to match spacing color */
    border-collapse: separate;
    border-spacing: 0;
  }

  .signers-preview {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
    overflow: hidden;
    width: 100%;
  }

  .signer-bubble {
    flex-shrink: 0;
    white-space: nowrap;
    /* ... rest of your existing signer-bubble styles ... */
  }

  .operator-bubble {
    flex-shrink: 0;
    white-space: nowrap;
    /* ... rest of your existing operator-bubble styles ... */
  }

  .expand-btn {
    flex-shrink: 0;
    white-space: nowrap;
    /* ... rest of your existing expand-btn styles ... */
  }
</style>