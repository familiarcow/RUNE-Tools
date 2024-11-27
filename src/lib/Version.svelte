<script>
  import { onMount } from 'svelte';

  let nodes = [];
  let versions = {};
  let allSameVersion = true;
  let latestVersion = '';
  let expandedVersion = null;
  let totalNodes = 0;
  let oldVersion = '';
  let newVersion = '';

  const icons = {
    eye: '👁️',
    eyeOff: '🙈',
    fileText: '📄'
  };

  onMount(async () => {
    await fetchNodeData();
  });

  async function fetchNodeData() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/nodes');
      const data = await response.json();
      nodes = data.filter(node => node.status === 'Active');
      processVersions();
    } catch (error) {
      console.error('Error fetching node data:', error);
    }
  }

  function compareVersions(a, b) {
    const [, aMajor, aMinor = '0'] = a.split('.').map(Number);
    const [, bMajor, bMinor = '0'] = b.split('.').map(Number);
    
    if (aMajor !== bMajor) {
      return bMajor - aMajor;
    }
    return bMinor - aMinor;
  }

  function processVersions() {
    versions = {};
    
    nodes.forEach(node => {
      if (!versions[node.version]) {
        versions[node.version] = [];
      }
      versions[node.version].push(node);
    });

    const versionKeys = Object.keys(versions);
    allSameVersion = versionKeys.length === 1;
    
    versionKeys.sort(compareVersions);
    newVersion = versionKeys[0];
    oldVersion = versionKeys[1] || newVersion;
    latestVersion = newVersion;

    totalNodes = nodes.length;
  }

  function toggleVersionExpand(version) {
    expandedVersion = expandedVersion === version ? null : version;
  }

  function getChangelogUrl(version) {
    const versionNumber = version.replace(/^v/, '');
    return `https://gitlab.com/thorchain/thornode/-/releases/v${versionNumber}`;
  }

  function getShortAddress(address) {
    return address.slice(-4);
  }
</script>

<div class="version-checker">
  <h2>THORNode Version Checker</h2>
  
  <div class="container">
    {#if allSameVersion}
      <div class="version-status same">
        <span class="version-number">{latestVersion} ✅</span>
        <p>All nodes are on the same version.</p>
        <div class="action-buttons">
          <a href={getChangelogUrl(latestVersion)} target="_blank" rel="noopener noreferrer" class="icon-button changelog-button">
            {icons.fileText} Changelog
          </a>
        </div>
      </div>
    {:else}
      <div class="version-status different">
        <p>The new THORNode version has not yet been fully adopted:</p>
        <div class="version-boxes">
          <div class="version-box old">
            <h3>Old Version</h3>
            <p class="version-info">
              {oldVersion} ({versions[oldVersion].length} / {totalNodes} nodes)
            </p>
            <div class="action-buttons">
              <button on:click={() => toggleVersionExpand(oldVersion)} class="icon-button">
                {expandedVersion === oldVersion ? icons.eyeOff : icons.eye}
              </button>
              <a href={getChangelogUrl(oldVersion)} target="_blank" rel="noopener noreferrer" class="icon-button changelog-button">
                {icons.fileText} Changelog
              </a>
            </div>
            {#if expandedVersion === oldVersion}
              <div class="node-list">
                {#each versions[oldVersion] as node}
                  <div class="node-item">{getShortAddress(node.node_address)}</div>
                {/each}
              </div>
            {/if}
          </div>
          <div class="version-box new">
            <h3>New Version</h3>
            <p class="version-info">
              {newVersion} ({versions[newVersion].length} / {totalNodes} nodes)
            </p>
            <div class="action-buttons">
              <button on:click={() => toggleVersionExpand(newVersion)} class="icon-button">
                {expandedVersion === newVersion ? icons.eyeOff : icons.eye}
              </button>
              <a href={getChangelogUrl(newVersion)} target="_blank" rel="noopener noreferrer" class="icon-button changelog-button">
                {icons.fileText} Changelog
              </a>
            </div>
            {#if expandedVersion === newVersion}
              <div class="node-list">
                {#each versions[newVersion] as node}
                  <div class="node-item">{getShortAddress(node.node_address)}</div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .version-checker {
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    padding: 20px;
  }

  h2 {
    text-align: center;
    margin: 0 0 20px 0;
    padding: 20px;
    background-color: #2c2c2c;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
    border-radius: 12px 12px 0 0;
  }

  .version-status {
    padding: 20px;
    border-radius: 5px;
    margin-bottom: 10px;
  }

  .version-status.same {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .version-status.same .action-buttons {
    margin-top: 10px;
  }

  .version-status.different {
    background-color: rgba(255, 152, 0, 0.1);
    color: #ff9800;
  }

  .version-number {
    font-size: 1.2em;
    font-weight: bold;
  }

  .checkmark {
    margin-left: 10px;
  }

  .version-group {
    margin-bottom: 15px;
  }

  button {
    background-color: #4A90E2;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
  }

  button:hover {
    background-color: #3A7BC8;
  }

  ul {
    list-style-type: none;
    padding-left: 20px;
    margin-top: 10px;
  }

  li {
    margin-bottom: 5px;
    font-size: 14px;
    color: #e0e0e0;
  }

  .changelog-link {
    display: inline-block;
    margin-left: 10px;
    color: #4A90E2;
    text-decoration: none;
    font-size: 14px;
    transition: color 0.3s;
  }

  .changelog-link:hover {
    color: #3A7BC8;
    text-decoration: none;
  }

  @media (max-width: 600px) {
    .version-checker {
      padding: 10px;
    }

    h2 {
      font-size: 18px;
      padding: 15px;
    }

    .version-status {
      padding: 15px;
    }

    button {
      font-size: 12px;
      padding: 8px 12px;
    }

    .changelog-link {
      font-size: 12px;
    }

    li {
      font-size: 12px;
    }
  }

  .version-boxes {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-top: 20px;
  }

  .version-box {
    flex: 1;
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
  }

  .version-box h3 {
    margin-top: 0;
    color: #4A90E2;
    font-size: 18px;
  }

  .version-info {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 15px;
  }

  .version-box.old {
    border: 1px solid #ff9800;
  }

  .version-box.new {
    border: 1px solid #4caf50;
  }

  .version-box button {
    margin-right: 10px;
  }

  @media (max-width: 600px) {
    .version-boxes {
      flex-direction: column;
    }

    .version-box {
      margin-bottom: 15px;
    }
  }

  .node-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 15px;
  }

  .node-item {
    background-color: #4A90E2;
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 12px;
    font-weight: bold;
  }

  @media (max-width: 600px) {
    .node-list {
      gap: 8px;
    }

    .node-item {
      font-size: 10px;
      padding: 4px 8px;
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
  }

  .icon-button {
    background-color: transparent;
    border: 1px solid #4A90E2;
    color: #4A90E2;
    padding: 5px 10px;
    border-radius: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    font-size: 14px;
    height: 36px;
    line-height: 1;
    text-decoration: none;  /* Add this line to remove underline */
  }

  .icon-button:hover {
    background-color: #4A90E2;
    color: white;
  }

  .changelog-button {
    width: auto;
    padding: 5px 12px;
  }

  /* Remove the old button and changelog-link styles */
  button, .changelog-link {
    display: none;
  }
</style>
