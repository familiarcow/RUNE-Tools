<script>
  import { onMount } from "svelte";

  let securedAssets = [];
  let totalSecuredValue = 0;
  let totalActiveBond = 0;
  let pendulumAssetBasisPoints = 10000;
  let nodeShare = 0;
  let poolShare = 0;
  let totalAdjustedSecuredValue = 0;
  let showAllAssets = false;
  let networkState = "";
  let isLoading = true;
  let pendulumUseVaultAssets = -1;
  let showPendulumUseVaultAssets = false;
  let pendulumUseEffectiveSecurity = -1;
  let usingAllNodesBond = true;
  let adjustedBond = 0;
  let showMore = false;
  let isEditing = false;
  let editedTotalActiveBond = totalActiveBond;
  let editedTotalSecuredValue = totalSecuredValue;
  let editedPendulumAssetBasisPoints = pendulumAssetBasisPoints;
  let editedTotalAdjustedSecuredValue = totalAdjustedSecuredValue;
  let editedPendulumUseVaultAssets = pendulumUseVaultAssets;
  let editedUsingAllNodesBond = usingAllNodesBond;
  let editedAdjustedBond = adjustedBond;

  const fetchData = async () => {
    try {
      const [vaultsResponse, poolsResponse, nodesResponse, mimirResponse, pendulumUseVaultAssetsResponse, pendulumUseEffectiveSecurityResponse] = await Promise.all([
        fetch("https://thornode.ninerealms.com/thorchain/vaults/asgard"),
        fetch("https://thornode.ninerealms.com/thorchain/pools"),
        fetch("https://thornode.ninerealms.com/thorchain/nodes"),
        fetch("https://thornode.ninerealms.com/thorchain/mimir/key/PendulumAssetBasisPoints"),
        fetch("https://thornode.ninerealms.com/thorchain/mimir/key/PendulumUseVaultAssets"),
        fetch("https://thornode.ninerealms.com/thorchain/mimir/key/PendulumUseEffectiveSecurity")
      ]);

      const vaultsData = await vaultsResponse.json();
      const poolsData = await poolsResponse.json();
      const nodesData = await nodesResponse.json();
      const mimirData = await mimirResponse.json();

      const assetTotals = {};
      const poolPrices = {};

      // Calculate total amounts for each asset across all vaults
      vaultsData.forEach(vault => {
        vault.coins.forEach(coin => {
          const { asset, amount } = coin;
          const divisor = 1e8;
          assetTotals[asset] = (assetTotals[asset] || 0) + Number(amount) / divisor;
        });
      });

      // Get asset prices in RUNE
      poolsData.forEach(pool => {
        const assetPrice = Number(pool.balance_rune) / Number(pool.balance_asset);
        poolPrices[pool.asset] = assetPrice;
      });

      pendulumUseVaultAssets = Number(await pendulumUseVaultAssetsResponse.json());
      pendulumUseEffectiveSecurity = Number(await pendulumUseEffectiveSecurityResponse.json());

      // Calculate totalSecuredValue based on PendulumUseVaultAssets
      if (pendulumUseVaultAssets === 1) {
        // Use Vault Assets (existing logic)
        // Calculate RUNE value for each asset
        securedAssets = Object.entries(assetTotals).map(([asset, amount]) => {
          const runeValue = amount * (poolPrices[asset] || 0);
          totalSecuredValue += runeValue;
          return { asset, shortName: getAssetShortName(asset), amount, runeValue };
        });

        securedAssets.sort((a, b) => b.runeValue - a.runeValue);
      } else {
        // Use Pool Assets
        totalSecuredValue = poolsData.reduce((sum, pool) => sum + Number(pool.balance_rune) / 1e8, 0);
        securedAssets = poolsData.map(pool => ({
          asset: pool.asset,
          shortName: getAssetShortName(pool.asset),
          amount: Number(pool.balance_asset) / 1e8,
          runeValue: Number(pool.balance_rune) / 1e8
        }));
        securedAssets.sort((a, b) => b.runeValue - a.runeValue);
      }

      // Calculate total active bond
      const activeNodes = nodesData.filter(node => node.status === "Active");
      
      if (pendulumUseEffectiveSecurity === 1) {
        usingAllNodesBond = false;
        // Sort nodes by bond amount in descending order
        activeNodes.sort((a, b) => Number(b.total_bond) - Number(a.total_bond));
        
        // Calculate cutoff index for bottom 2/3 of nodes (cutting off top 1/3)
        const cutoffIndex = Math.floor(activeNodes.length / 3);
        
        // Sum the bonds of the bottom 2/3 of nodes
        totalActiveBond = activeNodes
          .slice(cutoffIndex)
          .reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);
      } else {
        usingAllNodesBond = true;
        totalActiveBond = activeNodes.reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);
      }

      // Set PendulumAssetBasisPoints
      pendulumAssetBasisPoints = Number(mimirData) > 0 ? Number(mimirData) : 10000;

      // Calculate Adjusted Secured Assetsz
      totalAdjustedSecuredValue = totalSecuredValue * (pendulumAssetBasisPoints / 10000);

      // Calculate adjusted bond
      activeNodes.sort((a, b) => Number(b.total_bond) - Number(a.total_bond));
      const splitIndex = Math.floor(activeNodes.length * (2/3));
      adjustedBond = activeNodes
        .slice(splitIndex)
        .reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);

      // Calculate all dependent values at the end
      calculateDependentValues();

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  onMount(() => {
    fetchData().then(() => {
      isLoading = false;
      calculateScalePosition();
    });
  });

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
  };

  const formatPercentage = (num) => {
    return num.toFixed(2) + '%';
  };

  const getAssetShortName = (asset) => {
    return asset.split('-')[0];
  };

  const toggleShowAllAssets = () => {
    showAllAssets = !showAllAssets;
  };

  const togglePendulumUseVaultAssets = () => {
    showPendulumUseVaultAssets = !showPendulumUseVaultAssets;
  };

  const toggleShowMore = () => {
    showMore = !showMore;
  };

  const toggleEdit = () => {
    isEditing = !isEditing;
    if (isEditing) {
      editedTotalActiveBond = totalActiveBond;
      editedTotalSecuredValue = totalSecuredValue;
      editedPendulumAssetBasisPoints = pendulumAssetBasisPoints;
      editedTotalAdjustedSecuredValue = totalAdjustedSecuredValue;
      editedPendulumUseVaultAssets = pendulumUseVaultAssets;
      editedUsingAllNodesBond = usingAllNodesBond;
      editedAdjustedBond = adjustedBond;
    } else {
      // Apply changes when exiting edit mode
      totalActiveBond = editedTotalActiveBond;
      totalSecuredValue = editedTotalSecuredValue;
      pendulumAssetBasisPoints = editedPendulumAssetBasisPoints;
      totalAdjustedSecuredValue = editedTotalAdjustedSecuredValue;
      pendulumUseVaultAssets = editedPendulumUseVaultAssets;
      usingAllNodesBond = editedUsingAllNodesBond;
      adjustedBond = editedAdjustedBond;
      // Recalculate dependent values
      calculateDependentValues();
    }
  };

  const calculateDependentValues = () => {
    // Recalculate totalAdjustedSecuredValue if not directly edited
    if (totalAdjustedSecuredValue === editedTotalAdjustedSecuredValue) {
      totalAdjustedSecuredValue = totalSecuredValue * (pendulumAssetBasisPoints / 10000);
    }

    // Get effective bond based on whether we're using all nodes or bottom 2/3
    const effectiveBond = usingAllNodesBond ? totalActiveBond : adjustedBond;

    // Calculate shares using the correct formula: poolShare = (b - p) / b
    poolShare = (effectiveBond - totalAdjustedSecuredValue) / effectiveBond;
    
    // Clamp poolShare between 0 and 1
    poolShare = Math.min(Math.max(poolShare, 0), 1);
    
    nodeShare = 1 - poolShare;

    // Convert to percentages for display
    poolShare = poolShare * 100;
    nodeShare = nodeShare * 100;

    // Determine network state
    if (Math.abs(nodeShare - 50) < 10) {
      networkState = "Normal";
    } else if (nodeShare < 50) {
      networkState = "Overbonded";
    } else {
      networkState = "Underbonded";
    }

    // Recalculate scalePosition
    calculateScalePosition();
  };

  const calculateScalePosition = () => {
    const maxTilt = 30; // Maximum tilt angle in degrees
    const midpoint = 50; // The balanced point where nodeShare equals poolShare

    // Calculate the tilt based on the difference from the midpoint
    const tiltPercentage = (nodeShare - midpoint) / midpoint;
    
    // Apply the tilt, capped at maxTilt
    scalePosition = Math.max(Math.min(tiltPercentage * maxTilt, maxTilt), -maxTilt);
  };

  // Replace the existing reactive statement for scalePosition with a writable variable
  let scalePosition = 0;

  $: if (isEditing) {
    totalActiveBond = editedTotalActiveBond;
    totalSecuredValue = editedTotalSecuredValue;
    pendulumAssetBasisPoints = editedPendulumAssetBasisPoints;
    totalAdjustedSecuredValue = editedTotalAdjustedSecuredValue;
    pendulumUseVaultAssets = editedPendulumUseVaultAssets;
    usingAllNodesBond = editedUsingAllNodesBond;
    adjustedBond = editedAdjustedBond;
    calculateDependentValues();
  }

  $: formattedTotalActiveBond = isLoading ? "Loading..." : formatNumber(totalActiveBond);
  $: formattedTotalSecuredValue = isLoading ? "Loading..." : formatNumber(totalSecuredValue);
  $: formattedNodeShare = isLoading ? "Loading..." : formatPercentage(nodeShare);
  $: formattedPoolShare = isLoading ? "Loading..." : formatPercentage(poolShare);
  $: formattedPendulumModifier = isLoading ? "Loading..." : formatNumber(pendulumAssetBasisPoints / 10000);
  $: formattedTotalAdjustedSecuredValue = isLoading ? "Loading..." : formatNumber(totalAdjustedSecuredValue);
  $: formattedAdjustedBond = isLoading ? "Loading..." : formatNumber(adjustedBond);

  // Add this helper function to simplify large numbers
  function simplifyNumber(num) {
    if (num >= 1000000) {
      return Math.round(num / 1000000) + 'M';
    } else if (num >= 1000) {
      return Math.round(num / 1000) + 'K';
    }
    return Math.round(num);
  }
</script>

<div class="incentive-pendulum">
  <div class="container">
    <h2>THORChain Incentive Pendulum</h2>
    <div class="network-state">
      <div class="balance-scale">
        <div class="scale-beam" style="transform: translateX(-50%) rotate({scalePosition}deg)">
          <div class="scale-pan left">
            <div class="pan-label-box">Security</div>
            <div class="pan-content">
              <span>{simplifyNumber(usingAllNodesBond ? totalActiveBond : adjustedBond)}</span>
              <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="scale-icon" />
            </div>
          </div>
          <div class="scale-pan right">
            <div class="pan-label-box">Liquidity</div>
            <div class="pan-content">
              <span>{simplifyNumber(totalAdjustedSecuredValue)}</span>
              <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="scale-icon" />
            </div>
          </div>
        </div>
        <div class="scale-stand"></div>
      </div>
      <div class="state-label"><span class="state-value">{networkState}</span></div>
      <div class="reward-indicator">
        {#if nodeShare > poolShare}
          Security earning {formattedNodeShare} of rewards
        {:else if poolShare > nodeShare}
          Liquidity earning {formattedPoolShare} of rewards
        {:else}
          Equal reward distribution
        {/if}
      </div>
    </div>
    <div class="grid">
      <div class="card total-bond">
        <h3>Total Active Bond</h3>
        <div class="main-value">
          {#if isEditing}
            <input type="number" bind:value={editedTotalActiveBond} step="1000" min="0" />
          {:else}
            {formattedTotalActiveBond}
          {/if}
          {#if !isLoading}<img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />{/if}
        </div>
      </div>
      <div class="card total-secured">
        <h3>Total Secured Value</h3>
        <div class="main-value">
          {#if isEditing}
            <input type="number" bind:value={editedTotalSecuredValue} step="1000" min="0" />
          {:else}
            {formattedTotalSecuredValue}
          {/if}
          {#if !isLoading}<img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />{/if}
        </div>
      </div>
      <div class="card node-share">
        <h3>Node Reward Share</h3>
        <div class="main-value">{formattedNodeShare}</div>
      </div>
      <div class="card pool-share">
        <h3>Pool Reward Share</h3>
        <div class="main-value">{formattedPoolShare}</div>
      </div>
    </div>

    <div class="button-container">
      <button on:click={toggleShowMore} class="toggle-button" disabled={isLoading}>
        {showMore ? 'Hide' : 'Show'} More
      </button>
      {#if showMore}
        <button on:click={toggleEdit} class="toggle-button edit-button" disabled={isLoading}>
          {isEditing ? 'Save' : 'Edit'}
        </button>
      {/if}
    </div>

    {#if showMore && !isLoading}
      <div class="grid">
        <div class="card pendulum-modifier">
          <h3>Pendulum Modifier</h3>
          <div class="main-value">
            {#if isEditing}
              <input type="number" bind:value={editedPendulumAssetBasisPoints} step="100" min="0" max="10000" />
            {:else}
              {formattedPendulumModifier}x
            {/if}
          </div>
        </div>
        <div class="card adjusted-secured">
          <h3>Total Adjusted Secured Value</h3>
          <div class="main-value">
            {#if isEditing}
              <input type="number" bind:value={editedTotalAdjustedSecuredValue} step="1000" min="0" />
            {:else}
              {formattedTotalAdjustedSecuredValue}
            {/if}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          </div>
        </div>
        <div class="card pendulum-use-vault-assets">
          <h3>Assets Considered in Pendulum</h3>
          <div class="main-value">
            {#if isEditing}
              <select bind:value={editedPendulumUseVaultAssets}>
                <option value={1}>All Vault Assets</option>
                <option value={0}>Pool Only</option>
              </select>
            {:else}
              {pendulumUseVaultAssets === 1 ? 'All Vault Assets' : 'Pool Only'}
            {/if}
          </div>
        </div>
        <div class="card pendulum-use-effective-security">
          <h3>Using All Nodes Bond?</h3>
          <div class="main-value">
            {#if isEditing}
              <select bind:value={editedUsingAllNodesBond}>
                <option value={true}>Yes</option>
                <option value={false}>No</option>
              </select>
            {:else}
              {usingAllNodesBond ? 'Yes' : 'No'}
            {/if}
          </div>
        </div>
        <div class="card adjusted-bond">
          <h3>Bottom 2/3 Nodes Bond</h3>
          <div class="main-value">
            {#if isEditing}
              <input type="number" bind:value={editedAdjustedBond} step="1000" min="0" />
            {:else}
              {formattedAdjustedBond}
            {/if}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          </div>
        </div>
      </div>

      <table class="asset-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Total Secured Value (RUNE)</th>
          </tr>
        </thead>
        <tbody>
          {#each securedAssets as asset}
            <tr>
              <td>{asset.shortName}</td>
              <td>{formatNumber(asset.runeValue)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<style>
  .incentive-pendulum {
    max-width: 800px;
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
  }

  h2 {
    text-align: center;
    margin: 0;
    padding: 20px;
    background-color: #2c2c2c;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 120px;
    position: relative;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  h3 {
    font-size: 14px;
    margin: 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .main-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    position: absolute;
    top: 50%;
    left: 15px;
    right: 15px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rune-icon {
    width: 20px;
    height: 20px;
    margin-left: 5px;
  }

  .toggle-button {
    display: block;
    margin: 20px auto;
    padding: 10px 20px;
    background-color: #4a4a4a;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .toggle-button:hover {
    background-color: #5a5a5a;
  }

  .asset-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }

  .asset-table th, .asset-table td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #4a4a4a;
  }

  .asset-table th {
    background-color: #3a3a3a;
    font-weight: bold;
  }

  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .card {
      height: auto;
      min-height: 100px;
    }

    .main-value {
      position: static;
      transform: none;
      margin: 10px 0;
      font-size: 18px;
    }
  }

  .network-state {
    padding: 30px;
    background-color: #2c2c2c;
    border-bottom: 1px solid #3a3a3a;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 2px solid #4A90E2;
    border-radius: 10px;
    margin: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .balance-scale {
    width: 100%;
    max-width: 300px;
    height: 200px;
    position: relative;
    margin-bottom: 20px;
  }

  .scale-beam {
    width: calc(100% - 20px);
    max-width: 280px;
    height: 8px;
    background-color: #4A90E2;
    position: absolute;
    top: 50px;
    left: 50%;
    transform-origin: center;
    transition: transform 0.3s ease;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .scale-pan {
    width: 100px;
    height: 40px;
    background-color: #4a4a4a;
    border-radius: 0 0 40px 40px;
    position: absolute;
    top: 58px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid #5a5a5a;
  }

  .pan-label-box {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #1a1a1a;
    padding: 2px 12px;
    border-radius: 12px;
    font-size: 12px;
    color: #a9a9a9;
    white-space: nowrap;
  }

  .pan-content {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: white;
  }

  .scale-pan .scale-icon {
    width: 14px;
    height: 14px;
  }

  .scale-pan.left {
    left: -50px;
  }

  .scale-pan.right {
    right: -50px;
  }

  .scale-stand {
    width: 8px;
    height: 140px;
    background-color: #4A90E2;
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .state-label {
    margin-top: 20px;
    font-size: 18px;
    font-weight: 600;
    color: #a9a9a9;
    text-align: center;
    background-color: #1a1a1a;
    padding: 10px 20px;
    border-radius: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .state-value {
    color: #4A90E2;
    font-size: 20px;
    font-weight: 700;
  }

  .scale-pan.left::after,
  .scale-pan.right::after {
    display: none;
  }

  .toggle-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pendulum-use-vault-assets {
    position: relative;
  }

  .pendulum-use-vault-assets .toggle-button {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    padding: 5px 10px;
  }

  .pendulum-use-vault-assets-details {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
    margin-top: 20px;
    font-size: 14px;
    color: #a9a9a9;
  }

  .pendulum-use-vault-assets-details ul {
    margin-top: 10px;
    padding-left: 20px;
  }

  .pendulum-use-vault-assets-details li {
    margin-bottom: 5px;
  }

  .pendulum-use-effective-security {
    position: relative;
  }

  .pendulum-use-effective-security .main-value {
    font-size: 20px;
  }

  .adjusted-bond {
    position: relative;
  }

  .adjusted-bond .main-value {
    font-size: 20px;
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
  }

  .edit-button {
    background-color: #4A90E2;
  }

  .edit-button:hover {
    background-color: #3A80D2;
  }

  input[type="number"] {
    width: 100%;
    background-color: #3a3a3a;
    border: 1px solid #4a4a4a;
    color: white;
    padding: 5px;
    border-radius: 4px;
    font-size: 18px;
    text-align: center;
  }

  input[type="number"]:focus {
    outline: none;
    border-color: #4A90E2;
  }

  select {
    width: 100%;
    background-color: #3a3a3a;
    border: 1px solid #4a4a4a;
    color: white;
    padding: 5px;
    border-radius: 4px;
    font-size: 16px;
    text-align: center;
  }

  select:focus {
    outline: none;
    border-color: #4A90E2;
  }

  .reward-indicator {
    margin-top: 15px;
    font-size: 16px;
    color: #a9a9a9;
    text-align: center;
    background-color: #1a1a1a;
    padding: 8px 16px;
    border-radius: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 600px) {
    .network-state {
      padding: 15px;
      margin: 10px;
    }

    .balance-scale {
      height: 160px;
      margin-bottom: 15px;
    }

    .scale-beam {
      width: calc(100% - 100px);
      top: 40px;
    }

    .scale-pan {
      width: 80px;
      height: 40px;
    }

    .pan-label-box {
      font-size: 10px;
      padding: 2px 8px;
      top: -20px;
    }

    .state-label {
      font-size: 16px;
      padding: 8px 16px;
    }

    .state-value {
      font-size: 18px;
    }

    .reward-indicator {
      font-size: 14px;
      padding: 6px 12px;
      margin-top: 10px;
    }
  }
</style>