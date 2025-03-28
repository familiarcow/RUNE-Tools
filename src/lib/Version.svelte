<script>
  import { onMount, onDestroy } from 'svelte';

  const BASE_URL = 'https://thornode.thorchain.liquify.com/thorchain';
  const REFRESH_INTERVAL = 6000; // 6 seconds
  const BLOCK_TIME = 6; // seconds per block
  
  let nodes = [];
  let versions = {};
  let upgradeProposal = null;
  let currentBlock = 0;
  let loading = true;
  let error = null;
  let timeRemaining = '';
  let targetDate = null;
  
  // For periodic updates
  let blockUpdateInterval;
  let countdownInterval;

  // Add new state variable
  let upgradeProposalDetails = null;

  $: if (currentBlock && upgradeProposal) {
    calculateTargetDate();
  }

  onMount(async () => {
    try {
      await Promise.all([
        fetchNodeData(),
        fetchUpgradeProposal(),
        fetchCurrentBlock()
      ]);
      
      // Refresh all data every 6 seconds
      blockUpdateInterval = setInterval(async () => {
        await Promise.all([
          fetchCurrentBlock(),
          fetchNodeData(),
          fetchUpgradeProposal()
        ]);
      }, REFRESH_INTERVAL);
      
      // Update countdown display every minute since we don't show seconds
      countdownInterval = setInterval(() => {
        if (targetDate) {
          // This will trigger the reactive timeRemaining calculation
          targetDate = targetDate;
        }
      }, 60000);
      
    } catch (e) {
      error = 'Failed to fetch data';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    clearInterval(blockUpdateInterval);
    clearInterval(countdownInterval);
  });

  async function fetchCurrentBlock() {
    const response = await fetch(`${BASE_URL}/lastblock`);
    const data = await response.json();
    currentBlock = data[0].thorchain;
  }

  function calculateTargetDate() {
    const blocksRemaining = upgradeProposal.height - currentBlock;
    const secondsRemaining = blocksRemaining * BLOCK_TIME;
    targetDate = new Date(Date.now() + (secondsRemaining * 1000));
  }

  async function fetchNodeData() {
    const response = await fetch(`${BASE_URL}/nodes`);
    const data = await response.json();
    nodes = data.filter(node => node.status === 'Active');
    processVersions();
  }

  async function fetchUpgradeProposal() {
    try {
      const response = await fetch(`${BASE_URL}/upgrade_proposals`);
      const data = await response.json();
      
      // Add debugging
      if (data && data[0]) {
        console.log('Upgrade proposal info:', data[0].info);
      }
      
      // Handle null response
      if (!data) {
        upgradeProposal = null;
        upgradeProposalDetails = null;
        return;
      }
      
      upgradeProposal = data[0];
      if (upgradeProposal) {
        await fetchUpgradeProposalDetails(upgradeProposal.name);
      }
    } catch (error) {
      console.error('Error fetching upgrade proposal:', error);
      upgradeProposal = null;
      upgradeProposalDetails = null;
    }
  }

  async function fetchUpgradeProposalDetails(name) {
    try {
      const response = await fetch(`${BASE_URL}/upgrade_proposal/${name}`);
      const data = await response.json();
      upgradeProposalDetails = data;
    } catch (error) {
      console.error('Error fetching upgrade proposal details:', error);
    }
  }

  function processVersions() {
    versions = {};
    nodes.forEach(node => {
      if (!versions[node.version]) {
        versions[node.version] = [];
      }
      versions[node.version].push(node);
    });
  }

  function getVersionPercentage(version) {
    return ((versions[version]?.length || 0) / nodes.length * 100).toFixed(1);
  }

  function formatBlockHeight(height) {
    return height.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatDate(date) {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);

    const dateStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);

    return `${timeStr}\n${dateStr}`;
  }

  // Reactive statements to process data
  $: if (nodes) {
    processVersions();
  }

  $: timeRemaining = targetDate ? calculateTimeRemaining(targetDate) : '';

  function calculateTimeRemaining(target) {
    const now = new Date();
    const diff = target - now;
    
    if (diff <= 0) {
      return 'Upgrade time reached!';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m`;
  }

  function getReleaseNotesUrl(proposal) {
    try {
      let info = proposal.info;
      
      // Replace double backslashes with single backslashes
      info = info.replace(/\\\\/g, '\\');
      
      // Now parse the cleaned string
      info = JSON.parse(info);
      return info.tag || 'https://gitlab.com/thorchain/thornode/-/tags/v' + proposal.name;
    } catch (e) {
      console.warn('Failed to parse upgrade proposal info:', e);
      // Fallback to constructing the URL from the version number
      return 'https://gitlab.com/thorchain/thornode/-/tags/v' + proposal.name;
    }
  }
</script>

<div class="version-checker">
  {#if loading}
    <div class="loading">Loading network data...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="container">
      <!-- Upgrade Proposal -->
      {#if upgradeProposal}
        <section class="upgrade-proposal">
          <h2>Upcoming Upgrade</h2>
          
          <!-- New version container -->
          <div class="version-container">
            <div class="info-label">Upcoming Version</div>
            <div class="version-number">{upgradeProposal.name}</div>
          </div>

          {#if upgradeProposalDetails}
            <div class="version-container">
              <div class="info-label">Validator Approval</div>
              <div class="sub-label">Requires 66% Quorum</div>
              <div class="card-header">
                <div class="percentage">
                  {(Number(upgradeProposalDetails.approved_percent)).toFixed(1)}%
                </div>
              </div>
              <div class="progress-bar">
                <div 
                  class="progress approval-progress" 
                  style="width: {Number(upgradeProposalDetails.approved_percent)}%"
                ></div>
                <div class="threshold-marker"></div>
              </div>
              <div class="approval-info">
                {#if upgradeProposalDetails.approved}
                  <div class="status approved">Upgrade {upgradeProposal.name} Approved ✅</div>
                {:else if upgradeProposalDetails.validators_to_quorum > 0}
                  <div class="status pending">
                    Needs approval from {upgradeProposalDetails.validators_to_quorum} more validators
                  </div>
                {:else}
                  <div class="status pending">Awaiting approval</div>
                {/if}
              </div>
            </div>
          {/if}

          <div class="proposal-card">
            <div class="proposal-info">
              <div class="info-item">
                <div class="info-label">Target Block Height</div>
                <div class="info-value">{formatBlockHeight(upgradeProposal.height)}</div>
              </div>
              {#if targetDate}
                <div class="time-info">
                  <div class="target-date">
                    <div class="info-label">Estimated Upgrade Time</div>
                    <div class="date-value">{formatDate(targetDate)}</div>
                  </div>
                  <div class="countdown-container">
                    <div class="info-label">Time Remaining</div>
                    <div class="countdown">{timeRemaining}</div>
                  </div>
                </div>
              {/if}
            </div>
            <a 
              href={getReleaseNotesUrl(upgradeProposal)} 
              target="_blank" 
              rel="noopener noreferrer"
              class="action-button"
            >
              View Release Notes
            </a>
          </div>
        </section>
      {/if}

      <!-- Current Network Status -->
      <section class="current-status">
        <h2>Network Status</h2>
        <div class="status-header">
          <div class="block-info">
            <span class="info-label">Current Block</span>
            <span class="block-value">{formatBlockHeight(currentBlock)}</span>
          </div>
        </div>
        <div class="version-grid">
          {#each Object.entries(versions) as [version, nodeList]}
            <div class="version-card">
              <div class="card-header">
                <h3>{version}</h3>
                <div class="percentage">{getVersionPercentage(version)}%</div>
              </div>
              <div class="progress-bar">
                <div 
                  class="progress" 
                  style="width: {getVersionPercentage(version)}%"
                ></div>
              </div>
              <div class="node-count">
                {nodeList.length} active nodes
              </div>
              <a 
                href={`https://gitlab.com/thorchain/thornode/-/releases/v${version.replace(/^v/, '')}`}
                target="_blank" 
                rel="noopener noreferrer"
                class="action-button"
              >
                View Release Notes
              </a>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .version-checker {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section {
    background-color: #1a1a1a;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    color: #31FD9D;
    text-align: center;
  }

  .info-item {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .info-label {
    color: #888;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .info-value {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.2rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .version-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .version-card {
    background: #2c2c2c;
    border-radius: 8px;
    padding: 1.2rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .card-header h3 {
    margin: 0;
    color: #31FD9D;
    font-size: 1.2rem;
  }

  .percentage {
    color: white;
    font-size: 1.1rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin: 0.5rem 0;
  }

  .progress {
    height: 100%;
    background: rgba(49, 253, 157, 0.8);
    transition: width 0.3s ease;
  }

  .node-count {
    color: #888;
    font-size: 0.9rem;
    margin: 0.5rem 0 1rem 0;
  }

  .action-button {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    border-radius: 4px;
    font-weight: 500;
    transition: all 0.2s;
    text-align: center;
    font-size: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .status-header {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .block-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .block-value {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.3rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .time-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .target-date, .countdown-container {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
  }

  .date-value {
    color: white;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
    white-space: pre-line;
    line-height: 1.6;
    text-align: center;
  }

  .countdown {
    color: #31FD9D;
    font-size: 1.2rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
    color: #888;
  }

  .error {
    color: #ff4444;
  }

  .version-container {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .version-number {
    color: #31FD9D;
    font-size: 1.2rem;
    font-weight: 500;
    margin-top: 0.5rem;
    font-family: 'JetBrains Mono', monospace;
  }

  @media (max-width: 600px) {
    .version-checker {
      padding: 10px;
    }

    section {
      padding: 1rem;
    }

    .version-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .time-info {
      grid-template-columns: 1fr;
    }

    .date-value {
      font-size: 0.8rem;
      line-height: 1.5;
    }
  }

  @media (max-width: 400px) {
    .date-value {
      font-size: 0.75rem;
      line-height: 1.4;
    }
  }

  .approval-status {
    margin-bottom: 1.5rem;
  }

  .threshold-marker {
    position: absolute;
    top: -4px;
    bottom: -4px;
    right: 34%;
    width: 2px;
    height: calc(100% + 8px);
    background-color: white;
    opacity: 1;
  }

  .threshold-marker::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -2px;
    width: 8px;
    height: 16px;
    background-color: white;
    border-radius: 50%;
    transform: translateY(-50%);
  }

  .progress-bar {
    position: relative;
    margin: 1rem 0;
  }

  .approval-info {
    margin-top: 0.5rem;
    text-align: center;
  }

  .status {
    display: inline-block;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .status.approved {
    background: rgba(49, 253, 157, 0.1);
    color: #31FD9D;
  }

  .status.pending {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .approval-progress {
    background-color: #31FD9D !important;
    opacity: 0.5;
  }

  .sub-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.7rem;
    margin-bottom: 1rem;
  }

  .version-container .status {
    margin-top: 1rem;
    display: inline-block;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
