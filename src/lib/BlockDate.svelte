<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  let blockHeight = '';
  let selectedDate = new Date().toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
  let result = null;
  let loading = false;
  let error = null;
  let blockData = [];

  // Constants for block time calculations
  const BLOCKS_PER_DAY = 14515; // Average blocks per day
  const BLOCK_TIME = 6; // Average block time in seconds

  onMount(async () => {
    await fetchBlockData();
  });

  async function fetchBlockData() {
    try {
      loading = true;
      const response = await axios.get('https://flipsidecrypto.xyz/api/v1/queries/bfedb0b6-704d-494a-8651-0386277cc294/data/latest');
      blockData = response.data.sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
      loading = false;
    } catch (err) {
      error = 'Failed to fetch block data';
      loading = false;
    }
  }

  function findNearestBlock(targetDate) {
    const targetTimestamp = new Date(targetDate).getTime();
    
    // Find the closest block by comparing timestamps
    let closest = blockData.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.DATE).getTime() - targetTimestamp);
      const currDiff = Math.abs(new Date(curr.DATE).getTime() - targetTimestamp);
      return currDiff < prevDiff ? curr : prev;
    });

    // Calculate the exact block using time difference
    const timeDiff = targetTimestamp - new Date(closest.DATE).getTime();
    const blockDiff = Math.round(timeDiff / (BLOCK_TIME * 1000));
    
    return closest.HEIGHT + blockDiff;
  }

  function findBlockDate(targetBlock) {
    // Find the closest known block
    let closest = blockData.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.HEIGHT - targetBlock);
      const currDiff = Math.abs(curr.HEIGHT - targetBlock);
      return currDiff < prevDiff ? curr : prev;
    });

    // Calculate the time difference based on block difference
    const blockDiff = targetBlock - closest.HEIGHT;
    const timeDiff = blockDiff * BLOCK_TIME * 1000;
    return new Date(new Date(closest.DATE).getTime() + timeDiff);
  }

  function handleDateChange(event) {
    selectedDate = event.target.value;
    if (selectedDate && blockData.length > 0) {
      const estimatedBlock = findNearestBlock(selectedDate);
      blockHeight = Math.round(estimatedBlock).toString();
    }
  }

  function handleBlockChange(event) {
    blockHeight = event.target.value;
    if (blockHeight && !isNaN(parseInt(blockHeight)) && blockData.length > 0) {
      const estimatedDate = findBlockDate(parseInt(blockHeight));
      selectedDate = estimatedDate.toISOString().slice(0, 16);
    }
  }

  // Export functions for use in other components
  export const blockDateUtils = {
    findNearestBlock,
    findBlockDate,
    BLOCKS_PER_DAY,
    BLOCK_TIME
  };
</script>

<div class="block-date-calculator">
  <div class="container">
    <h2>Block Date Calculator</h2>

    <div class="calculator-grid">
      <div class="input-group">
        <label for="date">Date & Time</label>
        <input
          type="datetime-local"
          id="date"
          value={selectedDate}
          on:change={handleDateChange}
          class="date-input"
        />
      </div>

      <div class="input-group">
        <label for="block-height">Block Height</label>
        <input
          type="number"
          id="block-height"
          value={blockHeight}
          on:input={handleBlockChange}
          placeholder="Enter block height..."
          min="0"
          class="block-input"
        />
      </div>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading block data...</div>
    {/if}
  </div>
</div>

<style>
  .block-date-calculator {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo', sans-serif;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

  .calculator-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    padding: 20px;
  }

  .input-group {
    background-color: #2c2c2c;
    padding: 20px;
    border-radius: 8px;
  }

  label {
    display: block;
    color: #a9a9a9;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #4A90E2;
    background-color: #1a1a1a;
    color: white;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  input:focus {
    outline: none;
    border-color: #357abd;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  /* Style the calendar input */
  input[type="datetime-local"] {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234A90E2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 44px;
  }

  input[type="datetime-local"]::-webkit-calendar-picker-indicator {
    background: transparent;
    color: transparent;
    cursor: pointer;
    height: 20px;
    width: 20px;
    position: absolute;
    right: 12px;
  }

  .error-message {
    color: #ff4444;
    padding: 10px;
    margin: 10px 20px;
    background-color: rgba(255, 68, 68, 0.1);
    border-radius: 6px;
    text-align: center;
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: #a9a9a9;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .block-date-calculator {
      padding: 10px;
    }

    .calculator-grid {
      grid-template-columns: 1fr;
      gap: 15px;
      padding: 15px;
    }

    .input-group {
      padding: 15px;
    }
  }
</style>
