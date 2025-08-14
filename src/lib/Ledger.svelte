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
    'BASE.ETH'
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
    'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'ethereum/erc20/usd__coin',
    'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'ethereum/erc20/usd_tether__erc20_',
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
  
  // Performance Analysis state
  let isAnalyzing = false;
  let analysisProgress = { current: 0, total: 0, currentPair: '' };
  let analysisResults = null;
  let showAnalysisModal = false;
  let assetPrices = {}; // USD prices from THORNode pools
  
  // Rate limiting management
  let requestQueue = [];
  let activeRequests = 0;
  let maxConcurrentRequests = 3; // Limit concurrent requests
  let baseDelay = 300; // Base delay between requests (ms)
  let retryCount = 0;
  let maxRetries = 3;

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

  function closeAnalysisModal() {
    showAnalysisModal = false;
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
    const response = await rateLimitedFetch(url, {
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
    // Convert amount to base units - THORChain uses 1e8 for all assets
    const amountToSend = Math.floor(amount * 1e8);
    const destination = destinations[selectedToAsset];
    
    // Build THORNode URL
    let url = `https://thornode.ninerealms.com/thorchain/quote/swap?`;
    url += `amount=${amountToSend}&from_asset=${selectedFromAsset}&to_asset=${selectedToAsset}&destination=${destination}&streaming_interval=1&streaming_quantity=0`;
    
    // Add affiliate parameters
    url += `&affiliate=ll&affiliate_bps=${affiliateBps}`;

    console.log('Making THORNode request to:', url);
    console.log(`💱 THORNode amount: ${amount} → ${amountToSend} (1e8 base units)`);

    const response = await rateLimitedFetch(url, {
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
    // THORChain uses 1e8 for all assets
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

  async function fetchAssetPrices() {
    try {
      console.log('💰 Fetching current asset prices from THORNode...');
      const response = await rateLimitedFetch('https://thornode.ninerealms.com/thorchain/pools');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pool data: ${response.status}`);
      }
      
      const pools = await response.json();
      const prices = {};
      
      // Process each pool to extract USD prices
      pools.forEach(pool => {
        if (pool.asset && pool.asset_tor_price) {
          // Convert asset_tor_price from 1e8 to USD
          const usdPrice = parseFloat(pool.asset_tor_price) / 1e8;
          prices[pool.asset] = usdPrice;
          
          console.log(`💵 ${pool.asset}: $${usdPrice.toFixed(4)}`);
        }
      });
      
      return prices;
    } catch (error) {
      console.error('❌ Failed to fetch asset prices:', error);
      throw error;
    }
  }

  function convertUsdToAssetAmount(usdAmount, asset, prices) {
    const price = prices[asset];
    if (!price || price <= 0) {
      console.warn(`⚠️ No price found for ${asset}, using fallback amount`);
      return 0.001; // Fallback amount
    }
    
    const assetAmount = usdAmount / price;
    
    // THORChain normalizes all assets to 8 decimals (1e8)
    const roundedAmount = Math.round(assetAmount * 1e8) / 1e8;
    console.log(`💱 ${asset}: $${usdAmount} = ${roundedAmount} tokens`);
    return roundedAmount;
  }

  async function smartDelay(attempt = 0) {
    // Exponential backoff with jitter
    const jitter = Math.random() * 100; // 0-100ms random jitter
    const exponentialDelay = baseDelay * Math.pow(1.5, attempt);
    const totalDelay = exponentialDelay + jitter;
    
    console.log(`⏱️ Smart delay: ${totalDelay.toFixed(0)}ms (attempt ${attempt})`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));
  }

  async function rateLimitedFetch(url, options = {}, retryAttempt = 0) {
    // Wait for available slot
    while (activeRequests >= maxConcurrentRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    activeRequests++;
    
    try {
      // Add delay between requests
      if (retryAttempt > 0) {
        await smartDelay(retryAttempt);
      } else {
        await smartDelay();
      }
      
      const response = await fetch(url, options);
      
      // Handle rate limiting
      if (response.status === 429) {
        console.warn(`🚦 Rate limited! Waiting before retry... (attempt ${retryAttempt + 1})`);
        
        if (retryAttempt < maxRetries) {
          activeRequests--;
          // Exponential backoff for rate limits
          await smartDelay(retryAttempt + 2);
          return rateLimitedFetch(url, options, retryAttempt + 1);
        } else {
          throw new Error(`Rate limited after ${maxRetries} retries`);
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      activeRequests--;
      return response;
      
    } catch (error) {
      activeRequests--;
      
      // Retry on network errors
      if (retryAttempt < maxRetries && (error.name === 'NetworkError' || error.message.includes('fetch'))) {
        console.warn(`🔄 Network error, retrying... (attempt ${retryAttempt + 1}):`, error.message);
        await smartDelay(retryAttempt + 1);
        return rateLimitedFetch(url, options, retryAttempt + 1);
      }
      
      throw error;
    }
  }

  async function runPerformanceAnalysis() {
    isAnalyzing = true;
    analysisResults = null;
    
    try {
      console.log('🚀 Starting comprehensive performance analysis...');
      
      // Step 1: Fetch current USD prices for all assets
      assetPrices = await fetchAssetPrices();
      
      // Define test amounts in USD (normalized across all assets)
      const testUsdAmounts = [100, 500, 2500, 10000, 50000, 150000]; // $100 to $150k swaps
      console.log('📊 Testing USD amounts:', testUsdAmounts);
      
      // Define popular asset pairs for analysis
      const testAssets = [
        'BTC.BTC', 'ETH.ETH', 'BSC.BNB',
        'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
        'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
        'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
        'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
        'BCH.BCH', 'LTC.LTC', 'AVAX.AVAX', 'GAIA.ATOM', 'DOGE.DOGE',
        'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
        'BSC.USDT-0X55D398326F99059FF775485246999027B3197955'
      ];
      
      // Generate meaningful asset pairs (avoiding same-chain stablecoins)
      const assetPairs = [];
      for (let i = 0; i < testAssets.length; i++) {
        for (let j = 0; j < testAssets.length; j++) {
          if (i !== j) {
            const fromAsset = testAssets[i];
            const toAsset = testAssets[j];
            
            // Skip if both are on same chain and are stablecoins
            const fromChain = fromAsset.split('.')[0];
            const toChain = toAsset.split('.')[0];
            const fromIsStable = fromAsset.includes('USDC') || fromAsset.includes('USDT');
            const toIsStable = toAsset.includes('USDC') || toAsset.includes('USDT');
            
            if (fromChain === toChain && fromIsStable && toIsStable) continue;
            
            assetPairs.push({ from: fromAsset, to: toAsset });
          }
        }
      }
      
      // Limit to top pairs for reasonable execution time
      const selectedPairs = assetPairs.slice(0, 20);
      const totalTests = selectedPairs.length * testUsdAmounts.length;
      
      analysisProgress = { current: 0, total: totalTests, currentPair: '' };
      
      const results = [];
      let testIndex = 0;
      
      for (const pair of selectedPairs) {
        for (const usdAmount of testUsdAmounts) {
          testIndex++;
          
          // Convert USD amount to appropriate crypto amount for this asset
          const cryptoAmount = convertUsdToAssetAmount(usdAmount, pair.from, assetPrices);
          
          analysisProgress.current = testIndex;
          analysisProgress.currentPair = `${assetNames[pair.from] || pair.from} → ${assetNames[pair.to] || pair.to} ($${usdAmount})`;
          
          console.log(`📊 Testing ${analysisProgress.currentPair} (${testIndex}/${totalTests})`);
          
          try {
            const result = await testAssetPairPerformance(pair.from, pair.to, cryptoAmount);
            results.push({
              fromAsset: pair.from,
              toAsset: pair.to,
              amount: cryptoAmount,
              usdAmount: usdAmount, // Store the USD amount for display
              ...result
            });
          } catch (error) {
            console.error(`❌ Failed to test ${pair.from} → ${pair.to} at $${usdAmount}:`, error);
            results.push({
              fromAsset: pair.from,
              toAsset: pair.to,
              amount: cryptoAmount,
              usdAmount: usdAmount,
              error: error.message,
              thorchainWins: false,
              advantage: 0
            });
          }
          
          // Rate limiting handled by rateLimitedFetch
        }
      }
      
      // Process and analyze results
      analysisResults = processAnalysisResults(results);
      showAnalysisModal = true;
      
      console.log('✅ Performance analysis complete:', analysisResults);
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      analysisResults = { error: error.message };
    } finally {
      isAnalyzing = false;
      analysisProgress = { current: 0, total: 0, currentPair: '' };
    }
  }

  async function testAssetPairPerformance(fromAsset, toAsset, testAmount) {
    // Get Ledger format assets
    const fromLedgerAsset = thorToLedgerAssetMap[fromAsset] || 'bitcoin';
    const toLedgerAsset = thorToLedgerAssetMap[toAsset] || 'ethereum';
    
    // Get addresses
    const fromAddress = destinations[fromAsset] || 'bc1qpuc4jgrdjsmg8h4kcm25u02yw2m8ts2gvkl3g8';
    const toAddress = destinations[toAsset] || '0x3FAF4ec3694BFa2b3F9dcFC12A5AE19f923DABB0';
    
    // Temporarily set the amount for THORNode quote
    const originalAmount = amount;
    amount = testAmount;
    
    try {
      // Fetch quotes from both sources
      const [ledgerResponse, thornodeResponse140, thornodeResponse125] = await Promise.allSettled([
        fetchLedgerQuoteForAnalysis(fromLedgerAsset, toLedgerAsset, fromAddress, toAddress, testAmount),
        fetchThornodeQuote(140), // Standard fee
        fetchThornodeQuote(125)  // Minimum viable fee
      ]);
      
      let bestLedgerProvider = null;
      let thorchainProvider140 = null;
      let thorchainProvider125 = null;
      let thorswapProvider = null;
      
      // Process Ledger response and separate THORSwap from other providers
      if (ledgerResponse.status === 'fulfilled' && Array.isArray(ledgerResponse.value)) {
        const successfulProviders = ledgerResponse.value.filter(p => !p.code && p.exchangeRate > 0);
        
        // Find THORSwap provider (represents THORNode with ~140 bps via Ledger)
        thorswapProvider = successfulProviders.find(p => p.provider?.toLowerCase().includes('thorswap'));
        
        // Get best non-THORSwap provider
        const nonThorswapProviders = successfulProviders.filter(p => 
          !p.provider?.toLowerCase().includes('thorswap')
        );
        
        if (nonThorswapProviders.length > 0) {
          bestLedgerProvider = nonThorswapProviders.reduce((best, current) => 
            current.exchangeRate > best.exchangeRate ? current : best
          );
        }
      }
      
      // Process THORNode responses
      if (thornodeResponse140.status === 'fulfilled' && !thornodeResponse140.value.code) {
        thorchainProvider140 = thornodeResponse140.value;
      }
      
      if (thornodeResponse125.status === 'fulfilled' && !thornodeResponse125.value.code) {
        thorchainProvider125 = thornodeResponse125.value;
      }
      
      // Strategic analysis: Can THORChain win and at what cost?
      const canWinAt140 = thorchainProvider140 && bestLedgerProvider && 
        thorchainProvider140.exchangeRate > bestLedgerProvider.exchangeRate;
      
      const canWinAt125 = thorchainProvider125 && bestLedgerProvider && 
        thorchainProvider125.exchangeRate > bestLedgerProvider.exchangeRate;
      
      // Find optimal fee within constraints (125-140 bps range)
      let optimalFee = null;
      let optimalProvider = null;
      
      if (canWinAt140) {
        // Can win at full fee - optimal scenario
        optimalFee = 140;
        optimalProvider = thorchainProvider140;
      } else if (canWinAt125) {
        // Need to reduce to minimum viable fee
        optimalFee = 125;
        optimalProvider = thorchainProvider125;
      }
      // If can't win at 125 bps, optimalFee remains null
      
      const advantage140 = thorchainProvider140 && bestLedgerProvider ? 
        ((thorchainProvider140.exchangeRate / bestLedgerProvider.exchangeRate) - 1) * 100 : -999;
      
      const advantage125 = thorchainProvider125 && bestLedgerProvider ? 
        ((thorchainProvider125.exchangeRate / bestLedgerProvider.exchangeRate) - 1) * 100 : -999;
      
      return {
        // Core metrics
        thorchainWins: canWinAt125, // Can we win within business constraints?
        advantage: advantage140, // Default advantage at standard fee
        bestLedgerRate: bestLedgerProvider?.exchangeRate || 0,
        thorchainRate: thorchainProvider140?.exchangeRate || 0,
        bestLedgerProvider: bestLedgerProvider?.provider || 'none',
        
        // Strategic analysis
        canWinAt140,
        canWinAt125,
        advantage140,
        advantage125,
        optimalFee,
        optimalAdvantage: optimalProvider && bestLedgerProvider ? 
          ((optimalProvider.exchangeRate / bestLedgerProvider.exchangeRate) - 1) * 100 : null,
        
        // Fee impact analysis
        feeReductionRequired: canWinAt125 && !canWinAt140,
        feeReductionAmount: canWinAt125 && !canWinAt140 ? 15 : 0, // 140 - 125
        revenueImpact: canWinAt125 && !canWinAt140 ? ((140 - 125) / 140) * 100 : 0, // % revenue loss
        
        // THORSwap comparison (Ledger's version vs direct)
        thorswapRate: thorswapProvider?.exchangeRate || 0,
        thorswapProvider: thorswapProvider?.provider || 'none',
        directVsThorswapDiff: thorchainProvider140 && thorswapProvider ? 
          ((thorchainProvider140.exchangeRate / thorswapProvider.exchangeRate) - 1) * 100 : 0,
        
        // Additional context
        thorchainSlippage: thorchainProvider140?.slippage || 0,
        bestLedgerSlippage: bestLedgerProvider?.slippage || 0,
        isViableRoute: canWinAt125 // Can compete within business constraints
      };
      
    } finally {
      amount = originalAmount; // Restore original amount
    }
  }

  async function fetchLedgerQuoteForAnalysis(fromLedgerAsset, toLedgerAsset, fromAddress, toAddress, testAmount) {
    const url = new URL('https://swap.ledger.com/v5/quote');
    
    const params = {
      'fiatForCounterValue': 'USD',
      'providers-whitelist': 'changelly_v2,cic,exodus,lifi,moonpay,oneinch,paraswap,thorswap,uniswap,velora',
      'currencyTicker': 'USD',
      'lang': 'en',
      'fromAccountId': 'af905639-1a05-5d29-b6ca-943fcc0d6fe0',
      'amountFrom': testAmount.toString(),
      'from': fromLedgerAsset,
      'to': toLedgerAsset,
      'addressFrom': fromAddress,
      'addressTo': toAddress,
      'networkFees': '0',
      'networkFeesCurrency': fromLedgerAsset,
      'theme': 'dark',
      'displayLanguage': 'en'
    };

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await rateLimitedFetch(url, {
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

    if (!response.ok) {
      throw new Error(`Ledger HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  function processAnalysisResults(results) {
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      return { error: 'No valid results to analyze' };
    }
    
    // Strategic Business Analysis
    const viableRoutes = validResults.filter(r => r.isViableRoute);
    const routesRequiringFeeReduction = validResults.filter(r => r.feeReductionRequired);
    const routesWinningAtFullFee = validResults.filter(r => r.canWinAt140);
    const uncompetitiveRoutes = validResults.filter(r => !r.canWinAt125);
    
    // Calculate overall statistics
    const thorchainWins = viableRoutes.length; // Only count viable wins
    const totalValid = validResults.length;
    const winRate = (thorchainWins / totalValid) * 100;
    const viabilityRate = (viableRoutes.length / totalValid) * 100;
    
    // Calculate average advantage/disadvantage (at 140 bps)
    const advantages = validResults.map(r => r.advantage140);
    const avgAdvantage = advantages.reduce((sum, adv) => sum + adv, 0) / advantages.length;
    
    // Revenue impact analysis
    const totalRevenueImpact = routesRequiringFeeReduction.reduce((sum, r) => sum + r.revenueImpact, 0);
    const avgRevenueImpact = routesRequiringFeeReduction.length > 0 ? 
      totalRevenueImpact / routesRequiringFeeReduction.length : 0;
    
    // Find best and worst performing routes (by optimal performance)
    const bestRoute = validResults.reduce((best, current) => {
      const bestOptimal = best.optimalAdvantage || best.advantage140;
      const currentOptimal = current.optimalAdvantage || current.advantage140;
      return currentOptimal > bestOptimal ? current : best;
    });
    
    const worstRoute = validResults.reduce((worst, current) => {
      const worstOptimal = worst.optimalAdvantage || worst.advantage140;
      const currentOptimal = current.optimalAdvantage || current.advantage140;
      return currentOptimal < worstOptimal ? current : worst;
    });
    
    // Group by asset pairs with strategic metrics
    const pairPerformance = {};
    validResults.forEach(result => {
      const pairKey = `${result.fromAsset} → ${result.toAsset}`;
      if (!pairPerformance[pairKey]) {
        pairPerformance[pairKey] = {
          wins: 0,
          viableWins: 0,
          total: 0,
          avgAdvantage: 0,
          advantages: [],
          feeReductionsRequired: 0,
          avgRevenueImpact: 0,
          revenueImpacts: []
        };
      }
      
      pairPerformance[pairKey].total++;
      if (result.thorchainWins) pairPerformance[pairKey].wins++;
      if (result.isViableRoute) pairPerformance[pairKey].viableWins++;
      if (result.feeReductionRequired) pairPerformance[pairKey].feeReductionsRequired++;
      
      pairPerformance[pairKey].advantages.push(result.advantage140);
      pairPerformance[pairKey].revenueImpacts.push(result.revenueImpact);
    });
    
    // Calculate averages per pair
    Object.values(pairPerformance).forEach(pair => {
      pair.avgAdvantage = pair.advantages.reduce((sum, adv) => sum + adv, 0) / pair.advantages.length;
      pair.winRate = (pair.wins / pair.total) * 100;
      pair.viabilityRate = (pair.viableWins / pair.total) * 100;
      pair.avgRevenueImpact = pair.revenueImpacts.reduce((sum, imp) => sum + imp, 0) / pair.revenueImpacts.length;
    });
    
    // Group by USD amount size with strategic metrics
    const amountPerformance = {};
    validResults.forEach(result => {
      // Use USD amount for grouping instead of crypto amount
      const amountKey = result.usdAmount ? `$${result.usdAmount}` : result.amount.toString();
      if (!amountPerformance[amountKey]) {
        amountPerformance[amountKey] = {
          wins: 0,
          viableWins: 0,
          total: 0,
          avgAdvantage: 0,
          advantages: [],
          feeReductionsRequired: 0,
          avgRevenueImpact: 0,
          usdAmount: result.usdAmount || null
        };
      }
      
      amountPerformance[amountKey].total++;
      if (result.thorchainWins) amountPerformance[amountKey].wins++;
      if (result.isViableRoute) amountPerformance[amountKey].viableWins++;
      if (result.feeReductionRequired) amountPerformance[amountKey].feeReductionsRequired++;
      
      amountPerformance[amountKey].advantages.push(result.advantage140);
    });
    
    Object.values(amountPerformance).forEach(amount => {
      amount.avgAdvantage = amount.advantages.reduce((sum, adv) => sum + adv, 0) / amount.advantages.length;
      amount.winRate = (amount.wins / amount.total) * 100;
      amount.viabilityRate = (amount.viableWins / amount.total) * 100;
    });
    
    return {
      summary: {
        totalTests: totalValid,
        thorchainWins,
        winRate,
        viabilityRate,
        avgAdvantage,
        bestRoute,
        worstRoute,
        
        // Strategic business metrics
        routesWinningAtFullFee: routesWinningAtFullFee.length,
        routesRequiringFeeReduction: routesRequiringFeeReduction.length,
        uncompetitiveRoutes: uncompetitiveRoutes.length,
        avgRevenueImpact,
        
        // Performance at different fee levels
        fullFeeWinRate: (routesWinningAtFullFee.length / totalValid) * 100,
        reducedFeeWinRate: (routesRequiringFeeReduction.length / totalValid) * 100,
        uncompetitiveRate: (uncompetitiveRoutes.length / totalValid) * 100
      },
      pairPerformance,
      amountPerformance,
      allResults: validResults,
      errors: results.filter(r => r.error),
      
      // Strategic data for detailed analysis
      strategicAnalysis: {
        viableRoutes,
        routesRequiringFeeReduction,
        routesWinningAtFullFee,
        uncompetitiveRoutes
      }
    };
  }

  function exportAnalysisResults() {
    if (!analysisResults) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      testConfiguration: {
        usdAmounts: [100, 500, 2500, 10000, 50000, 150000],
        assetPrices: assetPrices,
        minViableFee: 125, // bps
        standardFee: 140 // bps
      },
      summary: analysisResults.summary,
      pairPerformance: analysisResults.pairPerformance,
      amountPerformance: analysisResults.amountPerformance,
      detailedResults: analysisResults.allResults.map(result => ({
        fromAsset: assetNames[result.fromAsset] || result.fromAsset,
        toAsset: assetNames[result.toAsset] || result.toAsset,
        cryptoAmount: result.amount,
        usdAmount: result.usdAmount,
        fromAssetPrice: assetPrices[result.fromAsset],
        thorchainWins: result.thorchainWins,
        isViableRoute: result.isViableRoute,
        advantage140bps: result.advantage140,
        advantage125bps: result.advantage125,
        optimalFee: result.optimalFee,
        feeReductionRequired: result.feeReductionRequired,
        revenueImpact: result.revenueImpact,
        thorchainRate: result.thorchainRate,
        bestCompetitorRate: result.bestLedgerRate,
        bestCompetitor: result.bestLedgerProvider,
        thorswapRate: result.thorswapRate
      }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `thorchain-performance-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          disabled={isLoading || isOptimizing || isAnalyzing}
        >
          {isOptimizing ? 'Optimizing Fee...' : '🎯 Optimize Affiliate Fee'}
        </button>

        <button 
          class="analysis-button" 
          on:click={runPerformanceAnalysis} 
          disabled={isLoading || isOptimizing || isAnalyzing}
        >
          {isAnalyzing ? `Analyzing... (${analysisProgress.current}/${analysisProgress.total})` : '📊 Performance Analysis'}
        </button>
      </div>

      {#if isAnalyzing && analysisProgress.total > 0}
        <div class="analysis-progress">
          <h3>🔍 Running Performance Analysis</h3>
          <div class="progress-info">
            <p><strong>Progress:</strong> {analysisProgress.current} / {analysisProgress.total} tests completed</p>
            <p><strong>Current Test:</strong> {analysisProgress.currentPair}</p>
            <p><strong>Active Requests:</strong> {activeRequests} / {maxConcurrentRequests} (rate limited)</p>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: {(analysisProgress.current / analysisProgress.total) * 100}%"></div>
          </div>
          <p class="progress-note">⏱️ Smart rate limiting with exponential backoff prevents API limits. Please wait...</p>
        </div>
      {/if}

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

<!-- Performance Analysis Results Modal -->
{#if showAnalysisModal && analysisResults}
  <div class="modal-overlay" on:click={closeAnalysisModal}>
    <div class="modal-content analysis-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>📊 THORChain Performance Analysis</h2>
        <div class="header-actions">
          <button class="export-button" on:click={exportAnalysisResults} title="Export Results">
            💾 Export
          </button>
          <button class="close-button" on:click={closeAnalysisModal}>&times;</button>
        </div>
      </div>
      
      <div class="modal-body">
        {#if analysisResults.error}
          <div class="error-box">
            <p>❌ Analysis failed: {analysisResults.error}</p>
          </div>
        {:else}
          <!-- Summary Statistics -->
          <div class="analysis-summary">
            <h3>📈 Strategic Performance Summary</h3>
            <p class="business-constraint">🎯 <strong>Business Constraint:</strong> THORChain needs minimum 125 bps affiliate fee to be viable. Ledger's THORSwap shows ~140 bps fee rates.</p>
            <p class="usd-normalization">💰 <strong>USD Normalized Testing:</strong> All tests use equivalent USD amounts ($100, $500, $2.5K, $10K, $50K, $150K) converted to appropriate crypto amounts using real-time <a href="https://thornode.ninerealms.com/thorchain/pools" target="_blank" rel="noopener noreferrer">THORNode pool prices</a>.</p>
            
            <div class="summary-cards">
              <div class="summary-card" class:positive={analysisResults.summary.viabilityRate > 50}>
                <div class="card-icon">{analysisResults.summary.viabilityRate > 50 ? '✅' : '⚠️'}</div>
                <div class="card-content">
                  <h4>Viable Win Rate</h4>
                  <p class="big-number">{analysisResults.summary.viabilityRate.toFixed(1)}%</p>
                  <p class="card-subtitle">Can compete at ≥125 bps fee ({analysisResults.summary.thorchainWins} of {analysisResults.summary.totalTests})</p>
                </div>
              </div>

              <div class="summary-card" class:positive={analysisResults.summary.fullFeeWinRate > 30}>
                <div class="card-icon">{analysisResults.summary.fullFeeWinRate > 30 ? '💰' : '📉'}</div>
                <div class="card-content">
                  <h4>Full Fee Wins</h4>
                  <p class="big-number">{analysisResults.summary.fullFeeWinRate.toFixed(1)}%</p>
                  <p class="card-subtitle">Win at 140 bps (no revenue loss) ({analysisResults.summary.routesWinningAtFullFee} routes)</p>
                </div>
              </div>

              <div class="summary-card" class:positive={analysisResults.summary.reducedFeeWinRate < 30} class:warning={analysisResults.summary.reducedFeeWinRate > 30}>
                <div class="card-icon">{analysisResults.summary.reducedFeeWinRate > 30 ? '⚖️' : '🟢'}</div>
                <div class="card-content">
                  <h4>Fee Reduction Required</h4>
                  <p class="big-number">{analysisResults.summary.reducedFeeWinRate.toFixed(1)}%</p>
                  <p class="card-subtitle">Must reduce to 125 bps to win ({analysisResults.summary.routesRequiringFeeReduction} routes)</p>
                </div>
              </div>

              <div class="summary-card" class:negative={analysisResults.summary.uncompetitiveRate > 20}>
                <div class="card-icon">{analysisResults.summary.uncompetitiveRate > 20 ? '❌' : '😐'}</div>
                <div class="card-content">
                  <h4>Uncompetitive</h4>
                  <p class="big-number">{analysisResults.summary.uncompetitiveRate.toFixed(1)}%</p>
                  <p class="card-subtitle">Cannot win even at 125 bps ({analysisResults.summary.uncompetitiveRoutes} routes)</p>
                </div>
              </div>

              {#if analysisResults.summary.avgRevenueImpact > 0}
                <div class="summary-card warning">
                  <div class="card-icon">💸</div>
                  <div class="card-content">
                    <h4>Revenue Impact</h4>
                    <p class="big-number">{analysisResults.summary.avgRevenueImpact.toFixed(1)}%</p>
                    <p class="card-subtitle">Avg revenue loss for competitive routes</p>
                  </div>
                </div>
              {/if}

              <div class="summary-card" class:positive={analysisResults.summary.avgAdvantage > 0}>
                <div class="card-icon">{analysisResults.summary.avgAdvantage > 0 ? '📈' : '📉'}</div>
                <div class="card-content">
                  <h4>Avg Performance (140 bps)</h4>
                  <p class="big-number">{analysisResults.summary.avgAdvantage > 0 ? '+' : ''}{analysisResults.summary.avgAdvantage.toFixed(2)}%</p>
                  <p class="card-subtitle">vs best non-THORSwap competitor</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance by Asset Pairs -->
          <div class="analysis-section">
            <h3>🎯 Strategic Performance by Asset Pair</h3>
            <div class="pairs-table">
              <div class="table-header strategic">
                <div>Asset Pair</div>
                <div>Viability Rate</div>
                <div>Fee Strategy</div>
                <div>Revenue Impact</div>
                <div>Performance @ 140bps</div>
              </div>
              {#each Object.entries(analysisResults.pairPerformance).sort(([,a], [,b]) => b.viabilityRate - a.viabilityRate) as [pairKey, pairData]}
                <div class="table-row strategic" class:viable={pairData.viabilityRate > 0} class:full-fee={pairData.viabilityRate > 0 && pairData.feeReductionsRequired === 0}>
                  <div class="pair-cell">
                    {pairKey.split(' → ').map(asset => assetNames[asset] || asset).join(' → ')}
                  </div>
                  <div class="viability-cell">
                    <span class="viability-rate" class:good={pairData.viabilityRate > 50} class:partial={pairData.viabilityRate > 0 && pairData.viabilityRate <= 50} class:none={pairData.viabilityRate === 0}>
                      {pairData.viabilityRate.toFixed(0)}%
                    </span>
                  </div>
                  <div class="strategy-cell">
                    {#if pairData.viabilityRate === 0}
                      <span class="strategy uncompetitive">❌ Uncompetitive</span>
                    {:else if pairData.feeReductionsRequired === 0}
                      <span class="strategy full-fee">💰 Keep 140 bps</span>
                    {:else if pairData.feeReductionsRequired === pairData.viableWins}
                      <span class="strategy reduce-fee">⚖️ Reduce to 125 bps</span>
                    {:else}
                      <span class="strategy mixed">🔄 Mixed strategy</span>
                    {/if}
                  </div>
                  <div class="revenue-cell">
                    {#if pairData.avgRevenueImpact > 0}
                      <span class="revenue-impact">-{pairData.avgRevenueImpact.toFixed(1)}%</span>
                    {:else}
                      <span class="no-impact">0%</span>
                    {/if}
                  </div>
                  <div class="advantage-cell">
                    <span class="advantage" class:positive={pairData.avgAdvantage > 0} class:negative={pairData.avgAdvantage < 0}>
                      {pairData.avgAdvantage > 0 ? '+' : ''}{pairData.avgAdvantage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Performance by Swap Size -->
          <div class="analysis-section">
            <h3>💰 Performance by Swap Size (USD Normalized)</h3>
            <div class="amounts-table">
              <div class="table-header">
                <div>Swap Amount (USD)</div>
                <div>Viability Rate</div>
                <div>Avg Advantage</div>
                <div>Tests</div>
              </div>
              {#each Object.entries(analysisResults.amountPerformance).sort(([,a], [,b]) => (a.usdAmount || 0) - (b.usdAmount || 0)) as [amount, amountData]}
                <div class="table-row" class:viable={amountData.viabilityRate > 0}>
                  <div class="amount-cell">{amount}</div>
                  <div class="rate-cell">
                    <span class="viability-rate" class:good={amountData.viabilityRate > 50} class:partial={amountData.viabilityRate > 0 && amountData.viabilityRate <= 50} class:none={amountData.viabilityRate === 0}>
                      {amountData.viabilityRate.toFixed(0)}%
                    </span>
                  </div>
                  <div class="advantage-cell">
                    <span class="advantage" class:positive={amountData.avgAdvantage > 0} class:negative={amountData.avgAdvantage < 0}>
                      {amountData.avgAdvantage > 0 ? '+' : ''}{amountData.avgAdvantage.toFixed(2)}%
                    </span>
                  </div>
                  <div class="tests-cell">{amountData.total}</div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Key Strategic Insights -->
          <div class="analysis-section">
            <h3>💡 Strategic Business Insights</h3>
            <div class="insights">
              <!-- Viability Assessment -->
              {#if analysisResults.summary.viabilityRate > 60}
                <div class="insight success">
                  <span class="insight-icon">🎉</span>
                  <p><strong>Strong Competitive Position:</strong> THORChain can viably compete in {analysisResults.summary.viabilityRate.toFixed(1)}% of routes (≥125 bps fee). This indicates good market positioning within business constraints.</p>
                </div>
              {:else if analysisResults.summary.viabilityRate > 40}
                <div class="insight warning">
                  <span class="insight-icon">⚖️</span>
                  <p><strong>Selective Competitiveness:</strong> THORChain can compete in {analysisResults.summary.viabilityRate.toFixed(1)}% of routes. Focus on optimizing winning routes and improving underperforming ones.</p>
                </div>
              {:else}
                <div class="insight danger">
                  <span class="insight-icon">⚠️</span>
                  <p><strong>Limited Competitiveness:</strong> THORChain can only compete viably in {analysisResults.summary.viabilityRate.toFixed(1)}% of routes. Significant protocol improvements needed.</p>
                </div>
              {/if}

              <!-- Fee Strategy Insights -->
              {#if analysisResults.summary.fullFeeWinRate > 30}
                <div class="insight success">
                  <span class="insight-icon">💰</span>
                  <p><strong>Revenue Optimization:</strong> {analysisResults.summary.fullFeeWinRate.toFixed(1)}% of routes can win at full 140 bps fee, preserving maximum revenue. Focus on these high-value routes.</p>
                </div>
              {:else}
                <div class="insight warning">
                  <span class="insight-icon">💸</span>
                  <p><strong>Revenue Pressure:</strong> Only {analysisResults.summary.fullFeeWinRate.toFixed(1)}% of routes win at full fee. Most competitive routes require fee reduction to 125 bps.</p>
                </div>
              {/if}

              <!-- Revenue Impact Analysis -->
              {#if analysisResults.summary.avgRevenueImpact > 0}
                <div class="insight warning">
                  <span class="insight-icon">📊</span>
                  <p><strong>Revenue Impact:</strong> Competitive routes require an average {analysisResults.summary.avgRevenueImpact.toFixed(1)}% revenue reduction. Strategic fee optimization needed to balance volume vs margin.</p>
                </div>
              {/if}

              <!-- THORSwap Comparison -->
              <div class="insight info">
                <span class="insight-icon">🔄</span>
                <p><strong>Ledger Integration:</strong> THORSwap provider in Ledger represents THORNode quotes with ~140 bps fees. Direct THORNode integration allows strategic fee optimization down to 125 bps minimum.</p>
              </div>

              <!-- Best performing pairs (viable routes) -->
              {#if Object.entries(analysisResults.pairPerformance).filter(([,data]) => data.viabilityRate > 80).length > 0}
                {@const topViablePairs = Object.entries(analysisResults.pairPerformance)
                  .filter(([,data]) => data.viabilityRate > 80)
                  .sort(([,a], [,b]) => b.viabilityRate - a.viabilityRate)
                  .slice(0, 3)}
                <div class="insight success">
                  <span class="insight-icon">🏆</span>
                  <p><strong>Strongest Routes:</strong> Focus on {topViablePairs.map(([pair]) => pair.split(' → ').map(asset => assetNames[asset] || asset).join('→')).join(', ')} - these routes show consistent competitive advantage.</p>
                </div>
              {/if}

              <!-- Worst performing pairs (uncompetitive) -->
              {#if Object.entries(analysisResults.pairPerformance).filter(([,data]) => data.viabilityRate === 0).length > 0}
                {@const uncompetitivePairs = Object.entries(analysisResults.pairPerformance)
                  .filter(([,data]) => data.viabilityRate === 0)
                  .slice(0, 3)}
                <div class="insight danger">
                  <span class="insight-icon">🔍</span>
                  <p><strong>Protocol Gaps:</strong> Routes like {uncompetitivePairs.map(([pair]) => pair.split(' → ').map(asset => assetNames[asset] || asset).join('→')).join(', ')} cannot compete even at minimum 125 bps fee. These need fundamental improvements.</p>
                </div>
              {/if}

              <!-- Fee reduction opportunities -->
              {#if Object.entries(analysisResults.pairPerformance).filter(([,data]) => data.feeReductionsRequired > 0 && data.viabilityRate > 0).length > 0}
                {@const feeReductionPairs = Object.entries(analysisResults.pairPerformance)
                  .filter(([,data]) => data.feeReductionsRequired > 0 && data.viabilityRate > 0)
                  .sort(([,a], [,b]) => b.viabilityRate - a.viabilityRate)
                  .slice(0, 3)}
                <div class="insight warning">
                  <span class="insight-icon">⚖️</span>
                  <p><strong>Strategic Fee Opportunities:</strong> {feeReductionPairs.map(([pair]) => pair.split(' → ').map(asset => assetNames[asset] || asset).join('→')).join(', ')} can win by reducing fees to 125 bps. Consider dynamic pricing strategies.</p>
                </div>
              {/if}
            </div>
          </div>

          {#if analysisResults.errors && analysisResults.errors.length > 0}
            <div class="analysis-section">
              <h3>⚠️ Test Errors ({analysisResults.errors.length})</h3>
              <div class="errors-list">
                {#each analysisResults.errors.slice(0, 5) as error}
                  <div class="error-item">
                    <strong>{assetNames[error.fromAsset] || error.fromAsset} → {assetNames[error.toAsset] || error.toAsset}</strong>
                    <span class="error-message">{error.error}</span>
                  </div>
                {/each}
                {#if analysisResults.errors.length > 5}
                  <p class="errors-note">... and {analysisResults.errors.length - 5} more errors</p>
                {/if}
              </div>
            </div>
          {/if}
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
    flex-wrap: wrap;
  }

  .quote-button, .optimize-button, .analysis-button {
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

  .analysis-button {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  }

  .quote-button:hover:not(:disabled), .optimize-button:hover:not(:disabled), .analysis-button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .quote-button:hover:not(:disabled) {
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  }

  .optimize-button:hover:not(:disabled) {
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
  }

  .analysis-button:hover:not(:disabled) {
    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
  }

  .quote-button:disabled, .optimize-button:disabled, .analysis-button:disabled {
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .export-button {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .export-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
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

  /* Analysis Progress Styles */
  .analysis-progress {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
    border: 1px solid #8b5cf6;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .analysis-progress h3 {
    color: #8b5cf6;
    margin-bottom: 1rem;
  }

  .progress-info {
    margin-bottom: 1rem;
  }

  .progress-info p {
    margin: 0.5rem 0;
    color: #a0a0a0;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #2c2c2c;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a855f7);
    transition: width 0.3s ease;
  }

  .progress-note {
    color: #8b5cf6;
    font-size: 0.9rem;
    margin: 0;
    font-style: italic;
  }

  /* Analysis Modal Styles */
  .analysis-modal {
    max-width: 1000px;
    max-height: 95vh;
  }

  .analysis-summary {
    margin-bottom: 2rem;
  }

  .business-constraint {
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
    color: #e0e0e0;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .usd-normalization {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    color: #e0e0e0;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .usd-normalization a {
    color: #10b981;
    text-decoration: underline;
  }

  .usd-normalization a:hover {
    color: #34d399;
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .summary-card {
    background: #1e1e1e;
    border: 2px solid #444;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s ease;
  }

  .summary-card.positive {
    border-color: #22c55e;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  }

  .summary-card.negative {
    border-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .summary-card.warning {
    border-color: #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  }

  .card-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .card-content h4 {
    margin: 0 0 0.5rem 0;
    color: #e0e0e0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .big-number {
    font-size: 1.5rem;
    font-weight: 700;
    color: #e0e0e0;
    margin: 0 0 0.25rem 0;
    line-height: 1;
  }

  .card-subtitle {
    color: #a0a0a0;
    font-size: 0.8rem;
    margin: 0;
  }

  .route-name {
    color: #e0e0e0;
    font-weight: 600;
    font-size: 0.9rem;
    margin: 0 0 0.25rem 0;
  }

  .analysis-section {
    margin-bottom: 2rem;
    background: #1e1e1e;
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid #333;
  }

  .analysis-section h3 {
    margin: 0 0 1rem 0;
    color: #e0e0e0;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
  }

  /* Table Styles */
  .pairs-table, .amounts-table {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: #2c2c2c;
    border-radius: 6px;
    font-weight: 600;
    color: #e0e0e0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table-header.strategic {
    grid-template-columns: 2fr 1fr 1.5fr 1fr 1fr;
    font-size: 0.8rem;
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: #252525;
    border-radius: 6px;
    transition: all 0.2s ease;
    border: 1px solid #333;
  }

  .table-row.strategic {
    grid-template-columns: 2fr 1fr 1.5fr 1fr 1fr;
  }

  .table-row:hover {
    background: #2a2a2a;
    border-color: #444;
  }

  .table-row.winning {
    border-color: rgba(34, 197, 94, 0.3);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.02) 100%);
  }

  .table-row.viable {
    border-color: rgba(34, 197, 94, 0.3);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.02) 100%);
  }

  .table-row.full-fee {
    border-color: rgba(16, 185, 129, 0.4);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%);
  }

  .pair-cell, .amount-cell {
    color: #e0e0e0;
    font-weight: 500;
  }

  .win-rate {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .win-rate.good {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  .advantage {
    font-weight: 600;
    font-family: monospace;
  }

  .advantage.positive {
    color: #22c55e;
  }

  .advantage.negative {
    color: #ef4444;
  }

  .tests-cell {
    color: #a0a0a0;
    text-align: center;
  }

  /* Strategic Table Cells */
  .viability-rate {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .viability-rate.good {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  .viability-rate.partial {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .viability-rate.none {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .strategy {
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .strategy.full-fee {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .strategy.reduce-fee {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .strategy.mixed {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
  }

  .strategy.uncompetitive {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .revenue-impact {
    color: #f59e0b;
    font-weight: 600;
    font-family: monospace;
  }

  .no-impact {
    color: #6b7280;
    font-family: monospace;
  }

  /* Insights Styles */
  .insights {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .insight {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid;
  }

  .insight.success {
    border-color: #22c55e;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
  }

  .insight.warning {
    border-color: #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  }

  .insight.danger {
    border-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .insight.info {
    border-color: #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  }

  .insight-icon {
    font-size: 1.5rem;
    line-height: 1;
    margin-top: 0.1rem;
  }

  .insight p {
    margin: 0;
    color: #e0e0e0;
    line-height: 1.5;
  }

  /* Errors List Styles */
  .errors-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
  }

  .error-item strong {
    color: #fca5a5;
  }

  .error-message {
    color: #a0a0a0;
    font-size: 0.9rem;
    font-style: italic;
  }

  .errors-note {
    color: #a0a0a0;
    font-style: italic;
    text-align: center;
    margin: 0.5rem 0 0 0;
  }

  /* Mobile Responsiveness for Analysis Modal */
  @media (max-width: 768px) {
    .analysis-modal {
      max-width: 95vw;
      margin: 0.5rem;
    }

    .summary-cards {
      grid-template-columns: 1fr;
    }

    .table-header, .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .table-header {
      display: none; /* Hide headers on mobile, show data inline */
    }

    .table-row {
      flex-direction: column;
      display: flex;
    }

    .pair-cell::before, .amount-cell::before {
      content: "Route: ";
      color: #a0a0a0;
      font-weight: normal;
    }

    .amount-cell::before {
      content: "Amount: ";
    }

    .insight {
      flex-direction: column;
      gap: 0.5rem;
    }

    .insight-icon {
      align-self: flex-start;
    }

    .button-group {
      flex-direction: column;
    }

    .quote-button, .optimize-button, .analysis-button {
      flex: none;
    }
  }
</style>