<script>
  import { onMount, onDestroy } from 'svelte';
  import { thornode } from '$lib/api';
  import { PageHeader, LoadingBar, LinkOutIcon } from '$lib/components';
  import { getNodes, filterNodesByStatus, NODE_STATUS } from '$lib/utils/nodes';
  import { getCurrentBlock } from '$lib/utils/network';
  import { BLOCK_TIME_SECONDS } from '$lib/utils/blockchain';

  const REFRESH_INTERVAL = 6000; // 6 seconds
  
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
    currentBlock = await getCurrentBlock();
  }

  function calculateTargetDate() {
    const blocksRemaining = upgradeProposal.height - currentBlock;
    const secondsRemaining = blocksRemaining * BLOCK_TIME_SECONDS;
    targetDate = new Date(Date.now() + (secondsRemaining * 1000));
  }

  async function fetchNodeData() {
    const allNodes = await getNodes({ cache: false });
    nodes = filterNodesByStatus(allNodes, NODE_STATUS.ACTIVE);
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
  @import '$lib/styles/variables.css';

  .version-checker {
    max-width: var(--container-lg);
    margin: 0 auto;
    padding: var(--space-lg);
    color: var(--text-primary);
    background-color: var(--bg-main);
    min-height: 100vh;
    font-family: var(--font-system);
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  section {
    background: var(--gradient-card);
    border-radius: var(--radius-xl);
    padding: 1.25rem;
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-default);
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .card-label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    margin-bottom: 0.5rem;
  }

  .card-value {
    color: var(--text-primary);
    font-size: 22px;
    font-weight: var(--font-bold);
    letter-spacing: -0.3px;
  }

  .gradient-text {
    background: var(--gradient-primary);
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
    transition: var(--transition-base);
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
    color: var(--text-primary);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    background: rgba(99, 102, 241, 0.2);
    padding: var(--space-xs) var(--space-md);
    border-radius: 6px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .approval-status-text {
    margin-top: 0.5rem;
    text-align: center;
  }

  .status-text {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .status-text.approved {
    color: var(--color-success-light);
  }

  .status-text.pending {
    color: var(--color-warning-light);
  }

  /* ===== PROGRESS BAR ===== */
  .progress-bar {
    position: relative;
    width: 100%;
    height: 6px;
    background: var(--border-subtle);
    border-radius: 3px;
    overflow: visible;
    margin: 0.5rem 0;
  }

  .progress {
    height: 100%;
    background: var(--gradient-primary);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .approval-progress {
    background: var(--gradient-success) !important;
  }

  .threshold-marker {
    position: absolute;
    top: -4px;
    right: 34%;
    width: 2px;
    height: calc(100% + 8px);
    background-color: var(--text-primary);
    opacity: 0.8;
  }

  .threshold-marker::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -3px;
    width: 8px;
    height: 8px;
    background-color: var(--text-primary);
    border-radius: var(--radius-full);
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stat-label {
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  .stat-value {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: var(--font-bold);
    letter-spacing: -0.2px;
  }

  .stat-value.date-value {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    white-space: pre-line;
    line-height: 1.4;
  }

  /* ===== BLOCK STAT IN HEADER ===== */
  .block-stat {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--border-subtle);
    padding: 6px var(--space-md);
    border-radius: var(--radius-md);
  }

  .block-label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
  }

  .block-value {
    color: var(--text-primary);
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    letter-spacing: -0.3px;
  }

  /* ===== VERSION GRID ===== */
  .version-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .version-card {
    background: var(--gradient-card);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    height: var(--card-height);
    position: relative;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: var(--transition-smooth);
  }

  .version-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .version-title {
    position: absolute;
    top: var(--space-lg);
    left: var(--space-lg);
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: -0.2px;
  }

  .version-card .percentage-badge {
    position: absolute;
    top: var(--space-lg);
    right: var(--space-lg);
  }

  .version-card .progress-bar {
    position: absolute;
    top: 50%;
    left: var(--space-lg);
    right: var(--space-lg);
    width: calc(100% - 32px);
    transform: translateY(-50%);
    margin: 0;
  }

  .card-footer {
    position: absolute;
    bottom: var(--space-lg);
    left: var(--space-lg);
    right: var(--space-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .node-count {
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .link-button {
    color: var(--accent-link);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-decoration: none;
    transition: var(--transition-base);
  }

  .link-button:hover {
    color: var(--accent-primary);
    text-decoration: underline;
  }

  /* ===== LOADING & ERROR ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px var(--space-xl);
    gap: var(--space-lg);
    background: var(--gradient-card);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-subtle);
  }

  .loading-text {
    color: var(--text-muted);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    margin: 0;
  }

  .error {
    text-align: center;
    padding: 40px;
    color: var(--color-error);
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    background: rgba(220, 53, 69, 0.1);
    border-radius: var(--radius-xl);
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  /* ===== MOBILE RESPONSIVE ===== */
  @media (max-width: 600px) {
    .version-checker {
      padding: var(--space-md);
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
      padding: var(--space-lg);
    }

    .version-title {
      position: static;
      margin-bottom: var(--space-sm);
    }

    .version-card .percentage-badge {
      position: static;
      display: inline-block;
      margin-bottom: var(--space-sm);
    }

    .version-card .progress-bar {
      position: static;
      width: 100%;
      transform: none;
      margin: var(--space-sm) 0;
    }

    .card-footer {
      position: static;
      margin-top: var(--space-sm);
    }

    .card-value {
      font-size: var(--text-xl);
    }

    .stat-value {
      font-size: var(--text-base);
    }

    .block-stat {
      padding: var(--space-xs) var(--space-sm);
    }

    .block-value {
      font-size: var(--text-sm);
    }
  }

  @media (max-width: 400px) {
    .version-checker {
      padding: var(--space-md);
    }

    section {
      padding: 0.75rem;
    }

    .card-value {
      font-size: var(--text-lg);
    }

    .stat-value {
      font-size: 13px;
    }

    .stat-label {
      font-size: 9px;
    }

    .action-button {
      font-size: var(--text-sm);
      padding: 6px var(--space-md);
    }
  }
</style>
