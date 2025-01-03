<script>
  import { onMount } from 'svelte';
  import axios from 'axios';
  import { fade } from 'svelte/transition';

  let constants = null;
  let mimir = null;
  let loading = true;
  let error = null;
  let toast = null;
  let toastTimeout;
  let searchTerm = '';

  onMount(async () => {
    try {
      const [constantsResponse, mimirResponse] = await Promise.all([
        axios.get('https://thornode.ninerealms.com/thorchain/constants'),
        axios.get('https://thornode.ninerealms.com/thorchain/mimir')
      ]);

      constants = constantsResponse.data;
      mimir = mimirResponse.data;
      loading = false;
    } catch (err) {
      error = 'Failed to fetch data. Please try again later.';
      loading = false;
    }
  });

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied "${text}" to clipboard!`);
    });
  }

  function showToast(message) {
    toast = message;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast = null;
    }, 3000);
  }

  function renderValue(key, value) {
    const mimirValue = mimir[key.toUpperCase()];
    const displayValue = mimirValue !== undefined ? mimirValue : value;
    return {
      value: displayValue,
      isOverridden: mimirValue !== undefined,
      isLong: String(displayValue).length > 14
    };
  }

  function filterConstants(constants, mimir, searchTerm) {
    const lowercaseSearch = searchTerm.toLowerCase();
    const filteredEntries = [];

    for (const category in constants) {
      for (const [key, value] of Object.entries(constants[category])) {
        const { value: displayValue, isOverridden } = renderValue(key, value);
        if (key.toLowerCase().includes(lowercaseSearch) || String(displayValue).toLowerCase().includes(lowercaseSearch)) {
          filteredEntries.push([key, value, isOverridden]);
        }
      }
    }

    return filteredEntries;
  }

  function isLongString(str) {
    return String(str).length > 15;
  }

  $: filteredConstants = constants ? filterConstants(constants, mimir, searchTerm) : [];
</script>

<div class="container">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo">
    <h2>THORChain Constants</h2>
    <div class="info-icon" on:click={() => showToast('Constants are the core parameters that govern the THORChain protocol.')}>ⓘ</div>
  </div>

  <div class="search-container">
    <input 
      type="text" 
      bind:value={searchTerm}
      placeholder="Search constants..."
      class="search-input"
    />
  </div>

  {#if loading}
    <div class="loading">Loading data...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="key-column">Constant</th>
            <th class="value-column">Value</th>
            <th class="status-column">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredConstants as [key, value, isOverridden]}
            <tr>
              <td class="key-cell" on:click={() => copyToClipboard(key)}>
                <div class="key-name">{key}</div>
              </td>
              <td 
                class="value-cell" 
                on:click={() => copyToClipboard(String(renderValue(key, value).value))}
              >
                <div class="value-content">
                  <span class={renderValue(key, value).isLong ? 'long-value' : ''}>
                    {renderValue(key, value).value}
                  </span>
                </div>
              </td>
              <td class="status-cell">
                <span class={isOverridden ? 'status overridden' : 'status default'}>
                  {isOverridden ? 'Mimir' : 'Constant'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if toast}
    <div class="toast" transition:fade={{ duration: 300 }}>
      {toast}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo 2', sans-serif;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
    gap: 15px;
    position: relative;
  }

  .app-header img {
    width: 40px;
    height: 40px;
  }

  .app-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #f8f8f8;
  }

  .info-icon {
    position: absolute;
    right: 0;
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .info-icon:hover {
    opacity: 1;
  }

  .search-container {
    margin-bottom: 30px;
  }

  .search-input {
    width: 100%;
    padding: 12px;
    background-color: #2c2c2c;
    border: 1px solid #3a3a3c;
    border-radius: 6px;
    color: #fff;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow-x: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #1a1a1a;
    table-layout: fixed;
  }

  .key-column {
    width: 30%;
  }

  .value-column {
    width: 50%;
  }

  .status-column {
    width: 20%;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #3a3a3c;
  }

  tr {
    background-color: #2c2c2c;
    border-bottom: 1px solid #3a3a3c;
  }

  tr:last-child {
    border-bottom: none;
  }

  .key-cell {
    padding: 12px 16px;
    vertical-align: middle;
    cursor: pointer;
    transition: background-color 0.2s;
    border-right: none;
  }

  .key-cell:hover {
    background-color: #3a3a3c;
  }

  .key-name {
    font-size: 16px;
    font-weight: 600;
    color: #4A90E2;
  }

  .value-cell {
    padding: 12px 16px;
    vertical-align: middle;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .value-cell:hover {
    background-color: #3a3a3c;
  }

  .value-content {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .long-value {
    word-break: break-all;
    white-space: pre-wrap;
    font-family: monospace;
    font-size: 14px;
  }

  .status-cell {
    padding: 12px 16px;
    vertical-align: middle;
    text-align: center;
  }

  .status {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    min-width: 80px;
    text-align: center;
  }

  .status.overridden {
    background: rgba(255, 169, 77, 0.1);
    color: #ffa94d;
  }

  .status.default {
    background: rgba(105, 219, 124, 0.1);
    color: #69db7c;
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4A90E2;
    color: #fff;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  .error {
    text-align: center;
    color: #ff6b6b;
    font-size: 18px;
    padding: 40px;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
      max-width: 100%;
    }

    table {
      table-layout: auto;
    }

    .key-cell, .value-cell, .status-cell {
      padding: 10px;
    }

    .status {
      min-width: 60px;
      font-size: 12px;
      padding: 3px 6px;
    }

    .long-value {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .key-column {
      width: 40%;
    }

    .value-column {
      width: 40%;
    }

    .status-column {
      width: 20%;
    }

    .value-content {
      max-width: 120px;
    }
  }
</style>