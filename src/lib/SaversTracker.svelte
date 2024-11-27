<script>
  import { onMount } from "svelte";
  import SaversYield from "./SaversYield.svelte";
  import SaversPosition from "./SaversPosition.svelte";

  let activeTab = "position"; // Default to the Savers Position tab
  let asset = "";
  let address = "";

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    asset = urlParams.get("asset") || "";
    address = urlParams.get("address") || "";
    
    if (asset && address) {
      activeTab = "position";
    }
  });

  function switchTab(tab) {
    activeTab = tab;
  }
</script>

<div class="savers-tracker">
  <div class="tabs">
    <button 
      class:active={activeTab === "position"} 
      on:click={() => switchTab("position")}
    >
      Savers Position
    </button>
    <button 
      class:active={activeTab === "yieldshare"} 
      on:click={() => switchTab("yieldshare")}
    >
      Savers Yield Share
    </button>
  </div>

  <div class="content">
    {#if activeTab === "position"}
      <SaversPosition {asset} {address} />
    {:else}
      <SaversYield />
    {/if}
  </div>
</div>

<style>
  .savers-tracker {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    font-family: 'Exo', sans-serif;
  }

  .tabs {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .tabs button {
    padding: 10px 20px;
    border: none;
    background-color: #2c2c2c;
    color: #a9a9a9;
    cursor: pointer;
    transition: background-color 0.3s, color 0.3s;
  }

  .tabs button.active {
    background-color: #4A90E2;
    color: white;
  }

  .tabs button:first-child {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }

  .tabs button:last-child {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .content {
    width: 100%;
    overflow-x: auto;
  }

  @media (max-width: 768px) {
    .savers-tracker {
      width: 95%;
    }
  }
</style>