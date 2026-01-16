<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { thornode } from '$lib/api';
  import { PageHeader, LoadingBar } from '$lib/components';

  let constants = null;
  let mimir = null;
  let loading = true;
  let error = null;
  let toast = null;
  let toastTimeout;
  let searchTerm = '';

  onMount(async () => {
    try {
      const [constantsData, mimirData] = await Promise.all([
        thornode.fetch('/thorchain/constants'),
        thornode.fetch('/thorchain/mimir')
      ]);

      constants = constantsData;
      mimir = mimirData;
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
    const processedKeys = new Set();

    // First add all Mimir values
    if (mimir) {
      for (const [key, value] of Object.entries(mimir)) {
        if (key.toLowerCase().includes(lowercaseSearch) || String(value).toLowerCase().includes(lowercaseSearch)) {
          filteredEntries.push([key, value, true]);
          processedKeys.add(key);
        }
      }
    }

    // Then add constants that don't have Mimir overrides
    if (constants) {
      for (const category in constants) {
        for (const [key, value] of Object.entries(constants[category])) {
          if (!processedKeys.has(key.toUpperCase()) && 
              (key.toLowerCase().includes(lowercaseSearch) || String(value).toLowerCase().includes(lowercaseSearch))) {
            filteredEntries.push([key, value, false]);
          }
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
  <PageHeader title="THORChain Constants">
    <div slot="actions" class="header-actions">
      <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo" class="header-logo">
      <div class="info-icon" on:click={() => showToast('Constants are the core parameters that govern the THORChain protocol.')}>ⓘ</div>
    </div>
  </PageHeader>

  <div class="search-container">
    <input
      type="text"
      bind:value={searchTerm}
      placeholder="Search constants..."
      class="search-input"
    />
  </div>

  {#if loading}
    <div class="loading-container">
      <LoadingBar width="200px" height="20px" />
      <p class="loading-text">Loading constants...</p>
    </div>
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    color: #FFFFFF;
    background-color: #1a1a1a;
    min-height: 100vh;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-logo {
    width: 32px;
    height: 32px;
  }

  .info-icon {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 18px;
    transition: opacity 0.2s;
  }

  .info-icon:hover {
    color: #ffffff;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }

  .loading-text {
    color: #a0a0a0;
    font-size: 14px;
    margin: 0;
  }

  .search-container {
    margin-bottom: 30px;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #ffffff;
    font-size: 16px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    background: linear-gradient(145deg, #3a3a3a 0%, #4a4a4a 100%);
  }

  .search-input::placeholder {
    color: #a0a0a0;
  }

  .table-wrapper {
    background-color: #1a1a1a;
    border-radius: 16px;
    overflow-x: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 20px 16px;
    text-align: left;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
  }

  th:last-child {
    border-right: none;
  }

  tbody tr {
    background: #2c2c2c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  tbody tr:nth-child(even) {
    background: #252525;
  }

  tbody tr:hover {
    background: #3a3a3a !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  tbody tr:last-child {
    border-bottom: none;
  }

  .key-cell {
    padding: 16px;
    vertical-align: middle;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .key-name {
    font-size: 16px;
    font-weight: 600;
    color: #4A90E2;
    font-family: inherit;
  }

  .value-cell {
    padding: 16px;
    vertical-align: middle;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
    padding: 16px;
    vertical-align: middle;
    text-align: center;
  }

  .status {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    min-width: 80px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status.overridden {
    background: rgba(255, 169, 77, 0.15);
    color: #ffa94d;
    border: 1px solid rgba(255, 169, 77, 0.3);
  }

  .status.default {
    background: rgba(105, 219, 124, 0.15);
    color: #69db7c;
    border: 1px solid rgba(105, 219, 124, 0.3);
  }

  .toast {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4A90E2 0%, #357abd 100%);
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-weight: 600;
    z-index: 1000;
  }

  .error {
    text-align: center;
    color: #dc3545;
    font-size: 18px;
    font-weight: 600;
    padding: 40px;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(220, 53, 69, 0.2);
  }

  @media (max-width: 600px) {
    .container {
      padding: 16px;
      max-width: 100%;
    }

    table {
      table-layout: auto;
    }

    .key-cell, .value-cell, .status-cell {
      padding: 12px;
    }

    .status {
      min-width: 60px;
      font-size: 11px;
      padding: 4px 8px;
    }

    .long-value {
      font-size: 12px;
    }
  }

  @media (max-width: 400px) {
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

    .key-cell, .value-cell, .status-cell {
      padding: 10px;
    }
  }
</style>