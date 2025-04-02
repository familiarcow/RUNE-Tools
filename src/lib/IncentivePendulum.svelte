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
        totalActiveBond = activeNodes.reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);
        adjustedBond = activeNodes
          .slice(cutoffIndex)
          .reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);
      } else {
        usingAllNodesBond = true;
        totalActiveBond = activeNodes.reduce((sum, node) => sum + Number(node.total_bond) / 1e8, 0);
        adjustedBond = totalActiveBond;
      }

      // Set PendulumAssetBasisPoints
      pendulumAssetBasisPoints = Number(mimirData) > 0 ? Number(mimirData) : 10000;

      // Calculate Adjusted Secured Assetsz
      totalAdjustedSecuredValue = totalSecuredValue * (pendulumAssetBasisPoints / 10000);

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

    // Determine network state based on the difference from equilibrium
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

    // Calculate relative difference between node and pool share
    // This gives us a value between -1 and 1 representing how far from equilibrium we are
    const tiltPercentage = (nodeShare - poolShare) / 100;
    
    // Apply the tilt, capped at maxTilt
    scalePosition = -Math.max(Math.min(tiltPercentage * maxTilt, maxTilt), -maxTilt);
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

    <div class="grid">
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

      <div class="card adjusted-bond">
        <h3>Effective Security</h3>
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
      </div>

      <!-- Add new Mimir values section -->
      <div class="mimir-section">
        <h3>Mimir Configuration</h3>
        <div class="mimir-grid">
          <div class="mimir-card">
            <div class="mimir-label">PendulumAssetBasisPoints</div>
            <div class="mimir-value">{pendulumAssetBasisPoints}</div>
            <div class="mimir-description">Adjusts the secured value considered in pendulum calculations</div>
          </div>
          <div class="mimir-card">
            <div class="mimir-label">PendulumUseVaultAssets</div>
            <div class="mimir-value">{pendulumUseVaultAssets}</div>
            <div class="mimir-description">{pendulumUseVaultAssets === 1 ? 'Using all vault assets' : 'Using pool assets only'}</div>
          </div>
          <div class="mimir-card">
            <div class="mimir-label">PendulumUseEffectiveSecurity</div>
            <div class="mimir-value">{pendulumUseEffectiveSecurity}</div>
            <div class="mimir-description">{pendulumUseEffectiveSecurity === 1 ? 'Using bottom 2/3 nodes bond' : 'Using all nodes bond'}</div>
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
    padding: 40px 20px;
    background: linear-gradient(180deg, rgba(74, 144, 226, 0.1) 0%, rgba(26, 26, 26, 0.8) 100%);
    border-bottom: 1px solid #3a3a3a;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 2px solid rgba(74, 144, 226, 0.3);
    border-radius: 16px;
    margin: 20px 10px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    position: relative;
  }

  .balance-scale {
    width: 100%;
    max-width: 400px;
    height: 250px;
    position: relative;
    margin: 0 auto 30px;
    padding: 0 60px;
  }

  .scale-beam {
    width: calc(100% - 120px);
    height: 10px;
    background: linear-gradient(90deg, #4A90E2 0%, #6AA8E8 50%, #4A90E2 100%);
    position: absolute;
    top: 60px;
    left: 50%;
    transform-origin: center;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 5px;
    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
  }

  .scale-pan {
    width: 120px;
    height: 50px;
    background: linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 100%);
    border-radius: 0 0 50px 50px;
    position: absolute;
    top: 70px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(74, 144, 226, 0.3);
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .scale-pan.left {
    left: -60px;
    transform-origin: top center;
  }

  .scale-pan.right {
    right: -60px;
    transform-origin: top center;
  }

  .scale-stand {
    width: 12px;
    height: 180px;
    background: linear-gradient(90deg, #4A90E2 0%, #6AA8E8 50%, #4A90E2 100%);
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 6px;
    box-shadow: 0 4px 8px rgba(74, 144, 226, 0.3);
  }

  .scale-stand::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 8px;
    background: linear-gradient(90deg, #4A90E2 0%, #6AA8E8 50%, #4A90E2 100%);
    border-radius: 4px;
  }

  .pan-label-box {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 26, 26, 0.9);
    padding: 4px 16px;
    border-radius: 12px;
    font-size: 14px;
    color: #4A90E2;
    white-space: nowrap;
    border: 1px solid rgba(74, 144, 226, 0.3);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .pan-content {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .scale-icon {
    width: 18px;
    height: 18px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .state-label {
    margin-top: 25px;
    font-size: 18px;
    font-weight: 600;
    color: #a9a9a9;
    text-align: center;
    background: rgba(26, 26, 26, 0.9);
    padding: 12px 24px;
    border-radius: 24px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(74, 144, 226, 0.3);
  }

  .state-value {
    color: #4A90E2;
    font-size: 22px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .reward-indicator {
    margin-top: 20px;
    font-size: 16px;
    color: #a9a9a9;
    text-align: center;
    background: rgba(26, 26, 26, 0.9);
    padding: 10px 20px;
    border-radius: 16px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(74, 144, 226, 0.3);
    font-weight: 500;
  }

  /* Add smooth animations for the scale pans */
  .scale-beam[style*="rotate"] .scale-pan.left {
    transform: rotate(calc(var(--rotation) * -1));
  }

  .scale-beam[style*="rotate"] .scale-pan.right {
    transform: rotate(calc(var(--rotation) * -1));
  }

  @media (max-width: 600px) {
    .network-state {
      padding: 20px 10px;
      margin: 10px 5px;
    }

    .balance-scale {
      max-width: 280px;
      height: 180px;
      padding: 0 40px;
      margin-bottom: 20px;
    }

    .scale-beam {
      width: calc(100% - 80px);
      height: 8px;
      top: 40px;
    }

    .scale-pan {
      width: 80px;
      height: 35px;
      top: 48px;
    }

    .scale-pan.left {
      left: -40px;
    }

    .scale-pan.right {
      right: -40px;
    }

    .scale-stand {
      height: 140px;
      width: 10px;
    }

    .scale-stand::after {
      width: 30px;
      height: 6px;
    }

    .pan-label-box {
      font-size: 12px;
      padding: 3px 10px;
      top: -22px;
    }

    .pan-content {
      font-size: 13px;
      gap: 4px;
    }

    .scale-icon {
      width: 12px;
      height: 12px;
    }

    .state-label {
      font-size: 14px;
      padding: 8px 16px;
      margin-top: 15px;
    }

    .state-value {
      font-size: 16px;
    }

    .reward-indicator {
      font-size: 12px;
      padding: 6px 12px;
      margin-top: 12px;
    }
  }

  /* Add small phone breakpoint */
  @media (max-width: 360px) {
    .balance-scale {
      max-width: 240px;
      padding: 0 30px;
    }

    .scale-beam {
      width: calc(100% - 60px);
    }

    .scale-pan {
      width: 70px;
      height: 30px;
    }

    .scale-pan.left {
      left: -35px;
    }

    .scale-pan.right {
      right: -35px;
    }

    .pan-content {
      font-size: 12px;
    }
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

  /* Add these new styles */
  .mimir-section {
    padding: 20px;
    margin: 20px 10px;
    background: rgba(26, 26, 26, 0.9);
    border-radius: 12px;
    border: 1px solid rgba(74, 144, 226, 0.3);
  }

  .mimir-section h3 {
    color: #4A90E2;
    font-size: 18px;
    margin-bottom: 15px;
    text-align: center;
  }

  .mimir-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
  }

  .mimir-card {
    background: #2c2c2c;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid rgba(74, 144, 226, 0.2);
    transition: all 0.3s ease;
  }

  .mimir-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .mimir-label {
    color: #4A90E2;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    font-family: monospace;
  }

  .mimir-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    margin-bottom: 8px;
  }

  .mimir-description {
    color: #a9a9a9;
    font-size: 12px;
    line-height: 1.4;
  }

  @media (max-width: 600px) {
    .mimir-section {
      padding: 15px;
      margin: 10px 5px;
    }

    .mimir-grid {
      grid-template-columns: 1fr;
    }

    .mimir-card {
      padding: 12px;
    }

    .mimir-value {
      font-size: 20px;
    }
  }
</style>