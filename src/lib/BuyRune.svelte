<svelte:head>
  <title>Buy RUNE | Purchase THORChain RUNE with ETH or Stablecoins</title>
  <meta name="description" content="Buy THORChain RUNE directly with Ethereum (ETH), USDC, or USDT using MetaMask or any Web3 wallet. The easiest way to purchase RUNE on THORChain." />
  <meta name="keywords" content="Buy RUNE, Buy THORChain, Buy RUNE with MetaMask, Buy RUNE with Ethereum, Where to buy THORChain, THORChain RUNE, Purchase RUNE, RUNE token, Buy crypto with MetaMask" />
  
  <!-- Open Graph / Social Media Meta Tags -->
  <meta property="og:title" content="Buy RUNE | Purchase THORChain RUNE with ETH or Stablecoins" />
  <meta property="og:description" content="Buy THORChain RUNE directly with Ethereum (ETH), USDC, or USDT using MetaMask or any Web3 wallet." />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card data -->
  <meta name="twitter:title" content="Buy RUNE with ETH or Stablecoins" />
  <meta name="twitter:description" content="Buy THORChain RUNE directly with Ethereum (ETH), USDC, or USDT using MetaMask." />
</svelte:head>

<script>
  import { onMount, onDestroy } from 'svelte';
  import { ethers } from 'ethers';
  import { fade } from 'svelte/transition';
  
  let account = '';
  let selectedAsset = 'ETH';
  let inputAmount = '';
  let runeAddress = '';
  let isWalletConnected = false;
  let balances = {
    ETH: '0',
    USDC: '0',
    USDT: '0'
  };

  // ERC20 minimal ABI for balanceOf
  const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];

  const supportedAssets = [
    { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'USDT', name: 'Tether', decimals: 6 }
  ];

  // Update the TOKEN_ADDRESSES constant with correct checksum addresses
  const TOKEN_ADDRESSES = {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523A2206206994597C13D831ec7'  // Fixed checksum
  };

  // Add Router ABI
  const ROUTER_ABI = [
    'function depositWithExpiry(address vault, address asset, uint amount, string memory memo, uint256 expiry) payable',
  ];

  // Add Router address (we'll need the actual address)
  let routerAddress = '';
  let vaultAddress = '';
  let isLoading = false;
  
  // Memo configuration
  const MEMO_CONFIG = {
    ASSET: 'THOR.RUNE',
    LIM: '0',           
    INTERVAL: '1',      
    QUANTITY: '0',      
    AFFILIATE: '-',     
    FEE: '20'
  };

  function constructMemo(destAddr) {
    return `=:${MEMO_CONFIG.ASSET}:${destAddr}:${MEMO_CONFIG.LIM}/${MEMO_CONFIG.INTERVAL}/${MEMO_CONFIG.QUANTITY}:${MEMO_CONFIG.AFFILIATE}:${MEMO_CONFIG.FEE}`;
  }

  async function fetchThorchainAddresses() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/inbound_addresses');
      const data = await response.json();
      const ethChain = data.find(chain => chain.chain === 'ETH');
      
      if (!ethChain) {
        throw new Error('ETH chain info not found');
      }

      if (ethChain.halted || ethChain.global_trading_paused || ethChain.chain_trading_paused) {
        throw new Error('Trading is currently paused or halted');
      }

      vaultAddress = ethChain.address;
      routerAddress = ethChain.router;
    } catch (error) {
      console.error('Error fetching THORChain addresses:', error);
      throw error;
    }
  }

  let assetPrices = {
    ETH: 0,
    USDC: 0,
    USDT: 0
  };

  async function fetchPoolPrices() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      const pools = await response.json();
      
      const ethPool = pools.find(p => p.asset === 'ETH.ETH');
      const usdcPool = pools.find(p => p.asset === 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48');
      const usdtPool = pools.find(p => p.asset === 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7');

      assetPrices = {
        ETH: ethPool.asset_tor_price / 1e8,
        USDC: usdcPool.asset_tor_price / 1e8,
        USDT: usdtPool.asset_tor_price / 1e8
      };
    } catch (error) {
      console.error('Error fetching pool prices:', error);
    }
  }

  onMount(async () => {
    try {
      isLoading = true;
      await Promise.all([
        fetchThorchainAddresses(),
        fetchPoolPrices()
      ]);
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      isLoading = false;
    }
  });

  function getChecksumAddress(address) {
    try {
      // First convert to lowercase to normalize
      const normalizedAddress = address.toLowerCase();
      // Then get proper checksum
      return ethers.getAddress(normalizedAddress);
    } catch (error) {
      console.error('Invalid address format:', error);
      throw error; // Throw error instead of returning invalid address
    }
  }

  async function getBalance(asset) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      if (asset === 'ETH') {
        const balance = await provider.getBalance(account);
        return ethers.formatEther(balance);
      } else {
        const tokenAddress = getChecksumAddress(TOKEN_ADDRESSES[asset]);
        const contract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          provider
        );
        const balance = await contract.balanceOf(getChecksumAddress(account));
        const decimals = supportedAssets.find(a => a.symbol === asset).decimals;
        return ethers.formatUnits(balance, decimals);
      }
    } catch (error) {
      console.error(`Error fetching ${asset} balance:`, error);
      return '0';
    }
  }

  async function updateAllBalances() {
    if (!isWalletConnected) return;
    
    for (const asset of supportedAssets) {
      balances[asset.symbol] = await getBalance(asset.symbol);
    }
    balances = { ...balances }; // Trigger reactivity
  }

  async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Remove any existing listeners first to prevent duplicates
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        account = accounts[0];
        isWalletConnected = true;
        await updateAllBalances();

        // Add account change listener
        window.ethereum.on('accountsChanged', handleAccountsChanged);
      } catch (error) {
        console.error('User denied account access:', error);
        isWalletConnected = false;
      }
    } else {
      alert('Please install MetaMask or another Web3 wallet');
    }
  }

  // Separate handler for account changes
  async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // User disconnected their wallet
      account = '';
      isWalletConnected = false;
    } else {
      account = accounts[0];
      await updateAllBalances();
    }
  }

  // Add cleanup on component destruction
  onDestroy(() => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  });

  function handleAmountInput(event) {
    const value = event.target.value;
    
    // Only allow numbers and one decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      inputAmount = value;
    } else {
      // Revert to previous valid value
      event.target.value = inputAmount;
    }
  }

  function getNumericAmount() {
    return parseFloat(inputAmount) || 0;
  }

  // Update the APPROVAL_ABI to include allowance function
  const APPROVAL_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];

  // Add a helper function to ensure addresses are always checksummed correctly
  function ensureChecksumAddress(address) {
    try {
      return ethers.getAddress(address.toLowerCase());
    } catch (error) {
      console.error('Invalid address format:', error);
      throw error;
    }
  }

  // Update the approveToken function to remove unnecessary alerts
  async function approveToken(tokenAddress, amount) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const checksummedAddress = ensureChecksumAddress(tokenAddress);
      const checksummedRouter = ensureChecksumAddress(routerAddress);
      
      const tokenContract = new ethers.Contract(
        checksummedAddress,
        APPROVAL_ABI,
        signer
      );

      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Approve maximum amount
      const maxAmount = ethers.MaxUint256;
      
      console.log('Sending approval transaction:', {
        token: checksummedAddress,
        spender: checksummedRouter,
        amount: maxAmount.toString()
      });

      // Send approval transaction
      let tx;
      try {
        tx = await tokenContract.approve(checksummedRouter, maxAmount);
        console.log('Approval transaction sent:', tx.hash);
      } catch (error) {
        // Check if we still got transaction info despite the error
        if (error.transaction || (error.value && error.value.hash)) {
          tx = error.transaction || error.value;
          console.warn('Approval warning, but continuing:', error);
        } else {
          throw error;
        }
      }

      if (!tx || !tx.hash) {
        throw new Error('Failed to get approval transaction hash');
      }

      // Wait for confirmation
      try {
        const receipt = await tx.wait();
        console.log('Approval confirmed:', receipt);
      } catch (error) {
        // Ignore receipt fetching errors
        console.warn('Approval receipt warning:', error);
      }

      // Verify the new allowance
      const newAllowance = await tokenContract.allowance(account, checksummedRouter);
      console.log('New allowance:', newAllowance.toString());

      return true;
    } catch (error) {
      console.error('Approval failed:', error);
      if (error.code === 'ACTION_REJECTED') {
        // Only alert if user explicitly rejected
        alert('Token approval was rejected');
        return false;
      }
      // Don't alert for other errors, just return false
      return false;
    }
  }

  // Update the checkAllowance function
  async function checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContract = new ethers.Contract(
        tokenAddress,
        APPROVAL_ABI,
        provider
      );
      
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
      console.log('Current allowance:', allowance.toString());
      return allowance;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return ethers.parseUnits('0', 0);
    }
  }

  // Add new state variables
  let showReviewModal = false;
  let estimatedOutput = '0';
  let estimatedFee = '0';
  let slippage = '1'; // 1% default slippage

  // Add function to estimate RUNE output
  async function estimateRuneOutput() {
    try {
      const amount = parseFloat(inputAmount);
      const assetPrice = assetPrices[selectedAsset];
      const inboundFee = 0.02; // 2% inbound fee
      const amountAfterFee = amount * (1 - inboundFee);
      const runePrice = assetPrice / 1.002; // Approximate RUNE price (accounting for slip)
      estimatedOutput = (amountAfterFee * assetPrice / runePrice).toFixed(2);
      estimatedFee = (amount * inboundFee * assetPrice).toFixed(2);
    } catch (error) {
      console.error('Error estimating output:', error);
    }
  }

  // Add these new imports and variables
  let expectedAmountOut = '0';
  let outboundFee = 0;
  let liquidityFee = 0;
  let totalFee = 0;
  let totalFeeBps = 0;
  let feeAsset = '';

  // Add function to fetch quote from THORChain
  async function fetchQuote() {
    try {
      const amountToSend = getNumericAmount() * 1e8;
      const url = `https://thornode.ninerealms.com/thorchain/quote/swap?amount=${amountToSend}&from_asset=${getFullAssetString(selectedAsset)}&to_asset=THOR.RUNE&destination=${runeAddress}&affiliate=${MEMO_CONFIG.AFFILIATE}&affiliate_bps=${MEMO_CONFIG.FEE}`;
      
      const response = await fetch(url);
      const result = await response.json();

      // Check for explicit error
      if (result.error) {
        alert(`THORChain Error: ${result.error}`);
        return false;
      }

      // Validate expected output
      if (!result.expected_amount_out || result.expected_amount_out <= 0) {
        alert('Invalid quote: Expected output amount is zero or missing');
        return false;
      }

      // Validate fees exist and are reasonable
      if (!result.fees) {
        alert('Invalid quote: Fee information is missing');
        return false;
      }

      expectedAmountOut = result.expected_amount_out / 1e8;
      
      // Extract fee information
      outboundFee = result.fees.outbound / 1e8;
      liquidityFee = result.fees.liquidity / 1e8;
      totalFee = result.fees.total / 1e8;
      totalFeeBps = result.fees.total_bps;
      feeAsset = result.fees.asset.split('.')[1];

      // Additional validation for reasonable output
      const inputValue = parseFloat(inputAmount);
      const outputValue = expectedAmountOut;
      

      return true;
    } catch (error) {
      console.error('Error fetching quote:', error);
      alert(`Failed to fetch quote: ${error.message}`);
      return false;
    }
  }

  // Helper function to get full asset string
  function getFullAssetString(symbol) {
    const assetMap = {
      'ETH': 'ETH.ETH',
      'USDC': 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
      'USDT': 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7'
    };
    return assetMap[symbol];
  }

  // Add this validation function
  function isValidRuneAddress(address) {
    return address.toLowerCase().startsWith('thor');
  }

  // Update the handleSubmit function
  async function handleSubmit() {
    if (!isWalletConnected || !inputAmount || !runeAddress || !vaultAddress || !routerAddress) return;
    
    // Validate RUNE address
    if (!isValidRuneAddress(runeAddress)) {
      alert(`Invalid RUNE address. Address must start with 'thor'.\n\nNeed a RUNE wallet? Create one securely with Vultisig`);
      window.open('https://t.me/vultirefbot/app?startapp=ref_3a5c3bba-9c5f-47ed-a2fc-6f659476404a', '_blank');
      return;
    }
    
    isLoading = true;
    const quoteSuccess = await fetchQuote();
    isLoading = false;

    if (quoteSuccess) {
      showReviewModal = true;
    }
  }

  // Add these constants
  const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  // Add this helper function to verify addresses
  async function verifyThorchainAddresses() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/inbound_addresses');
      const data = await response.json();
      const ethChain = data.find(chain => chain.chain === 'ETH');
      
      if (!ethChain) {
        throw new Error('ETH chain info not found');
      }

      if (ethChain.halted || ethChain.global_trading_paused || ethChain.chain_trading_paused) {
        throw new Error('Trading is currently paused or halted');
      }

      // Add debug logging
      console.log('Address Verification:', {
        stored: {
          vault: vaultAddress,
          router: routerAddress
        },
        current: {
          vault: ethChain.address,
          router: ethChain.router
        }
      });

      // Check for case-sensitivity issues
      const isValid = ethChain.address.toLowerCase() === vaultAddress.toLowerCase() && 
                     ethChain.router.toLowerCase() === routerAddress.toLowerCase();

      return {
        isValid,
        newVault: ethChain.address,
        newRouter: ethChain.router
      };
    } catch (error) {
      console.error('Error verifying THORChain addresses:', error);
      throw error;
    }
  }

  // Update the executeTransaction function to handle approval more gracefully
  async function executeTransaction() {
    if (!isWalletConnected || !inputAmount || !runeAddress || !vaultAddress || !routerAddress) return;
    
    try {
      isLoading = true;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const asset = supportedAssets.find(a => a.symbol === selectedAsset);
      const amount = ethers.parseUnits(inputAmount, asset.decimals);
      
      // Handle ERC20 tokens (USDC & USDT)
      if (selectedAsset !== 'ETH') {
        const tokenAddress = TOKEN_ADDRESSES[selectedAsset];
        const currentAllowance = await checkAllowance(tokenAddress, account, routerAddress);
        
        if (currentAllowance < amount) {
          const approved = await approveToken(tokenAddress, amount);
          if (!approved) {
            // Only return if approval was explicitly rejected
            if (error?.code === 'ACTION_REJECTED') {
              return;
            }
            // Otherwise continue with the transaction
          }
        }
      }

      // Construct the router contract
      const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
      
      // Prepare transaction parameters
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const memo = constructMemo(runeAddress);
      
      // Prepare base transaction options
      let txOptions = {};
      
      // Add value only for ETH transactions
      if (selectedAsset === 'ETH') {
        txOptions = { value: amount };
      }

      // Estimate gas
      try {
        const estimatedGas = await router.depositWithExpiry.estimateGas(
          vaultAddress,
          selectedAsset === 'ETH' ? ETH_ADDRESS : TOKEN_ADDRESSES[selectedAsset],
          amount,
          memo,
          expiry,
          txOptions
        );
        
        // Calculate gas limit with 2% buffer
        const gasBuffer = estimatedGas * BigInt(2) / BigInt(100);
        const finalGasLimit = estimatedGas + gasBuffer;
        txOptions.gasLimit = finalGasLimit;

      } catch (error) {
        console.warn('Gas estimation failed:', error);
        txOptions.gasLimit = BigInt(210000);
      }

      // Send transaction
      let txResponse;
      try {
        txResponse = await router.depositWithExpiry(
          vaultAddress,
          selectedAsset === 'ETH' ? ETH_ADDRESS : TOKEN_ADDRESSES[selectedAsset],
          amount,
          memo,
          expiry,
          txOptions
        );
      } catch (error) {
        // Check if the error contains transaction data
        if (error.transaction || (error.value && error.value.hash)) {
          txResponse = error.transaction || error.value;
          console.warn('Transaction warning, but continuing:', error);
        } else if (error.code === 'ACTION_REJECTED') {
          throw error;
        } else {
          console.error('Transaction error:', error);
          return; // Exit without showing confirmation
        }
      }

      // If we have a transaction response, redirect to tracker
      if (txResponse && (txResponse.hash || txResponse.transactionHash)) {
        const txHash = txResponse.hash || txResponse.transactionHash;
        console.log('Transaction sent:', txHash);
        showReviewModal = false;
        
        // Open tracker in new tab
        window.open(`https://track.ninerealms.com/${txHash}`, '_blank');
      }

    } catch (error) {
      console.error('Transaction error:', error);
      if (error.code === 'ACTION_REJECTED') {
        alert('Transaction was rejected by user');
      } else if (!error.message?.includes('message channel closed')) {
        alert(`Transaction failed: ${error.message}`);
      }
    } finally {
      isLoading = false;
    }
  }

  function getAssetLogo(symbol) {
    const logoMap = {
      'ETH': 'ethereum-eth-logo.svg',
      'USDC': 'usd-coin-usdc-logo.svg',
      'USDT': 'tether-usdt-logo.svg'
    };
    return logoMap[symbol];
  }

  function formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Add this helper function to format the address
  function formatAddress(address) {
    if (!address || address.length < 8) return address;
    const lastFour = address.slice(-4);
    if (address.length <= 12) return address;
    return `${address.slice(0, 8)}...${lastFour}`;
  }

  // Add third disclaimer state
  let disclaimer1 = false;
  let disclaimer2 = false;
  let disclaimer3 = false;

  // Add this state variable
  let showWalletHelper = false;
</script>

<div class="bond-tracker-wrapper">
  <div class="container">
    <div class="card-header">
      <h2>Buy RUNE</h2>
    </div>
    
    <div class="card-body">
      <div class="wallet-section" in:fade={{ duration: 200 }}>
        {#if !isWalletConnected}
          <button 
            class="btn btn-primary connect-button"
            on:click={connectWallet}
          >
            Connect Wallet
          </button>
        {:else}
          <div class="connected-account">
            <div class="wallet-status">
              <div class="wallet-indicator"></div>
              <span class="wallet-label">Wallet Connected</span>
              <span class="address">{formatAddress(account)}</span>
            </div>
          </div>
        {/if}
      </div>

      {#if isWalletConnected}
        <div class="form-group">
          <label>
            Select Asset
            <div class="asset-grid">
              {#each supportedAssets as asset}
                <button 
                  class="asset-button" 
                  class:selected={selectedAsset === asset.symbol}
                  on:click={() => selectedAsset = asset.symbol}
                >
                  <img 
                    src="/assets/coins/{getAssetLogo(asset.symbol)}" 
                    alt={asset.name}
                    class="asset-logo"
                  />
                  <div class="asset-info">
                    <span class="asset-symbol">{asset.symbol}</span>
                    {#if isWalletConnected}
                      <div class="balance-info" in:fade={{ duration: 200 }}>
                        <span class="asset-balance">
                          {parseFloat(balances[asset.symbol]).toFixed(6)}
                        </span>
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </label>

          <div class="input-row">
            <span class="input-label">{selectedAsset} Amount</span>
            <div class="input-container">
              <input 
                type="text"
                class="form-control"
                placeholder="Enter {selectedAsset} amount"
                bind:value={inputAmount}
                on:input={handleAmountInput}
              />
            </div>
          </div>

          <div class="input-row">
            <span class="input-label">
              RUNE Address
              <button 
                class="info-button" 
                on:click={() => showWalletHelper = !showWalletHelper}
                title="Toggle wallet info"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </button>
            </span>
            <div class="input-container">
              <input 
                type="text" 
                bind:value={runeAddress} 
                placeholder="Enter RUNE address"
                class="form-control"
              />
              {#if showWalletHelper}
                <div class="input-helper" transition:fade={{ duration: 200 }}>
                  Your THORChain address. Starts with "thor..." Need a RUNE wallet? 
                  <a 
                    href="https://t.me/vultirefbot/app?startapp=ref_3a5c3bba-9c5f-47ed-a2fc-6f659476404a" 
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Create one with Vultisig
                  </a>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="connect-prompt">
          <p>Connect your wallet to buy RUNE with ETH or stablecoins</p>
        </div>
      {/if}

      <div class="submit-container" in:fade={{ duration: 200 }}>
        {#if isWalletConnected}
          <button 
            class="btn btn-primary"
            on:click={handleSubmit}
            disabled={!inputAmount || !runeAddress}
            in:fade={{ duration: 200 }}
          >
            Review Transaction
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

{#if showReviewModal}
  <div class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3>Review Transaction</h3>
        <button class="close-button" on:click={() => showReviewModal = false}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      <div class="review-details">
        <div class="review-row">
          <span>You Pay</span>
          <div class="asset-amount">
            <img 
              src="/assets/coins/{getAssetLogo(selectedAsset)}" 
              alt={selectedAsset}
              class="review-asset-logo"
            />
            <span>{inputAmount} {selectedAsset}</span>
          </div>
        </div>

        <div class="review-row highlight">
          <span>You Receive</span>
          <div class="asset-amount">
            <img 
              src="/assets/coins/RUNE-ICON.svg" 
              alt="RUNE"
              class="review-asset-logo"
            />
            <span>≈ {expectedAmountOut.toFixed(6)} RUNE</span>
          </div>
        </div>

        <div class="review-row">
          <span>Destination</span>
          <div class="address-container">
            <span class="address">{formatAddress(runeAddress)}</span>
            <a 
              href={`https://runescan.io/address/${runeAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              class="verify-link"
              title="View on Runescan"
            >
              <svg class="external-link-icon" viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div class="disclaimers">
        <label class="disclaimer-item">
          <input type="checkbox" bind:checked={disclaimer1} />
          <span>I understand THORChain is providing this swap service, not RUNE Tools.</span>
        </label>

        <label class="disclaimer-item">
          <input type="checkbox" bind:checked={disclaimer2} />
          <span>RUNE Tools is not responsible for any potential loss of funds.</span>
        </label>

        <label class="disclaimer-item">
          <input type="checkbox" bind:checked={disclaimer3} />
          <span>I confirm that the destination address is correct.</span>
        </label>
      </div>

      <div class="modal-actions">
        <button 
          class="btn btn-primary"
          on:click={executeTransaction}
          disabled={!disclaimer1 || !disclaimer2 || !disclaimer3}
        >
          {#if isLoading}
            Processing...
          {:else}
            Confirm Swap
          {/if}
        </button>
        <button 
          class="btn btn-secondary"
          on:click={() => showReviewModal = false}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bond-tracker-wrapper {
    position: relative;
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
  }

  .container {
    background-color: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .card-header {
    background-color: #2c2c2c;
    padding: 20px;
  }

  .card-header h2 {
    margin: 0;
    text-align: center;
    color: #4A90E2;
    font-size: 22px;
    font-weight: 600;
  }

  .card-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    margin-top: 0;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: #e0e0e0;
    font-weight: 500;
  }

  .form-control {
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #4A90E2;
    background-color: #2c2c2c;
    color: #e0e0e0;
    font-size: 16px;
    width: 100%;
  }

  .form-control:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .select-wrapper {
    position: relative;
  }

  .select-wrapper::after {
    content: '▼';
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #a9a9a9;
  }

  .btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    font-weight: 600;
    transition: background-color 0.3s, transform 0.1s;
  }

  .btn-primary {
    background-color: #4A90E2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #3A7BC8;
    transform: translateY(-2px);
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .connected-account {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .connected-account .label {
    font-weight: 500;
    color: #a9a9a9;
  }

  .connected-account .address {
    word-break: break-all;
    font-family: monospace;
    color: #e0e0e0;
  }

  .balance {
    font-size: 0.9rem;
    color: #a9a9a9;
    margin-top: 0.25rem;
  }

  .asset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .asset-button {
    background: #2c2c2c;
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: auto;
  }

  .asset-button:hover {
    background: #363636;
  }

  .asset-button.selected {
    border-color: #4A90E2;
    background: #363636;
  }

  .asset-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.1));
  }

  .asset-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
    min-height: auto;
  }

  .asset-symbol {
    color: #e0e0e0;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .balance-info {
    margin-top: 0.25rem;
  }

  .asset-value {
    color: #4A90E2;
    font-size: 0.8rem;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .card-body {
      padding: 15px;
    }

    .form-control {
      padding: 10px;
      font-size: 14px;
    }

    .btn {
      padding: 12px;
      font-size: 16px;
    }

    .asset-grid {
      gap: 0.5rem;
    }

    .asset-button {
      min-height: 100px;
      padding: 0.75rem;
    }

    .asset-logo {
      width: 24px;
      height: 24px;
    }

    .asset-symbol {
      font-size: 0.8rem;
    }

    .asset-balance {
      font-size: 0.7rem;
    }

    .asset-value {
      font-size: 0.7rem;
    }
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 1.5rem;
    width: 95%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .modal h3 {
    color: #4A90E2;
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .review-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .review-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #e0e0e0;
    font-size: 0.9rem;
  }

  .review-row.highlight {
    background: #2c2c2c;
    margin: 1.5rem -1.5rem;
    padding: 1rem 1.5rem;
    color: #4A90E2;
    font-weight: 600;
    font-size: 1.1rem;
  }

  .review-row .address {
    font-family: monospace;
    font-size: 0.9rem;
    color: #e0e0e0;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .modal-actions .btn {
    width: auto;
    min-width: 120px;
    padding: 12px 24px;
  }

  .btn-primary {
    background-color: #4A90E2;
    color: white;
  }

  .btn-primary:disabled {
    background-color: #2c2c2c;
    transform: none;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #2c2c2c;
    color: #e0e0e0;
  }

  .review-asset-logo {
    width: 20px;
    height: 20px;
    margin-right: 8px;
  }

  .asset-amount {
    display: flex;
    align-items: center;
  }

  .review-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .review-row.highlight {
    background: rgba(74, 144, 226, 0.1);
    margin: 8px -1.5rem;
    padding: 12px 1.5rem;
    border-top: 1px solid #2c2c2c;
    border-bottom: 1px solid #2c2c2c;
  }

  .disclaimers {
    margin: 1.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
  }

  .disclaimer-item {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 0.75rem;
    color: #e0e0e0;
    font-size: 0.85rem;
    line-height: 1.4;
    cursor: pointer;
  }

  .disclaimer-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    align-self: start;
    margin-top: 2px;
  }

  .disclaimer-item span {
    display: block;
    padding-top: 1px;
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .verify-link {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4A90E2;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(74, 144, 226, 0.1);
    transition: background-color 0.2s;
  }

  .verify-link:hover {
    background: rgba(74, 144, 226, 0.2);
  }

  .external-link-icon {
    opacity: 0.8;
  }

  .modal-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .close-button {
    position: absolute;
    right: -0.5rem;
    top: -0.5rem;
    background: none;
    border: none;
    color: #a9a9a9;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-button:hover {
    color: #e0e0e0;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .modal-actions .btn {
    width: auto;
    min-width: 120px;
    padding: 12px 24px;
  }

  .btn-primary {
    background-color: #4A90E2;
    color: white;
  }

  .btn-primary:disabled {
    background-color: #2c2c2c;
    transform: none;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #2c2c2c;
    color: #e0e0e0;
  }

  /* Add back the asset-balance style */
  .asset-balance {
    color: #e0e0e0;
    font-size: 0.9rem;
    font-family: monospace;
  }

  .balance-info {
    margin-top: 0.25rem;
  }

  /* Add these new styles */
  .tx-confirmation-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem 0;
  }

  .tx-status-container {
    background: #2c2c2c;
    padding: 1.5rem;
    border-radius: 8px;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tx-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .status-label {
    color: #a9a9a9;
  }

  .status-value {
    color: #4A90E2;
    font-weight: 500;
  }

  .tx-links {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tx-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #31FD9D;
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.5rem;
    border-radius: 4px;
    background: rgba(49, 253, 157, 0.1);
    transition: all 0.2s ease;
  }

  .tx-link:hover {
    background: rgba(49, 253, 157, 0.15);
    transform: translateX(4px);
  }

  /* Add these styles */
  .tracker-viewport {
    width: 100%;
    height: 800px;
    margin: 1rem 0;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .tracker-viewport iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
  }

  /* Update tx-status-container to accommodate iframe */
  .tx-status-container {
    background: #2c2c2c;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Update modal styles for better sizing */
  .modal {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 1.5rem;
    width: 95%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  /* Update tracker viewport size */
  .tracker-viewport {
    width: 100%;
    height: 600px;
    margin: 1rem 0;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .tracker-viewport iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
  }

  /* Update layout of transaction details */
  .tx-confirmation-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem 0;
  }

  .tx-status-container {
    background: #2c2c2c;
    padding: 1.5rem;
    border-radius: 8px;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Make the modal header more compact */
  .modal-header {
    margin-bottom: 1rem;
  }

  .modal-header h3 {
    font-size: 1.25rem;
    margin: 0;
  }

  /* Adjust spacing for transaction details */
  .review-row {
    padding: 0.5rem 0;
  }

  /* Make the close button more accessible */
  .modal-actions {
    margin-top: 1rem;
  }

  .modal-actions .btn {
    width: auto;
    min-width: 120px;
  }

  /* Add responsive adjustments */
  @media (max-width: 768px) {
    .modal {
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      margin: 0;
      padding: 1rem;
    }

    .tracker-viewport {
      height: 500px;
    }
  }

  /* Add these styles */
  .connect-prompt {
    color: #a9a9a9;
    text-align: center;
    padding: 0.75rem;
    font-size: 0.95rem;
  }

  .connected-account {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    font-size: 0.95rem;
  }

  .connected-account .label {
    color: #a9a9a9;
  }

  .connected-account .address {
    color: #e0e0e0;
    font-family: monospace;
  }

  /* Add these new styles */
  .wallet-section {
    padding: 0.5rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .connect-button {
    min-width: 180px;
    padding: 10px 20px;
    font-size: 1rem;
  }

  .connected-account {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    background: rgba(74, 144, 226, 0.08);
    border-radius: 12px;
    border: 1px solid rgba(74, 144, 226, 0.15);
  }

  .wallet-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .wallet-indicator {
    width: 6px;
    height: 6px;
    background: #31FD9D;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(49, 253, 157, 0.4);
  }

  .wallet-label {
    color: #31FD9D;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .address-divider {
    width: 1px;
    height: 16px;
    background: rgba(74, 144, 226, 0.2);
  }

  .address {
    color: #e0e0e0;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .connect-button {
    min-width: 180px;
    padding: 10px 20px;
    font-size: 1rem;
  }

  /* Add these new styles */
  .input-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    min-height: 48px;
  }

  .input-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .input-container .form-control {
    height: 48px;
    width: 100%;
  }

  .input-label {
    color: #e0e0e0;
    font-weight: 500;
    font-size: 0.9rem;
    min-width: 120px;
    padding-top: 12px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-control {
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(74, 144, 226, 0.3);
    background-color: #2c2c2c;
    color: #e0e0e0;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .form-control:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  }

  .form-control::placeholder {
    color: #666;
  }

  /* Update form-group spacing */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Add these styles */
  .input-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .input-helper {
    font-size: 0.8rem;
    color: #a9a9a9;
    text-align: right;
  }

  .input-helper a {
    color: #4A90E2;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .input-helper a:hover {
    color: #357ABD;
    text-decoration: underline;
  }

  /* Add these new styles */
  .input-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-button {
    background: none;
    border: none;
    padding: 2px;
    color: #4A90E2;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .info-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .info-button:active {
    transform: scale(0.95);
  }

  /* Update input-helper transition */
  .input-helper {
    font-size: 0.8rem;
    color: #a9a9a9;
    text-align: right;
    margin-top: 0.25rem;
  }
</style>
