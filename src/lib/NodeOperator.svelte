<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import {
    fetchNode,
    fetchMimirKey,
    fetchWalletBalances,
    fetchNodeOperatorPerformance,
    fetchNodeOperatorLeaderboard,
    fetchNodeOperatorMeta,
    isValidThorAddress,
    toBaseAmount,
    fromBaseAmount,
    formatRune,
    getRuneBalanceFromBankResponse
  } from './node-operator/api.js';
  import {
    normalizeLeaderboardRows,
    getLeaderboardCellClass
  } from './node-operator/leaderboard.js';
  import {
    hasThorProvider,
    requestAccounts,
    depositThorTx
  } from './node-operator/wallet.js';

  const NODE_STORAGE_KEY = 'runetools-operator-node';
  const REFRESH_INTERVAL_MS = 6000;

  const slashPointsTween = tweened(0, {
    duration: 700,
    easing: cubicOut
  });

  const currentAwardTween = tweened(0, {
    duration: 700,
    easing: cubicOut
  });

  let nodeAddressInput = '';
  let nodeAddress = '';
  let nodeData = null;
  let performanceData = null;
  let backendMeta = null;
  let minimumBondInRune = 0;
  let churnIntervalBlocks = 0;
  let nodeError = '';
  let performanceError = '';

  let activeTab = 'performance';
  let isPaused = false;
  let isLoadingNode = false;

  let walletSupported = false;
  let walletConnected = false;
  let walletBusy = false;
  let walletAddress = '';
  let walletBalanceRune = 0;

  let txState = {
    status: 'idle',
    message: '',
    hash: '',
    error: ''
  };

  let confirmAction = null;

  let bondAmountRune = '';
  let unbondAmountRune = '';
  let whitelistProvider = '';
  let whitelistAmountRune = '0';
  let operatorFeeBps = '2000';
  let operatorFeeAmountRune = '0';

  let leaderboardRows = [];
  let leaderboardLoading = false;
  let leaderboardLoaded = false;
  let leaderboardRequested = false;
  let leaderboardError = '';
  let leaderboardRequestedWindows = 10;
  let leaderboardComputedWindows = 0;

  let refreshInterval;
  let toastTimeout;

  let showToast = false;
  let toastMessage = '';
  let toastType = 'info';

  $: nodeAddressValid = isValidThorAddress(nodeAddress);
  $: inputAddressValid = isValidThorAddress(nodeAddressInput.trim());

  $: providerRows = getProviderRows(nodeData);
  $: totalBondRune = fromBaseAmount(nodeData?.total_bond || 0);
  $: nodeOperatorFeeBps = Number(nodeData?.bond_providers?.node_operator_fee || 0);
  $: nodeOperatorFeePercent = nodeOperatorFeeBps / 100;

  $: chainSyncRows = Array.isArray(performanceData?.chain_sync) ? performanceData.chain_sync : [];
  $: jailState = {
    jailed: Boolean(performanceData?.jail?.jailed),
    status: performanceData?.jail?.jailed ? 'Jailed' : 'Free',
    releaseHeight: Number(performanceData?.jail?.release_height || 0),
    blocksRemaining: Number(performanceData?.jail?.blocks_remaining || 0),
    reason: performanceData?.jail?.reason || 'Unknown'
  };
  $: versionState = {
    node: performanceData?.version?.node || '-',
    majority: performanceData?.version?.majority || '',
    compliant: typeof performanceData?.version?.compliant === 'boolean'
      ? performanceData.version.compliant
      : null
  };
  $: preflightState = {
    status: performanceData?.preflight?.status || '-',
    reason: performanceData?.preflight?.reason || '-',
    code: Number(performanceData?.preflight?.code || 0)
  };
  $: performanceSourceHeight = Number(performanceData?.source_height || 0);
  $: canUnbond = isUnbondStatusAllowed(nodeData?.status);

  $: if (performanceData) {
    slashPointsTween.set(Number(performanceData.slash_points) || 0);
    currentAwardTween.set(Number(performanceData.current_award_rune) || 0);
  }

  $: if (activeTab === 'leaderboard' && !leaderboardRequested && !leaderboardLoading) {
    leaderboardRequested = true;
    loadLeaderboard(false);
  }

  function showToastMessage(message, type = 'info') {
    clearTimeout(toastTimeout);
    toastMessage = message;
    toastType = type;
    showToast = true;

    toastTimeout = setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  function formatAddress(address) {
    if (!address) return '-';
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  }

  function formatInteger(value) {
    return Intl.NumberFormat('en-US').format(Number(value) || 0);
  }

  function formatRuneValue(value, decimals = 2) {
    return formatRune(value, decimals);
  }

  function normalizeAddress(value) {
    return (value || '').trim();
  }

  function updateNodeAddressInUrl(address) {
    const url = new URL(window.location);

    if (address) {
      url.searchParams.set('node_address', address);
    } else {
      url.searchParams.delete('node_address');
    }

    window.history.replaceState({}, '', url);
  }

  function persistNodeAddress(address) {
    if (!address) {
      localStorage.removeItem(NODE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(NODE_STORAGE_KEY, address);
  }

  async function applyNodeAddress(nextAddress) {
    const normalized = normalizeAddress(nextAddress);
    nodeAddressInput = normalized;

    if (!isValidThorAddress(normalized)) {
      nodeData = null;
      performanceData = null;
      nodeAddress = '';
      nodeError = 'Node address must start with thor and be 43 characters.';
      performanceError = '';
      updateNodeAddressInUrl('');
      persistNodeAddress('');
      return;
    }

    nodeAddress = normalized;
    nodeError = '';
    updateNodeAddressInUrl(nodeAddress);
    persistNodeAddress(nodeAddress);

    await refreshNodeData();
  }

  async function loadNodeFromInput(event) {
    event.preventDefault();
    await applyNodeAddress(nodeAddressInput);
  }

  async function refreshWalletBalance() {
    if (!walletConnected || !walletAddress) {
      walletBalanceRune = 0;
      return;
    }

    try {
      const bankResponse = await fetchWalletBalances(walletAddress);
      walletBalanceRune = getRuneBalanceFromBankResponse(bankResponse);
    } catch (error) {
      console.error('Wallet balance fetch failed:', error);
      showToastMessage(`Wallet balance fetch failed: ${error.message}`, 'error');
    }
  }

  async function refreshNodeData() {
    if (!nodeAddressValid) {
      return;
    }

    isLoadingNode = true;
    nodeError = '';
    performanceError = '';

    const [nodeResult, performanceResult, minBondResult, churnIntervalResult, metaResult] = await Promise.allSettled([
      fetchNode(nodeAddress),
      fetchNodeOperatorPerformance(nodeAddress),
      fetchMimirKey('MinimumBondInRune'),
      fetchMimirKey('CHURNINTERVAL'),
      fetchNodeOperatorMeta()
    ]);

    if (nodeResult.status === 'fulfilled') {
      nodeData = nodeResult.value;
    } else {
      nodeData = null;
      nodeError = `Node lookup failed: ${nodeResult.reason?.message || 'Unknown error'}`;
    }

    if (performanceResult.status === 'fulfilled') {
      performanceData = performanceResult.value;
    } else {
      performanceData = null;
      performanceError = `Performance API failed: ${performanceResult.reason?.message || 'Unknown error'}`;
    }

    if (minBondResult.status === 'fulfilled') {
      minimumBondInRune = fromBaseAmount(minBondResult.value);
    }

    if (churnIntervalResult.status === 'fulfilled') {
      churnIntervalBlocks = Number(churnIntervalResult.value) || 0;
    }

    if (metaResult.status === 'fulfilled') {
      backendMeta = metaResult.value;
    }

    if (walletConnected) {
      await refreshWalletBalance();
    }

    isLoadingNode = false;
  }

  function getProviderRows(node) {
    const providers = node?.bond_providers?.providers || [];
    const totalBond = Number(node?.total_bond || 0);

    return providers.map((provider) => {
      const bond = Number(provider.bond) || 0;
      return {
        address: provider.bond_address,
        bondBase: bond,
        bondRune: fromBaseAmount(bond),
        sharePct: totalBond > 0 ? (bond / totalBond) * 100 : 0
      };
    });
  }

  function isUnbondStatusAllowed(status) {
    return ['Standby', 'Ready', 'Whitelisted', 'Disabled'].includes(status);
  }

  async function connectWallet() {
    if (!walletSupported) {
      showToastMessage('No THOR wallet provider detected. Install CTRL/XDEFI and retry.', 'error');
      return;
    }

    walletBusy = true;

    try {
      const accounts = await requestAccounts();
      walletAddress = accounts[0];
      walletConnected = true;
      await refreshWalletBalance();
      showToastMessage('Wallet connected', 'success');
    } catch (error) {
      walletConnected = false;
      walletAddress = '';
      walletBalanceRune = 0;
      showToastMessage(`Wallet connection failed: ${error.message}`, 'error');
    }

    walletBusy = false;
  }

  function prepareBondAction() {
    if (!walletConnected) {
      showToastMessage('Connect wallet before submitting transactions.', 'error');
      return;
    }

    const amountBase = toBaseAmount(bondAmountRune);
    if (amountBase <= 0) {
      showToastMessage('Bond amount must be greater than 0.', 'error');
      return;
    }

    confirmAction = {
      type: 'bond',
      label: 'Bond',
      amountBase,
      memo: `BOND:${nodeAddress}`,
      recipient: nodeAddress,
      details: [
        `Node: ${nodeAddress}`,
        `Amount: ${formatRuneValue(fromBaseAmount(amountBase), 4)} RUNE`
      ]
    };
  }

  function prepareUnbondAction() {
    if (!walletConnected) {
      showToastMessage('Connect wallet before submitting transactions.', 'error');
      return;
    }

    if (!canUnbond) {
      showToastMessage(`Unbond is disabled for status ${nodeData?.status || 'Unknown'}.`, 'error');
      return;
    }

    const amountBase = toBaseAmount(unbondAmountRune);
    if (amountBase <= 0) {
      showToastMessage('Unbond amount must be greater than 0.', 'error');
      return;
    }

    confirmAction = {
      type: 'unbond',
      label: 'Unbond',
      amountBase,
      memo: `UNBOND:${nodeAddress}:${amountBase}`,
      recipient: nodeAddress,
      details: [
        `Node: ${nodeAddress}`,
        `Amount: ${formatRuneValue(fromBaseAmount(amountBase), 4)} RUNE`
      ]
    };
  }

  function prepareWhitelistAction() {
    if (!walletConnected) {
      showToastMessage('Connect wallet before submitting transactions.', 'error');
      return;
    }

    const providerAddress = normalizeAddress(whitelistProvider);
    if (!isValidThorAddress(providerAddress)) {
      showToastMessage('Whitelist provider address must be a valid thor... address.', 'error');
      return;
    }

    const amountBase = toBaseAmount(whitelistAmountRune || '0');

    confirmAction = {
      type: 'whitelist',
      label: 'Whitelist Provider',
      amountBase,
      memo: `BOND:${nodeAddress}:${providerAddress}`,
      recipient: nodeAddress,
      details: [
        `Node: ${nodeAddress}`,
        `Provider: ${providerAddress}`,
        `Amount: ${formatRuneValue(fromBaseAmount(amountBase), 4)} RUNE`
      ]
    };
  }

  function prepareSetFeeAction() {
    if (!walletConnected) {
      showToastMessage('Connect wallet before submitting transactions.', 'error');
      return;
    }

    const feeBps = Math.trunc(Number(operatorFeeBps));
    if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10000) {
      showToastMessage('Operator fee must be between 0 and 10000 bps.', 'error');
      return;
    }

    const amountBase = toBaseAmount(operatorFeeAmountRune || '0');
    const operatorAddress = nodeData?.node_operator_address || walletAddress;

    confirmAction = {
      type: 'set-fee',
      label: 'Set Operator Fee',
      amountBase,
      memo: `BOND:${nodeAddress}:${operatorAddress}:${feeBps}`,
      recipient: nodeAddress,
      details: [
        `Node: ${nodeAddress}`,
        `Operator: ${operatorAddress}`,
        `Fee: ${feeBps} bps (${(feeBps / 100).toFixed(2)}%)`,
        `Amount: ${formatRuneValue(fromBaseAmount(amountBase), 4)} RUNE`
      ]
    };
  }

  function closeConfirmAction() {
    confirmAction = null;
  }

  async function executeConfirmedAction() {
    if (!confirmAction || !walletConnected || !walletAddress) {
      return;
    }

    txState = {
      status: 'pending',
      message: `Submitting ${confirmAction.label} transaction...`,
      hash: '',
      error: ''
    };

    const action = confirmAction;

    try {
      const txResult = await depositThorTx({
        from: walletAddress,
        recipient: action.recipient,
        amountBase: action.amountBase,
        memo: action.memo
      });

      txState = {
        status: 'success',
        message: `${action.label} transaction submitted successfully.`,
        hash: txResult.txHash || '',
        error: ''
      };

      showToastMessage(`${action.label} transaction submitted.`, 'success');
      confirmAction = null;

      await refreshWalletBalance();

      setTimeout(() => {
        refreshNodeData();
      }, 6000);
    } catch (error) {
      let message = error.message || `${action.label} transaction failed`;

      if (action.amountBase === 0) {
        message += ' Retry with a non-zero amount if wallet/provider rejects zero-amount deposits.';
      }

      txState = {
        status: 'error',
        message: `${action.label} failed.`,
        hash: '',
        error: message
      };

      showToastMessage(message, 'error');
      confirmAction = null;
    }
  }

  async function loadLeaderboard(forceRefresh = false) {
    leaderboardLoading = true;
    leaderboardError = '';

    try {
      const response = await fetchNodeOperatorLeaderboard({
        windows: 10,
        minParticipation: 3,
        forceRefresh
      });

      leaderboardRows = normalizeLeaderboardRows(response?.rows, 10);
      leaderboardRequestedWindows = Number(response?.requested_windows) || 10;
      leaderboardComputedWindows = Number(response?.computed_windows) || 0;
      leaderboardLoaded = true;
    } catch (error) {
      leaderboardError = error.message || 'Failed to load leaderboard.';
      leaderboardRows = [];
      leaderboardLoaded = false;
    }

    leaderboardLoading = false;
  }

  function togglePause() {
    isPaused = !isPaused;

    if (!isPaused && nodeAddressValid) {
      refreshNodeData();
    }
  }

  async function refreshNow() {
    await refreshNodeData();
  }

  onMount(async () => {
    walletSupported = hasThorProvider();

    const urlParams = new URLSearchParams(window.location.search);
    const urlNode = normalizeAddress(urlParams.get('node_address') || '');
    const savedNode = normalizeAddress(localStorage.getItem(NODE_STORAGE_KEY) || '');

    const initialNode = isValidThorAddress(urlNode)
      ? urlNode
      : (isValidThorAddress(savedNode) ? savedNode : '');

    if (initialNode) {
      nodeAddressInput = initialNode;
      await applyNodeAddress(initialNode);
    }

    refreshInterval = setInterval(() => {
      if (!isPaused && nodeAddressValid) {
        refreshNodeData();
      }
    }, REFRESH_INTERVAL_MS);
  });

  onDestroy(() => {
    clearTimeout(toastTimeout);
    clearInterval(refreshInterval);
  });
</script>

<div class="node-operator-page">
  <div class="top-controls">
    <form class="node-form" on:submit={loadNodeFromInput}>
      <label for="node-address">Node Address</label>
      <div class="node-input-row">
        <input
          id="node-address"
          type="text"
          bind:value={nodeAddressInput}
          placeholder="thor1..."
          autocomplete="off"
        />
        <button type="submit" disabled={!inputAddressValid || isLoadingNode}>Load Node</button>
      </div>
      {#if nodeAddress && nodeAddressValid}
        <small>Tracking node: {nodeAddress}</small>
      {/if}
    </form>

    <div class="wallet-panel">
      <div class="wallet-header">
        <span class="wallet-title">Wallet</span>
        <span class={`wallet-status ${walletConnected ? 'connected' : 'disconnected'}`}>
          {walletConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div class="wallet-row">
        <button on:click={connectWallet} disabled={walletBusy || !walletSupported}>
          {#if walletBusy}
            Connecting...
          {:else if walletConnected}
            Reconnect Wallet
          {:else}
            Connect Wallet
          {/if}
        </button>
      </div>
      <div class="wallet-balance">
        <strong>{formatRuneValue(walletBalanceRune, 4)} RUNE</strong>
        {#if walletAddress}
          <small>{formatAddress(walletAddress)}</small>
        {/if}
      </div>
      {#if !walletSupported}
        <small class="warn">No `window.xfi.thorchain` provider detected.</small>
      {/if}
    </div>

    <div class="refresh-panel">
      <button on:click={refreshNow} disabled={!nodeAddressValid || isLoadingNode}>Refresh</button>
      <button on:click={togglePause} disabled={!nodeAddressValid}>
        {isPaused ? 'Resume 6s Refresh' : 'Pause 6s Refresh'}
      </button>
      <small>{churnIntervalBlocks > 0 ? `CHURNINTERVAL: ${formatInteger(churnIntervalBlocks)} blocks` : ''}</small>
    </div>
  </div>

  <div class="tab-row">
    <button class:active={activeTab === 'management'} on:click={() => (activeTab = 'management')}>Management</button>
    <button class:active={activeTab === 'performance'} on:click={() => (activeTab = 'performance')}>Performance</button>
    <button class:active={activeTab === 'leaderboard'} on:click={() => (activeTab = 'leaderboard')}>Leaderboard</button>
  </div>

  {#if nodeError}
    <div class="alert error">{nodeError}</div>
  {/if}

  {#if performanceError && activeTab === 'performance'}
    <div class="alert error">{performanceError}</div>
  {/if}

  {#if isLoadingNode}
    <div class="alert info">Refreshing node data...</div>
  {/if}

  {#if activeTab === 'management'}
    <section class="tab-content" in:fade={{ duration: 180 }}>
      <h3>Node Management</h3>

      {#if !nodeData}
        <div class="empty-state">Load a valid node to access management actions.</div>
      {:else}
        <div class="summary-grid">
          <article>
            <h4>Status</h4>
            <p>{nodeData.status}</p>
          </article>
          <article>
            <h4>Total Bond</h4>
            <p>{formatRuneValue(totalBondRune, 2)} RUNE</p>
          </article>
          <article>
            <h4>Operator</h4>
            <p>{formatAddress(nodeData.node_operator_address)}</p>
          </article>
          <article>
            <h4>Operator Fee</h4>
            <p>{nodeOperatorFeePercent.toFixed(2)}%</p>
          </article>
          <article>
            <h4>Min Bond</h4>
            <p>{formatRuneValue(minimumBondInRune, 0)} RUNE</p>
          </article>
          <article>
            <h4>Providers</h4>
            <p>{providerRows.length}</p>
          </article>
        </div>

        <div class="management-grid">
          <article class="action-card">
            <h4>Bond</h4>
            <label for="bond-amount-input">Amount (RUNE)</label>
            <input id="bond-amount-input" type="number" min="0" step="0.00000001" bind:value={bondAmountRune} />
            <button on:click={prepareBondAction} disabled={!walletConnected}>Bond</button>
          </article>

          <article class="action-card">
            <h4>Unbond</h4>
            <label for="unbond-amount-input">Amount (RUNE)</label>
            <input id="unbond-amount-input" type="number" min="0" step="0.00000001" bind:value={unbondAmountRune} />
            <button on:click={prepareUnbondAction} disabled={!walletConnected || !canUnbond}>Unbond</button>
            {#if !canUnbond}
              <small>Unbond is disabled for current status.</small>
            {/if}
          </article>

          <article class="action-card">
            <h4>Whitelist Provider</h4>
            <label for="whitelist-provider-input">Provider Address</label>
            <input id="whitelist-provider-input" type="text" bind:value={whitelistProvider} placeholder="thor1..." />
            <label for="whitelist-amount-input">Advanced Amount (RUNE, optional)</label>
            <input id="whitelist-amount-input" type="number" min="0" step="0.00000001" bind:value={whitelistAmountRune} />
            <button on:click={prepareWhitelistAction} disabled={!walletConnected}>Whitelist</button>
          </article>

          <article class="action-card">
            <h4>Set Operator Fee</h4>
            <label for="operator-fee-bps-input">Operator Fee (bps)</label>
            <input id="operator-fee-bps-input" type="number" min="0" max="10000" step="1" bind:value={operatorFeeBps} />
            <label for="operator-fee-amount-input">Advanced Amount (RUNE, optional)</label>
            <input id="operator-fee-amount-input" type="number" min="0" step="0.00000001" bind:value={operatorFeeAmountRune} />
            <button on:click={prepareSetFeeAction} disabled={!walletConnected}>Set Fee</button>
          </article>
        </div>

        <article class="providers-card">
          <h4>Bond Providers</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Bond (RUNE)</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {#each providerRows as provider}
                  <tr>
                    <td class="mono">{provider.address}</td>
                    <td>{formatRuneValue(provider.bondRune, 2)}</td>
                    <td>{provider.sharePct.toFixed(2)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </article>

        {#if txState.status !== 'idle'}
          <article class={`tx-state ${txState.status}`}>
            <h4>Transaction Status</h4>
            <p>{txState.message}</p>
            {#if txState.hash}
              <p class="mono">Hash: {txState.hash}</p>
            {/if}
            {#if txState.error}
              <p class="error-text">{txState.error}</p>
            {/if}
          </article>
        {/if}
      {/if}
    </section>
  {/if}

  {#if activeTab === 'performance'}
    <section class="tab-content" in:fade={{ duration: 180 }}>
      <h3>Node Performance</h3>

      {#if !nodeAddressValid}
        <div class="empty-state">Load a valid node to view performance metrics.</div>
      {:else if !performanceData}
        <div class="empty-state">Performance backend has no sample for this node yet.</div>
      {:else}
        <div class="summary-grid">
          <article>
            <h4>Slash Points</h4>
            <p>{Math.round($slashPointsTween)}</p>
          </article>
          <article>
            <h4>Current Award</h4>
            <p>{formatRuneValue($currentAwardTween, 4)} RUNE</p>
          </article>
          <article>
            <h4>Jail Status</h4>
            <p>{jailState.status}</p>
            <small>{jailState.jailed ? `${formatInteger(jailState.blocksRemaining)} blocks remaining` : 'No active jail'}</small>
          </article>
          <article>
            <h4>Missing Blocks</h4>
            <p>{formatInteger(performanceData.missing_blocks || 0)}</p>
          </article>
          <article>
            <h4>Version</h4>
            <p>{versionState.node}</p>
            <small>{versionState.majority ? `Majority: ${versionState.majority}` : 'No majority available'}</small>
          </article>
          <article>
            <h4>Preflight</h4>
            <p>{preflightState.status}</p>
            <small>{preflightState.reason}</small>
          </article>
        </div>

        <article class="status-card">
          <h4>Version Compliance</h4>
          {#if versionState.compliant === null}
            <p>Not enough data to determine compliance.</p>
          {:else if versionState.compliant}
            <p class="success">Node version matches the majority active version.</p>
          {:else}
            <p class="warn-text">Node version differs from majority active version.</p>
          {/if}
        </article>

        <article class="status-card">
          <h4>Jail Details</h4>
          <p><strong>Status:</strong> {jailState.status}</p>
          <p><strong>Reason:</strong> {jailState.reason}</p>
          <p><strong>Release Height:</strong> {jailState.releaseHeight ? formatInteger(jailState.releaseHeight) : '-'}</p>
          <p><strong>Current THOR Height:</strong> {formatInteger(performanceSourceHeight)}</p>
          {#if backendMeta?.data_freshness_seconds >= 0}
            <p><strong>Backend Freshness:</strong> {formatInteger(backendMeta.data_freshness_seconds)}s</p>
          {/if}
        </article>

        <article class="providers-card">
          <h4>Chain Sync Lag</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>Node Height</th>
                  <th>Network Max</th>
                  <th>Lag</th>
                </tr>
              </thead>
              <tbody>
                {#each chainSyncRows as row}
                  <tr>
                    <td>{row.chain}</td>
                    <td>{formatInteger(row.node_height)}</td>
                    <td>{formatInteger(row.network_max)}</td>
                    <td>{formatInteger(row.lag)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </article>
      {/if}
    </section>
  {/if}

  {#if activeTab === 'leaderboard'}
    <section class="tab-content" in:fade={{ duration: 180 }}>
      <div class="leaderboard-header">
        <h3>Slash Leaderboard (Last 10 Churns)</h3>
        <button on:click={() => loadLeaderboard(true)} disabled={leaderboardLoading}>
          {leaderboardLoading ? 'Refreshing...' : 'Manual Refresh'}
        </button>
      </div>

      {#if leaderboardError}
        <div class="alert error">{leaderboardError}</div>
      {/if}

      <div class="leaderboard-meta">
        <span>Computed from {leaderboardComputedWindows}/{leaderboardRequestedWindows} churn windows</span>
        <span>Scoring uses `max(0, endSlash - startSlash)`</span>
      </div>

      {#if leaderboardRows.length === 0 && !leaderboardLoading && !leaderboardError}
        <div class="empty-state">No rows matched participation filter (3+ churn windows).</div>
      {/if}

      {#if leaderboardRows.length > 0}
        <div class="table-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Node</th>
                <th>C1</th>
                <th>C2</th>
                <th>C3</th>
                <th>C4</th>
                <th>C5</th>
                <th>C6</th>
                <th>C7</th>
                <th>C8</th>
                <th>C9</th>
                <th>C10</th>
                <th>Total</th>
                <th>Avg/Churn</th>
                <th>Participation</th>
              </tr>
            </thead>
            <tbody>
              {#each leaderboardRows as row}
                <tr class:highlight={row.node_address === nodeAddress}>
                  <td>{row.rank}</td>
                  <td class="mono">{formatAddress(row.node_address)}</td>
                  {#each row.perWindow as value}
                    <td class={getLeaderboardCellClass(value)}>{value == null ? '-' : value}</td>
                  {/each}
                  <td>{row.total}</td>
                  <td>{row.avgPerChurn.toFixed(2)}</td>
                  <td>{row.participation}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}

  {#if confirmAction}
    <div class="modal-overlay" transition:fade>
      <div class="modal-card">
        <h4>Confirm {confirmAction.label}</h4>
        <p>This action will submit a THOR deposit with the following memo:</p>
        <p class="mono memo">{confirmAction.memo}</p>

        <ul>
          {#each confirmAction.details as detail}
            <li>{detail}</li>
          {/each}
        </ul>

        <div class="modal-actions">
          <button class="ghost" on:click={closeConfirmAction}>Cancel</button>
          <button class="primary" on:click={executeConfirmedAction}>Confirm</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showToast}
    <div class={`toast ${toastType}`} transition:fade>
      {toastMessage}
    </div>
  {/if}
</div>

<style>
  .node-operator-page {
    color: #e8edf2;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    max-width: 1280px;
    padding: 1rem;
    text-align: left;
    width: 100%;
  }

  .top-controls {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1.8fr 1.2fr 1fr;
  }

  .node-form,
  .wallet-panel,
  .refresh-panel,
  .summary-grid article,
  .action-card,
  .providers-card,
  .status-card,
  .tx-state,
  .empty-state,
  .alert {
    background: #222b33;
    border: 1px solid #314150;
    border-radius: 12px;
  }

  .node-form,
  .wallet-panel,
  .refresh-panel,
  .providers-card,
  .status-card,
  .tx-state,
  .empty-state,
  .alert {
    padding: 0.9rem;
  }

  .node-form label,
  .action-card label {
    color: #9fb4c6;
    display: block;
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
  }

  .node-input-row {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr auto;
  }

  input {
    background: #11181f;
    border: 1px solid #355168;
    border-radius: 8px;
    color: #e8edf2;
    font-size: 0.95rem;
    padding: 0.6rem 0.7rem;
    width: 100%;
  }

  button {
    background: #0f6fbc;
    border: 1px solid #2783cf;
    border-radius: 8px;
    color: #ffffff;
    cursor: pointer;
    font-weight: 600;
    padding: 0.55rem 0.75rem;
    transition: background 0.2s ease;
  }

  button:hover:not(:disabled) {
    background: #1190ec;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .wallet-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }

  .wallet-title {
    font-weight: 700;
  }

  .wallet-status {
    border-radius: 999px;
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
  }

  .wallet-status.connected {
    background: rgba(37, 183, 99, 0.18);
    border: 1px solid rgba(37, 183, 99, 0.45);
    color: #95ffbf;
  }

  .wallet-status.disconnected {
    background: rgba(230, 73, 73, 0.16);
    border: 1px solid rgba(230, 73, 73, 0.35);
    color: #ffafaf;
  }

  .wallet-row {
    margin-bottom: 0.6rem;
  }

  .wallet-row button,
  .refresh-panel button {
    width: 100%;
  }

  .wallet-balance {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .wallet-balance strong {
    font-size: 1.05rem;
  }

  .wallet-balance small,
  .warn,
  .refresh-panel small,
  .node-form small {
    color: #9fb4c6;
  }

  .refresh-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    justify-content: flex-start;
  }

  .tab-row {
    display: flex;
    gap: 0.5rem;
  }

  .tab-row button {
    background: #1d2832;
    border-color: #304353;
    color: #b7c9d8;
  }

  .tab-row button.active {
    background: #0f6fbc;
    border-color: #2f91de;
    color: #fff;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h3 {
    margin: 0;
  }

  .summary-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summary-grid article {
    padding: 0.9rem;
  }

  .summary-grid h4 {
    color: #9db4c9;
    font-size: 0.85rem;
    margin: 0 0 0.4rem;
  }

  .summary-grid p {
    font-size: 1.08rem;
    margin: 0;
  }

  .summary-grid small {
    color: #9db4c9;
    display: block;
    margin-top: 0.2rem;
  }

  .management-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .action-card {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.9rem;
  }

  .action-card h4 {
    margin: 0 0 0.2rem;
  }

  .action-card small {
    color: #d9a970;
  }

  .providers-card h4,
  .status-card h4,
  .tx-state h4 {
    margin-top: 0;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    min-width: 720px;
    width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid #344758;
    font-size: 0.9rem;
    padding: 0.55rem;
    text-align: left;
    white-space: nowrap;
  }

  th {
    color: #a6bbce;
    font-weight: 600;
  }

  .mono {
    font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  .status-card p {
    margin: 0.3rem 0;
  }

  .status-card .success {
    color: #92f7b8;
  }

  .status-card .warn-text {
    color: #ffc880;
  }

  .tx-state.pending {
    border-color: #5a8eb6;
  }

  .tx-state.success {
    border-color: #48a777;
  }

  .tx-state.error {
    border-color: #bf5f5f;
  }

  .tx-state .error-text {
    color: #ffb6b6;
  }

  .leaderboard-header {
    align-items: center;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

  .leaderboard-meta {
    color: #9bb2c6;
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 0.25rem;
  }

  .leaderboard-table {
    min-width: 1160px;
  }

  .leaderboard-table tr.highlight {
    background: rgba(25, 124, 204, 0.2);
  }

  .leaderboard-table td.cell-good {
    background: rgba(56, 184, 106, 0.24);
  }

  .leaderboard-table td.cell-warn {
    background: rgba(208, 166, 74, 0.22);
  }

  .leaderboard-table td.cell-bad {
    background: rgba(215, 92, 92, 0.22);
  }

  .leaderboard-table td.cell-empty {
    color: #6e889d;
  }

  .alert.info {
    border-color: #4e7898;
    color: #bdd8ec;
  }

  .alert.error {
    border-color: #b35d5d;
    color: #ffc0c0;
  }

  .empty-state {
    color: #9bb2c6;
  }

  .modal-overlay {
    align-items: center;
    background: rgba(10, 16, 22, 0.7);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 1rem;
    position: fixed;
    z-index: 3000;
  }

  .modal-card {
    background: #1f2932;
    border: 1px solid #38506a;
    border-radius: 12px;
    max-width: 680px;
    padding: 1rem;
    width: 100%;
  }

  .modal-card h4 {
    margin-top: 0;
  }

  .modal-card .memo {
    background: #111820;
    border: 1px solid #33506b;
    border-radius: 8px;
    padding: 0.6rem;
    word-break: break-all;
  }

  .modal-card ul {
    margin: 0.6rem 0 0;
    padding-left: 1.1rem;
  }

  .modal-card li {
    margin: 0.25rem 0;
  }

  .modal-actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
    margin-top: 0.8rem;
  }

  .modal-actions .ghost {
    background: transparent;
    border-color: #4c6478;
    color: #dce7ef;
  }

  .modal-actions .primary {
    background: #0f6fbc;
  }

  .toast {
    border-radius: 8px;
    bottom: 1rem;
    left: 50%;
    max-width: 640px;
    padding: 0.65rem 0.9rem;
    position: fixed;
    transform: translateX(-50%);
    z-index: 3200;
  }

  .toast.info {
    background: #224463;
    border: 1px solid #36678d;
    color: #d8ecff;
  }

  .toast.success {
    background: #1f5740;
    border: 1px solid #338962;
    color: #d3fbe6;
  }

  .toast.error {
    background: #5d2f2f;
    border: 1px solid #a95757;
    color: #ffe0e0;
  }

  @media (max-width: 1024px) {
    .top-controls {
      grid-template-columns: 1fr;
    }

    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .management-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .tab-row {
      flex-wrap: wrap;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .leaderboard-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .modal-actions {
      justify-content: stretch;
    }

    .modal-actions button {
      width: 100%;
    }
  }
</style>
