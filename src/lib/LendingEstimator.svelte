<script>
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  let fromAsset = "BTC.BTC"; // default collateral asset BTC
  let userFromAmount = ""; // user inputted fromAmount (not yet converted to 1e8)
  let toAsset = "ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7"; // Asset the user will receive their debt equivalent in (default USDT)
  let response = null;
  let toAssets = []; // Holds the array of available destination assets
  let fromAssets = []; // Holds the array of available collateral
  let toAddress = ""; // This will be set based on the selected toAsset
  let quoteFetched = false;
  let loanCollateralRemaining = []; // holds the remaining collateral amount for each asset
  let noCapacityRemaining = false; // used to change the GetQuote button if there's no lending capacity

  // Helper function to round USD numbers
  function formatNumberUSD(number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(number);
  }

  // Helper function to round the decimals depending on the toAsset
  function formatNumberCrypto(number, toAsset) {
    const assetPrefix = toAsset.split(".")[0];
    const decimals = {
      BTC: 5,
      ETH: 3,
      BSC: 2,
      BCH: 2,
      LTC: 2,
      AVAX: 2,
      GAIA: 2,
      DOGE: 2,
      THOR: 2,
    };

    const decimalPoints = decimals[assetPrefix] || 2; // Default to 2 decimal points if not listed

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimalPoints,
      maximumFractionDigits: decimalPoints,
    }).format(number);
  }

  // Helper function to format a full crypto name to plaintext
  function formatCryptoName(cryptoName) {
    const parts = cryptoName.split(/\.|-/); // This regex splits by both "." and "-"

    const [chain, asset, identifier] = parts;

    if (["ETH", "BSC", "AVAX"].includes(chain) && identifier) {
      return `${asset} (${chain})`;
    } else {
      return asset;
    }
  }

  // Hardcoded mapping of dummy addresses to destination chains to be used in the quote
  const assetToAddressMap = {
    BTC: "bc1qdvxpt06ulfk5gm5p52wa4mrt6e887wkmvc4xxw",
    ETH: "0x4E71F9debEC9117F1FACc7eeB490758AF45806A7",
    BSC: "0x4E71F9debEC9117F1FACc7eeB490758AF45806A7",
    BCH: "pqvm5jv4zhy38dkzrx0md73c3sujhkmg4yhlmhhmfm",
    LTC: "ltc1qzvcgmntglcuv4smv3lzj6k8szcvsrmvk0phrr9wfq8w493r096ssm2fgsw",
    AVAX: "0x66153cf0e164bc9bdae88fb36fc5b92dc63a79d6",
    GAIA: "cosmos1rdly788mpmwvemd5yr8wu0499zs4v4qnaptum4",
    DOGE: "DLmW4rFuPqR3cUyqJiBqjho2CtHMC12bFt",
    THOR: "thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3",
  };

  let refFromAsset = "",
    refUserFromAmount = "",
    refToAsset = "";

  // Fetches the loan quote from Thornode
  async function fetchLoanQuote() {
    response = null; // Reset response at the start
    quoteFetched = false; // Resetting quoteFetched as well

    try {
      let fromAmount = Math.round(userFromAmount * 1e8);
      const endpoint = `https://thornode.ninerealms.com/thorchain/quote/loan/open?from_asset=${fromAsset}&amount=${fromAmount}&to_asset=${toAsset}&destination=${toAddress}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error(`Network response was not ok (${res.status})`);
      }

      const jsonResponse = await res.json();

      if (
        jsonResponse.error &&
        jsonResponse.error.startsWith(
          "failed to simulate handler: no availability"
        )
      ) {
        const assetIndex = fromAssets.indexOf(fromAsset);
        const remainingCollateral = loanCollateralRemaining[assetIndex];
        alert(`Loan too big. There is currently ${remainingCollateral} ${formatCryptoName(fromAsset)} remaining.`);
        return;
      }

      if (
        jsonResponse.error &&
        jsonResponse.error.startsWith(
          "failed to validate message: amount cannot be zero"
        )
      ) {
        alert("Amount cannot be zero.");
        return;
      }

      // Success path
      response = jsonResponse;
      quoteFetched = true;

      // Set reference values to current state, used for detecting input changes
      refFromAsset = fromAsset;
      refUserFromAmount = userFromAmount;
      refToAsset = toAsset;
    } catch (error) {
      console.error("Error fetching loan quote:", error.message);
      alert("Error: " + error.message);
    }
  }

  // Maps asset names to logos
  const assetLogos = {
    RUNE: "https://raw.githubusercontent.com/thorchain/Resources/b3cbd8f6e8a9d455b2b66e90581082e30e1e8859/Assets/Rune/RUNE-ICON.svg",
    USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
    USDT: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
    ETH: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
    BNB: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
    AVAX: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
    BTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
    DAI: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg",
    DOGE: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
    GUSD: "https://cryptologos.cc/logos/gemini-dollar-gusd-logo.svg",
    LUSD: "https://cryptologos.cc/logos/liquity-lqty-logo.svg",
    WBTC: "https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.svg",
    ATOM: "https://cryptologos.cc/logos/cosmos-atom-logo.svg",
    BCH: "https://cryptologos.cc/logos/bitcoin-cash-bch-logo.svg",
    LTC: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
    USDP: "https://cryptologos.cc/logos/paxos-standard-usdp-logo.svg",
    fallback: "https://cryptologos.cc/logos/thorchain-rune-logo.svg",
  };

  // Logo retrieval function
  function getLogoUrl(assetFullName) {
    const shortName = assetFullName.split(".")[1].split("-")[0];
    return assetLogos[shortName] || assetLogos.fallback;
  }

  // Fetches the available destination assets from THORNode. This will only return gas assets & stablecoins on the EVM chains
  async function fetchToAssets() {
    const res = await fetch("https://thornode.ninerealms.com/thorchain/pools");
    const pools = await res.json();
    toAssets = pools
      .filter((pool) => pool.status === "Available")
      .filter((pool) => {
        const [chain, assetName] = pool.asset.split(".");
        if (
          assetName.includes("AVAX") ||
          assetName.includes("ETH") ||
          assetName.includes("BNB") ||
          assetName.includes("DAI") ||
          assetName.includes("WBTC")
        ) {
          return true;
        }
        if (
          (chain === "AVAX" || chain === "BSC" || chain === "ETH") &&
          !assetName.includes("USD")
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.balance_rune - a.balance_rune)
      .map((pool) => pool.asset);

    toAssets.splice(2, 0, "THOR.RUNE");
  }

  // Fetches the available collateral assets from THORNode
  async function fetchFromAssets() {
    const res = await fetch("https://thornode.ninerealms.com/thorchain/pools");
    const pools = await res.json();
    fromAssets = pools
      .filter((pool) => pool.loan_collateral > 0 && Number(pool.loan_collateral_remaining) > 0) // Filter out pools with zero remaining collateral
      .map((pool) => pool.asset);

    loanCollateralRemaining = pools
      .filter((pool) => pool.loan_collateral > 0 && Number(pool.loan_collateral_remaining) > 0) // Filter out pools with zero remaining collateral
      .map((pool) => Number(pool.loan_collateral_remaining)); // Convert to number

  }


  // Sets the toAddress based on the selected toAsset
  function setToAddress() {
    const assetPrefix = toAsset.split(".")[0];
    toAddress = assetToAddressMap[assetPrefix] || "";
  }

  // Reactively set toAddress whenever toAsset changes
  $: toAsset, setToAddress();
  $: noCapacityRemaining = loanCollateralRemaining.every(value => value === 0); // Check after conversion
  //

  // Helper function to reset responses when an input field is changed
  function resetResponse() {
    response = null;
    quoteFetched = false;
  }

  // Reset response if any input field is changed from the quoted values
  $: if (quoteFetched) {
    if (
      fromAsset !== refFromAsset ||
      userFromAmount !== refUserFromAmount ||
      toAsset !== refToAsset
    ) {
      resetResponse();
    }
  }

  // Fetch available collateral & debt assets when the page loads
  onMount(() => {
    fetchToAssets();
    fetchFromAssets();
  });
</script>

<div class="lending-widget-container">
  <div
    style="display: flex; align-items: center; justify-content: center; margin-bottom:10px;"
  >
    <img
      src="https://cryptologos.cc/logos/thorchain-rune-logo.svg"
      alt="THORChain Logo"
      style="margin-right: 15px; max-height: 25px; max-width: 25px;"
    />
    <div
      style="text-align: center; font-size: 20px; font-weight: 600; text-shadow: 2px 2px 4px #000000; color: #f8f8f8; font-family: 'Exo 2', sans-serif;"
    >
      <b>THORChain Borrow Estimator</b>
    </div>
  </div>
  <div style="height: 1px; background-color: #3a3a3c"></div>
  <div style="height: 10px"></div>

  <form on:submit|preventDefault={fetchLoanQuote}>
    <!-- From Asset Selector -->
    <div class="selector-group">
      <div class="selector-title">Collateral Asset:</div>
      <div class="selector">
        <select bind:value={fromAsset}>
          {#each fromAssets as asset}
            <option value={asset}>{formatCryptoName(asset)}</option>
          {/each}
        </select>
      </div>
    </div>


      <!-- From Amount Input -->
      <div class="selector-group">
        <div class="selector-title">Amount:</div>
        <div class="selector">
          <input
            type="text"
            pattern="[0-9]*([.][0-9]+)?"
            bind:value={userFromAmount}
            placeholder="Loan Amount ({formatCryptoName(fromAsset)})"
          />
        </div>
      </div>

      <!-- To Asset Selector -->
      <div class="selector-group">
        <div class="selector-title">Debt Asset:</div>
        <div class="selector">
          <select bind:value={toAsset}>
            {#each toAssets as asset}
              <option value={asset}>{formatCryptoName(asset)}</option>
            {/each}
          </select>
        </div>
      </div>


    <!-- Conditional Button Display -->
    {#if noCapacityRemaining}
      <button type="button" class="no-capacity">No Capacity Remaining</button>
    {:else}
      <button type="submit">Get Quote</button>
    {/if}
  </form>


  <!-- Display the quote response once fetched -->
  {#if response}
    <div style="height: 1px; background-color: #3a3a3c"></div>
    <div style="height: 5px"></div>
    <div
      class="quote-response"
      in:slide={{ duration: 800 }}
      out:slide={{ duration: 400 }}
    >
      <!-- Amount In -->
      <div class="response-display">
        <p>
          Amount In: <span class="green-accent">{userFromAmount}</span>
          {formatCryptoName(fromAsset)}
        </p>
        <img src={getLogoUrl(fromAsset)} alt="Logo" width="20" height="20" />
      </div>

      <!-- Amount Out -->
      <div class="response-display">
        <p>
          Amount Out: <span class="green-accent"
            >{formatNumberCrypto(
              response.expected_amount_out / 1e8,
              toAsset
            )}</span
          >
          {formatCryptoName(toAsset)}
        </p>
        <img src={getLogoUrl(toAsset)} alt="Logo" width="20" height="20" />
      </div>

      <!-- Collateralization Ratio -->
      <div class="response-display">
        <p>
          Collateralization Ratio: <span class="green-accent"
            >{(response.expected_collateralization_ratio / 100).toFixed(
              0
            )}%</span
          >
        </p>
      </div>

      <!-- Debt -->
      <div class="response-display">
        <p>
          Debt: <span class="green-accent"
            >{formatNumberUSD(response.expected_debt_issued / 1e8)}</span
          >
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  :root {
    --background-color: #121212;
    --text-color: #e0e0e0;
    --accent-color: #2cbe8c;
    --input-background-color: #333;
    --input-border-color: #444;
    --button-hover-color: #29a879;
    --container-bg-color: #1a1a1a;
    --container-border-radius: 8px;
    --container-padding: 20px;
    --container-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .green-accent {
    color: #2cbe8c;
  }

  .selector-title {
    color: #fff;
    margin-right: 10px; /* Ensure some spacing between the title and the selector */
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .selector {
    margin-left: 15px;
    width: 100%; /* Adjust this to a specific width if needed */
    flex-grow: 1; /* This will make the selector fill the available space */
  }

  .selector-group {
    display: flex;
    align-items: center; /* Vertically center */
    justify-content: flex-start;
    margin-bottom: 15px; /* Adds some space between each selector group */
  }

  .selector select,
  .selector input {
    width: 100%; /* Ensures that the select/input elements take the full width of their parent */
    box-sizing: border-box; /* Ensures padding and border are included in the total width and height */
  }

  .selector select:focus,
  .selector input:focus {
    border-color: var(--accent-color); /* Highlights the border when focused */
  }

  .selector-group {
    display: flex;
    align-items: center;
    margin-bottom: 5px; /* Adds some space between each selector group */
  }

  .lending-widget-container {
    background-color: var(--container-bg-color);
    border-radius: var(--container-border-radius);
    padding: var(--container-padding);
    box-shadow: var(--container-shadow);
    margin: 20px auto; /* Center the container with some margin */
    width: 325px;
  }

  .response-display {
    display: flex;
    align-items: center; /* Vertically center */
    justify-content: center; /* Horizontally align to the start */
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1em;
    margin: auto;
  }

  select,
  input {
    background-color: var(--input-background-color);
    border: 1px solid var(--input-border-color);
    padding: 0.5em;
    font-size: 1em;
    color: var(--text-color);
    border-radius: 4px;
  }

  input::placeholder {
    color: #aaa;
  }

  button {
    width: auto;
    background-color: var(--accent-color);
    color: white;
    border: none;
    cursor: pointer;
    padding: 10px;
    border-radius: 5px;
    transition: background-color 0.5s ease;
    display: block;
    margin: 0 auto;
    font-size: 1em;
    margin-bottom: 10px;
  }

  button:hover {
    background-color: var(
      --button-hover-color
    ); /* Darker shade on hover for visual feedback */
  }

  .quote-response p {
    margin: 5px;
    color: #fff;
  }

  .quote-response img {
    margin-left: 0px; /* Adjusts spacing to the left of the image */
  }

  button.no-capacity {
    background-color: #BF2E2C;
    color: white;
    border: none;
    cursor: not-allowed;
    padding: 10px;
    border-radius: 5px;
    display: block;
    margin: 0 auto;
    font-size: 1em;
  }

</style>
