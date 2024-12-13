<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';

  interface Token {
    address: string;
    chainId: number;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
    chain: 'ETH' | 'BSC' | 'AVAX';
  }

  interface TokenList {
    name: string;
    timestamp: string;
    version: {
      major: number;
      minor: number;
      patch: number;
    };
    keywords: string[];
    tokens: Token[];
  }

  let tokenList: TokenList | null = null;
  let error: string | null = null;
  let fallbackLogo = '/assets/coins/RUNE-ICON.svg';
  let loadedLogos: { [key: string]: string } = {};
  let searchQuery = '';
  let loading = true;
  let selectedChain: 'ALL' | 'ETH' | 'BSC' | 'AVAX' = 'ALL';
  let showInfo = false;

  $: filteredTokens = tokenList?.tokens.filter(token => {
    if (!searchQuery.trim() && selectedChain === 'ALL') return true;
    
    const query = searchQuery.trim().toLowerCase();
    const name = token.name.toLowerCase();
    const symbol = token.symbol.toLowerCase();
    const address = token.address.toLowerCase();
    const chain = token.chain.toLowerCase();
    
    const matchesSearch = !query || 
      name.includes(query) || 
      symbol.includes(query) || 
      address.includes(query) ||
      chain.includes(query);

    const matchesChain = selectedChain === 'ALL' || token.chain === selectedChain;
    
    return matchesSearch && matchesChain;
  }) ?? [];

  async function fetchTokenLists() {
    try {
      const [ethResponse, bscResponse, avaxResponse] = await Promise.all([
        fetch('https://gitlab.com/api/v4/projects/thorchain%2Fthornode/repository/files/common%2Ftokenlist%2Fethtokens%2Feth_mainnet_latest.json/raw?ref=develop'),
        fetch('https://gitlab.com/api/v4/projects/thorchain%2Fthornode/repository/files/common%2Ftokenlist%2Fbsctokens%2Fbsc_mainnet_latest.json/raw?ref=develop'),
        fetch('https://gitlab.com/api/v4/projects/thorchain%2Fthornode/repository/files/common%2Ftokenlist%2Favaxtokens%2Favax_mainnet_latest.json/raw?ref=develop')
      ]);

      if (!ethResponse.ok || !bscResponse.ok || !avaxResponse.ok) 
        throw new Error('Failed to fetch one or more token lists');

      const [ethList, bscList, avaxList] = await Promise.all([
        ethResponse.json(),
        bscResponse.json(),
        avaxResponse.json()
      ]);

      ethList.tokens = ethList.tokens.map(t => ({ ...t, chain: 'ETH' }));
      bscList.tokens = bscList.tokens.map(t => ({ ...t, chain: 'BSC' }));
      avaxList.tokens = avaxList.tokens.map(t => ({ ...t, chain: 'AVAX' }));

      tokenList = {
        name: 'THORChain Token Whitelist',
        timestamp: new Date().toISOString(),
        version: { major: 1, minor: 0, patch: 0 },
        keywords: ['thorchain', 'ethereum', 'bsc', 'avalanche'],
        tokens: [...ethList.tokens, ...bscList.tokens, ...avaxList.tokens]
      };

      if (tokenList) {
        await Promise.all(tokenList.tokens.map(token => 
          checkImageExists(token.logoURI)
        ));
      }
      
      loading = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch token lists';
      console.error('Error fetching token lists:', e);
      loading = false;
    }
  }

  async function checkImageExists(url: string): Promise<string> {
    if (loadedLogos[url]) return loadedLogos[url];
    
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        loadedLogos[url] = url;
        resolve(url);
      };
      
      img.onerror = () => {
        loadedLogos[url] = fallbackLogo;
        resolve(fallbackLogo);
      };

      img.src = url;
    });
  }

  function truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  }

  function copyToClipboard(address: string) {
    navigator.clipboard.writeText(address);
  }

  onMount(() => {
    fetchTokenLists();
  });
</script>

<div class="container">
  <div class="token-whitelist">
    {#if error}
      <div class="error">
        {error}
      </div>
    {:else if loading}
      <div class="loading">
        Loading token lists...
      </div>
    {:else}
      <div class="header">
        <div class="title-section">
          <div class="title-with-info">
            <h2>THORChain Token Whitelist</h2>
            <button 
              class="info-button {showInfo ? 'active' : ''}" 
              on:click={() => showInfo = !showInfo}
              title="Show information"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
          </div>
          <div class="chain-filters">
            <button 
              class="chain-filter {selectedChain === 'ALL' ? 'active' : ''}"
              on:click={() => selectedChain = 'ALL'}
            >
              ALL
            </button>
            <button 
              class="chain-filter eth {selectedChain === 'ETH' ? 'active' : ''}"
              on:click={() => selectedChain = 'ETH'}
            >
              ETH
            </button>
            <button 
              class="chain-filter bsc {selectedChain === 'BSC' ? 'active' : ''}"
              on:click={() => selectedChain = 'BSC'}
            >
              BSC
            </button>
            <button 
              class="chain-filter avax {selectedChain === 'AVAX' ? 'active' : ''}"
              on:click={() => selectedChain = 'AVAX'}
            >
              AVAX
            </button>
          </div>
        </div>
        <div class="search-section">
          <input
            type="text"
            placeholder="Search by name, symbol, or address..."
            bind:value={searchQuery}
            class="search-input"
          />
        </div>
        {#if showInfo}
          <div class="info-section" transition:slide>
            This is a list of the tokens that are whitelisted for liquidity pool creation on THORChain. 
            These assets may or may not have a pool created already. New pools can be created by staging 
            a pool with at least 10k in RUNE and the equivalent value of the token. Pools become active 
            after a few days and will become inactive with less than 10k RUNE in liquidity.
          </div>
        {/if}
      </div>
      
      <div class="token-grid">
        {#each filteredTokens as token}
          <div class="token-card">
            <img 
              src={loadedLogos[token.logoURI] || fallbackLogo}
              alt={`${token.symbol} logo`}
            />
            <div class="token-info">
              <div class="token-header">
                <h3>{token.name}</h3>
                <span class="chain-badge {token.chain.toLowerCase()}">{token.chain}</span>
              </div>
              <p class="symbol">{token.symbol}</p>
              <p 
                class="address" 
                title="Click to copy address"
                on:click={() => copyToClipboard(token.address)}
              >
                {truncateAddress(token.address)}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .token-whitelist {
    color: #fff;
    height: 100%;
    overflow-y: auto;
    position: relative;
    box-sizing: border-box;
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
    padding-bottom: 2rem;
  }

  .token-card {
    display: flex;
    align-items: center;
    padding: 1.25rem;
    border: 1px solid #333;
    border-radius: 12px;
    background: #1a1a1a;
    transition: transform 0.2s, border-color 0.2s;
  }

  .header {
    position: sticky;
    top: 0;
    background: #111;
    padding: 1rem;
    z-index: 10;
    border: 1px solid #333;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem;
    width: calc(100% - 2rem);
    box-sizing: border-box;
  }

  .title-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: #1a1a1a;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #333;
  }

  @media (min-width: 768px) {
    .title-section {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  .title-section h2 {
    font-size: 1.5rem;
    margin: 0;
    color: #fff;
  }

  .chain-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chain-filter {
    padding: 0.5rem 1rem;
    border: 1px solid #333;
    border-radius: 8px;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    flex: 1;
    min-width: 60px;
    text-align: center;
  }

  @media (min-width: 768px) {
    .chain-filter {
      flex: 0 1 auto;
    }

    .header {
      padding: 1.5rem;
      gap: 1.5rem;
    }
  }

  .chain-filter:hover {
    border-color: #444;
    color: #fff;
  }

  .chain-filter.active {
    border-color: transparent;
    color: white;
  }

  .chain-filter.active.eth {
    background: #627eea;
  }

  .chain-filter.active.bsc {
    background: #f3ba2f;
    color: black;
  }

  .chain-filter.active.avax {
    background: #e84142;
  }

  .chain-filter.active:hover {
    opacity: 0.9;
  }

  .search-section {
    width: 100%;
    background: #1a1a1a;
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid #333;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 1rem;
  }

  .search-input:focus {
    outline: none;
  }

  .search-input::placeholder {
    color: #666;
  }

  .address {
    font-size: 0.8rem;
    color: #666;
    font-family: monospace;
    margin: 0;
    cursor: pointer;
    transition: color 0.2s;
    user-select: none;
  }

  .address:hover {
    color: #888;
  }

  .address:active {
    color: #aaa;
  }

  .token-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .chain-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .chain-badge.eth {
    background: #627eea;
    color: white;
  }

  .chain-badge.bsc {
    background: #f3ba2f;
    color: black;
  }

  .chain-badge.avax {
    background: #e84142;
    color: white;
  }

  .timestamp {
    color: #888;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .error {
    color: #ff4444;
    padding: 1rem;
    border: 1px solid #ff4444;
    border-radius: 8px;
    background: rgba(255, 68, 68, 0.1);
  }

  .loading {
    padding: 1rem;
    text-align: center;
    color: #888;
  }

  .token-card:hover {
    transform: translateY(-2px);
    border-color: #444;
  }

  .token-card img {
    width: 32px;
    height: 32px;
    margin-right: 1rem;
    border-radius: 50%;
  }

  .token-info {
    flex: 1;
  }

  .token-info h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #fff;
  }

  .symbol {
    color: #888;
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .title-with-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .info-button {
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    border-radius: 50%;
  }

  .info-button:hover {
    color: #fff;
  }

  .info-button.active {
    color: #fff;
    background: #333;
  }

  .info-section {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 1.25rem;
    line-height: 1.5;
    color: #888;
    font-size: 0.95rem;
  }
</style>
