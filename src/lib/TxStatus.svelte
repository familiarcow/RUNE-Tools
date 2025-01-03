<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let txId = '';
  let txData = null;
  let midgardData = null;
  let loading = false;
  let error = null;
  let toast = { message: '', visible: false };
  let activeTab = 'thornode';
  let selectedExplorer = 'etherscan.io';
  let showRealValues = false;
  let isValidTx = false;

  const explorers = [
    { name: 'Etherscan', url: 'https://etherscan.io/tx/' },
    { name: 'Snowtrace', url: 'https://snowtrace.io/tx/' },
    { name: 'BscScan', url: 'https://bscscan.com/tx/' },
    { name: 'Blockchair', url: 'https://blockchair.com/search?q=' },
    { name: 'Mempool.space', url: 'https://mempool.space/tx/' },
    { name: 'Mintscan', url: 'https://www.mintscan.io/thorchain/txs/' },
    { name: 'RuneScan', url: 'https://runescan.io/tx/' },
  ];

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlTxId = urlParams.get('txid');
    if (urlTxId) {
      txId = urlTxId;
      fetchTxStatus();
      fetchMidgardActions();
    }
  });

  async function fetchTxStatus() {
    loading = true;
    error = null;
    try {
      const cleanedTxId = txId.startsWith('0x') ? txId.slice(2) : txId;
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/tx/status/${cleanedTxId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transaction status');
      }
      txData = await response.json();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function fetchMidgardActions() {
    loading = true;
    error = null;
    try {
      const cleanedTxId = txId.startsWith('0x') ? txId : txId;
      const response = await fetch(`https://midgard.ninerealms.com/v2/actions?txid=${cleanedTxId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Midgard actions');
      }
      midgardData = await response.json();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleSubmit() {
    if (txId) {
      const cleanedTxId = txId.startsWith('0x') ? txId.slice(2) : txId;
      fetchTxStatus(cleanedTxId);
      fetchMidgardActions(cleanedTxId);
      const newUrl = `/tx?txid=${cleanedTxId}`;
      history.pushState(null, '', newUrl);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied: ${text}`);
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  }

  function showToast(message) {
    toast = { message, visible: true };
    setTimeout(() => {
      toast = { message: '', visible: false };
    }, 500);
  }

  function setActiveTab(tab) {
    activeTab = tab;
  }

  function openExplorer() {
    if (txId) {
      const explorer = explorers.find(e => e.url.includes(selectedExplorer));
      if (explorer) {
        const cleanedTxId = txId.startsWith('0x') ? txId : txId;
        const prefix = ['etherscan.io', 'bscscan.com', 'snowtrace.io'].some(url => explorer.url.includes(url)) ? '0x' : '';
        window.open(explorer.url + prefix + cleanedTxId, '_blank');
      }
    }
  }

  $: formatAmount = (amount) => {
    if (showRealValues) {
      return (Number(amount) / 1e8).toFixed(8);
    }
    return amount.toString();
  };

  function toggleRealValues() {
    showRealValues = !showRealValues;
    txData = {...txData};
    midgardData = {...midgardData};
  }

  function setDefaultExplorer() {
    if (txData && txData.tx && txData.tx.chain) {
      const chain = txData.tx.chain.toLowerCase();
      switch (chain) {
        case 'btc':
        case 'ltc':
        case 'bch':
        case 'doge':
          selectedExplorer = 'https://blockchair.com/search?q=';
          break;
        case 'eth':
          selectedExplorer = 'https://etherscan.io/tx/';
          break;
        case 'bsc':
          selectedExplorer = 'https://bscscan.com/tx/';
          break;
        case 'avax':
          selectedExplorer = 'https://snowtrace.io/tx/';
          break;
        case 'atom':
          selectedExplorer = 'https://www.mintscan.io/thorchain/txs/';
          break;
        case 'thor':
          selectedExplorer = 'https://runescan.io/tx/';
          break;
        default:
          // Keep the current selection or set a default
          break;
      }
    }
  }

  $: if (txData) setDefaultExplorer();

  function getLatestStatus(stages) {
    if (!stages) return 'Unknown';

    if (stages.inbound_finalised && !stages.inbound_finalised.completed) {
      return 'Awaiting Confirmation Counting';
    }

    if (stages.outbound_delay && !stages.outbound_delay.completed) {
      const remainingSeconds = stages.outbound_delay.remaining_delay_seconds || 0;
      return `Outbound delay: ${remainingSeconds} seconds remaining`;
    }

    if (stages.swap_finalised && stages.swap_finalised.completed && 
        stages.outbound_signed && stages.outbound_signed.completed) {
      return 'Completed';
    }

    if (stages.outbound_signed && !stages.outbound_signed.completed) {
      return 'Outbound scheduled';
    }

    return 'Processing';
  }

  function getStatusColor(status) {
    if (status === 'Completed') return 'green';
    if (status.includes('Pending') || status.includes('Awaiting')) return 'orange';
    return 'blue';
  }

  $: {
    isValidTx = txData && txData.tx && txData.tx.id;
  }
</script>

<div class="tx-status-container">
  <h2>Transaction Status</h2>
  
  {#if txData && txData.stages}
    <div class="status-summary" style="background-color: {getStatusColor(getLatestStatus(txData.stages))}">
      <span class="status-label">Status:</span>
      <span class="status-value">{getLatestStatus(txData.stages)}</span>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <input
      type="text"
      bind:value={txId}
      placeholder="Enter Transaction ID"
      required
    />
    <button type="submit">Check Status</button>
  </form>

  {#if isValidTx}
    <div class="controls-container">
      <div class="explorer-search">
        <select bind:value={selectedExplorer}>
          {#each explorers as explorer}
            <option value={explorer.url}>{explorer.name}</option>
          {/each}
        </select>
        <button on:click={openExplorer}>Go</button>
      </div>
      <button on:click={toggleRealValues} class:active={showRealValues}>
        {showRealValues ? 'Show Raw Values' : 'Show Real Values'}
      </button>
    </div>
  {/if}

  {#if loading}
    <p class="loading">Loading...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if txData || (midgardData && midgardData.actions.length > 0)}
    <div class="tabs">
      {#if txData}
        <button class:active={activeTab === 'thornode'} on:click={() => setActiveTab('thornode')}>Thornode Status</button>
      {/if}
      {#if midgardData && midgardData.actions.length > 0}
        <button class:active={activeTab === 'midgard'} on:click={() => setActiveTab('midgard')}>Midgard Actions</button>
      {/if}
    </div>

    {#if activeTab === 'thornode' && txData}
      <div class="tx-details">
        <section>
          <h3>Transaction Details</h3>
          <div class="detail-item" on:click={() => copyToClipboard(txData.tx.id)}>
            <span class="label">ID:</span>
            <span class="value">{txData.tx.id}</span>
          </div>
          <div class="detail-item" on:click={() => copyToClipboard(txData.tx.chain)}>
            <span class="label">Chain:</span>
            <span class="value">{txData.tx.chain}</span>
          </div>
          <div class="detail-item" on:click={() => copyToClipboard(txData.tx.from_address)}>
            <span class="label">From:</span>
            <span class="value">{txData.tx.from_address}</span>
          </div>
          <div class="detail-item" on:click={() => copyToClipboard(txData.tx.to_address)}>
            <span class="label">To:</span>
            <span class="value">{txData.tx.to_address}</span>
          </div>
          <div class="detail-item" on:click={() => copyToClipboard(txData.tx.memo)}>
            <span class="label">Memo:</span>
            <span class="value">{txData.tx.memo}</span>
          </div>

          <div class="nested-item">
            <h4>Coins</h4>
            {#if Array.isArray(txData.tx.coins)}
              {#each txData.tx.coins as coin, index}
                <div class="coin-item">
                  <h5>Coin {index + 1}</h5>
                  <div class="detail-item" on:click={() => copyToClipboard(coin.asset)}>
                    <span class="label">Asset:</span>
                    <span class="value">{coin.asset}</span>
                  </div>
                  <div class="detail-item" on:click={() => copyToClipboard(coin.amount)}>
                    <span class="label">Amount:</span>
                    <span class="value">{formatAmount(coin.amount)}</span>
                  </div>
                  {#if coin.decimals !== undefined}
                    <div class="detail-item" on:click={() => copyToClipboard(coin.decimals)}>
                      <span class="label">Decimals:</span>
                      <span class="value">{coin.decimals}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            {:else}
              <p>No coins information available</p>
            {/if}
          </div>
        </section>

        <section>
          <h4>Gas</h4>
          {#if Array.isArray(txData.tx.gas)}
            {#each txData.tx.gas as gas, index}
              <div class="nested-item">
                <h5>Gas {index + 1}</h5>
                <div class="detail-item" on:click={() => copyToClipboard(gas.asset)}>
                  <span class="label">Asset:</span>
                  <span class="value">{gas.asset}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(gas.amount)}>
                  <span class="label">Amount:</span>
                  <span class="value">{formatAmount(gas.amount)}</span>
                </div>
              </div>
            {/each}
          {:else if txData.tx.gas}
            <div class="nested-item">
              <h5>Gas</h5>
              <div class="detail-item" on:click={() => copyToClipboard(txData.tx.gas.asset)}>
                <span class="label">Asset:</span>
                <span class="value">{txData.tx.gas.asset}</span>
              </div>
              <div class="detail-item" on:click={() => copyToClipboard(txData.tx.gas.amount)}>
                <span class="label">Amount:</span>
                <span class="value">{formatAmount(txData.tx.gas.amount)}</span>
              </div>
            </div>
          {:else}
            <p>No gas information available</p>
          {/if}
        </section>

        {#if txData.planned_out_txs && txData.planned_out_txs.length > 0}
          <section>
            <h3>Planned Out Transactions</h3>
            {#each txData.planned_out_txs as outTx, index}
              <div class="out-tx">
                <h4>Planned Out Transaction {index + 1}</h4>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.chain)}>
                  <span class="label">Chain:</span>
                  <span class="value">{outTx.chain}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.to_address)}>
                  <span class="label">To:</span>
                  <span class="value">{outTx.to_address}</span>
                </div>
                <div class="nested-item">
                  <h5>Coin</h5>
                  <div class="detail-item" on:click={() => copyToClipboard(outTx.coin.asset)}>
                    <span class="label">Asset:</span>
                    <span class="value">{outTx.coin.asset}</span>
                  </div>
                  <div class="detail-item" on:click={() => copyToClipboard(outTx.coin.amount)}>
                    <span class="label">Amount:</span>
                    <span class="value">{formatAmount(outTx.coin.amount)}</span>
                  </div>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.refund.toString())}>
                  <span class="label">Refund:</span>
                  <span class="value">{outTx.refund ? 'Yes' : 'No'}</span>
                </div>
              </div>
            {/each}
          </section>
        {/if}

        {#if txData.out_txs && txData.out_txs.length > 0}
          <section>
            <h3>Actual Out Transactions</h3>
            {#each txData.out_txs as outTx, index}
              <div class="out-tx">
                <h4>Out Transaction {index + 1}</h4>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.id)}>
                  <span class="label">ID:</span>
                  <span class="value">{outTx.id}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.chain)}>
                  <span class="label">Chain:</span>
                  <span class="value">{outTx.chain}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.from_address)}>
                  <span class="label">From:</span>
                  <span class="value">{outTx.from_address}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(outTx.to_address)}>
                  <span class="label">To:</span>
                  <span class="value">{outTx.to_address}</span>
                </div>
                <div class="nested-item">
                  <h5>Coins</h5>
                  {#if Array.isArray(outTx.coins)}
                    {#each outTx.coins as coin, coinIndex}
                      <div class="nested-item">
                        <h6>Coin {coinIndex + 1}</h6>
                        <div class="detail-item" on:click={() => copyToClipboard(coin.asset)}>
                          <span class="label">Asset:</span>
                          <span class="value">{coin.asset}</span>
                        </div>
                        <div class="detail-item" on:click={() => copyToClipboard(coin.amount)}>
                          <span class="label">Amount:</span>
                          <span class="value">{formatAmount(coin.amount)}</span>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <p>No coins information available</p>
                  {/if}
                </div>
                <div class="nested-item">
                  <h5>Gas</h5>
                  {#if Array.isArray(outTx.gas)}
                    {#each outTx.gas as gas, gasIndex}
                      <div class="nested-item">
                        <h6>Gas {gasIndex + 1}</h6>
                        <div class="detail-item" on:click={() => copyToClipboard(gas.asset)}>
                          <span class="label">Asset:</span>
                          <span class="value">{gas.asset}</span>
                        </div>
                        <div class="detail-item" on:click={() => copyToClipboard(gas.amount)}>
                          <span class="label">Amount:</span>
                          <span class="value">{formatAmount(gas.amount)}</span>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <p>No gas information available</p>
                  {/if}
                </div>
                {#if outTx.memo}
                  <div class="detail-item" on:click={() => copyToClipboard(outTx.memo)}>
                    <span class="label">Memo:</span>
                    <span class="value">{outTx.memo}</span>
                  </div>
                {/if}
              </div>
            {/each}
          </section>
        {/if}

        <section>
          <h3>Transaction Stages</h3>
          {#if txData.stages}
            {#each Object.entries(txData.stages) as [stage, status]}
              <div class="detail-item" on:click={() => copyToClipboard(`${stage}: ${status.completed ? 'Completed' : 'Pending'}`)}>
                <span class="label">{stage}:</span>
                <span class="value">
                  {#if 'completed' in status}
                    {status.completed ? 'Completed' : 'Pending'}
                  {:else if 'pending' in status}
                    {status.pending ? 'Pending' : 'Completed'}
                  {:else}
                    {JSON.stringify(status)}
                  {/if}
                </span>
              </div>
              {#if 'pre_confirmation_count' in status}
                <div class="detail-item" on:click={() => copyToClipboard(`Pre-confirmation count: ${status.pre_confirmation_count}`)}>
                  <span class="label">Pre-confirmation count:</span>
                  <span class="value">{status.pre_confirmation_count}</span>
                </div>
              {/if}
              {#if 'final_count' in status}
                <div class="detail-item" on:click={() => copyToClipboard(`Final count: ${status.final_count}`)}>
                  <span class="label">Final count:</span>
                  <span class="value">{status.final_count}</span>
                </div>
              {/if}
            {/each}
          {:else}
            <p>No stages information available</p>
          {/if}
        </section>
      </div>
    {:else if activeTab === 'midgard' && midgardData && midgardData.actions.length > 0}
      <div class="tx-details">
        <section>
          <h3>Midgard Actions</h3>
          {#if Array.isArray(midgardData.actions)}
            {#each midgardData.actions as action}
              <div class="out-tx">
                <div class="detail-item" on:click={() => copyToClipboard(action.date)}>
                  <span class="label">Date:</span>
                  <span class="value">{new Date(Number(action.date) / 1000000).toLocaleString()}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(action.height)}>
                  <span class="label">Height:</span>
                  <span class="value">{action.height}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(action.type)}>
                  <span class="label">Type:</span>
                  <span class="value">{action.type}</span>
                </div>
                <div class="detail-item" on:click={() => copyToClipboard(action.status)}>
                  <span class="label">Status:</span>
                  <span class="value">{action.status}</span>
                </div>

                <h4>In</h4>
                {#if Array.isArray(action.in)}
                  {#each action.in as inTx}
                    <div class="detail-item" on:click={() => copyToClipboard(inTx.address)}>
                      <span class="label">Address:</span>
                      <span class="value">{inTx.address}</span>
                    </div>
                    <div class="detail-item" on:click={() => copyToClipboard(inTx.txID)}>
                      <span class="label">TxID:</span>
                      <span class="value">{inTx.txID}</span>
                    </div>
                    {#if Array.isArray(inTx.coins)}
                      {#each inTx.coins as coin}
                        <div class="detail-item" on:click={() => copyToClipboard(`${coin.amount} ${coin.asset}`)}>
                          <span class="label">Coin:</span>
                          <span class="value">{formatAmount(coin.amount)} {coin.asset}</span>
                        </div>
                      {/each}
                    {:else}
                      <p>No coins information available</p>
                    {/if}
                  {/each}
                {:else}
                  <p>No in transactions available</p>
                {/if}

                <h4>Out</h4>
                {#if Array.isArray(action.out)}
                  {#each action.out as outTx}
                    <div class="detail-item" on:click={() => copyToClipboard(outTx.address)}>
                      <span class="label">Address:</span>
                      <span class="value">{outTx.address}</span>
                    </div>
                    <div class="detail-item" on:click={() => copyToClipboard(outTx.txID)}>
                      <span class="label">TxID:</span>
                      <span class="value">{outTx.txID}</span>
                    </div>
                    <div class="detail-item" on:click={() => copyToClipboard(outTx.height)}>
                      <span class="label">Height:</span>
                      <span class="value">{outTx.height}</span>
                    </div>
                    {#if Array.isArray(outTx.coins)}
                      {#each outTx.coins as coin}
                        <div class="detail-item" on:click={() => copyToClipboard(`${coin.amount} ${coin.asset}`)}>
                          <span class="label">Coin:</span>
                          <span class="value">{formatAmount(coin.amount)} {coin.asset}</span>
                        </div>
                      {/each}
                    {:else}
                      <p>No coins information available</p>
                    {/if}
                  {/each}
                {:else}
                  <p>No out transactions available</p>
                {/if}

                <h4>Metadata</h4>
                {#if action.metadata.swap}
                  <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.memo)}>
                    <span class="label">Memo:</span>
                    <span class="value">{action.metadata.swap.memo}</span>
                  </div>
                  <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.liquidityFee)}>
                    <span class="label">Liquidity Fee:</span>
                    <span class="value">{formatAmount(action.metadata.swap.liquidityFee)}</span>
                  </div>
                  <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.swapSlip)}>
                    <span class="label">Swap Slip:</span>
                    <span class="value">{formatAmount(action.metadata.swap.swapSlip)}</span>
                  </div>
                  <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.swapTarget)}>
                    <span class="label">Swap Target:</span>
                    <span class="value">{formatAmount(action.metadata.swap.swapTarget)}</span>
                  </div>
                  {#if action.metadata.swap.streamingSwapMeta}
                    <h5>Streaming Swap Meta</h5>
                    <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.streamingSwapMeta.count)}>
                      <span class="label">Count:</span>
                      <span class="value">{action.metadata.swap.streamingSwapMeta.count}</span>
                    </div>
                    <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.streamingSwapMeta.interval)}>
                      <span class="label">Interval:</span>
                      <span class="value">{action.metadata.swap.streamingSwapMeta.interval}</span>
                    </div>
                    <div class="detail-item" on:click={() => copyToClipboard(action.metadata.swap.streamingSwapMeta.lastHeight)}>
                      <span class="label">Last Height:</span>
                      <span class="value">{action.metadata.swap.streamingSwapMeta.lastHeight}</span>
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          {:else}
            <p>No actions available</p>
          {/if}
        </section>
      </div>
    {:else}
      <p>No data available for this transaction.</p>
    {/if}
  {/if}

  {#if toast.visible}
    <div class="toast" transition:fade={{ duration: 500 }}>
      {toast.message}
    </div>
  {/if}
</div>

<style>
  .tx-status-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: var(--background-color);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  h2 {
    font-size: 24px;
    margin-bottom: 20px;
    text-align: center;
    color: var(--primary-color);
  }

  form {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  input[type="text"] {
    padding: 10px;
    font-size: 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--surface-color);
    color: var(--text-color);
    margin-right: 10px;
    flex-grow: 1;
  }

  button[type="submit"] {
    padding: 10px 20px;
    font-size: 16px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button[type="submit"]:hover {
    background-color: var(--primary-hover-color);
  }

  .status-summary {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 20px;
    margin-bottom: 20px;
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .status-label {
    margin-right: 6px;
    opacity: 0.8;
  }

  .controls-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    background-color: var(--surface-color);
    padding: 10px;
    border-radius: 8px;
  }

  .explorer-search {
    display: flex;
    align-items: center;
  }

  select {
    padding: 8px;
    font-size: 14px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--background-color);
    color: var(--text-color);
    margin-right: 10px;
  }

  .explorer-search button,
  .controls-container button {
    padding: 8px 16px;
    font-size: 14px;
    background-color: var(--secondary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .explorer-search button:hover,
  .controls-container button:hover {
    background-color: var(--secondary-hover-color);
  }

  .tabs {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
    background-color: var(--surface-color);
    border-radius: 8px;
    padding: 5px;
  }

  .tabs button {
    padding: 8px 16px;
    font-size: 14px;
    background-color: transparent;
    color: var(--text-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .tabs button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .tabs button.active {
    background-color: var(--primary-color);
    color: white;
  }

  .tx-details {
    background-color: var(--surface-color);
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  section {
    margin-bottom: 30px;
    padding: 15px;
    background-color: var(--background-color);
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }

  h3 {
    font-size: 18px;
    margin-bottom: 15px;
    color: var(--secondary-color);
    border-bottom: 2px solid var(--secondary-color);
    padding-bottom: 5px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: var(--surface-color);
    border-radius: 4px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.2s;
  }

  .detail-item:hover {
    background-color: var(--surface-hover-color);
    transform: translateY(-2px);
  }

  .label {
    font-weight: bold;
    margin-right: 10px;
    color: var(--text-muted);
  }

  .value {
    flex-grow: 1;
    word-wrap: break-word;
    text-align: right;
    font-family: 'Courier New', monospace;
  }

  .nested-item {
    margin-left: 20px;
    padding-left: 10px;
    border-left: 2px solid var(--border-color);
  }

  .out-tx {
    margin-bottom: 20px;
    padding: 15px;
    background-color: var(--surface-color);
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }

  .loading,
  .error {
    text-align: center;
    margin-top: 20px;
    font-size: 18px;
    color: var(--text-muted);
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    background-color: var(--primary-color);
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 999;
  }

  @media (max-width: 600px) {
    .tx-status-container {
      padding: 10px;
    }

    h2 {
      font-size: 20px;
    }

    form {
      flex-direction: column;
    }

    input[type="text"] {
      margin-bottom: 10px;
    }

    .controls-container {
      flex-direction: column;
    }

    .explorer-search {
      margin-bottom: 10px;
    }

    .tabs button {
      padding: 6px 12px;
      font-size: 12px;
    }

    .detail-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .label {
      margin-bottom: 5px;
    }

    .value {
      text-align: left;
    }
  }
</style>
