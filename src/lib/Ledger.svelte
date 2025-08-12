<script>
  import { onMount } from 'svelte';

  let isLoading = false;
  let lastResponse = null;
  let error = null;
  let amount = 0.00061;
  let fromAsset = 'bitcoin';
  let toAsset = 'bsc';

  // Import assets and dummy addresses from SwapEstimator
  const assets = [
    'BTC.BTC',
    'ETH.ETH',
    'BSC.BNB',
    'THOR.RUNE',
    'THOR.TCY',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
    'BCH.BCH',
    'LTC.LTC',
    'AVAX.AVAX',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',
    'GAIA.ATOM',
    'DOGE.DOGE',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',
    'BASE.ETH',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF'
  ];

  // Map asset names to readable names
  const assetNames = {
    'BTC.BTC': 'Bitcoin',
    'ETH.ETH': 'Ethereum',
    'BSC.BNB': 'BNB',
    'BCH.BCH': 'Bitcoin Cash',
    'LTC.LTC': 'Litecoin',
    'AVAX.AVAX': 'Avalanche',
    'GAIA.ATOM': 'Cosmos',
    'DOGE.DOGE': 'Dogecoin',
    'THOR.RUNE': 'RUNE',
    'THOR.TCY': 'TCY',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': "USDC (ETH)",
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': "USDT (ETH)",
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': "WBTC (ETH)",
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': "DAI (ETH)",
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': "USDC (BSC)",
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': "USDT (BSC)",
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': "USDC (AVAX)",
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': "USDT (AVAX)",
    'BASE.ETH': "ETH (BASE)",
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': "USDC (BASE)",
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': "cbBTC (BASE)"
  };

  // Dummy destinations from SwapEstimator
  const destinations = {
    'BTC.BTC': 'bc1qdvxpt06ulfk5gm5p52wa4mrt6e887wkmvc4xxw',
    'ETH.ETH': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BSC.BNB': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BCH.BCH': 'pqvm5jv4zhy38dkzrx0md73c3sujhkmg4yhlmhhmfm',
    'LTC.LTC': 'ltc1qzvcgmntglcuv4smv3lzj6k8szcvsrmvk0phrr9wfq8w493r096ssm2fgsw',
    'AVAX.AVAX': '0x66153cf0e164bc9bdae88fb36fc5b92dc63a79d6',
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': '0x66153cf0e164bc9bdae88fb36fc5b92dc63a79d6',
    'GAIA.ATOM': 'cosmos1rdly788mpmwvemd5yr8wu0499zs4v4qnaptum4',
    'DOGE.DOGE': 'DLmW4rFuPqR3cUyqJiBqjho2CtHMC12bFt',
    'THOR.RUNE': 'thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3',
    'THOR.TCY': 'thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3',
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BASE.ETH': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7'
  };

  // Map THORChain assets to Ledger format
  const thorToLedgerAssetMap = {
    // Native coins
    'BTC.BTC': 'bitcoin',
    'ETH.ETH': 'ethereum',
    'BSC.BNB': 'bsc',
    'BCH.BCH': 'bitcoin_cash',
    'LTC.LTC': 'litecoin',
    'AVAX.AVAX': 'avalanche_c_chain',
    'GAIA.ATOM': 'cosmos',
    'DOGE.DOGE': 'dogecoin',
    'BASE.ETH': 'base',
    
    // Ethereum tokens
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'ethereum/erc20/usd_coin',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'ethereum/erc20/usd_tether_erc20',
    'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'ethereum/erc20/wrapped_bitcoin',
    'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'ethereum/erc20/dai_stablecoin_v2_0',
    'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'ethereum/erc20/gemini_dollar',
    'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'ethereum/erc20/liquity-usd',
    'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'ethereum/erc20/paxos_standard__pax_',
    
    // BSC tokens
    'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'bsc/bep20/binance-peg_usd-coin',
    'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'bsc/bep20/binance-peg_bsc-usd',
    
    // Avalanche tokens
    'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'avalanche_c_chain/erc20/usd_coin',
    'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'avalanche_c_chain/erc20/TetherToken',
    
    // Base tokens
    'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': 'base/erc20/usdc',
    'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'base/erc20/coinbase_wrapped_btc'
  };

  let selectedFromAsset = 'BTC.BTC';
  let selectedToAsset = 'ETH.ETH';
  let showModal = false;
  let modalProviders = [];
  let isOptimizing = false;
  let optimizationResult = null;

  function sortProviders(providers) {
    // Sort providers by exchange rate (highest first), putting errors at the end
    return [...providers].sort((a, b) => {
      // If both have errors, sort by provider name
      if (a.code && b.code) {
        return a.provider.localeCompare(b.provider);
      }
      // If only a has error, put it after b
      if (a.code) return 1;
      // If only b has error, put it after a
      if (b.code) return -1;
      // Both are successful, sort by exchange rate (highest first)
      return (b.exchangeRate || 0) - (a.exchangeRate || 0);
    });
  }

  function closeModal() {
    showModal = false;
  }

  function getBestProvider(providers) {
    const successfulProviders = providers.filter(p => !p.code);
    if (successfulProviders.length === 0) return null;
    return successfulProviders.reduce((best, current) => 
      (current.exchangeRate || 0) > (best.exchangeRate || 0) ? current : best
    );
  }

  function formatAmount(amount) {
    return parseFloat(amount).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  }

  async function requestQuote() {
    isLoading = true;
    error = null;
    
    try {
      // Get the Ledger format for selected assets
      const fromLedgerAsset = thorToLedgerAssetMap[selectedFromAsset] || 'bitcoin';
      const toLedgerAsset = thorToLedgerAssetMap[selectedToAsset] || 'bsc';
      
      // Get the addresses for selected assets
      const fromAddress = destinations[selectedFromAsset] || 'bc1qpuc4jgrdjsmg8h4kcm25u02yw2m8ts2gvkl3g8';
      const toAddress = destinations[selectedToAsset] || '0x3FAF4ec3694BFa2b3F9dcFC12A5AE19f923DABB0';

      // Make both requests in parallel
      const [ledgerResponse, thornodeResponse] = await Promise.allSettled([
        fetchLedgerQuote(fromLedgerAsset, toLedgerAsset, fromAddress, toAddress),
        fetchThornodeQuote()
      ]);

      let allProviders = [];

      // Process Ledger response
      if (ledgerResponse.status === 'fulfilled' && Array.isArray(ledgerResponse.value)) {
        allProviders = [...ledgerResponse.value];
      } else if (ledgerResponse.status === 'rejected') {
        console.error('Ledger request failed:', ledgerResponse.reason);
      }

      // Process THORNode response
      if (thornodeResponse.status === 'fulfilled' && thornodeResponse.value) {
        allProviders.push(thornodeResponse.value);
      } else if (thornodeResponse.status === 'rejected') {
        console.error('THORNode request failed:', thornodeResponse.reason);
      }

      lastResponse = { ledger: ledgerResponse.value, thornode: thornodeResponse.value };
      console.log('Combined Quote Response:', lastResponse);
      
      // Process all providers and show modal
      if (allProviders.length > 0) {
        modalProviders = sortProviders(allProviders);
        showModal = true;
      }
      
    } catch (err) {
      error = err.message;
      console.error('Error requesting quotes:', err);
    } finally {
      isLoading = false;
    }
  }

  async function fetchLedgerQuote(fromLedgerAsset, toLedgerAsset, fromAddress, toAddress) {
    // URL with all the parameters from the decrypted request
    const url = new URL('https://swap.ledger.com/v5/quote');
    
    // Add all the query parameters as seen in the request
    const params = {
      'fiatForCounterValue': 'USD',
      'providers-whitelist': 'changelly_v2,cic,exodus,lifi,moonpay,oneinch,paraswap,thorswap,uniswap,velora',
      'currencyTicker': 'USD',
      'lang': 'en',
      'fromAccountId': 'af905639-1a05-5d29-b6ca-943fcc0d6fe0',
      'amountFrom': amount.toString(),
      'from': fromLedgerAsset,
      'to': toLedgerAsset,
      'addressFrom': fromAddress,
      'addressTo': toAddress,
      'networkFees': '0',
      'networkFeesCurrency': fromLedgerAsset,
      'theme': 'dark',
      'displayLanguage': 'en'
    };

    // Add all parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    console.log('Making Ledger request to:', url.toString());

    // Make the request with headers similar to the original
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Origin': 'https://swap-live-app-demo-1.vercel.app',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) LedgerLive/2.124.0 Chrome/128.0.6613.84 Electron/32.0.2 Safari/537.36',
        'Referer': 'https://swap-live-app-demo-1.vercel.app/',
        'Accept-Language': 'en-US',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'no-cache'
      },
      mode: 'cors'
    });

    console.log('Ledger response status:', response.status);

    if (!response.ok) {
      throw new Error(`Ledger HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ledger Quote Response:', data);
    
    return data;
  }

  async function fetchThornodeQuote(affiliateBps = 140) {
    // Convert amount to sats (like in SwapEstimator)
    const amountToSend = amount * 1e8;
    const destination = destinations[selectedToAsset];
    
    // Build THORNode URL
    let url = `https://thornode.ninerealms.com/thorchain/quote/swap?`;
    url += `amount=${amountToSend}&from_asset=${selectedFromAsset}&to_asset=${selectedToAsset}&destination=${destination}&streaming_interval=1&streaming_quantity=0`;
    
    // Add affiliate parameters
    url += `&affiliate=ll&affiliate_bps=${affiliateBps}`;

    console.log('Making THORNode request to:', url);

    const response = await fetch(url, {
      headers: {
        'x-client-id': 'familarcow-runetools'
      }
    });
    
    if (!response.ok) {
      throw new Error(`THORNode HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('THORNode Quote Response:', data);

    if (data.error) {
      // Return error in provider format
      return {
        provider: 'thorchain',
        providerType: 'DEX',
        code: 'thornode_error',
        message: data.error,
        parameter: {
          from: selectedFromAsset,
          to: selectedToAsset,
          amount: amount.toString()
        }
      };
    }

    // Convert THORNode response to provider format
    const expectedAmountOut = data.expected_amount_out / 1e8;
    const exchangeRate = expectedAmountOut / amount;
    
    return {
      provider: 'thorchain',
      providerType: 'DEX',
      type: 'streaming',
      amountTo: expectedAmountOut,
      amountFrom: amount,
      exchangeRate: exchangeRate,
      slippage: data.fees?.total_bps ? (data.fees.total_bps / 100) : 0,
      networkFees: {
        value: data.fees?.outbound ? (data.fees.outbound / 1e8) : 0,
        currency: selectedToAsset.split('.')[1]?.split('-')[0] || 'unknown'
      },
      payoutNetworkFees: {
        value: 0,
        currency: selectedToAsset.split('.')[1]?.split('-')[0] || 'unknown'
      },
      tags: {
        isRegistrationRequired: false,
        isTokenApprovalRequired: false
      },
      thornode_data: {
        total_swap_seconds: data.total_swap_seconds,
        affiliate_fee: data.fees?.affiliate ? (data.fees.affiliate / 1e8) : 0,
        liquidity_fee: data.fees?.liquidity ? (data.fees.liquidity / 1e8) : 0,
        outbound_fee: data.fees?.outbound ? (data.fees.outbound / 1e8) : 0,
        affiliate_bps: affiliateBps
      }
    };
  }

  async function optimizeAffiliateFee() {
    isOptimizing = true;
    optimizationResult = null;
    
    try {
      console.log('🎯 Starting affiliate fee optimization...');
      
      // First get Ledger quotes to find the best competitor
      const fromLedgerAsset = thorToLedgerAssetMap[selectedFromAsset] || 'bitcoin';
      const toLedgerAsset = thorToLedgerAssetMap[selectedToAsset] || 'bsc';
      const fromAddress = destinations[selectedFromAsset] || 'bc1qpuc4jgrdjsmg8h4kcm25u02yw2m8ts2gvkl3g8';
      const toAddress = destinations[selectedToAsset] || '0x3FAF4ec3694BFa2b3F9dcFC12A5AE19f923DABB0';
      
      const ledgerProviders = await fetchLedgerQuote(fromLedgerAsset, toLedgerAsset, fromAddress, toAddress);
      
      // Find the best Ledger provider (highest exchange rate)
      const successfulLedgerProviders = ledgerProviders.filter(p => !p.code && p.exchangeRate);
      if (successfulLedgerProviders.length === 0) {
        throw new Error('No successful Ledger providers found to compete against');
      }
      
      const bestLedgerProvider = successfulLedgerProviders.reduce((best, current) => 
        current.exchangeRate > best.exchangeRate ? current : best
      );
      
      console.log(`🏆 Best Ledger provider: ${bestLedgerProvider.provider} with rate ${bestLedgerProvider.exchangeRate}`);
      
      // Binary search to find optimal affiliate fee
      let lowBps = 0;
      let highBps = 500; // Start with reasonable upper bound
      let bestWinningBps = null;
      let bestWinningRate = 0;
      let attempts = 0;
      const maxAttempts = 15; // Prevent infinite loops
      
      while (lowBps <= highBps && attempts < maxAttempts) {
        attempts++;
        const testBps = Math.floor((lowBps + highBps) / 2);
        
        console.log(`🧪 Testing affiliate_bps: ${testBps} (attempt ${attempts})`);
        
        const thornodeQuote = await fetchThornodeQuote(testBps);
        
        if (thornodeQuote.code) {
          console.log(`❌ THORNode error at ${testBps} bps:`, thornodeQuote.message);
          break;
        }
        
        console.log(`📊 THORChain rate at ${testBps} bps: ${thornodeQuote.exchangeRate}`);
        
        if (thornodeQuote.exchangeRate > bestLedgerProvider.exchangeRate) {
          // THORChain wins! Try to increase fee to find the maximum winning fee
          bestWinningBps = testBps;
          bestWinningRate = thornodeQuote.exchangeRate;
          lowBps = testBps + 1;
          console.log(`✅ THORChain WINS with ${testBps} bps (rate: ${thornodeQuote.exchangeRate} vs ${bestLedgerProvider.exchangeRate})`);
        } else {
          // THORChain loses, need to reduce fee
          highBps = testBps - 1;
          console.log(`❌ THORChain loses with ${testBps} bps (rate: ${thornodeQuote.exchangeRate} vs ${bestLedgerProvider.exchangeRate})`);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final verification with the best winning fee
      let finalThornodeQuote = null;
      if (bestWinningBps !== null) {
        console.log(`🔍 Final verification with ${bestWinningBps} bps...`);
        finalThornodeQuote = await fetchThornodeQuote(bestWinningBps);
      }
      
      optimizationResult = {
        bestLedgerProvider,
        bestWinningBps,
        bestWinningRate,
        finalThornodeQuote,
        attempts,
        originalBps: 140,
        originalThornodeQuote: await fetchThornodeQuote(140)
      };
      
      console.log('🎉 Optimization complete:', optimizationResult);
      
      // Show results in modal with optimized THORChain quote
      if (finalThornodeQuote && !finalThornodeQuote.code) {
        const allProviders = [...ledgerProviders, finalThornodeQuote];
        modalProviders = sortProviders(allProviders);
        showModal = true;
      }
      
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      optimizationResult = { error: error.message };
    } finally {
      isOptimizing = false;
    }
  }

  onMount(() => {
    console.log('Ledger component mounted');
  });
</script>

<div class="ledger-container">
  <div class="header">
    <h1>Ledger Swap Quote Test</h1>
    <p>Test the Ledger swap service quote endpoint</p>
  </div>

  <div class="content">
    <div class="quote-section">
      <h2>Quote Request</h2>
      <p>This will request a quote from Ledger's swap service using the parameters from the decrypted request.</p>
      
      <div class="input-section">
        <div class="input-row">
          <div class="input-group">
            <label for="amount">Amount:</label>
            <input 
              type="number" 
              id="amount" 
              bind:value={amount} 
              step="0.00001" 
              min="0"
              placeholder="Enter amount"
            />
          </div>
        </div>

        <div class="input-row">
          <div class="input-group">
            <label for="fromAsset">From Asset:</label>
            <select id="fromAsset" bind:value={selectedFromAsset}>
              {#each assets as asset}
                <option value={asset}>{assetNames[asset] || asset}</option>
              {/each}
            </select>
          </div>

          <div class="input-group">
            <label for="toAsset">To Asset:</label>
            <select id="toAsset" bind:value={selectedToAsset}>
              {#each assets as asset}
                <option value={asset}>{assetNames[asset] || asset}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="request-params">
        <h3>Current Request Parameters:</h3>
        <ul>
          <li><strong>Amount:</strong> {amount}</li>
          <li><strong>From:</strong> {assetNames[selectedFromAsset] || selectedFromAsset}</li>
          <li><strong>To:</strong> {assetNames[selectedToAsset] || selectedToAsset}</li>
          <li><strong>From Address:</strong> {destinations[selectedFromAsset] || 'unknown'}</li>
          <li><strong>To Address:</strong> {destinations[selectedToAsset] || 'unknown'}</li>
        </ul>
        
        <div class="sources-info">
          <h4>Quote Sources:</h4>
          <div class="source-item">
            <strong>🏦 Ledger Providers:</strong> changelly_v2, cic, exodus, lifi, moonpay, oneinch, paraswap, thorswap, uniswap, velora
          </div>
          <div class="source-item">
            <strong>⚡ THORChain Native:</strong> Streaming swap with affiliate "ll" (140 bps fee)
          </div>
        </div>
      </div>

      <div class="button-group">
        <button 
          class="quote-button" 
          on:click={requestQuote} 
          disabled={isLoading || isOptimizing}
        >
          {isLoading ? 'Requesting Quote...' : 'Request Quote'}
        </button>

        <button 
          class="optimize-button" 
          on:click={optimizeAffiliateFee} 
          disabled={isLoading || isOptimizing}
        >
          {isOptimizing ? 'Optimizing Fee...' : '🎯 Optimize Affiliate Fee'}
        </button>
      </div>

      {#if error}
        <div class="error">
          <h3>Error:</h3>
          <p>{error}</p>
        </div>
      {/if}

      {#if optimizationResult}
        <div class="optimization-results">
          <h3>🎯 Affiliate Fee Optimization Results</h3>
          {#if optimizationResult.error}
            <div class="error-box">
              <p>❌ Optimization failed: {optimizationResult.error}</p>
            </div>
          {:else}
            <div class="results-summary">
              <div class="result-card">
                <h4>🏆 Best Competitor</h4>
                <p><strong>{optimizationResult.bestLedgerProvider.provider}</strong></p>
                <p>Exchange Rate: <span class="rate">{formatAmount(optimizationResult.bestLedgerProvider.exchangeRate)}</span></p>
                <p>Type: {optimizationResult.bestLedgerProvider.providerType} • {optimizationResult.bestLedgerProvider.type}</p>
              </div>

              {#if optimizationResult.bestWinningBps !== null}
                <div class="result-card success">
                  <h4>✅ THORChain Victory!</h4>
                  <p><strong>Optimal Affiliate Fee: {optimizationResult.bestWinningBps} bps</strong></p>
                  <p>Exchange Rate: <span class="rate">{formatAmount(optimizationResult.bestWinningRate)}</span></p>
                  <p>Advantage: +{((optimizationResult.bestWinningRate / optimizationResult.bestLedgerProvider.exchangeRate - 1) * 100).toFixed(4)}%</p>
                </div>
              {:else}
                <div class="result-card error">
                  <h4>❌ THORChain Cannot Win</h4>
                  <p>Even with 0 bps affiliate fee, THORChain cannot beat the best Ledger provider.</p>
                </div>
              {/if}

              <div class="result-card comparison">
                <h4>📊 Fee Comparison</h4>
                <div class="fee-comparison">
                  <div class="fee-row">
                    <span>Original (140 bps):</span>
                    <span>{formatAmount(optimizationResult.originalThornodeQuote.exchangeRate)} 
                      {optimizationResult.originalThornodeQuote.exchangeRate > optimizationResult.bestLedgerProvider.exchangeRate ? '✅' : '❌'}
                    </span>
                  </div>
                  {#if optimizationResult.bestWinningBps !== null}
                    <div class="fee-row optimal">
                      <span>Optimal ({optimizationResult.bestWinningBps} bps):</span>
                      <span>{formatAmount(optimizationResult.bestWinningRate)} ✅</span>
                    </div>
                    <div class="fee-row savings">
                      <span>Extra Revenue Potential:</span>
                      <span>{optimizationResult.bestWinningBps - 140} bps</span>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="result-card info">
                <h4>🔍 Analysis Details</h4>
                <p>Attempts: {optimizationResult.attempts}</p>
                <p>Search Method: Binary search optimization</p>
                <p>Target: Beat {optimizationResult.bestLedgerProvider.provider} ({formatAmount(optimizationResult.bestLedgerProvider.exchangeRate)})</p>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if lastResponse}
        <div class="response">
          <h3>Response (Check Console for Full Details):</h3>
          <pre>{JSON.stringify(lastResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Provider Results Modal -->
{#if showModal}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Swap Provider Results</h2>
        <button class="close-button" on:click={closeModal}>&times;</button>
      </div>
      
      <div class="modal-body">
        {#if modalProviders.length > 0}
          {@const bestProvider = getBestProvider(modalProviders)}
          
          <div class="providers-list">
            {#each modalProviders as provider, index}
              <div class="provider-card" class:best={provider === bestProvider} class:error={provider.code}>
                <div class="provider-header">
                  <div class="provider-info">
                    <h3 class="provider-name">
                      {provider.provider}
                      {#if provider === bestProvider}
                        <span class="recommended-badge">🏆 BEST RATE</span>
                      {/if}
                      {#if provider.code}
                        <span class="error-badge">❌ ERROR</span>
                      {/if}
                    </h3>
                    <div class="provider-type">
                      {provider.providerType || 'Unknown'} • {provider.type || 'Unknown'}
                    </div>
                  </div>
                  
                  {#if !provider.code}
                    <div class="exchange-rate">
                      <div class="rate-value">{formatAmount(provider.exchangeRate)}</div>
                      <div class="rate-label">Exchange Rate</div>
                    </div>
                  {/if}
                </div>

                {#if provider.code}
                  <div class="error-details">
                    <div class="error-message">{provider.message}</div>
                  </div>
                {:else}
                  <div class="provider-details">
                    <div class="detail-row">
                      <span class="detail-label">You receive:</span>
                      <span class="detail-value">{formatAmount(provider.amountTo)} {selectedToAsset.split('.')[1]?.split('-')[0] || 'tokens'}</span>
                    </div>
                    
                    <div class="detail-row">
                      <span class="detail-label">Slippage:</span>
                      <span class="detail-value">{provider.slippage}%</span>
                    </div>
                    
                    {#if provider.networkFees?.value}
                      <div class="detail-row">
                        <span class="detail-label">Network Fees:</span>
                        <span class="detail-value">{formatAmount(provider.networkFees.value)} {provider.networkFees.currency}</span>
                      </div>
                    {/if}
                    
                    {#if provider.payoutNetworkFees?.value}
                      <div class="detail-row">
                        <span class="detail-label">Payout Fees:</span>
                        <span class="detail-value">{formatAmount(provider.payoutNetworkFees.value)} {provider.payoutNetworkFees.currency}</span>
                      </div>
                    {/if}
                    
                    {#if provider.thornode_data}
                      <div class="detail-row">
                        <span class="detail-label">Swap Time:</span>
                        <span class="detail-value">{Math.floor(provider.thornode_data.total_swap_seconds / 60)} min {provider.thornode_data.total_swap_seconds % 60} sec</span>
                      </div>
                      
                      {#if provider.thornode_data.affiliate_fee > 0}
                        <div class="detail-row">
                          <span class="detail-label">Affiliate Fee:</span>
                          <span class="detail-value">{formatAmount(provider.thornode_data.affiliate_fee)} {selectedFromAsset.split('.')[1]?.split('-')[0] || 'tokens'}</span>
                        </div>
                      {/if}
                      
                      <div class="detail-row">
                        <span class="detail-label">Liquidity Fee:</span>
                        <span class="detail-value">{formatAmount(provider.thornode_data.liquidity_fee)} {selectedFromAsset.split('.')[1]?.split('-')[0] || 'tokens'}</span>
                      </div>
                      
                      <div class="detail-row">
                        <span class="detail-label">Affiliate Fee Rate:</span>
                        <span class="detail-value">{provider.thornode_data.affiliate_bps} bps</span>
                      </div>
                    {/if}

                    {#if provider.tags}
                      <div class="tags">
                        {#if provider.provider === 'thorchain'}
                          <span class="tag thor">Native DEX</span>
                          <span class="tag success">No KYC Required</span>
                          <span class="tag success">Decentralized</span>
                        {:else}
                          {#if provider.tags.isRegistrationRequired}
                            <span class="tag warning">Registration Required</span>
                          {/if}
                          {#if provider.tags.isTokenApprovalRequired}
                            <span class="tag warning">Token Approval Required</span>
                          {/if}
                          {#if !provider.tags.isRegistrationRequired && !provider.tags.isTokenApprovalRequired}
                            <span class="tag success">No KYC Required</span>
                          {/if}
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-results">No provider results to display</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .ledger-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    color: #e0e0e0;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    color: #e0e0e0;
    margin-bottom: 0.5rem;
    font-size: 2rem;
  }

  .header p {
    color: #a0a0a0;
    font-size: 1.1rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .quote-section {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 2rem;
  }

  .quote-section h2 {
    color: #e0e0e0;
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .quote-section h3 {
    color: #e0e0e0;
    margin-bottom: 0.5rem;
    font-size: 1.2rem;
  }

  .quote-section p {
    color: #a0a0a0;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .request-params {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #1e1e1e;
    border-radius: 8px;
  }

  .request-params ul {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }

  .request-params li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #3a3a3a;
    color: #a0a0a0;
  }

  .request-params li:last-child {
    border-bottom: none;
  }

  .request-params strong {
    color: #e0e0e0;
  }

  .sources-info {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #3a3a3a;
  }

  .sources-info h4 {
    color: #e0e0e0;
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }

  .source-item {
    padding: 0.75rem;
    background: rgba(102, 126, 234, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    color: #a0a0a0;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .source-item:last-child {
    margin-bottom: 0;
  }

  .source-item strong {
    color: #e0e0e0;
  }

  .input-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #1e1e1e;
    border-radius: 8px;
    border: 1px solid #3a3a3a;
  }

  .input-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .input-row:last-child {
    margin-bottom: 0;
  }

  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .input-group label {
    color: #e0e0e0;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .input-group input,
  .input-group select {
    padding: 0.75rem;
    background: #2c2c2c;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 1rem;
  }

  .input-group input:focus,
  .input-group select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }

  .input-group select option {
    background: #2c2c2c;
    color: #e0e0e0;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .quote-button, .optimize-button {
    flex: 1;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .quote-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .optimize-button {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .quote-button:hover:not(:disabled), .optimize-button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .quote-button:hover:not(:disabled) {
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  }

  .optimize-button:hover:not(:disabled) {
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
  }

  .quote-button:disabled, .optimize-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .optimization-results {
    background: #1a3d1a;
    border: 1px solid #28a745;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .optimization-results h3 {
    color: #40d856;
    margin-bottom: 1rem;
  }

  .results-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .result-card {
    background: #2c2c2c;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 1rem;
  }

  .result-card.success {
    border-color: #22c55e;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  }

  .result-card.error {
    border-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .result-card.comparison {
    border-color: #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  }

  .result-card.info {
    border-color: #8b5cf6;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
  }

  .result-card h4 {
    margin: 0 0 0.75rem 0;
    color: #e0e0e0;
    font-size: 1.1rem;
  }

  .result-card p {
    margin: 0.5rem 0;
    color: #a0a0a0;
    font-size: 0.9rem;
  }

  .result-card .rate {
    color: #22c55e;
    font-weight: 600;
  }

  .fee-comparison {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .fee-row.optimal {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .fee-row.savings {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .error-box {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    padding: 1rem;
  }

  .error-box p {
    color: #fca5a5;
    margin: 0;
  }

  .error {
    background: #3d1a1a;
    border: 1px solid #d73a49;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .error h3 {
    color: #f85149;
    margin-bottom: 0.5rem;
  }

  .error p {
    color: #ffa198;
    margin: 0;
  }

  .response {
    background: #1a3d1a;
    border: 1px solid #28a745;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .response h3 {
    color: #40d856;
    margin-bottom: 0.5rem;
  }

  .response pre {
    color: #a0a0a0;
    background: #1e1e1e;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9rem;
    line-height: 1.4;
    max-height: 400px;
    overflow-y: auto;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-content {
    background: #2c2c2c;
    border-radius: 12px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #444;
    background: #333;
  }

  .modal-header h2 {
    margin: 0;
    color: #e0e0e0;
    font-size: 1.5rem;
  }

  .close-button {
    background: none;
    border: none;
    color: #a0a0a0;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #444;
    color: #e0e0e0;
  }

  .modal-body {
    max-height: calc(90vh - 80px);
    overflow-y: auto;
    padding: 1.5rem 2rem;
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .provider-card {
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .provider-card.best {
    border-color: #22c55e;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  }

  .provider-card.error {
    border-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .provider-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .provider-info {
    flex: 1;
  }

  .provider-name {
    margin: 0 0 0.25rem 0;
    color: #e0e0e0;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .recommended-badge {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .error-badge {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .provider-type {
    color: #a0a0a0;
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .exchange-rate {
    text-align: right;
  }

  .rate-value {
    color: #22c55e;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1;
  }

  .rate-label {
    color: #a0a0a0;
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  .provider-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-label {
    color: #a0a0a0;
    font-size: 0.9rem;
  }

  .detail-value {
    color: #e0e0e0;
    font-weight: 500;
  }

  .tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .tag {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tag.success {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .tag.warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .tag.thor {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2));
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
    font-weight: 600;
  }

  .error-details {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    padding: 1rem;
  }

  .error-message {
    color: #fca5a5;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .no-results {
    text-align: center;
    color: #a0a0a0;
    padding: 2rem;
    font-size: 1.1rem;
  }

  @media (max-width: 768px) {
    .ledger-container {
      padding: 1rem;
    }

    .header h1 {
      font-size: 1.5rem;
    }

    .quote-section {
      padding: 1.5rem;
    }

    .response pre {
      font-size: 0.8rem;
    }

    .modal-overlay {
      padding: 0.5rem;
    }

    .modal-header {
      padding: 1rem;
    }

    .modal-body {
      padding: 1rem;
    }

    .provider-card {
      padding: 1rem;
    }

    .provider-header {
      flex-direction: column;
      gap: 1rem;
    }

    .exchange-rate {
      text-align: left;
    }

    .detail-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .button-group {
      flex-direction: column;
      gap: 0.75rem;
    }

    .results-summary {
      grid-template-columns: 1fr;
    }

    .fee-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>