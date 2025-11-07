<script>
    // Swap estimator created by FamiliarCow for the THORChain community under MIT license
    // Utilizing Nine Realms public infrastructure and THORNode quote endpoint
    
        import { onMount } from 'svelte';
        import { slide } from 'svelte/transition';
        import Settings from '../../public/assets/Settings.svelte';
        import AssetDropdown from './SwapEstimator/AssetDropdown.svelte';
  
          
        let amount = null; //random starting swap
        let from_asset = 'ETH.ETH'; //set default from_asset
        let to_asset = 'BTC.BTC'; //set default to_asset
        let destination = '';
        let expectedAmountOut = '';
        let expectedAmountOutStreaming = '';
        let assetPriceUSD = 0;
        let expectedAmountOutUSD = 0;
        let inbound_confirmation_seconds = 0;
        let outbound_delay_blocks = 0;
        let total_swap_seconds = 0;
        let streaming_total_swap_seconds = 0;
        let slippage_bps = 0;
        let estimated_swap_time = 0;
        let showLogos = false;  
        let estimatedValue = '';
        let fromDropdownOpen = false;
        let toDropdownOpen = false;
        let isLoading = false;
        let affiliate_fee = 0;
        let affiliate_fee_usd = 0;
        let outboundFee = 0;
        let liquidityFee = 0;
        let totalFee = 0;
        let totalFeeBps = 0;
        let feeAsset = '';
        let streaming_interval = 1;
        let streaming_quantity = 0;
        let showEstimatedTime = false;
        let showSettings = false;
        let showFeeBreakdown = false;
        let affiliateAddress = '';
        let affiliateFeeBps = '';
        let enableAffiliateSettings = false;
        let affiliateEarningsUSD = 0;
        let outboundFeeUSD = 0;
        let liquidityFeeUSD = 0;
        let totalFeeUSD = 0;
        let showInboundDelay = false;
        let showOutboundDelay = false;
        let inboundConfirmationBlocks = 0;
        let inboundConfirmationSeconds = 0;
        let outboundDelayBlocks = 0;
        let outboundDelaySeconds = 0;
        let showStreamingDetails = false;
        let maxStreamingQuantity = 0;
        let streamingSwapBlocks = 0;
        let streamingSwapSeconds = 0;
        let toggleAll = false;
        let showHeightField = false;
        let height = '';
  
  function changellyAssetFormat(asset) {
    // Splits the string into two at the period, takes the second piece
    let afterPeriod = asset.split('.')[1];
  
    // If there is a hyphen, split the string into two at the hyphen, takes the first piece
    if (afterPeriod.includes('-')) {
      return afterPeriod.split('-')[0];
    }
  
    return afterPeriod;
  }
  
  function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }
      
        function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes} min ${remainingSeconds} sec`;
      }
          
        function formatNumber(number) {
          return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }        
      
      // Valid assets to swap to or from (ordered by descending balance_rune + THOR.RUNE exception)
        const assets = [
          'BTC.BTC',
          'ETH.ETH',
          'THOR.RUNE',
          'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
          'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
          'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
          'BCH.BCH',
          'BSC.BNB',
          'DOGE.DOGE',
          'LTC.LTC',
          'AVAX.AVAX',
          'XRP.XRP',
          'THOR.RUJI',
          'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044',
          'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
          'THOR.TCY',
          'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
          'GAIA.ATOM',
          'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',
          'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
          'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C',
          'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T',
          'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0',
          'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',
          'TRON.TRX',
          'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C',
          'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1',
          'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD',
          'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8',
          'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
          'BASE.ETH',
          'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56',
          'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F',
          'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003',
          'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA',
          'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B',
          'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9',
          'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325',
          'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D',
          'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D',
          'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E'
        ];
      
      // Map asset names to pool abbreviations
      const assetNames = {
          'BTC.BTC': 'Bitcoin',
          'ETH.ETH': 'Ethereum',
          'BSC.BNB': 'BNB',
          'BCH.BCH': 'Bitcoin Cash',
          'LTC.LTC': 'Litecoin',
          'AVAX.AVAX': 'Avalanche',
          'GAIA.ATOM': 'Cosmos',
          'DOGE.DOGE': 'Dogecoin',
          'XRP.XRP': 'XRP',
          'THOR.RUNE': 'RUNE',
          'THOR.TCY': 'TCY',
          'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': "USDC (ETH)",
          'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': "USDT (ETH)",
          'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': "WBTC (ETH)",
          'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': "DAI (ETH)",
          'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': "GUSD (ETH)",
          'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': "LUSD (ETH)",
          'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': "USDP (ETH)",
          'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': "USDC (BSC)",
          'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': "USDT (BSC)",
          'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': "USDC (AVAX)",
          'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': "USDT (AVAX)",
          'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': "SOL (AVAX)",
          'BASE.ETH': "ETH (BASE)",
          'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': "USDC (BASE)",
          'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C': "BTCB (BSC)",
          'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56': "BUSD (BSC)",
          'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8': "ETH (BSC)",
          'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': "TWT (BSC)",
          'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': "AAVE (ETH)",
          'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': "DPI (ETH)",
          'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': "FOX (ETH)",
          'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': "LINK (ETH)",
          'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': "TGT (ETH)",
          'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': "THOR (ETH)",
          'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': "VTHOR (ETH)",
          'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': "XRUNE (ETH)",
          'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': "YFI (ETH)",
          'THOR.RUJI': "RUJI",
          'TRON.TRX': "Tron",
          'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T': "USDT (TRON)"
      };
      
      // Dummy destinations from the chains to pull a valid quote from thornode
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
          'XRP.XRP': 'rw7HeBkhm3ABP48WFbDYvimDghUCBWZamB',
          'THOR.RUNE': 'thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3',
          'THOR.TCY': 'thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3',
          'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': '0x66153cf0e164bc9bdae88fb36fc5b92dc63a79d6',
          'BASE.ETH': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': '0x4E71F9debEC9117F1FACc7eeB490758AF45806A7',
          'THOR.RUJI': 'thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3',
          'TRON.TRX': 'TRJZd7dDH6jDuPDVJP6sjdLLQfKMgqMu1c',
          'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T': 'TRJZd7dDH6jDuPDVJP6sjdLLQfKMgqMu1c'
        };
    
      // Asset svg logos for display
      const assetLogos = {
      'BTC.BTC': 'assets/coins/bitcoin-btc-logo.svg',
      'ETH.ETH': 'assets/coins/ethereum-eth-logo.svg',
      'BSC.BNB': 'assets/coins/binance-coin-bnb-logo.svg',
      'BCH.BCH': 'assets/coins/bitcoin-cash-bch-logo.svg',
      'LTC.LTC': 'assets/coins/litecoin-ltc-logo.svg',
      'AVAX.AVAX': 'assets/coins/avalanche-avax-logo.svg',
      'GAIA.ATOM': 'assets/coins/cosmos-atom-logo.svg',
      'DOGE.DOGE': 'assets/coins/dogecoin-doge-logo.svg',
      'THOR.RUNE': 'assets/coins/RUNE-ICON.svg',
      'THOR.TCY': 'assets/coins/TCY.svg',
      'XRP.XRP': 'assets/chains/XRP.svg',
      'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'assets/coins/usd-coin-usdc-logo.svg',
      'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'assets/coins/tether-usdt-logo.svg',
      'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
      'BNB.BUSD-BD1': 'assets/coins/binance-usd-busd-logo.svg',
      'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
      'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
      'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
      'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
      'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
      'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
      'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
      'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg',
      'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': 'assets/coins/solana-sol-logo.svg',
      'BASE.ETH': 'assets/coins/ethereum-eth-logo.svg',
      'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': 'assets/coins/usd-coin-usdc-logo.svg',
      'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C': 'assets/coins/bitcoin-btc-logo.svg',
      'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56': 'assets/coins/binance-usd-busd-logo.svg',
      'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8': 'assets/coins/ethereum-eth-logo.svg',
      'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': 'assets/coins/twt-logo.png',
      'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'assets/coins/aave-aave-logo.svg',
      'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': 'assets/coins/dpi-logo.png',
      'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'assets/coins/fox-token-fox-logo.svg',
      'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'assets/coins/chainlink-link-logo.svg',
      'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': 'assets/coins/tgt-logo.png',
      'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'assets/coins/thorchain-rune-logo.svg',
      'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': 'assets/coins/VTHOR.svg',
      'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'assets/coins/xrune-logo.png',
      'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E': 'assets/coins/YFI.svg',
      'THOR.RUJI': 'assets/coins/RUJI.svg',
      'TRON.TRX': 'assets/coins/TRON.svg',
      'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T': 'assets/coins/tether-usdt-logo.svg'
      };
    
      let assetPrices = {};
      let estimatedValueUSD = '';

      async function fetchAssetPrices() {
        try {
          const priceUrl = `https://midgard.ninerealms.com/v2/pools`;
          const priceResponse = await fetch(priceUrl);
          const priceResult = await priceResponse.json();
          
          assetPrices = priceResult.reduce((acc, pool) => {
            acc[pool.asset] = parseFloat(pool.assetPriceUSD);
            return acc;
          }, {});

          // Special case for RUNE
          const runePool = priceResult.find(pool => pool.asset === 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48');
          assetPrices['THOR.RUNE'] = parseFloat(runePool.assetDepth) / parseFloat(runePool.runeDepth);
        } catch (error) {
          console.error('Error fetching asset prices:', error);
        }
      }

      onMount(fetchAssetPrices);

      $: {
        if (amount && from_asset && assetPrices[from_asset]) {
          const usdValue = amount * assetPrices[from_asset];
          estimatedValueUSD = `≈ $${formatNumber(usdValue)}`;
        } else {
          estimatedValueUSD = '';
        }
      }

      // Function is called when swap button is pressed to fetch the quote from thornode
      async function fetchQuote() {
      try {
        if (!amount || amount <= 0) {
          alert("Please enter a valid swap amount.");
          return;
        }
        if (from_asset === to_asset) {
          alert("From asset and To asset must be different.");
          return;
        }
        isLoading = true;
        destination = destinations[to_asset];
        const amountToSend = amount * 1e8;
    
        // Use the already fetched prices
        const assetInPriceUSD = assetPrices[from_asset];
        const assetOutPriceUSD = assetPrices[to_asset];
        
        //estimate swap output value in USD
        const estimatedValueUSD = amount * assetInPriceUSD;
    
        // Fetch the streaming swap quote from thornode
        let url_stream = `https://thornode.ninerealms.com/thorchain/quote/swap?`;
        
        // Add height parameter if provided
        if (height) {
            url_stream += `height=${height}&`; 
        }
        
        // Add the rest of the parameters
        url_stream += `amount=${amountToSend}&from_asset=${from_asset}&to_asset=${to_asset}&destination=${destination}&streaming_interval=${streaming_interval}&streaming_quantity=${streaming_quantity}`;

        // Add affiliate parameters if enabled
        if (enableAffiliateSettings && affiliateAddress && affiliateFeeBps) {
            url_stream += `&affiliate=${affiliateAddress}&affiliate_bps=${affiliateFeeBps}`;
        }

        const response_stream = await fetch(url_stream);
        const result_stream = await response_stream.json();
    
        if (result_stream.error) {
          throw new Error(result_stream.error);
        }
    
        expectedAmountOutStreaming = result_stream.expected_amount_out / 1e8; //get expected amount out for streaming
        expectedAmountOutUSD = expectedAmountOutStreaming * assetOutPriceUSD;
    
        // Get total swap time
        streaming_total_swap_seconds = formatTime(result_stream.total_swap_seconds) || 0; //get streaming swap total seconds
      
        // Set the estimated value in the UI
        estimatedValue = `≈ $${formatNumber(estimatedValueUSD)}`;
  
        //Show result
        showLogos = true;
  
        // Calculate affiliate earnings if enabled
        if (enableAffiliateSettings && result_stream.fees && result_stream.fees.affiliate) {
            const affiliateFeeAsset = result_stream.fees.affiliate / 1e8; // Convert from sats to whole units
            const feeAsset = result_stream.fees.asset;
            const feeAssetPrice = feeAsset === from_asset ? assetInPriceUSD : assetOutPriceUSD;
            affiliateEarningsUSD = affiliateFeeAsset * feeAssetPrice;
        } else {
            affiliateEarningsUSD = 0;
        }
  
        // Extract fee information
        if (result_stream.fees) {
          outboundFee = result_stream.fees.outbound / 1e8;
          liquidityFee = result_stream.fees.liquidity / 1e8;
          totalFee = result_stream.fees.total / 1e8;
          totalFeeBps = result_stream.fees.total_bps;
          feeAsset = result_stream.fees.asset.split('.')[1];

          // Calculate USD values for fees
          const feeAssetPrice = result_stream.fees.asset === from_asset ? assetInPriceUSD : assetOutPriceUSD;
          outboundFeeUSD = outboundFee * feeAssetPrice;
          liquidityFeeUSD = liquidityFee * feeAssetPrice;
          totalFeeUSD = totalFee * feeAssetPrice;
        }
  
        if (result_stream) {
          inboundConfirmationBlocks = result_stream.inbound_confirmation_blocks;
          inboundConfirmationSeconds = result_stream.inbound_confirmation_seconds;
          outboundDelayBlocks = result_stream.outbound_delay_blocks;
          outboundDelaySeconds = result_stream.outbound_delay_seconds;
          maxStreamingQuantity = result_stream.max_streaming_quantity;
          streamingSwapBlocks = result_stream.streaming_swap_blocks;
          streamingSwapSeconds = result_stream.streaming_swap_seconds;
        }
  
      } catch (error) {
        alert(`Error fetching quote: ${error.message}`);
      } finally {
        isLoading = false;
      }
    }
    
      
      
      
      
      
          
          
        $: {
          if (from_asset || to_asset || amount) {
            resetResponse();
          }
        }
      
        function resetResponse() {
          expectedAmountOut = '';
          expectedAmountOutUSD = 0;
          expectedAmountOutStreaming = 0;
          inbound_confirmation_seconds = 0;
          outbound_delay_blocks = 0;
          slippage_bps = 0;
          estimated_swap_time = 0;
          estimatedValue = '';
          outboundFee = 0;
          liquidityFee = 0;
          totalFee = 0;
          totalFeeBps = 0;
          feeAsset = '';
          outboundFeeUSD = 0;
          liquidityFeeUSD = 0;
          totalFeeUSD = 0;
        }
              
        function handleFocus(node) {
    node.addEventListener('focus', (event) => {
      if (event.target.value == 1) {
        event.target.value = '';
      }
    });
  
    return {
      destroy() {
        node.removeEventListener('focus', handleFocus);
      },
    };
  }   
          
      function toggleSettings() {
        showSettings = !showSettings;
    }

    function toggleEstimatedTime() {
        showEstimatedTime = !showEstimatedTime;
    }
          
      function handleToggleAll() {
        toggleAll = !toggleAll;
        showEstimatedTime = toggleAll;
        enableAffiliateSettings = toggleAll;
        showFeeBreakdown = toggleAll;
        showInboundDelay = toggleAll;
        showOutboundDelay = toggleAll;
        showStreamingDetails = toggleAll;
      }
          
      </script>
      
      
    <style>
      * {
        box-sizing: border-box;
      }
      
      
      .swap-container {
        max-width: 500px;
        width: 100%;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 5px;
        background-color: rgba(0, 0, 0, 0.8);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        font-family: 'Exo 2', sans-serif;
      }
      
      label {
        display: block;
        margin-bottom: 5px;
      }
      
      input,
      select {
        width: 100%;
        padding: 8px;
        margin-bottom: 15px;
        border: none;
        border-radius: 5px;
        background-color: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      
      input:focus,
      select:focus {
        outline: none;
        box-shadow: 0 0 5px 2px rgba(0, 0, 0, 0.1);
      }
      
      button {
        width: 100%;
        padding: 10px;
        background-color: #2cbe8c;
        border: none;
        border-radius: 5px;
        color: #fff;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
      }
      
      button:hover {
        background-color: #3DA17E;
      }
      
      .result {
        margin-top: 20px;
        font-size: 18px;
      }
      
      .info-icon {
        display: inline-block;
        margin-left: 5px;
        cursor: pointer;
        position: relative;
      }
      
      .tooltip {
      display: none;
      position: absolute;
      background-color: rgba(0, 0, 0, 0.8);
      padding: 10px;
      border-radius: 5px;
      font-size: 14px;
      left: 50%;
      transform: translateX(-85%); 
      top: 25px; 
      opacity: 100; 
      }
      
      .info-icon:hover .tooltip {
        display: block;
      }
      
      .result {
        display: flex;
        align-items: center;
        margin-top: 20px;
        font-size: 18px;
        transition: opacity 0.5s ease-in-out;
      }
      
      .result-content {
        display: flex;
        align-items: center;
        flex-wrap: nowrap;
        font-size: 0.9rem;
        white-space: nowrap;
      }
      
      .asset-selection {
        display: flex;
        justify-content: space-between;
      }
      
      .asset-label {
        flex: 1;
        margin-right: 10px;
      }
      
      .asset-label:last-child {
        margin-right: 0;
      }
      
    
    
        .swap-container {
      color: #fff;
    }
    
    .asset-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    
    .green-text-bold {
      color: #2cbe8c;
      font-weight: bold;
    }
    
    .asset-label {
      margin-top: 8px;
      margin-bottom: 4px;
    }
    
    .custom-select {
      position: relative;
      display: inline-block;
    }
    
    .selected,
    .options div {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      cursor: pointer;
      user-select: none;
    }
    
    .selected {
      background-color: #2e2e2e;
      border: 1px solid #444;
      border-radius: 4px;
    }
    
    .options {
      position: absolute;
      background-color: #2e2e2e;
      border: 1px solid #444;
      border-radius: 4px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
      z-index: 1;
      max-height: 384px;
      overflow-y: auto;
    }
    
    .options div:hover {
      background-color: #3c3c3c;
    }
    
    img {
      width: 24px;
      height: 24px;
      margin-right: 8px;
    }
    
    input[type="number"] {
      background-color: #3c3c3c;
      color: #ffffff;
      border: 1px solid #444;
    }
    
    .hidden {
      display: none;
    }
    
    .asset-selection {
      display: flex;
      flex-direction: column;
    }
    
    .asset-label-container,
    .asset-select-container {
      display: flex;
      justify-content: space-between;
    }
    
    .asset-select-container {
      margin-top: -4px;
    
    }
    
    .asset-label {
      flex: 1;
      margin-right: 10px;
    }
    
    .asset-label:last-child {
      margin-right: 0;
    }
    
    .asset-selection {
      display: flex;
      flex-direction: column;
    }
    
    .asset-label-container {
      display: flex;
    }
    
    .asset-select-container {
      display: flex;
      margin-top: 4px;
    }
    
    .asset-label {
      margin-right: 10px;
    }
    
    .custom-select {
      flex: 1;
      margin-right: 10px;
    }
    
    .custom-select:last-child {
      margin-right: 0;
    }
    
    .loader {
        display: inline-block;
        border: 2px solid #f3f3f3;
        border-radius: 50%;
        border-top: 2px solid #3498db;
        width: 14px;
        height: 14px;
        margin-left: 5px;
        animation: spin 2s linear infinite;
      }
    
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    
    .app-container {
        position: relative;
        max-width: 500px;
        margin: 0 auto;
        display: flex;
        align-items: flex-start;
        gap: 10px;
    }

    .settings-icon {
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        padding: 10px;
        margin-top: 20px;
    }

    .affiliate-settings {
        margin-top: 10px;
    }

    .affiliate-input-container {
        display: flex;
        justify-content: space-between;
        gap: 10px;
    }

    .affiliate-input {
        flex: 1;
    }

    .affiliate-input label {
        display: block;
        margin-bottom: 5px;
    }

    .affiliate-input input {
        width: 100%;
    }

    .settings-modal {
      position: absolute;
      top: 40px;
      right: 0;
      background-color: #2e2e2e;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 20px;
      z-index: 1001;
      width: 300px;
      color: #ffffff;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #444;
    }

    .settings-header h3 {
      margin: 0;
    }

    .toggle-all-btn {
      background-color: #3c3c3c;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.9em;
      border: 1px solid #555;
    }

    .toggle-all-btn:hover {
      background-color: #444;
    }

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #3a3a3c;
    }

    .setting-item:last-child {
      border-bottom: none;
    }

    .setting-item input[type="checkbox"] {
      width: auto;
      margin: 0;
    }

    .amount-input-container {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }

    .amount-input-wrapper {
      position: relative;
      flex: 1;
      display: flex;
    }

    .usd-value {
      color: #888;
      font-size: 0.9em;
      white-space: nowrap;
    }

    .input-with-usd {
      width: 100%;
      padding-right: 100px;
      -moz-appearance: textfield;
    }

    .input-with-usd::-webkit-outer-spin-button,
    .input-with-usd::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .usd-overlay {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #888;
      font-size: 0.9em;
      pointer-events: none;
      background: transparent;
      padding: 0;
      margin: 0;
      border: none;
    }
</style>
    
      
    <div class="app-container">
        <div class="settings-icon" on:click={toggleSettings}>
            <Settings />
        </div>

        {#if showSettings}
            <div class="settings-modal" transition:slide>
                <div class="settings-header">
                    <h3>Settings</h3>
                    <button class="toggle-all-btn" on:click={handleToggleAll}>
                        {toggleAll ? 'Disable All' : 'Enable All'}
                    </button>
                </div>
                
                <div class="setting-item">
                    <span>Show Estimated Time</span>
                    <input type="checkbox" bind:checked={showEstimatedTime}>
                </div>
                <div class="setting-item">
                    <span>Show Affiliate</span>
                    <input type="checkbox" bind:checked={enableAffiliateSettings}>
                </div>
                <div class="setting-item">
                    <span>Show Fee Breakdown</span>
                    <input type="checkbox" bind:checked={showFeeBreakdown}>
                </div>
                <div class="setting-item">
                    <span>Show Inbound Delay</span>
                    <input type="checkbox" bind:checked={showInboundDelay}>
                </div>
                <div class="setting-item">
                    <span>Show Outbound Delay</span>
                    <input type="checkbox" bind:checked={showOutboundDelay}>
                </div>
                <div class="setting-item">
                    <span>Show Streaming Details</span>
                    <input type="checkbox" bind:checked={showStreamingDetails}>
                </div>
                <div class="setting-item">
                    <span>Show Height Field</span>
                    <input type="checkbox" bind:checked={showHeightField}>
                </div>
            </div>
        {/if}

        <div class="swap-container">
          
          <div style="display: flex; align-items: center; justify-content: center; margin-bottom:10px; ">
            <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo" style="margin-right: 15px;">
            <div style="text-align: center; font-size: 20px; font-weight: 600; text-shadow: 2px 2px 4px #000000; color: #f8f8f8; font-family: 'Exo 2', sans-serif;">
              <b>THORChain Quote Estimator</b>
            </div>    
          </div>
          
          
          <div style="height: 1px; background-color: #3a3a3c"></div>
          <div style="height: 10px"></div>
          
          
          <div class="asset-selection">
            <div class="asset-label-container">
              <label class="asset-label" for="from_asset">From:</label>
              <label class="asset-label" for="to_asset">To:</label>
            </div>
        
            <!-- asset selection container -->
            <div class="asset-select-container">
              <AssetDropdown
                  bind:selectedAsset={from_asset}
                  {assets}
                  {assetNames}
                  {assetLogos}
                  label="From"
                  on:select={({detail}) => {
                      if (detail.asset === to_asset) {
                          to_asset = from_asset;
                      }
                  }}
              />
          
              <AssetDropdown
                  bind:selectedAsset={to_asset}
                  {assets}
                  {assetNames}
                  {assetLogos}
                  label="To" 
                  on:select={({detail}) => {
                      if (detail.asset === from_asset) {
                          from_asset = to_asset;
                      }
                  }}
              />
            </div>
      
            <div>&nbsp;</div>
        
            <!-- swap amount input and display -->
            <div class="expand" in:slide={{ duration: 1000 }} out:slide={{ duration: 333 }}>
              <label>Swap Amount ({from_asset.split('.')[1].split('-')[0]}):</label>
              <div class="amount-input-container">
                <div class="amount-input-wrapper">
                  <input 
                    type="number" 
                    class="input-with-usd" 
                    bind:value={amount} 
                    use:handleFocus 
                    placeholder="Enter amount"
                  />
                  {#if estimatedValueUSD}
                    <span class="usd-overlay">{estimatedValueUSD}</span>
                  {/if}
                </div>
              </div>
            </div>

            {#if showHeightField}
                <div class="expand" in:slide={{ duration: 500 }} out:slide={{ duration: 500 }}>
                    <label>Block Height:</label>
                    <input 
                        type="number" 
                        style="width: 50%;" 
                        bind:value={height} 
                        placeholder="Optional block height"
                    />
                </div>
            {/if}

            {#if enableAffiliateSettings}
                <div class="expand affiliate-settings" in:slide={{ duration: 500 }} out:slide={{ duration: 500 }}>
                    <div class="affiliate-input-container">
                        <div class="affiliate-input">
                            <label for="affiliate">Affiliate Address:</label>
                            <input type="text" id="affiliate" bind:value={affiliateAddress} placeholder="Enter affiliate address" />
                        </div>
                        <div class="affiliate-input">
                            <label for="affiliateFee">Affiliate Fee (bps):</label>
                            <input type="number" id="affiliateFee" bind:value={affiliateFeeBps} placeholder="Enter fee in bps" />
                        </div>
                    </div>
                </div>
            {/if}

            <!-- estimate swap button -->
            <button  on:click={fetchQuote}>
              Get Quote
              {#if isLoading}
                <span class="loader"></span>
              {/if}
            </button>
        
            <!-- swap result -->
            {#if expectedAmountOutStreaming}
              <div class="expand" in:slide={{ duration: 1000 }} out:slide={{ duration: 1000 }}>
              
                {#if showLogos}
              <!--Streaming Swap-->
              <div>
                <div style="display: flex; justify-content: center; align-items: center; margin: 10px 0;"> <b>THORChain Streaming Swap</b> </div>
                <div style="display: flex; justify-content: center; align-items: center; margin: 10px 0;">
                  <img class="asset-logo" src="{assetLogos[from_asset]}" alt="From Asset Logo" />
                  <span class="green-text-bold">{amount} {from_asset.split('.')[1].split('-')[0]}</span>
                  <span style="font-size: 20px; margin: 0 10px;">→</span>
                  <img class="asset-logo" src="{assetLogos[to_asset]}" alt="To Asset Logo" />
                  <span class="green-text-bold">{expectedAmountOutStreaming.toFixed(4)} {to_asset.split('.')[1].split('-')[0]}</span>
                </div>
                {#if showEstimatedTime}
                  <div class="result-content" style="display: flex; justify-content: center; align-items: center; margin: 10px 0;">Estimated Time: {streaming_total_swap_seconds}</div>          
                {/if}

                {#if showFeeBreakdown}
                  <div class="fee-breakdown">
                    <div class="fee-item">
                      <span>Outbound Fee:</span>
                      <span>{outboundFee.toFixed(8)} {feeAsset} (${Math.floor(outboundFeeUSD)})</span>
                    </div>
                    <div class="fee-item">
                      <span>Liquidity Fee:</span>
                      <span>{liquidityFee.toFixed(8)} {feeAsset} (${Math.floor(liquidityFeeUSD)})</span>
                    </div>
                    <div class="fee-item">
                      <span>Total Fee:</span>
                      <span>{totalFee.toFixed(8)} {feeAsset} (${Math.floor(totalFeeUSD)})</span>
                    </div>
                    <div class="fee-item">
                      <span>Total Fee:</span>
                      <span>{(totalFeeBps / 100).toFixed(1)}%</span>
                    </div>
                  </div>
                {/if}

                {#if enableAffiliateSettings && affiliateEarningsUSD > 0}
                    <div class="result-content" style="display: flex; justify-content: center; align-items: center; margin: 10px 0;">
                        Affiliate Earnings: ${affiliateEarningsUSD.toFixed(2)}
                    </div>
                {/if}

                {#if showInboundDelay}
                  <div class="delay-info">
                    <div class="delay-item">
                      <span>Inbound Confirmation Blocks:</span>
                      <span>{inboundConfirmationBlocks}</span>
                    </div>
                    <div class="delay-item">
                      <span>Inbound Confirmation Time:</span>
                      <span>{formatTime(inboundConfirmationSeconds)}</span>
                    </div>
                  </div>
                {/if}

                {#if showOutboundDelay}
                  <div class="delay-info">
                    <div class="delay-item">
                      <span>Outbound Delay Blocks:</span>
                      <span>{outboundDelayBlocks}</span>
                    </div>
                    <div class="delay-item">
                      <span>Outbound Delay Time:</span>
                      <span>{formatTime(outboundDelaySeconds)}</span>
                    </div>
                  </div>
                {/if}

                {#if showStreamingDetails}
                  <div class="streaming-details">
                    <div class="streaming-item">
                      <span>Max Streaming Quantity:</span>
                      <span>{maxStreamingQuantity}</span>
                    </div>
                    <div class="streaming-item">
                      <span>Streaming Swap Blocks:</span>
                      <span>{streamingSwapBlocks}</span>
                    </div>
                    <div class="streaming-item">
                      <span>Streaming Swap Time:</span>
                      <span>{formatTime(streamingSwapSeconds)}</span>
                    </div>
                  </div>
                {/if}
              </div>
              <!--End Streaming Swap-->
        
                {/if}
              </div>
            {/if}
          </div>
        </div>
    </div>