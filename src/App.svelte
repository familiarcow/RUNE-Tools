<script>
  import { onMount, afterUpdate } from 'svelte';
  import { fade, fly, crossfade } from 'svelte/transition';
  import { quintOut, cubicInOut } from 'svelte/easing';
  import logo from "../public/assets/runetools-logo.svg";
  import laserLogo from "../public/assets/runetools-laser-logo.svg";
  import santaLogo from "../public/assets/runetools-logos/runetools-logo-santa.png";
  import Footer from './lib/Footer.svelte';
  import Snow from './lib/Snow.svelte';
  import TerminalText from './lib/TerminalText.svelte';
  import { writable } from 'svelte/store';
  import Banner from './lib/Banner.svelte';
  const HOLIDAY_MODE = false; // Easy to toggle holiday features on/off
  const SHOW_BANNER = false; // Easy to toggle banner on/off

  let selectedApp = null;
  let addressParam = writable('');
  let votingSearchTerm = writable('');
  let loadedComponent = null;

  // Replace the existing apps array with dynamic imports
  const apps = [
    { 
      name: "Swap Quote", 
      component: () => import("./lib/SwapEstimator.svelte"), 
      icon: "🔄", 
      path: "swap", 
      description: "Get real time THORChain swap quotes" 
    },
    { 
      name: "Bond Tracker", 
      component: () => import("./lib/BondTracker.svelte"), 
      icon: "🔗", 
      path: "bond", 
      description: "Monitor your THORChain node rewards" 
    },
    { 
      name: "Voting", 
      component: () => import("./lib/Voting.svelte"), 
      icon: "🗳️", 
      path: "voting", 
      description: "Check THORChain's active mimir votes" 
    },
    { 
      name: "Earnings", 
      component: () => import("./lib/Earnings.svelte"), 
      icon: "💰", 
      path: "earnings", 
      description: "Check the THORChain protocol's earnings" 
    },
    { 
      name: "Growth", 
      component: () => import("./lib/Growth.svelte"), 
      icon: "🌱", 
      path: "growth", 
      description: "Track THORChain's growth metrics" 
    },
    { 
      name: "Feed", 
      component: () => import("./lib/Feed.svelte"), 
      icon: "📰", 
      path: "feed", 
      description: "THORChain network transaction feed" 
    },
    { 
      name: "Constants and Mimirs", 
      component: () => import("./lib/Constants.svelte"), 
      icon: "📚", 
      path: "constants", 
      description: "View THORChain's network parameters and settings" 
    },
    { 
      name: "Incentive Pendulum", 
      component: () => import("./lib/IncentivePendulum.svelte"), 
      icon: "⚖️", 
      path: "pendulum", 
      description: "Check THORChain's incentive pendulum balance" 
    },
    { 
      name: "Supply Tracker", 
      component: () => import("./lib/Supply.svelte"), 
      icon: "🔥", 
      path: "supply", 
      description: "Track RUNE supply and burned tokens" 
    },
    { 
      name: "Price Checker", 
      component: () => import("./lib/PriceChecker.svelte"), 
      icon: "🏷️", 
      path: "prices", 
      description: "Check pool prices and compare prices of similar assets" 
    },
    { 
      name: "Vaults", 
      component: () => import("./lib/Vaults.svelte"), 
      icon: "🔒", 
      path: "vaults", 
      description: "Inspect THORChain's native asset vaults" 
    },
    { 
      name: "Rune", 
      component: () => import("./lib/Rune.svelte"), 
      icon: "🌙", 
      path: "rune", 
      description: "Check RUNE price" 
    },
    { 
      name: "Rune Pool", 
      component: () => import("./lib/RunePool.svelte"), 
      icon: "🏊", 
      path: "pool", 
      description: "Explore RUNEPool and track your position" 
    },
    { 
      name: "Lending Position", 
      component: () => import("./lib/LendingPosition.svelte"), 
      icon: "⚡️", 
      path: "lending", 
      description: "View your current THORChain lending position" 
    },
    { 
      name: "Savers", 
      component: () => import("./lib/SaversTracker.svelte"), 
      icon: "📈", 
      path: "savers", 
      description: "Track the Savers yield curve and Liquidity Provider rewards" 
    },
    { 
      name: "Version", 
      component: () => import("./lib/Version.svelte"), 
      icon: "🔧", 
      path: "version", 
      description: "Check the current THORNode version adoption" 
    },
    { 
      name: "Inbound Addresses", 
      component: () => import("./lib/InboundAddresses.svelte"), 
      icon: "📍", 
      path: "inbound", 
      description: "Find THORChain's inbound vault addresses" 
    },
    { 
      name: "Swapper Clout", 
      component: () => import("./lib/SwapperClout.svelte"), 
      icon: "🏆", 
      path: "clout", 
      description: "Check your Swapper Clout" 
    },
    { 
      name: "Affiliates", 
      component: () => import("./lib/Affiliates.svelte"), 
      icon: "🤝", 
      path: "affiliate", 
      description: "Track THORChain affiliate payout status" 
    },
    { 
      name: "Token Whitelist", 
      component: () => import("./lib/TokenWhitelist.svelte"), 
      icon: "📝", 
      path: "whitelist", 
      description: "View THORChain's whitelisted tokens and pools" 
    },
    { 
      name: "Treasury", 
      component: () => import("./lib/Treasury.svelte"), 
      icon: "🏦", 
      path: "treasury", 
      description: "Track THORChain's treasury balances and flows" 
    },
    { 
      name: "Base", 
      component: () => import("./lib/Base.svelte"), 
      icon: "/assets/chains/BASE.svg", 
      path: "base", 
      description: "Track Base chain stats and pools on THORChain" 
    },
    { 
      name: "Thorchad", 
      component: () => import("./lib/Thorchad.svelte"), 
      icon: "🧙‍♂️", 
      path: "thorchad", 
      description: "THORChad your profile picture" 
    },
    { 
      name: "Trade on THORSwap", 
      component: () => import("./lib/Thorswap.svelte"), 
      icon: "/assets/thorswap.png",
      path: "thorswap", 
      description: "Trade RUNE and other native assets on THORSwap." 
    },
    { 
      name: "Shop", 
      icon: "🏪", 
      path: "shop", 
      description: "Browse THORChain merchandise", 
      externalUrl: "https://shop.rune.tools" 
    },
  ];

  const hiddenApps = [];

  const [send, receive] = crossfade({
    duration: 400,
    fallback(node, params) {
      const style = getComputedStyle(node);
      const transform = style.transform === 'none' ? '' : style.transform;

      return {
        duration: 400,
        easing: cubicInOut,
        css: t => `
          transform: ${transform} scale(${t});
          opacity: ${t}
        `
      };
    }
  });

  let hoveredApp = null;
  let displayedDescription = "Welcome to RUNE Tools";
  let descriptionTimer;
  let isTyping = true;

  function handleMouseEnter(app) {
    if (!isMobile) {
      hoveredApp = app;
      clearTimeout(descriptionTimer);
      isTyping = true;
      displayedDescription = app.description;
    }
  }

  function handleMouseLeave() {
    if (!isMobile) {
      clearTimeout(descriptionTimer);
      descriptionTimer = setTimeout(() => {
        isTyping = true;
        displayedDescription = "Welcome to RUNE Tools";
      }, 3000);
    }
  }

  async function selectApp(app) {
    if (app.externalUrl) {
      window.open(app.externalUrl, '_blank');
    } else {
      selectedApp = app;
      const newUrl = `/${app.path}${getAppParams(app)}`;
      history.pushState(null, '', newUrl);
      menuOpen = false;

      try {
        // Dynamically load the component
        const module = await app.component();
        loadedComponent = module.default;
      } catch (error) {
        console.error('Error loading component:', error);
        // Handle error loading component
      }

      // Update addressParam if it's the SwapperClout component
      if (app.name === "Swapper Clout") {
        const urlParams = new URLSearchParams(window.location.search);
        const address = urlParams.get('address');
        addressParam.set(address || '');
      }
    }
  }

  function getAppParams(app) {
    if (app.name === "Bond Tracker") {
      const bondAddress = new URLSearchParams(window.location.search).get("bond_address");
      const nodeAddress = new URLSearchParams(window.location.search).get("node_address");
      if (bondAddress && nodeAddress) {
        return `?bond_address=${bondAddress}&node_address=${nodeAddress}`;
      }
    } else if (app.name === "Rune Pool") {
      const address = new URLSearchParams(window.location.search).get("address");
      if (address) {
        return `?address=${address}`;
      }
    } else if (app.name === "Swapper Clout") {
      const address = new URLSearchParams(window.location.search).get("address");
      if (address) {
        return `?address=${address}`;
      }
    } else if (app.name === "LP Checker") {
      const pool = new URLSearchParams(window.location.search).get("pool");
      const address = new URLSearchParams(window.location.search).get("address");
      if (pool && address) {
        return `?pool=${pool}&address=${address}`;
      } else if (pool) {
        return `?pool=${pool}`;
      } else if (address) {
        return `?address=${address}`;
      }
    } else if (app.name === "Affiliates") {
      const thorname = new URLSearchParams(window.location.search).get("thorname");
      if (thorname) {
        return `?thorname=${thorname}`;
      }
    } else if (app.name === "Voting") {
      const key = new URLSearchParams(window.location.search).get("key");
      if (key) {
        return `?key=${key}`;
      }
    }
    return "";
  }

  async function handlePopState() {
    const path = window.location.pathname.slice(1).split('/')[0];
    const app = [...apps, ...hiddenApps].find(a => a.path === path);
    selectedApp = app || null;

    if (app) {
      try {
        const module = await app.component();
        loadedComponent = module.default;
      } catch (error) {
        console.error('Error loading component:', error);
        // Handle error loading component
      }

      const urlParams = new URLSearchParams(window.location.search);
      if (app.name === "Swapper Clout") {
        const address = urlParams.get('address') || path.split('/')[1];
        addressParam.set(address || '');
      } else if (app.name === "Bond Tracker") {
        const bondAddress = urlParams.get('bond_address');
        const nodeAddress = urlParams.get('node_address');
        // Handle Bond Tracker params if needed
      } else if (app.name === "Rune Pool") {
        const address = urlParams.get('address');
        // Handle Rune Pool params if needed
      } else if (app.name === "LP Checker") {
        const pool = urlParams.get('pool');
        const address = urlParams.get('address');
        // Handle LP Checker params if needed
      } else if (app.name === "Affiliates") {
        const thorname = urlParams.get('thorname');
        if (thorname) {
          addressParam.set(thorname);
        }
      } else if (app.name === "Voting") {
        const key = urlParams.get('key');
        if (key) {
          // You might need to create a store or prop to pass this to the Voting component
          votingSearchTerm.set(key);
        }
      }
    }
  }

  onMount(() => {
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  });

  afterUpdate(() => {
    if (selectedApp && selectedApp.name === "Swapper Clout") {
      const address = window.location.pathname.split('/')[2];
      if (address) {
        addressParam.set(address);
      }
    }
  });

  let menuOpen = false;

  const houseIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  `;

  const hamburgerIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function goHome() {
    selectedApp = null;
    history.pushState(null, '', '/');
    menuOpen = false;
  }

  function handleDescriptionChange() {
    isTyping = true;
    setTimeout(() => {
      isTyping = false;
    }, 100); // Small delay to trigger re-render
  }

  $: {
    displayedDescription; // This will trigger the handleDescriptionChange when displayedDescription changes
    handleDescriptionChange();
  }

  let isMobile = false;

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  function handleAppClick(app) {
    selectApp(app);
  }

  let itemsPerRow = 5;
  

  function updateItemsPerRow() {
    if (containerWidth <= 600) {
      itemsPerRow = 2;
    } else if (containerWidth <= 900) {
      itemsPerRow = 3;
    } else if (containerWidth <= 1200) {
      itemsPerRow = 4;
    } else {
      itemsPerRow = 5;
    }
  }

  function handleResize() {
    checkMobile();
    updateItemsPerRow();
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  $: if (containerWidth) {
    updateItemsPerRow();
  }

  function groupAppsIntoRows(apps, itemsPerRow) {
    const rows = [];
    for (let i = 0; i < apps.length; i += itemsPerRow) {
      rows.push(apps.slice(i, i + itemsPerRow));
    }
    return rows;
  }

  $: rows = groupAppsIntoRows(apps, itemsPerRow);

  function calculateOptimalLayout(totalItems, containerWidth) {
    const minItemWidth = 120;
    const gap = 24;
    const maxColumns = Math.floor((containerWidth - 40) / (minItemWidth + gap));
    
    // Try different numbers of columns to find one that gives us balanced rows
    for (let cols = maxColumns; cols >= 3; cols--) {
      const rows = Math.ceil(totalItems / cols);
      const lastRowItems = totalItems % cols;
      
      // If the last row has 3 or more items, or if it's perfectly divided
      if (lastRowItems === 0 || lastRowItems >= 3) {
        return cols;
      }
    }
    
    // If we couldn't find a perfect fit, default to 3 columns
    return 3;
  }

  let containerWidth;
  let optimalColumns = 3;

  $: if (containerWidth) {
    optimalColumns = calculateOptimalLayout(apps.length, containerWidth);
  }

  // Group apps into rows based on optimal columns
  function groupIntoRows(apps, columns) {
    const rows = [];
    for (let i = 0; i < apps.length; i += columns) {
      rows.push(apps.slice(i, Math.min(i + columns, apps.length)));
    }
    return rows;
  }

  $: appRows = groupIntoRows(apps, optimalColumns);

  $: if (selectedApp) {
    document.title = `${selectedApp.name} - RUNE Tools`;
  } else {
    document.title = "RUNE Tools";
  }
</script>

<svelte:head>
  <link href="https://fonts.googleapis.com/css2?family=Exo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #1e1e1e;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
  </style>
</svelte:head>

<main>
  {#if HOLIDAY_MODE}
    <Snow />
  {/if}
  <header>
    <div class="header-content">
      <div class="logo-container">
        <div class="logo-wrapper" on:click={goHome}>
          {#if HOLIDAY_MODE}
            <img src={santaLogo} alt="THORChain Holiday Logo" class="logo holiday-logo" />
          {:else}
            <img src={logo} alt="THORChain Logo" class="logo original-logo" />
            <img src={laserLogo} alt="THORChain Laser Logo" class="logo laser-logo" />
          {/if}
        </div>
      </div>
      <div class="title-container">
        {#if selectedApp}
          <h2 class="rune-tools-title">
            {selectedApp.name}
          </h2>
          
        {/if}
      </div>
      <nav>
        {#if selectedApp}
          <button 
            class="nav-button menu-button" 
            on:click={toggleMenu}
            in:fly={{ y: -20, duration: 300, delay: 200, easing: cubicInOut }}
            out:fly={{ y: -20, duration: 300, easing: cubicInOut }}
          >
            {@html hamburgerIcon}
          </button>
        {/if}
      </nav>
    </div>
  </header>
  
  {#if SHOW_BANNER}
    <Banner />
  {/if}

  {#if menuOpen}
    <div class="menu-overlay" on:click|self={toggleMenu} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
      <div class="menu-content" in:fly={{ x: 300, duration: 300, easing: cubicInOut }} out:fly={{ x: 300, duration: 300, easing: cubicInOut }}>
        {#each apps as app}
          <button class="menu-item" on:click={() => selectApp(app)}>
            <span class="app-icon">
              {#if typeof app.icon === 'string' && (app.icon.endsWith('.svg') || app.icon.endsWith('.png'))}
                <img src={app.icon} alt={app.name} class="menu-icon-img" />
              {:else}
                {app.icon}
              {/if}
            </span>
            <span class="app-name">{app.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="content">
    <div class="scrollable-container">
      {#if !selectedApp}
        <div class="description-container">
          {#if isMobile}
            <p>Welcome to RUNE Tools</p>
          {:else}
            {#key displayedDescription}
              <TerminalText text={displayedDescription} />
            {/key}
          {/if}
        </div>
        <div 
          class="app-grid-container" 
          bind:clientWidth={containerWidth}
        >
          {#each appRows as row}
            <div class="app-row">
              {#each row as app, i}
                <button 
                  class="app-button"
                  on:click={() => handleAppClick(app)}
                  on:mouseenter={() => handleMouseEnter(app)}
                  on:mouseleave={handleMouseLeave}
                  in:fly={{ y: 20, duration: 300, delay: 100 + i * 50, easing: quintOut }}
                >
                  <span class="app-icon">
                    {#if typeof app.icon === 'string' && (app.icon.endsWith('.svg') || app.icon.endsWith('.png'))}
                      <img src={app.icon} alt={app.name} />
                    {:else}
                      {app.icon}
                    {/if}
                  </span>
                  <span class="app-name">{app.name}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {:else}
        {#if loadedComponent}
          <svelte:component this={loadedComponent} address={$addressParam} searchTerm={votingSearchTerm} />
        {:else}
          <div class="loading">Loading...</div>
        {/if}
      {/if}
    </div>
  </div>

  <Footer />
</main>

<style>
  :global(*) {
    font-family: 'Exo', sans-serif;
    box-sizing: border-box;
  }

  :root {
    --primary-color: #ff3e00;
    --secondary-color: #4a90e2;
    --background-color: #1e1e1e;
    --surface-color: #2c2c2c;
    --text-color: #e0e0e0;
    --text-muted: #a0a0a0;
  }

  main {
    text-align: center;
    margin: 0 auto;
    max-width: 100%;
    background-color: var(--background-color);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: var(--text-color);
    padding-top: calc(60px + var(--banner-height, 0px));
    position: relative;
  }

  header {
    background: rgba(44, 44, 44, 0.85);
    backdrop-filter: blur(10px);
    padding: 0.5rem 1rem;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .logo-container {
    flex: 0 0 auto;
    width: 33.33%;
    text-align: left;
  }

  .logo-wrapper {
    position: relative;
    display: inline-block;
    cursor: pointer;
    transform: scale(1.05);
  }

  .logo {
    height: 2rem;
    width: auto;
    max-width: 100%;
  }

  .original-logo {
    position: relative;
    z-index: 2;
  }

  .laser-logo {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    opacity: 0;
  }

  .title-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 33.33%;
  }

  .rune-tools-title {
    color: var(--text-color);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
  }

  .app-title {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 400;
    margin: 0;
    line-height: 1.2;
  }

  nav {
    flex: 0 0 auto;
    width: 33.33%;
    text-align: right;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    padding-top: calc(20px + var(--banner-height, 0px));
    position: relative;
    z-index: 1;
    padding-bottom: 60px;
  }

  .scrollable-container {
    padding-top: 20px; /* Add additional padding for the app components */
  }

  .description-container {
    color: var(--text-color);
    padding: 0.5rem;
    margin-bottom: 1rem;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background-color: transparent;
    border-radius: 8px;
    font-size: 1.5rem;
  }

  .description-container :global(p) {
    margin: 0;
    text-align: center;
    font-size: 1.5rem;
    line-height: 1.3;
  }

  .app-grid-container {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .app-row {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
  }

  .app-button {
    width: 120px;
    height: 120px;
    padding: 0.75rem;
    background-color: var(--surface-color);
    border: none;
    border-radius: 22px;
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .app-button:hover {
    transform: scale(1.05) translateY(-3px);
    background-color: #3a3a3a; /* Lighter color on hover */
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
  }

  /* Add active state for click feedback */
  .app-button:active {
    transform: scale(1.02) translateY(-1px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  .app-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  /* Add this style for image icons */
  .app-icon img {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
  }

  .app-name {
    font-size: 0.85rem;
    font-weight: 500;
    text-align: center;
    width: 100%;
    white-space: normal;
    line-height: 1.2;
  }

  .home-button, .menu-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: var(--text-color);
    transition: color 0.3s ease;
  }

  .home-button:hover, .menu-button:hover {
    color: var(--primary-color);
  }

  .menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    z-index: 2000;
  }

  .menu-content {
    background-color: var(--surface-color);
    width: 300px;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    width: 100%;
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .menu-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .menu-item .app-icon {
    margin-right: 1rem;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
  }

  .menu-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .menu-item .app-name {
    font-size: 1rem;
  }

  .clickable-logo {
    cursor: pointer;
    transition: opacity 0.3s ease;
  }

  .clickable-logo:hover {
    opacity: 0.8;
  }

  @media (max-width: 1200px) {
    .app-grid-container {
      max-width: 1000px;
    }
  }

  @media (max-width: 900px) {
    .app-grid-container {
      max-width: 800px;
    }
  }

  @media (max-width: 600px) {
    .app-row {
      gap: 1rem;
    }
    
    .app-button {
      width: 100px;
      height: 100px;
    }
  }

  .category-section {
    margin-bottom: 2rem;
    padding: 0 1rem;
  }

  .category-title {
    text-align: left;
    color: var(--text-muted);
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0.5rem 0;
    padding-left: 0.5rem;
  }

  .footer {
    position: relative;
    z-index: 1;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: var(--text-color);
    font-size: 1.2rem;
  }

  .holiday-logo {
    height: 2rem;
    width: auto;
    max-width: 100%;
    transform: scale(1.1);
  }

  .logo-wrapper:hover .holiday-logo {
    transform: scale(1.1);
  }

  :global(:root) {
    --banner-height: 24px; /* Height of banner */
  }

  @media (max-width: 600px) {
    :global(:root) {
      --banner-height: 22px;
    }
  }
</style>

