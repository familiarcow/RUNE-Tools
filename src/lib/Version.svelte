<script>
  import { onMount, onDestroy } from 'svelte';
  import { thornode } from '$lib/api';
  import { PageHeader, LoadingBar } from '$lib/components';
  import LinkOutIcon from './LinkOutIcon.svelte';

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
    const data = await thornode.fetch('/thorchain/lastblock', { cache: false });
    currentBlock = data[0].thorchain;
  }

  function calculateTargetDate() {
    const blocksRemaining = upgradeProposal.height - currentBlock;
    const secondsRemaining = blocksRemaining * BLOCK_TIME;
    targetDate = new Date(Date.now() + (secondsRemaining * 1000));
  }

  async function fetchNodeData() {
    const data = await thornode.fetch('/thorchain/nodes', { cache: false });
    nodes = data.filter(node => node.status === 'Active');
    processVersions();
  }

  async function fetchUpgradeProposal() {
    try {
      const data = await thornode.fetch('/thorchain/upgrade_proposals', { cache: false });
      
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
      const data = await thornode.fetch(`/thorchain/upgrade_proposal/${name}`, { cache: false });
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
    <div class="loading-container">
      <LoadingBar width="200px" height="20px" />
      <p class="loading-text">Loading network data...</p>
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="container">
      <!-- Upgrade Proposal -->
      {#if upgradeProposal}
        <section class="upgrade-proposal">
          <PageHeader title="Upcoming Upgrade" />

          <!-- Row 1: Version + Approval side-by-side -->
          <div class="upgrade-info-grid">
            <div class="info-card version-card-main">
              <div class="card-label">Upcoming Version</div>
              <div class="version-value-row">
                <span class="card-value gradient-text">{upgradeProposal.name}</span>
                <a
                  href={getReleaseNotesUrl(upgradeProposal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="release-link"
                  title="View Release Notes"
                >
                  <LinkOutIcon size={16} color="#4A90E2" />
                </a>
              </div>
            </div>

            {#if upgradeProposalDetails}
              <div class="info-card approval-card">
                <div class="approval-header">
                  <div class="card-label">Validator Approval</div>
                  <div class="percentage-badge">
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
                <div class="approval-status-text">
                  {#if upgradeProposalDetails.approved}
                    <span class="status-text approved">Approved</span>
                  {:else if upgradeProposalDetails.validators_to_quorum > 0}
                    <span class="status-text pending">Needs {upgradeProposalDetails.validators_to_quorum} more</span>
                  {:else}
                    <span class="status-text pending">Awaiting</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <!-- Row 2: Block Height + Date + Countdown -->
          {#if targetDate}
            <div class="timing-grid">
              <div class="stat-card">
                <span class="stat-label">Target Block</span>
                <span class="stat-value">{upgradeProposal.height.toLocaleString()}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Est. Time</span>
                <span class="stat-value date-value">{formatDate(targetDate)}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Remaining</span>
                <span class="stat-value gradient-text">{timeRemaining}</span>
              </div>
            </div>
          {/if}

        </section>
      {/if}

      <!-- Current Network Status -->
      <section class="current-status">
        <PageHeader title="Network Status">
          <div slot="actions" class="block-stat">
            <span class="block-label">Block</span>
            <span class="block-value">{currentBlock.toLocaleString()}</span>
          </div>
        </PageHeader>

        <div class="version-grid">
          {#each Object.entries(versions) as [version, nodeList]}
            <div class="version-card">
              <h3 class="version-title">{version}</h3>
              <div class="percentage-badge">{getVersionPercentage(version)}%</div>
              <div class="progress-bar">
                <div
                  class="progress"
                  style="width: {getVersionPercentage(version)}%"
                ></div>
              </div>
              <div class="card-footer">
                <span class="node-count">{nodeList.length} nodes</span>
                <a
                  href={`https://gitlab.com/thorchain/thornode/-/releases/v${version.replace(/^v/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-button"
                >
                  Release Notes
                </a>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .version-checker {
    max-width: 900px;
    margin: 0 auto;
    padding: 16px;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    padding: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  /* ===== UPGRADE INFO GRID ===== */
  .upgrade-info-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .info-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .card-label {
    color: #a0a0a0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.5rem;
  }

  .card-value {
    color: #ffffff;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .gradient-text {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ===== VERSION CARD WITH LINK ===== */
  .version-value-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .release-link {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 6px;
    background: rgba(74, 144, 226, 0.1);
    border: 1px solid rgba(74, 144, 226, 0.2);
    transition: all 0.2s ease;
  }

  .release-link:hover {
    background: rgba(74, 144, 226, 0.2);
    border-color: rgba(74, 144, 226, 0.4);
    transform: translateY(-1px);
  }

  /* ===== APPROVAL CARD ===== */
  .approval-card {
    text-align: left;
  }

  .approval-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .percentage-badge {
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.2);
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .approval-status-text {
    margin-top: 0.5rem;
    text-align: center;
  }

  .status-text {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .status-text.approved {
    color: #69db7c;
  }

  .status-text.pending {
    color: #ffa94d;
  }

  /* ===== PROGRESS BAR ===== */
  .progress-bar {
    position: relative;
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: visible;
    margin: 0.5rem 0;
  }

  .progress {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .approval-progress {
    background: linear-gradient(135deg, #69db7c 0%, #51cf66 100%) !important;
  }

  .threshold-marker {
    position: absolute;
    top: -4px;
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
  }

  /* ===== TIMING GRID ===== */
  .timing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.75rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    color: #a0a0a0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }

  .stat-value.date-value {
    font-size: 12px;
    font-weight: 500;
    white-space: pre-line;
    line-height: 1.4;
  }

  /* ===== BLOCK STAT IN HEADER ===== */
  .block-stat {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    padding: 6px 12px;
    border-radius: 8px;
  }

  .block-label {
    color: #a0a0a0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .block-value {
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  /* ===== VERSION GRID ===== */
  .version-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .version-card {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 16px;
    height: 120px;
    position: relative;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .version-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .version-title {
    position: absolute;
    top: 16px;
    left: 16px;
    margin: 0;
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }

  .version-card .percentage-badge {
    position: absolute;
    top: 16px;
    right: 16px;
  }

  .version-card .progress-bar {
    position: absolute;
    top: 50%;
    left: 16px;
    right: 16px;
    width: calc(100% - 32px);
    transform: translateY(-50%);
    margin: 0;
  }

  .card-footer {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .node-count {
    color: #a0a0a0;
    font-size: 12px;
    font-weight: 500;
  }

  .link-button {
    color: #4A90E2;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: color 0.2s;
  }

  .link-button:hover {
    color: #667eea;
    text-decoration: underline;
  }

  /* ===== LOADING & ERROR ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading-text {
    color: #a0a0a0;
    font-size: 14px;
    font-weight: 500;
    margin: 0;
  }

  .error {
    text-align: center;
    padding: 40px;
    color: #dc3545;
    font-size: 16px;
    font-weight: 600;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  /* ===== MOBILE RESPONSIVE ===== */
  @media (max-width: 600px) {
    .version-checker {
      padding: 12px;
    }

    section {
      padding: 1rem;
    }

    .upgrade-info-grid {
      grid-template-columns: 1fr;
    }

    .timing-grid {
      grid-template-columns: 1fr;
    }

    .version-grid {
      grid-template-columns: 1fr;
    }

    .version-card {
      height: auto;
      min-height: 100px;
      padding: 16px;
    }

    .version-title {
      position: static;
      margin-bottom: 8px;
    }

    .version-card .percentage-badge {
      position: static;
      display: inline-block;
      margin-bottom: 8px;
    }

    .version-card .progress-bar {
      position: static;
      width: 100%;
      transform: none;
      margin: 8px 0;
    }

    .card-footer {
      position: static;
      margin-top: 8px;
    }

    .card-value {
      font-size: 20px;
    }

    .stat-value {
      font-size: 14px;
    }

    .block-stat {
      padding: 4px 8px;
    }

    .block-value {
      font-size: 12px;
    }
  }

  @media (max-width: 400px) {
    .version-checker {
      padding: 10px;
    }

    section {
      padding: 0.75rem;
    }

    .card-value {
      font-size: 18px;
    }

    .stat-value {
      font-size: 13px;
    }

    .stat-label {
      font-size: 9px;
    }

    .action-button {
      font-size: 12px;
      padding: 6px 12px;
    }
  }
</style>
