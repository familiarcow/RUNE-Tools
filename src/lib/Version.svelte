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
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  h2 {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 16px;
    margin: 0 0 2rem 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: #FFFFFF;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  h2::before {
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

  .info-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .info-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  .info-label {
    color: #a0a0a0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.75rem;
    font-family: inherit;
  }

  .info-value {
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: -0.2px;
  }

  .version-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .version-card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .version-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    border-color: rgba(99, 102, 241, 0.4);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .card-header h3 {
    margin: 0;
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.2px;
  }

  .percentage {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    background: rgba(99, 102, 241, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin: 1rem 0;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .progress {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
  }

  .node-count {
    color: #a0a0a0;
    font-size: 14px;
    font-weight: 500;
    margin: 0.5rem 0 1.5rem 0;
    font-family: inherit;
  }

  .action-button {
    display: inline-block;
    padding: 10px 16px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
    color: #ffffff;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    font-size: 14px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    letter-spacing: -0.1px;
  }

  .action-button:hover {
    background: linear-gradient(145deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%);
    border-color: rgba(99, 102, 241, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .action-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .status-header {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .status-header:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .block-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .block-value {
    color: #ffffff;
    font-size: 24px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.5px;
  }

  .time-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin: 1.5rem 0;
  }

  .target-date, .countdown-container {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .target-date:hover, .countdown-container:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .date-value {
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    white-space: pre-line;
    line-height: 1.5;
    text-align: center;
    letter-spacing: -0.1px;
  }

  .countdown {
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    font-family: inherit;
    text-align: center;
    letter-spacing: -0.3px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .loading {
    text-align: center;
    padding: 60px;
    color: #a0a0a0;
    font-size: 18px;
    font-weight: 600;
    font-family: inherit;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .error {
    text-align: center;
    padding: 60px;
    color: #dc3545;
    font-size: 18px;
    font-weight: 600;
    font-family: inherit;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  .version-container {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .version-container:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .version-number {
    color: #ffffff;
    font-size: 20px;
    font-weight: 700;
    margin-top: 0.75rem;
    font-family: inherit;
    letter-spacing: -0.3px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @media (max-width: 600px) {
    .version-checker {
      padding: 16px;
    }

    section {
      padding: 1.5rem;
    }

    h2 {
      font-size: 20px;
      padding: 14px;
    }

    .version-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .version-card {
      padding: 1.25rem;
    }

    .card-header h3 {
      font-size: 16px;
    }

    .time-info {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .target-date, .countdown-container {
      padding: 1.25rem;
    }

    .date-value {
      font-size: 13px;
      line-height: 1.4;
    }

    .countdown {
      font-size: 16px;
    }

    .action-button {
      font-size: 13px;
      padding: 8px 14px;
    }
  }

  @media (max-width: 400px) {
    .version-checker {
      padding: 12px;
    }

    section {
      padding: 1rem;
    }

    h2 {
      font-size: 18px;
      padding: 12px;
    }

    .version-card {
      padding: 1rem;
    }

    .target-date, .countdown-container {
      padding: 1rem;
    }

    .date-value {
      font-size: 12px;
      line-height: 1.3;
    }

    .countdown {
      font-size: 14px;
    }

    .action-button {
      font-size: 12px;
      padding: 6px 12px;
    }

    .percentage {
      font-size: 14px;
      padding: 3px 6px;
    }
  }

  .approval-status {
    margin-bottom: 1.5rem;
  }

  .proposal-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    margin-top: 1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .proposal-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .proposal-info {
    margin-bottom: 1.5rem;
  }

  .threshold-marker {
    position: absolute;
    top: -4px;
    bottom: -4px;
    right: 34%;
    width: 2px;
    height: calc(100% + 8px);
    background-color: #ffffff;
    opacity: 0.8;
  }

  .threshold-marker::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -3px;
    width: 8px;
    height: 8px;
    background-color: #ffffff;
    border-radius: 50%;
    transform: translateY(-50%);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: -0.1px;
    text-transform: uppercase;
  }

  .status.approved {
    background: rgba(105, 219, 124, 0.15);
    color: #69db7c;
    border: 1px solid rgba(105, 219, 124, 0.3);
  }

  .status.pending {
    background: rgba(255, 169, 77, 0.15);
    color: #ffa94d;
    border: 1px solid rgba(255, 169, 77, 0.3);
  }

  .approval-progress {
    background: linear-gradient(135deg, #69db7c 0%, #51cf66 100%) !important;
    box-shadow: 0 2px 6px rgba(105, 219, 124, 0.3) !important;
  }

  .sub-label {
    color: #a0a0a0;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .version-container .status {
    margin-top: 1rem;
    display: inline-block;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    letter-spacing: -0.1px;
  }
</style>
