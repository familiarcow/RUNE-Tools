<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { getInboundAddresses, getExplorerUrl } from '$lib/utils/network';
  import { fetchJSONWithFallback } from '$lib/utils/api';

  interface ThorNameResponse {
    name: string;
    expire_block_height: number;
    owner: string;
    preferred_asset: string;
    affiliate_collector_rune: string;
    aliases: { chain: string; address: string }[];
  }

  interface InboundAddress {
    chain: string;
    pub_key: string;
    address: string;
    router?: string;
    halted: boolean;
    global_trading_paused: boolean;
    chain_trading_paused: boolean;
    chain_lp_actions_paused: boolean;
    gas_rate: string;
    gas_rate_units: string;
    outbound_tx_size: string;
    outbound_fee: string;
    dust_threshold: string;
  }

  interface Pool {
    asset: string;
    balance_asset: string;
    balance_rune: string;
    // ... (other pool properties)
  }

  interface OutboundFee {
    asset: string;
    outbound_fee: string;
    fee_withheld_rune: string;
    fee_spent_rune: string;
    surplus_rune: string;
    dynamic_multiplier_basis_points: string;
  }

  interface NetworkData {
    rune_price_in_tor: string;
    // ... (other properties)
  }

  const thorNameInfo = writable<ThorNameResponse | null>(null);
  const inboundAddresses = writable<InboundAddress[]>([]);
  const pools = writable<Pool[]>([]);
  const outboundFeeInfo = writable<OutboundFee | null>(null);
  const networkData = writable<NetworkData | null>(null);

  let thorname = '';
  let showData = false;
  let outboundFee = '';
  let payoutThreshold = '';
  let payoutThresholdUSD = '';
  let runePrice = 0;
  let preferredAssetFeeMultiplier = 200;

  // New variables for error messages
  let noPreferredAsset = false;
  let noThorChainAlias = false;
  let noPreferredAssetChainAlias = false;

  export let address = '';

  onMount(() => {
    if (address) {
      thorname = address;
      handleSubmit();
    }
  });

  async function queryThorName(thorname: string) {
    try {
      const response = await fetch(`https://thornode.ninerealms.com/thorchain/thorname/${thorname}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ThorNameResponse = await response.json();
      
      // Set preferred_asset to "THOR.RUNE" if it's "."
      if (data.preferred_asset === ".") {
        data.preferred_asset = "THOR.RUNE";
      }
      
      thorNameInfo.set(data);
      console.log('THORName info:', data);
    } catch (error) {
      console.error('Error fetching THORName:', error);
      thorNameInfo.set(null);
    }
  }

  async function queryInboundAddresses() {
    try {
      // Use shared utility with caching and fallback support
      const data: InboundAddress[] = await getInboundAddresses();
      inboundAddresses.set(data);
      console.log('Inbound addresses:', data);
    } catch (error) {
      console.error('Error fetching inbound addresses:', error);
      inboundAddresses.set([]);
    }
  }

  async function queryPools() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Pool[] = await response.json();
      pools.set(data);
      console.log('Pools:', data);
    } catch (error) {
      console.error('Error fetching pools:', error);
      pools.set([]);
    }
  }

  async function queryOutboundFee(asset: string) {
    try {
      // Use shared utility with fallback support
      const data: OutboundFee[] = await fetchJSONWithFallback(`/thorchain/outbound_fee/${asset}`);
      outboundFeeInfo.set(data[0]);
      console.log('Outbound fee info:', data[0]);
    } catch (error) {
      console.error('Error fetching outbound fee:', error);
      outboundFeeInfo.set(null);
    }
  }

  async function queryNetworkData() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: NetworkData = await response.json();
      networkData.set(data);
      runePrice = Number(data.rune_price_in_tor) / 1e8;
      console.log('Network data:', data);
    } catch (error) {
      console.error('Error fetching network data:', error);
      networkData.set(null);
    }
  }

  async function queryPreferredAssetFeeMultiplier() {
    try {
      const response = await fetch('https://thornode.ninerealms.com/thorchain/mimir/key/PreferredAssetOutboundFeeMultiplier');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.text();
      preferredAssetFeeMultiplier = Number(data) || 200; // Use 200 as fallback if the response is not a valid number
      console.log('Preferred Asset Fee Multiplier:', preferredAssetFeeMultiplier);
    } catch (error) {
      console.error('Error fetching Preferred Asset Fee Multiplier:', error);
      preferredAssetFeeMultiplier = 200; // Use default value in case of error
    }
  }

  async function handleSubmit() {
    await Promise.all([
      queryThorName(thorname), 
      queryInboundAddresses(), 
      queryPools(), 
      queryNetworkData(),
      queryPreferredAssetFeeMultiplier()
    ]);
    
    // Check for potential setup issues
    noPreferredAsset = !$thorNameInfo?.preferred_asset;
    noThorChainAlias = !$thorNameInfo?.aliases.some(alias => alias.chain === 'THOR');
    const preferredAssetChain = $thorNameInfo?.preferred_asset?.split('.')[0];
    noPreferredAssetChainAlias = !$thorNameInfo?.aliases.some(alias => alias.chain === preferredAssetChain);

    showData = true;
    
    const preferredAsset = $thorNameInfo?.preferred_asset || '';
    await queryOutboundFee(preferredAsset);

    const preferredPool = $pools.find(pool => pool.asset === preferredAsset);

    if (preferredPool && $outboundFeeInfo) {
      outboundFee = $outboundFeeInfo.outbound_fee;
      const outboundFeeInAsset = Number(outboundFee) / 1e8;
      const assetPriceInRune = Number(preferredPool.balance_rune) / Number(preferredPool.balance_asset);
      const outboundFeeInRune = outboundFeeInAsset * assetPriceInRune;
      payoutThreshold = formatRune((outboundFeeInRune * preferredAssetFeeMultiplier * 1e8).toString());
      payoutThresholdUSD = formatUSD(Number(payoutThreshold) * runePrice);
    } else {
      outboundFee = 'N/A';
      payoutThreshold = 'N/A';
      payoutThresholdUSD = 'N/A';
    }

    // Update the URL
    const newUrl = `/affiliate?thorname=${thorname}`;
    history.pushState(null, '', newUrl);
  }

  function formatRune(amount: string): string {
    return (Number(amount) / 1e8).toFixed(2);
  }

  function formatUSD(amount: number): string {
    return amount.toFixed(2);
  }

  function formatAssetName(asset: string): string {
    return asset.split('-')[0];
  }

  function getBlockExplorerUrl(chain: string, address: string): string {
    // Use shared utility for explorer URLs
    return getExplorerUrl(chain, address) || '';
  }

  $: blockExplorerUrl = $thorNameInfo 
    ? getBlockExplorerUrl(
        $thorNameInfo.preferred_asset.split('.')[0],
        $thorNameInfo.aliases.find(alias => alias.chain === $thorNameInfo.preferred_asset.split('.')[0])?.address || ''
      )
    : '';
</script>

<div class="affiliates-tracker">
  {#if !showData}
    <form on:submit|preventDefault={handleSubmit}>
      <h2>Affiliates Tracker</h2>
      <label>
        THORName:
        <input type="text" bind:value={thorname} required />
      </label>
      <button type="submit">Track Affiliates</button>
    </form>
  {:else}
    <div class="container">
      <h2>Affiliates Tracker - {$thorNameInfo?.name}</h2>
      
      <!-- Error messages -->
      {#if noPreferredAsset || noThorChainAlias || noPreferredAssetChainAlias}
        <div class="error-messages">
          {#if noPreferredAsset}
            <p class="error">Warning: No preferred asset set for this THORName.</p>
          {/if}
          {#if noThorChainAlias}
            <p class="error">Warning: No THOR chain alias set for this THORName.</p>
          {/if}
          {#if noPreferredAssetChainAlias}
            <p class="error">Warning: No alias set for the preferred asset's chain.</p>
          {/if}
        </div>
      {/if}

      <div class="grid">
        <div class="card thorname">
          <h3>THORName</h3>
          <div class="main-value">{$thorNameInfo?.name}</div>
        </div>
        <div class="card preferred-asset">
          <h3>Preferred Asset</h3>
          <div class="main-value">{formatAssetName($thorNameInfo?.preferred_asset || '')}</div>
                    {#if blockExplorerUrl}
            <div class="sub-value">
              <a href={blockExplorerUrl} target="_blank" rel="noopener noreferrer">Block Explorer</a>
            </div>
          {/if}
        </div>
        <div class="card collector-rune">
          <h3>Affiliate Fees Accrued</h3>
          <div class="main-value">
            ${formatUSD(Number(formatRune($thorNameInfo?.affiliate_collector_rune || '0')) * runePrice)}
          </div>
          <div class="sub-value">
            {formatRune($thorNameInfo?.affiliate_collector_rune || '0')}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          </div>
        </div>
        <div class="card payout-threshold">
          <h3>Payout Threshold</h3>
          <div class="main-value">
            ${payoutThresholdUSD}
          </div>
          <div class="sub-value">
            {payoutThreshold}
            <img src="/assets/coins/RUNE-ICON.svg" alt="RUNE" class="rune-icon" />
          </div>
        </div>
      </div>

      <!-- New section for chain addresses and owner -->
      <div class="chain-addresses">
        <h3>Chain Addresses</h3>
        <ul>
          <li class="owner-item">
            <span class="chain-name">Owner:</span>
            <span class="chain-address">{$thorNameInfo?.owner || 'N/A'}</span>
          </li>
          {#each $thorNameInfo?.aliases || [] as alias}
            <li>
              <span class="chain-name">{alias.chain}:</span>
              <span class="chain-address">{alias.address}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .affiliates-tracker {
    max-width: 600px;
    width: 95%;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo', sans-serif;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
  }

  .card {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    height: 120px;
    position: relative;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  h3 {
    font-size: 14px;
    margin: 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .main-value {
    font-size: 24px;
    font-weight: bold;
    color: white;
    position: absolute;
    top: 50%;
    left: 15px;
    right: 15px;
    transform: translateY(-50%);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rune-icon {
    width: 24px;
    height: 24px;
    margin-left: 5px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background-color: #2c2c2c;
    border-radius: 12px;
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

  button[type="submit"] {
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

  button[type="submit"]:hover {
    background-color: #3A7BC8;
  }

  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .card {
      height: auto;
      min-height: 100px;
    }

    .main-value {
      position: static;
      transform: none;
      margin: 10px 0;
    }
  }

  .sub-value {
    font-size: 14px;
    color: #a9a9a9;
    position: absolute;
    bottom: 10px;
    left: 15px;
    right: 15px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .sub-value .rune-icon {
    width: 16px;
    height: 16px;
    margin-left: 3px;
  }

  .sub-value a {
    color: #4A90E2;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .sub-value a:hover {
    color: #3A7BC8;
    text-decoration: underline;
  }

  .error-messages {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 20px;
  }

  .error {
    color: #ff4136;
    margin: 5px 0;
    font-size: 14px;
  }

  .chain-addresses {
    background-color: #2c2c2c;
    border-radius: 8px;
    padding: 12px;
    margin-top: 20px;
    grid-column: span 2;
  }

  .chain-addresses h3 {
    font-size: 14px;
    margin: 0 0 10px 0;
    color: #a9a9a9;
    font-weight: 500;
  }

  .chain-addresses ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .chain-addresses li {
    margin-bottom: 8px;
    font-size: 14px;
    display: flex;
    align-items: center;
  }

  .owner-item {
    margin-bottom: 16px;
    padding-bottom: 8px;
  }

  .chain-name {
    font-weight: bold;
    min-width: 60px;
    margin-right: 10px;
  }

  .chain-address {
    word-break: break-all;
  }

  @media (max-width: 600px) {
    .chain-addresses {
      padding: 12px;
    }

    .chain-addresses li {
      flex-direction: column;
      align-items: flex-start;
    }

    .chain-name {
      margin-bottom: 5px;
    }
  }
</style>