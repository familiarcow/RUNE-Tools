<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';

  interface Pool {
    asset: string;
    status: 'Available' | 'Staged' | string;
    balance_asset: string;
    balance_rune: string;
  }

  interface Token {
    address: string;
    chainId: number;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
    chain: 'ETH' | 'BSC' | 'AVAX' | 'BASE';
    poolStatus?: string;
    runeDepth?: number;
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
  let selectedChain: 'ALL' | 'ETH' | 'BSC' | 'AVAX' | 'BASE' = 'ALL';
  let showInfo = false;

  $: filteredTokens = tokenList?.tokens.filter(token => {
    if (!searchQuery.trim() && selectedChain === 'ALL') return true;
    
    const query = searchQuery.trim().toLowerCase();
    const name = token.name.toLowerCase();
    const symbol = token.symbol.toLowerCase();
    const address = token.address.toLowerCase();
    const chain = token.chain.toLowerCase();
    const status = token.poolStatus?.toLowerCase() || '';
    
    const matchesSearch = !query || 
      name.includes(query) || 
      symbol.includes(query) || 
      address.includes(query) ||
      chain.includes(query) ||
      status.includes(query);

    const matchesChain = selectedChain === 'ALL' || token.chain === selectedChain;
    
    return matchesSearch && matchesChain;
  }) ?? [];

  // Add token metadata mapping
  const TOKEN_METADATA: Record<string, { name: string; symbol: string; logoURI: string }> = {
    // BASE tokens
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
      name: 'USD Coin',
      symbol: 'USDC',
      logoURI: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
    },
    '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': {
      name: 'Coinbase Wrapped Bitcoin',
      symbol: 'cbBTC',
      logoURI: 'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png'
    },

    // AVAX tokens
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': {
      name: 'Tether USD',
      symbol: 'USDT',
      logoURI: 'https://assets.coingecko.com/coins/images/325/thumb/Tether.png'
    },
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': {
      name: 'USD Coin',
      symbol: 'USDC',
      logoURI: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
    },
    '0xfe6b19286885a4f7f55adad09c3cd1f906d2478f': {
      name: 'Wrapped SOL',
      symbol: 'WSOL',
      logoURI: 'https://assets.coingecko.com/coins/images/4128/thumb/solana.png'
    },
    '0x093783055f9047c2bff99c4e414501f8a147bc69': {
      name: 'Dexalot Token',
      symbol: 'ALOT',
      logoURI: 'https://assets.coingecko.com/coins/images/26336/thumb/alot-token-logo-200.png'
    },

    // BSC tokens
    '0x55d398326f99059ff775485246999027b3197955': {
      name: 'Binance Pegged USDT',
      symbol: 'USDT',
      logoURI: 'https://assets.coingecko.com/coins/images/325/thumb/Tether.png'
    },
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': {
      name: 'Binance Pegged USDC',
      symbol: 'USDC',
      logoURI: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
    },
    '0xe9e7cea3dedca5984780bafc599bd69add087d56': {
      name: 'Binance Pegged BUSD',
      symbol: 'BUSD',
      logoURI: 'https://assets.coingecko.com/coins/images/9576/thumb/BUSD.png'
    },
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3': {
      name: 'Binance Pegged DAI',
      symbol: 'DAI',
      logoURI: 'https://assets.coingecko.com/coins/images/9956/thumb/4943.png'
    },
    '0x14016e85a25aeb13065688cafb43044c2ef86784': {
      name: 'True USD',
      symbol: 'TUSD',
      logoURI: 'https://assets.coingecko.com/coins/images/3449/thumb/tusd.png'
    },
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8': {
      name: 'Binance Pegged ETH',
      symbol: 'ETH',
      logoURI: 'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png'
    },
    '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': {
      name: 'Binance Pegged BTC',
      symbol: 'BTC',
      logoURI: 'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png'
    },
    '0x570a5d26f7765ecb712c0924e4de545b89fd43df': {
      name: 'Binance Pegged SOL',
      symbol: 'SOL',
      logoURI: 'https://assets.coingecko.com/coins/images/4128/thumb/solana.png'
    },
    '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47': {
      name: 'Binance Pegged Cardano',
      symbol: 'ADA',
      logoURI: 'https://assets.coingecko.com/coins/images/975/thumb/cardano.png'
    },
    '0x4b0f1812e5df2a09796481ff14017e6005508003': {
      name: 'Trust Wallet Token',
      symbol: 'TWT',
      logoURI: 'https://assets.coingecko.com/coins/images/11085/thumb/Trust.png'
    },
    '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82': {
      name: 'PancakeSwap Token',
      symbol: 'CAKE',
      logoURI: 'https://assets.coingecko.com/coins/images/12632/thumb/pancakeswap-cake-logo_%281%29.png'
    }
  };

  async function fetchTokenLists() {
    try {
      const [ethResponse, configResponse, poolsResponse] = await Promise.all([
        fetch('https://gitlab.com/api/v4/projects/thorchain%2Fthornode/repository/files/common%2Ftokenlist%2Fethtokens%2Feth_mainnet_latest.json/raw?ref=develop'),
        fetch('https://gitlab.com/api/v4/projects/thorchain%2Fthornode/repository/files/config%2Fdefault.yaml/raw?ref=develop'),
        fetch('https://thornode.ninerealms.com/thorchain/pools')
      ]);

      if (!ethResponse.ok || !configResponse.ok) 
        throw new Error('Failed to fetch token lists');

      const ethList = await ethResponse.json();
      const configText = await configResponse.text();
      const pools: Pool[] = await poolsResponse.json();

      // Parse YAML to extract whitelist tokens
      const chainWhitelists: Record<string, string[]> = {};
      const lines = configText.split('\n');
      let currentChain = '';
      let inBlockScanner = false;
      
      for (const line of lines) {
        // Match chain section headers
        const chainMatch = line.match(/^\s+(\w+):$/);
        if (chainMatch && ['base', 'avax', 'bsc'].includes(chainMatch[1].toLowerCase())) {
          currentChain = chainMatch[1].toUpperCase();
          inBlockScanner = false;
          continue;
        }

        // Check if we're entering block_scanner section
        if (line.includes('block_scanner:')) {
          inBlockScanner = true;
          continue;
        }
        
        // Match whitelist_tokens section
        if (inBlockScanner && line.includes('whitelist_tokens:')) {
          chainWhitelists[currentChain] = [];
          continue;
        }
        
        // Match token addresses
        const tokenMatch = line.match(/^\s+-\s+(0x[a-fA-F0-9]+)\s+#\s*(.+)?$/);
        if (tokenMatch && currentChain) {
          const [_, address, comment] = tokenMatch;
          chainWhitelists[currentChain] = chainWhitelists[currentChain] || [];
          chainWhitelists[currentChain].push(address);
        }
      }

      console.log('Parsed whitelists:', chainWhitelists); // For debugging

      // Process ETH tokens
      const ethTokens = ethList.tokens.map(t => ({ ...t, chain: 'ETH' as const }));

      // Create tokens for other chains using the whitelist
      const otherChainTokens = Object.entries(chainWhitelists).flatMap(([chain, addresses]) =>
        addresses.map(address => {
          const metadata = TOKEN_METADATA[address.toLowerCase()];
          return {
            address: address.toLowerCase(),
            chainId: chain === 'BSC' ? 56 : chain === 'AVAX' ? 43114 : 8453, // BASE
            name: metadata?.name || '', // Use metadata if available
            symbol: metadata?.symbol || '', // Use metadata if available
            decimals: 18, // Default to 18 for all tokens
            logoURI: metadata?.logoURI || fallbackLogo,
            chain: chain as 'BSC' | 'AVAX' | 'BASE'
          };
        })
      );

      console.log('Other chain tokens:', otherChainTokens); // For debugging

      // Combine all tokens
      const allTokens = [...otherChainTokens, ...ethTokens];

      // Enrich with pool data
      const enrichedTokens = allTokens.map(token => {
        const poolAsset = `${token.chain}.${token.symbol || ''}-${token.address.toUpperCase()}`;
        console.log('Looking for pool:', poolAsset); // For debugging
        const pool = pools.find(p => p.asset === poolAsset);

        // If we find a pool, use its data to populate missing token info
        if (pool && (!token.symbol || !token.name)) {
          const assetParts = pool.asset.split('-');
          const symbol = assetParts[0].split('.')[1];
          console.log('Found pool for token:', { pool, symbol }); // For debugging
          return {
            ...token,
            symbol: symbol || token.symbol || '',
            name: symbol || token.name || '',
            poolStatus: pool.status,
            runeDepth: pool ? Number(pool.balance_rune) / 1e8 : undefined
          };
        }

        return {
          ...token,
          poolStatus: pool?.status,
          runeDepth: pool ? Number(pool.balance_rune) / 1e8 : undefined
        };
      });

      tokenList = {
        name: 'THORChain Token Whitelist',
        timestamp: new Date().toISOString(),
        version: { major: 1, minor: 0, patch: 0 },
        keywords: ['thorchain', 'ethereum', 'bsc', 'avalanche', 'base'],
        tokens: enrichedTokens // Include all tokens, even if we don't have names yet
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

  function formatRuneAmount(amount: number | undefined): string {
    if (!amount) return '';
    if (amount < 10000) return '<10k';
    if (amount < 1000000) return `${Math.round(amount / 1000)}k`;
    return `${(amount / 1000000).toFixed(1)}M`;
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
            <button 
              class="chain-filter base {selectedChain === 'BASE' ? 'active' : ''}"
              on:click={() => selectedChain = 'BASE'}
            >
              BASE
            </button>
            <button 
              class="chain-filter {selectedChain === 'ALL' ? 'active' : ''}"
              on:click={() => selectedChain = 'ALL'}
            >
              ALL
            </button>
          </div>
        </div>
        <div class="search-section">
          <input
            type="text"
            placeholder="Search by name, symbol, address, or pool status"
            bind:value={searchQuery}
            class="search-input"
          />
        </div>
        {#if showInfo}
          <div class="info-section" transition:slide>
            This is a list of the tokens that are whitelisted for liquidity pool creation on THORChain. 
            These assets may or may not have a pool created already. New pools can be created by staging 
            a pool with at least 10k in RUNE and the equivalent value of the token. Pools transition from Staged to  Active 
            after a few days. Active pools will revert to Staged with less than 10k RUNE in liquidity.
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
                <h3>{token.name || `Unknown Token (${token.chain})`}</h3>
                <div class="badge-container">
                  <span class="chain-badge {token.chain.toLowerCase()}">{token.chain}</span>
                  {#if token.poolStatus}
                    <span class="pool-badge {token.poolStatus.toLowerCase()}">
                      {token.poolStatus}
                      {#if token.runeDepth}
                        <span class="rune-depth">
                          <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" />
                          {formatRuneAmount(token.runeDepth)}
                        </span>
                      {/if}
                    </span>
                  {/if}
                </div>
              </div>
              <p class="symbol">{token.symbol || 'Unknown Symbol'}</p>
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

  .badge-container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .pool-badge {
    display: flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    background: #333;
    color: white;
  }

  .pool-badge.available {
    background: #00a67c;
  }

  .pool-badge.staged {
    background: #f3ba2f;
    color: black;
  }

  .rune-depth {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: 0.5rem;
    padding-left: 0.5rem;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
  }

  .rune-depth img {
    width: 12px;
    height: 12px;
    margin: 0;
  }

  .chain-filter.active.bsc {
    background: #f3ba2f;
    color: black;
  }

  .chain-filter.active.avax {
    background: #e84142;
  }

  .chain-filter.active.base {
    background: #0052FF;
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

  .chain-badge.base {
    background: #0052FF;
    color: white;
  }
</style>
