<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  let blockHeight = '';
  let selectedDate = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
  let loading = false;
  let error = null;
  let blockData = [];

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

  function handleDateChange(event) {
    selectedDate = event.target.value;
    if (selectedDate && blockData.length > 0) {
      try {
        const matchingBlock = blockData.find(block => 
          block.DATE.startsWith(selectedDate)
        );
        
        if (matchingBlock) {
          blockHeight = matchingBlock.HEIGHT.toString();
          error = null;
        } else {
          // Find the earliest date in the dataset
          const earliestBlock = blockData.reduce((prev, curr) => 
            new Date(prev.DATE) < new Date(curr.DATE) ? prev : curr
          );
          
          if (new Date(selectedDate) < new Date(earliestBlock.DATE)) {
            error = `No data available before ${earliestBlock.DATE.slice(0, 10)}.`;
          } else {
            error = 'No block data available for the selected date';
          }
          blockHeight = '';
        }
      } catch (err) {
        error = err.message;
        blockHeight = '';
      }
    }
  }

  function handleBlockChange(event) {
    blockHeight = event.target.value;
    if (blockHeight && !isNaN(parseInt(blockHeight)) && blockData.length > 0) {
      try {
        const targetBlock = parseInt(blockHeight);
        
        // First try exact match
        const exactMatch = blockData.find(block => block.HEIGHT === targetBlock);
        if (exactMatch) {
          selectedDate = exactMatch.DATE.slice(0, 10);
          error = null;
          return;
        }

        // Find the blocks before and after the target
        const beforeBlock = blockData.reduce((prev, curr) => {
          if (curr.HEIGHT > targetBlock) return prev;
          return !prev || curr.HEIGHT > prev.HEIGHT ? curr : prev;
        }, null);

        const afterBlock = blockData.reduce((prev, curr) => {
          if (curr.HEIGHT <= targetBlock) return prev;
          return !prev || curr.HEIGHT < prev.HEIGHT ? curr : prev;
        }, null);

        if (!beforeBlock) {
          error = 'Block height is before available data';
          selectedDate = '';
          return;
        }

        if (!afterBlock) {
          error = 'Block height is after available data';
          selectedDate = '';
          return;
        }

        // Calculate the estimated date using linear interpolation
        const blockDiff = afterBlock.HEIGHT - beforeBlock.HEIGHT;
        const timeDiff = new Date(afterBlock.DATE) - new Date(beforeBlock.DATE);
        const blockProgress = (targetBlock - beforeBlock.HEIGHT) / blockDiff;
        const estimatedTime = new Date(beforeBlock.DATE).getTime() + (timeDiff * blockProgress);
        
        selectedDate = new Date(estimatedTime).toISOString().slice(0, 10);
        error = null;
      } catch (err) {
        error = err.message;
        selectedDate = '';
      }
    }
  }
</script>

<div class="block-date-calculator">
  <div class="container">
    <h2>Block Date Calculator</h2>

    <div class="calculator-grid">
      <div class="input-group">
        <label for="date">Date</label>
        <input
          type="date"
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
  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.7;
    cursor: pointer;
  }

  input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
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
