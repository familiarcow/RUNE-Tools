<script>
  import { createEventDispatcher } from 'svelte';

  export let showEstimatedTime;
  export let enableAffiliateSettings;

  const dispatch = createEventDispatcher();

  function closeSettings() {
    dispatch('close');
  }
</script>

<style>
  .settings-modal {
    position: absolute;
    top: 40px;
    right: 0;
    background-color: #2e2e2e;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 16px;
    z-index: 10;
    min-width: 200px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .close-button {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    position: absolute;
    top: 8px;
    right: 8px;
  }
</style>

<div class="settings-modal">
  <button class="close-button" on:click={closeSettings}>×</button>
  <h3>Settings</h3>
  <div class="setting-item">
    <span>Show Estimated Time</span>
    <input type="checkbox" bind:checked={showEstimatedTime}>
  </div>
  <div class="setting-item">
    <span>Enable Affiliate Settings</span>
    <input type="checkbox" bind:checked={enableAffiliateSettings}>
  </div>
</div>