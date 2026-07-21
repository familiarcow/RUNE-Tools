<script>
  import { onMount } from 'svelte';
  import { getAddressSuffix } from '$lib/utils/formatting';
  import {
    getNodes,
    getActiveNodeAddresses,
    groupNodesByOperator,
    calculateConsensusThreshold
  } from '$lib/utils/nodes';
  import {
    fetchMimirNodeVotes,
    getCurrentMimirValues,
    getMissingVotesForNode,
    getMissingVotesForOperator,
    MIMIR_KEY_BLACKLIST
  } from '$lib/utils/voting';

  let searchTerm = '';
  let searchType = ''; // 'node' or 'operator'
  let searchedAddress = '';
  let resolvedFullAddress = ''; // full address resolved from suffix search
  let loading = false;
  let dataLoaded = false;

  // Fetched data
  let mimirData = [];
  let currentMimirValues = {};
  let nodeData = [];
  let activeNodeAddresses = [];
  let activeNodeCount = 0;
  let nodeOperators = {};
  let votesToPass = 0;

  // Results
  let missingVotes = [];
  let operatorNodes = [];
  let error = '';

  // Mobile detection
  let isMobile = false;

  onMount(async () => {
    // Check for URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlNode = urlParams.get('node');
    const urlOperator = urlParams.get('operator');

    await Promise.all([
      fetchMimirData(),
      fetchCurrentMimirValues(),
      fetchNodeData()
    ]);

    votesToPass = calculateConsensusThreshold(activeNodeCount);
    dataLoaded = true;

    const checkMobile = () => {
      isMobile = window.innerWidth <= 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Auto-search if URL param present
    if (urlNode) {
      searchTerm = urlNode;
      searchType = 'node';
      await doSearch(urlNode, 'node');
    } else if (urlOperator) {
      searchTerm = urlOperator;
      searchType = 'operator';
      await doSearch(urlOperator, 'operator');
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  async function fetchMimirData() {
    try {
      mimirData = await fetchMimirNodeVotes();
    } catch (e) {
      console.error('Error fetching mimir data:', e);
    }
  }

  async function fetchCurrentMimirValues() {
    try {
      currentMimirValues = await getCurrentMimirValues();
    } catch (e) {
      console.error('Error fetching mimir values:', e);
    }
  }

  async function fetchNodeData() {
    try {
      nodeData = await getNodes({ cache: false });
      activeNodeAddresses = getActiveNodeAddresses(nodeData);
      activeNodeCount = activeNodeAddresses.length;
      nodeOperators = groupNodesByOperator(nodeData);
    } catch (e) {
      console.error('Error fetching node data:', e);
      activeNodeCount = 1;
      activeNodeAddresses = [];
      nodeOperators = {};
    }
  }

  /**
   * Resolve a search input (full address or suffix) to matching
   * node and operator addresses. Returns { nodes, operators } where
   * each entry is the full address. Handles exact matches, suffix
   * matches, and partial matches.
   */
  function resolveAddress(input) {
    const clean = input.trim();
    if (!clean) return { nodes: [], operators: [] };

    const lower = clean.toLowerCase();

    // 1. Exact full-address match on nodes
    const exactNode = activeNodeAddresses.find(
      addr => addr.toLowerCase() === lower
    );
    if (exactNode) return { nodes: [exactNode], operators: [] };

    // 2. Exact full-address match on operators
    const exactOp = Object.keys(nodeOperators).find(
      op => op.toLowerCase() === lower
    );
    if (exactOp) return { nodes: [], operators: [exactOp] };

    // 3. Suffix match (e.g. last 4 chars like "r304")
    //    Match against the last N chars of addresses.
    const suffixLen = clean.length;
    const suffixNodes = activeNodeAddresses.filter(
      addr => addr.toLowerCase().endsWith(lower)
    );
    const suffixOps = Object.keys(nodeOperators).filter(
      op => op.toLowerCase().endsWith(lower)
    );

    // When a suffix matches exactly 1 node + 1 operator, and the
    // node belongs to that operator, prefer the NODE view (the user
    // is looking at a specific node on the voting page, same as they
    // would by clicking a signer bubble). Otherwise prefer operator.
    if (suffixNodes.length === 1 && suffixOps.length === 1) {
      const opNodes = nodeOperators[suffixOps[0]] || [];
      if (opNodes.some(n => n.toLowerCase() === suffixNodes[0].toLowerCase())) {
        return { nodes: suffixNodes, operators: [] };
      }
      return { nodes: [], operators: suffixOps };
    }

    // Single operator match (multiple nodes may also match, but
    // operator is the right level — shows all nodes at once).
    if (suffixOps.length === 1 && suffixNodes.length >= 1) {
      return { nodes: [], operators: suffixOps };
    }

    // Single node match, no operator match
    if (suffixNodes.length === 1 && suffixOps.length === 0) {
      return { nodes: suffixNodes, operators: [] };
    }

    // 4. Partial contains match (fallback for longer substrings not at end)
    //    Same operator-first preference as suffix matching.
    const partialNodes = activeNodeAddresses.filter(
      addr => addr.toLowerCase().includes(lower)
    );
    const partialOps = Object.keys(nodeOperators).filter(
      op => op.toLowerCase().includes(lower)
    );

    const allNodes = [...new Set([...suffixNodes, ...partialNodes])];
    const allOps = [...new Set([...suffixOps, ...partialOps])];

    // Single operator match — prefer it
    if (allOps.length === 1) {
      return { nodes: [], operators: allOps };
    }

    // Single node match, no operator match
    if (allNodes.length === 1 && allOps.length === 0) {
      return { nodes: allNodes, operators: [] };
    }

    if (allNodes.length > 0 || allOps.length > 0) {
      return { nodes: allNodes, operators: allOps };
    }

    return { nodes: [], operators: [] };
  }

  async function doSearch(address, type) {
    if (!address || !address.trim()) return;

    const clean = address.trim();
    error = '';
    searchedAddress = clean;
    resolvedFullAddress = '';
    missingVotes = [];
    operatorNodes = [];

    try {

    const { nodes, operators } = resolveAddress(clean);

    // If user explicitly chose a type and we have matches for it, filter
    let targetNodes = nodes;
    let targetOps = operators;

    if (type === 'node' && targetNodes.length === 0 && targetOps.length > 0) {
      // User typed a suffix that only matched operators but said "node" — try anyway
    }
    if (type === 'operator' && targetOps.length === 0 && targetNodes.length > 0) {
      // User typed a suffix that only matched nodes but said "operator" — try anyway
    }

    const totalMatches = targetNodes.length + targetOps.length;

    if (totalMatches === 0) {
      error = 'No node or operator found matching that address or suffix.';
      missingVotes = [];
      operatorNodes = [];
      return;
    }

    // Ambiguous: search matches multiple nodes AND/OR operators
    if (totalMatches > 1) {
      // If one side has exactly 1 match, prefer that
      if (targetNodes.length === 1 && targetOps.length === 0) {
        targetOps = [];
      } else if (targetOps.length === 1 && targetNodes.length === 0) {
        targetNodes = [];
      } else {
        // True ambiguity — show a helpful error listing all matches
        const nodeList = targetNodes.map(n => getAddressSuffix(n, 4)).join(', ');
        const opList = targetOps.map(o => getAddressSuffix(o, 4)).join(', ');
        const parts = [];
        if (targetNodes.length) parts.push(`node${targetNodes.length > 1 ? 's' : ''}: ${nodeList}`);
        if (targetOps.length) parts.push(`operator${targetOps.length > 1 ? 's' : ''}: ${opList}`);
        error = `Ambiguous — matched multiple addresses (${parts.join('; ')}). Try a longer suffix or the full address.`;
        missingVotes = [];
        operatorNodes = [];
        return;
      }
    }

    // Exactly 1 match total — determine type
    if (targetNodes.length === 1) {
      searchType = 'node';
      const matchedAddress = targetNodes[0];
      resolvedFullAddress = matchedAddress;

      missingVotes = getMissingVotesForNode(matchedAddress, {
        mimirData,
        currentMimirValues,
        activeNodeAddresses,
        keyBlacklist: MIMIR_KEY_BLACKLIST
      });
      operatorNodes = [matchedAddress];

      // Update URL with full address so it's shareable
      const url = new URL(window.location);
      url.searchParams.delete('node');
      url.searchParams.delete('operator');
      url.searchParams.set('node', matchedAddress);
      window.history.pushState({}, '', url);
      return;
    }

    if (targetOps.length === 1) {
      searchType = 'operator';
      const matchedOp = targetOps[0];
      resolvedFullAddress = matchedOp;

      const result = getMissingVotesForOperator(matchedOp, {
        mimirData,
        currentMimirValues,
        activeNodeAddresses,
        nodeOperators,
        keyBlacklist: MIMIR_KEY_BLACKLIST
      });

      if (!result.operatorNodes.length) {
        error = 'Operator found but has no active nodes.';
        missingVotes = [];
        operatorNodes = [];
        return;
      }

      missingVotes = result.missingVotes;
      operatorNodes = result.operatorNodes;

      // Update URL with full address so it's shareable
      const url = new URL(window.location);
      url.searchParams.delete('node');
      url.searchParams.delete('operator');
      url.searchParams.set('operator', matchedOp);
      window.history.pushState({}, '', url);
      return;
    }

    // Shouldn't reach here, but guard
    error = 'Could not determine address type. Try a more specific search.';
    missingVotes = [];
    operatorNodes = [];
    } catch (e) {
      console.error('Search error:', e);
      error = `Search failed: ${e.message || 'Unknown error'}. Check console for details.`;
      missingVotes = [];
      operatorNodes = [];
    }
  }

  function handleSearch() {
    const clean = searchTerm.trim();
    if (!clean) return;
    doSearch(clean, 'auto');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  function handleRowClick(key) {
    // Navigate to voting page with this key
    window.open(`/voting?key=${encodeURIComponent(key)}`, '_blank');
  }

  // Track if we have any results to show
  $: hasResults = missingVotes.length > 0;
  $: totalActiveKeys = Object.keys(
    mimirData.reduce((acc, m) => {
      if (!MIMIR_KEY_BLACKLIST.includes(m.key) && activeNodeAddresses.includes(m.signer)) {
        acc[m.key] = true;
      }
      return acc;
    }, {})
  ).length;

  // Valid if at least 3 characters (minimum for a meaningful suffix)
  $: validInput = searchTerm.trim().length >= 3;
</script>

<div class="container">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
    <h2>Missing Votes Checker</h2>
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
          <h3>Votes Required</h3>
        </div>
        <p class="stat-value">{votesToPass}</p>
      </div>

      <div class="stat-box">
        <div class="stat-header">
          <h3>Active Mimir Keys</h3>
        </div>
        <p class="stat-value">{totalActiveKeys}</p>
      </div>
    </div>

    <div class="search-container">
      <div class="search-row">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Enter a node/operator address or suffix (e.g., r304, thor1...)"
          on:keydown={handleKeyDown}
          class:valid={validInput}
        />
        <button
          class="search-btn"
          on:click={handleSearch}
          disabled={!validInput}
        >
          Check
        </button>
      </div>
      <p class="search-hint">Enter a full address or just the last few characters (e.g., <code>r304</code>). The page will find the matching node or operator.</p>
    </div>

    {#if error}
      <div class="error-box">{error}</div>
    {/if}

    {#if searchedAddress && !error && searchType === 'operator' && operatorNodes.length > 0}
      {@const isShort = searchedAddress.length < 40}
      <div class="operator-info">
        <span class="operator-label">Operator:</span>
        <span class="operator-address" title={isShort ? resolvedFullAddress : ''}>
          {getAddressSuffix(resolvedFullAddress || searchedAddress, 4)}
        </span>
        {#if isShort && resolvedFullAddress && resolvedFullAddress !== searchedAddress}
          <span class="resolved-from">(from "{searchedAddress}")</span>
        {/if}
        <span class="operator-nodes">running {operatorNodes.length} node{operatorNodes.length > 1 ? 's' : ''}</span>
      </div>
    {/if}

    {#if searchedAddress && !error && searchType === 'node' && operatorNodes.length > 0}
      {@const isShort = searchedAddress.length < 40}
      <div class="operator-info">
        <span class="operator-label">Node:</span>
        <span class="operator-address" title={isShort ? resolvedFullAddress : ''}>
          {getAddressSuffix(resolvedFullAddress || searchedAddress, 4)}
        </span>
        {#if isShort && resolvedFullAddress && resolvedFullAddress !== searchedAddress}
          <span class="resolved-from">(from "{searchedAddress}")</span>
        {/if}
        {#if resolvedFullAddress}
          {@const op = Object.entries(nodeOperators).find(([_, nodes]) => nodes.includes(resolvedFullAddress))}
          {#if op}
            <span class="operator-nodes">operator: {getAddressSuffix(op[0], 4)}</span>
          {/if}
        {/if}
      </div>
    {/if}

    {#if searchedAddress && !error && hasResults}
      <div class="results-summary">
        {#if searchType === 'node'}
          <p>This node has <strong>not voted</strong> on <strong>{missingVotes.length}</strong> mimir key{missingVotes.length > 1 ? 's' : ''}:</p>
        {:else}
          <p>Found <strong>{missingVotes.length}</strong> mimir key{missingVotes.length > 1 ? 's' : ''} where at least one node hasn't voted:</p>
        {/if}
      </div>

      {#if !isMobile}
        <table>
          <thead>
            <tr>
              <th>Mimir Key</th>
            </tr>
          </thead>
          <tbody>
            {#each missingVotes as { key, missingNodes }}
              <tr>
                <td class="key-cell" on:click={() => handleRowClick(key)}>
                  <div class="key-name">{key}</div>
                  {#if searchType === 'operator' && missingNodes}
                    <div class="missing-nodes-label">
                      Missing: {missingNodes.map(n => n.suffix).join(', ')}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="mobile-cards">
          {#each missingVotes as { key, missingNodes }}
            <div class="mobile-card">
              <div class="mobile-key-section" on:click={() => handleRowClick(key)} on:keydown={(e) => e.key === 'Enter' && handleRowClick(key)} role="button" tabindex="0">
                <h3 class="mobile-key">{key}</h3>
                {#if searchType === 'operator' && missingNodes}
                  <div class="missing-nodes-label">
                    Missing: {missingNodes.map(n => n.suffix).join(', ')}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if searchedAddress && !error && !hasResults}
      <div class="no-results">
        <p>✓ This {searchType === 'node' ? 'node has' : "operator's nodes have"} voted on all active mimir keys!</p>
        <p class="sub-text">No missing votes found.</p>
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
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
  }

  .app-header {
    background: linear-gradient(135deg, #e84393 0%, #6c5ce7 100%);
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

  .app-header img {
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

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .stat-box {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 16px;
    height: 100px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stat-box:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(232, 67, 147, 0.6);
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

  .search-container {
    margin-bottom: 30px;
  }

  .search-row {
    display: flex;
    gap: 10px;
  }

  .search-row input {
    flex: 1;
    padding: 12px 16px;
    background-color: #2c2c2c;
    border: 1px solid #3a3a3c;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-family: 'Courier New', monospace;
    transition: all 0.3s ease;
  }

  .search-row input:focus {
    outline: none;
    border-color: #e84393;
    box-shadow: 0 0 0 2px rgba(232, 67, 147, 0.2);
  }

  .search-row input.valid {
    border-color: #2ecc71;
  }

  .search-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #e84393 0%, #6c5ce7 100%);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .search-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(232, 67, 147, 0.3);
  }

  .search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-hint {
    color: #666;
    font-size: 12px;
    margin-top: 8px;
    text-align: center;
  }

  .error-box {
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    color: #e74c3c;
    text-align: center;
  }

  .operator-info {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .operator-label {
    color: #888;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }

  .operator-address {
    color: #e84393;
    font-family: 'Courier New', monospace;
    font-weight: 600;
  }

  .resolved-from {
    color: #666;
    font-size: 12px;
    font-style: italic;
  }

  .operator-nodes {
    color: #888;
    margin-left: auto;
  }

  .results-summary {
    margin-bottom: 20px;
    color: #ccc;
    font-size: 15px;
    text-align: center;
  }

  .results-summary strong {
    color: #e84393;
  }

  .no-results {
    background: rgba(46, 204, 113, 0.1);
    border: 1px solid rgba(46, 204, 113, 0.3);
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    color: #2ecc71;
    font-size: 16px;
  }

  .no-results .sub-text {
    color: #666;
    font-size: 14px;
    margin-top: 8px;
  }

  table {
    width: 100%;
    table-layout: fixed;
    background-color: #1a1a1a;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    margin-bottom: 30px;
    border-collapse: separate;
    border-spacing: 0;
  }

  th {
    background: linear-gradient(135deg, #e84393 0%, #6c5ce7 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 20px;
    text-align: center;
    vertical-align: middle;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  th:first-child {
    width: 50%;
    border-right: 1px solid #3a3a3c;
  }

  td {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  tr {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    transition: all 0.2s ease;
  }

  tr:hover {
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  tr:not(:last-child) {
    border-bottom: 8px solid #1a1a1a;
  }

  .key-cell {
    padding: 12px 16px;
    white-space: nowrap;
    vertical-align: middle;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .key-cell:hover {
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
    transform: translateY(-1px);
  }

  .key-name {
    font-size: 14px;
    font-weight: 600;
    color: #e84393;
  }

  .current-value {
    font-size: 14px;
    color: #888;
    padding: 4px 8px;
    background: rgba(232, 67, 147, 0.1);
    border-radius: 4px;
    display: inline-block;
  }

  .last-voted {
    font-size: 11px;
    color: #666;
    margin-top: 4px;
    font-family: 'Courier New', monospace;
  }

  .missing-nodes-label {
    font-size: 12px;
    color: #e74c3c;
    margin-top: 6px;
    font-family: 'Courier New', monospace;
    font-weight: 600;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    margin-top: 40px;
  }

  /* Mobile layout */
  @media (max-width: 768px) {
    .container {
      padding: 20px 10px;
    }

    .stats-container {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .stat-box {
      height: 80px;
    }

    .stat-value {
      font-size: 20px;
    }

    .search-row {
      flex-direction: column;
    }

    .mobile-card {
      background-color: #2c2c2c;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .mobile-key-section {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #3a3a3c;
    }

    .mobile-key {
      color: #e84393;
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
    }

    .mobile-current-value {
      display: inline-block;
      font-size: 14px;
      color: #888;
      padding: 4px 8px;
      background: rgba(232, 67, 147, 0.1);
      border-radius: 4px;
    }

  }
</style>
