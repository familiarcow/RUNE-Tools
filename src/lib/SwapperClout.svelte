<script>
  import { onMount, afterUpdate } from 'svelte';
  import { fade } from 'svelte/transition';
  import { navigate } from 'svelte-routing';

  export let address = '';

  let runeAddress = '';
  let cloutData = null;
  let loading = false;
  let error = '';
  let runePrice = 0;
  let showExplanation = false;
  let showCopyToast = false;
  let isMobile = false;

  let touchStartY = 0;
  let touchStartX = 0;
  let isTouching = false;

  function handleTouchStart(event) {
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
    isTouching = true;
  }

  function handleTouchMove(event) {
    if (!isTouching) return;

    const touchEndY = event.touches[0].clientY;
    const touchEndX = event.touches[0].clientX;
    const deltaY = Math.abs(touchEndY - touchStartY);
    const deltaX = Math.abs(touchEndX - touchStartX);

    // If the user has moved their finger more than 10 pixels, assume they're trying to scroll
    if (deltaY > 10 || deltaX > 10) {
      isTouching = false;
    }
  }

  function handleTouchEnd(event, action) {
    if (isTouching) {
      action();
    }
    isTouching = false;
  }

  onMount(() => {
    if (address) {
      runeAddress = address;
      fetchCloutData();
    }
    fetchRunePrice();
    checkMobile();
    window.addEventListener('resize', checkMobile);
  });

  afterUpdate(() => {
    if (address && address !== runeAddress) {
      runeAddress = address;
      fetchCloutData();
    }
  });

  async function fetchRunePrice() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
      if (!response.ok) throw new Error('Failed to fetch RUNE price');
      const data = await response.json();
      runePrice = Number(data.rune_price_in_tor) / 1e8;
    } catch (err) {
      console.error('Error fetching RUNE price:', err);
    }
  }

  async function fetchCloutData() {
    if (!runeAddress) {
      error = 'Please enter a RUNE address';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/clout/swap/${runeAddress}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      cloutData = await response.json();
    } catch (err) {
      error = 'Error fetching data. Please try again.';
      cloutData = null;
    } finally {
      loading = false;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (runeAddress) {
      navigate(`/clout?address=${runeAddress}`);
      fetchCloutData();
    }
  }

  const formatNumber = (num) => new Intl.NumberFormat().format(num);
  
  const formatClout = (num) => {
    const bigIntNum = BigInt(num);
    const runeValue = Number(bigIntNum) / 1e8;
    const usdValue = runeValue * runePrice;
    return {
      rune: formatNumber(runeValue),
      usd: formatNumber(usdValue.toFixed(2))
    };
  }
  
  const calculateAvailableClout = (total, spent, reclaimed) => {
    const totalBigInt = BigInt(total);
    const spentBigInt = BigInt(spent);
    const reclaimedBigInt = BigInt(reclaimed);
    const available = totalBigInt - spentBigInt + reclaimedBigInt;
    return available.toString();
  }

  const calculateSpentClout = (spent, reclaimed) => {
    const spentBigInt = BigInt(spent);
    const reclaimedBigInt = BigInt(reclaimed);
    const spentClout = spentBigInt - reclaimedBigInt;
    return spentClout.toString();
  }

  const formatAddress = (address) => {
    return `${address.slice(0, 20)}...${address.slice(-4)}`;
  };

  function toggleExplanation() {
    showExplanation = !showExplanation;
  }

  function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      showCopyToast = true;
      setTimeout(() => {
        showCopyToast = false;
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  }

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
  }
</script>

<svelte:window on:resize={checkMobile} />

<div class="swapper-clout">
  <div class="container">
    <h2>Swapper Clout</h2>
    {#if !cloutData}
      <form on:submit={handleSubmit}>
        <label>
          RUNE Address:
          <input type="text" bind:value={runeAddress} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Fetch Clout Data'}
        </button>
      </form>
    {:else}
      <div class="address-card">
        <h3>Address</h3>
        <div class="address-value">{formatAddress(cloutData.address)}</div>
      </div>
      <div class="clout-grid">
        <div class="card total">
          <h3>Total Clout</h3>
          <div class="main-value">
            <svg class="rune-icon" width="24" height="24" viewBox="0 0 114 114" xmlns="http://www.w3.org/2000/svg">
              <circle cx="57" cy="57" r="57" fill="#1C2731"/>
              <path d="M45.9220246 76H39V21H45.9220246L63.6409029 31.0068399V38.5683995L57.3207934 49.4028728L67.4028728 76H60.0294118L50.0225718 49.0266758L57.7722298 35.5588235L45.9220246 28.8625171V76Z" fill="url(#paint0_linear)"/>
              <defs>
                <linearGradient id="paint0_linear" x1="215.554%" y1="50%" x2="-104.268%" y2="60.8825%" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#33FF99"/>
                  <stop offset="1" stop-color="#00CCFF"/>
                </linearGradient>
              </defs>
            </svg>
            <span class="clout-amount">{@html formatClout(cloutData.score).rune}</span>
            <span class="usd-value">${formatClout(cloutData.score).usd}</span>
          </div>
        </div>
        <div class="card available">
          <h3>Available Clout</h3>
          <div class="main-value">
            <svg class="rune-icon" width="24" height="24" viewBox="0 0 114 114" xmlns="http://www.w3.org/2000/svg">
              <circle cx="57" cy="57" r="57" fill="#1C2731"/>
              <path d="M45.9220246 76H39V21H45.9220246L63.6409029 31.0068399V38.5683995L57.3207934 49.4028728L67.4028728 76H60.0294118L50.0225718 49.0266758L57.7722298 35.5588235L45.9220246 28.8625171V76Z" fill="url(#paint0_linear)"/>
              <defs>
                <linearGradient id="paint0_linear" x1="215.554%" y1="50%" x2="-104.268%" y2="60.8825%" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#33FF99"/>
                  <stop offset="1" stop-color="#00CCFF"/>
                </linearGradient>
              </defs>
            </svg>
            <span class="clout-amount">{@html formatClout(calculateAvailableClout(cloutData.score, cloutData.spent, cloutData.reclaimed)).rune}</span>
            <span class="usd-value">${formatClout(calculateAvailableClout(cloutData.score, cloutData.spent, cloutData.reclaimed)).usd}</span>
          </div>
        </div>
        <div class="card spent">
          <h3>Clout Spent</h3>
          <div class="main-value">
            <svg class="rune-icon" width="24" height="24" viewBox="0 0 114 114" xmlns="http://www.w3.org/2000/svg">
              <circle cx="57" cy="57" r="57" fill="#1C2731"/>
              <path d="M45.9220246 76H39V21H45.9220246L63.6409029 31.0068399V38.5683995L57.3207934 49.4028728L67.4028728 76H60.0294118L50.0225718 49.0266758L57.7722298 35.5588235L45.9220246 28.8625171V76Z" fill="url(#paint0_linear)"/>
              <defs>
                <linearGradient id="paint0_linear" x1="215.554%" y1="50%" x2="-104.268%" y2="60.8825%" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#33FF99"/>
                  <stop offset="1" stop-color="#00CCFF"/>
                </linearGradient>
              </defs>
            </svg>
            <span class="clout-amount">{@html formatClout(calculateSpentClout(cloutData.spent, cloutData.reclaimed)).rune}</span>
            <span class="usd-value">${formatClout(calculateSpentClout(cloutData.spent, cloutData.reclaimed)).usd}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="button-group">
    <button 
      class="icon-button copy-button" 
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={(e) => handleTouchEnd(e, copyLink)}
      on:click={copyLink} 
      title="Copy link" 
      class:mobile={isMobile}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
    </button>
    <button 
      class="icon-button help-button" 
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={(e) => handleTouchEnd(e, toggleExplanation)}
      on:click={toggleExplanation} 
      class:mobile={isMobile}
    >
      {showExplanation ? '×' : '?'}
    </button>
  </div>

  {#if showExplanation}
    <div class="explanation" transition:fade>
      Swapper Clout is THORChain's measure of liquidity fees paid. Make a swap and the fees you pay are added to your clout score. When you make another swap, you temporarily "spend" your score to get through the outbound delay more quickly. Once the outbound is sent, you reclaim your spent clout, which can be used on another swap.
    </div>
  {/if}

  {#if showCopyToast}
    <div class="toast" transition:fade>Link copied to clipboard!</div>
  {/if}

  {#if error}
    <div class="toast" transition:fade>{error}</div>
  {/if}
</div>

<style>
  .swapper-clout {
    max-width: 400px;
    width: 95%;
    margin: 0 auto;
    padding: 20px;
    position: relative;
    font-family: 'Exo', sans-serif;
    padding-bottom: 60px; /* Add this line to create space for the help button */
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

  .address-card {
    background-color: #2c2c2c;
    padding: 15px;
    margin: 15px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    word-break: break-all;
  }

  .address-value {
    font-size: 16px;
    color: white;
    margin-top: 5px;
  }

  .clout-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    padding: 15px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
  }

  .card.total { border-left: 4px solid #4A90E2; }
  .card.available { border-left: 4px solid #33FF99; }
  .card.spent { border-left: 4px solid #FF6B6B; }

  h3 {
    font-size: 14px;
    margin: 0 0 10px 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .main-value {
    font-size: 18px;
    font-weight: bold;
    color: white;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-right: 10px;
    flex-shrink: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #e0e0e0;
  }

  input {
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #1a1a1a;
    color: #e0e0e0;
    font-size: 16px;
  }

  button {
    background-color: #4A90E2;
    color: white;
    padding: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    font-size: 18px;
    font-weight: 600;
  }

  button:hover:not(:disabled) {
    background-color: #3A7BC8;
  }

  button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }

  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4A90E2;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 1000;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    max-width: 80%;
    text-align: center;
  }

  .clout-amount {
    margin-right: 10px;
  }

  .usd-value {
    font-size: 12px;
    color: #888;
    font-weight: normal;
    margin-left: auto;
  }

  .button-group {
    position: absolute;
    bottom: -40px;
    right: 0;
    display: flex;
    gap: 10px;
  }

  .icon-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #4A90E2;
    color: white;
    font-size: 18px;
    font-weight: bold;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
  }

  .icon-button:not(.mobile):hover {
    background-color: #3A7BC8;
    transform: scale(1.1);
  }

  .icon-button.mobile {
    transition: none;
  }

  .icon-button.mobile:active {
    background-color: #3A7BC8;
  }

  .copy-button svg {
    width: 20px;
    height: 20px;
  }

  .help-button {
    font-size: 16px;
  }

  .explanation {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #2c2c2c;
    color: white;
    padding: 20px;
    border-radius: 12px;
    font-size: 16px;
    line-height: 1.6;
    max-width: 90%;
    width: 400px;
    text-align: left;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    z-index: 999;
  }

  @media (max-width: 600px) {
    .explanation {
      width: 90%;
      font-size: 14px;
    }
  }

  @media (max-width: 768px) {
    .swapper-clout {
      touch-action: pan-y;
    }

    .button-group {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
    }

    .icon-button {
      touch-action: none;
    }
  }
</style>