<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { thornode } from '$lib/api';
    import { PageHeader } from '$lib/components';
    import { getAssetLogo, getChainLogo, getAssetDisplayName, ASSET_LOGOS, CHAIN_LOGOS } from '$lib/constants/assets';
    import { formatUSD, formatUSDWithDecimals, shortenAddress, getAddressSuffix } from '$lib/utils/formatting';
    import { denomToAsset } from '$lib/utils/wallet';
    import { fromBaseUnit } from '$lib/utils/blockchain';
    import { getAllPools } from '$lib/utils/liquidity';
    import { getRunePrice } from '$lib/utils/tcy';
    import { getBondsForAddresses, calculateTotalBondValue } from '$lib/utils/nodes';

//This app currently does not check free asset value on chains other than THORChain

    const THOR_ADDRESSES = [
        {
            address: 'thor10qh5272ktq4wes8ex343ky9rsuehcypddjh08k',
            label: 'Treasury Vultisig'
        }
    ];

    let LP_ASSETS = []; // Will be populated from pools API

    // Use shared constants for icons
    const assetLogos = ASSET_LOGOS;
    const chainIcons = CHAIN_LOGOS;

    let balances = [];
    let lpPositions = {};  // Store LP positions by address
    let loading = true;
    let error = null;
    let runePrice = 0;
    let assetPrices = {};  // Store all asset prices
    let bonds = [];

    function formatAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(fromBaseUnit(amount));
    }

    // formatUSD and formatUSDWithDecimals imported from $lib/utils/formatting

    function formatAssetName(denom) {
        if (denom === 'rune') return 'RUNE';
        return denom.toUpperCase();
    }

    function formatPoolName(pool) {
        // Split on hyphen and take the first part
        return pool.split('-')[0];
    }

    async function fetchRunePriceData() {
        try {
            runePrice = await getRunePrice();
        } catch (e) {
            console.error('Error fetching RUNE price:', e);
        }
    }

    async function fetchAssetPrices() {
        try {
            const pools = await getAllPools();

            // Create a price map for all assets
            const priceMap = pools.reduce((acc, pool) => {
                acc[pool.asset] = fromBaseUnit(pool.asset_tor_price);
                return acc;
            }, {});

            assetPrices = priceMap;

            // Log USD prices for each asset
            console.log('Asset Prices in USD:');
            Object.entries(priceMap).forEach(([asset, priceInTor]) => {
                console.log(`${asset}: $${priceInTor.toFixed(2)}`);
            });

        } catch (e) {
            console.error('Error fetching asset prices:', e);
        }
    }

    async function fetchLPPositions(address) {
        try {
            const lpPositions = [];

            // Check each asset individually
            for (const asset of LP_ASSETS) {
                try {
                    const data = await thornode.fetch(`/thorchain/pool/${encodeURIComponent(asset)}/liquidity_provider/${address}`);

                    // Only add if there are actual LP positions (units > 0)
                    if (data.units && Number(data.units) > 0) {
                        lpPositions.push({
                            pool: formatPoolName(data.asset),
                            fullPool: data.asset,
                            assetAmount: fromBaseUnit(data.asset_redeem_value),
                            runeAmount: fromBaseUnit(data.rune_redeem_value),
                            assetAddress: data.rune_address // Using rune_address as identifier
                        });
                    }
                } catch (e) {
                    // Continue with next asset even if one fails (404 etc)
                    continue;
                }
            }

            return lpPositions;
        } catch (e) {
            console.error(`Error in fetchLPPositions for ${address}:`, e);
            return [];
        }
    }

    async function fetchThorBalances() {
        try {
            // Fetch treasury address first
            const treasuryData = await thornode.fetch('/thorchain/balance/module/treasury');
            const treasuryAddress = treasuryData.address;

            // Add treasury address to the list if not already present
            const addresses = [...THOR_ADDRESSES];
            if (!addresses.find(a => a.address === treasuryAddress)) {
                addresses.push({
                    address: treasuryAddress,
                    label: 'Treasury LP (Locked)'
                });
            }

            await Promise.all([
                fetchRunePriceData(),
                fetchAssetPrices()
            ]);

            // Use the updated addresses array
            const results = await Promise.all(
                addresses.map(async ({address, label}) => {
                    const balanceData = await thornode.fetch(`/cosmos/bank/v1beta1/balances/${address}`);
                    const lpPositionsData = await fetchLPPositions(address);

                    return {
                        address,
                        label,
                        balances: balanceData.balances || [],
                        lpPositions: lpPositionsData
                    };
                })
            );

            balances = results;
        } catch (e) {
            error = 'Failed to fetch balances';
            console.error(e);
        } finally {
            loading = false;
        }
    }

    function getAssetUSDValue(amount, asset) {
        if (!assetPrices[asset]) return null;
        return amount * assetPrices[asset];
    }

    // shortenAddress imported from $lib/utils/formatting

    function calculateTotalValue(balancesData) {
        let total = 0;

        for (const { balances, lpPositions } of balancesData) {
            // Add up RUNE balances
            const runeBalance = balances.find(b => b.denom === 'rune');
            if (runeBalance) {
                total += (Number(runeBalance.amount) / 1e8) * runePrice;
            }

            // Add up LP positions
            for (const position of lpPositions) {
                // Add RUNE value
                total += position.runeAmount * runePrice;
                // Add asset value
                const assetValue = getAssetUSDValue(position.assetAmount, position.fullPool);
                if (assetValue) total += assetValue;
            }
        }

        // Add up bond values (amount is already in human-readable units from shared utility)
        for (const bond of bonds) {
            total += bond.amount * runePrice;
        }

        return total;
    }

    // Helper function to format RUNE amount (expects human-readable units)
    function formatRune(amount) {
        return amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // getAddressSuffix imported from $lib/utils/formatting (replaces getLastFour)

    // Fetch bonds using shared utility
    async function fetchBonds() {
        try {
            const addresses = THOR_ADDRESSES.map(a => a.address);
            bonds = await getBondsForAddresses(addresses);
        } catch (e) {
            console.error('Failed to fetch bonds:', e);
            bonds = [];
        }
    }

    // calculateTotalBondValue imported from $lib/utils/nodes
    // Wrapper to pass runePrice
    function getTotalBondValueUSD(bondsList) {
        return calculateTotalBondValue(bondsList, runePrice);
    }

    function calculateLockedLPValue(balancesData) {
        const lockedAddress = balancesData.find(b => b.label === 'Treasury LP (Locked)');
        if (!lockedAddress) return 0;

        return lockedAddress.lpPositions.reduce((total, position) => {
            const assetValue = getAssetUSDValue(position.assetAmount, position.fullPool) || 0;
            const runeValue = position.runeAmount * runePrice;
            return total + assetValue + runeValue;
        }, 0);
    }

    function calculateUnlockedLPValue(balancesData) {
        return balancesData
            .filter(b => b.label !== 'Treasury LP (Locked)')
            .reduce((total, address) => {
                return total + address.lpPositions.reduce((lpTotal, position) => {
                    const assetValue = getAssetUSDValue(position.assetAmount, position.fullPool) || 0;
                    const runeValue = position.runeAmount * runePrice;
                    return lpTotal + assetValue + runeValue;
                }, 0);
            }, 0);
    }

    function calculateFreeAssetValue(balancesData) {
        return balancesData.reduce((total, { balances }) => {
            const runeBalance = balances.find(b => b.denom === 'rune');
            if (runeBalance) {
                total += (Number(runeBalance.amount) / 1e8) * runePrice;
            }
            return total;
        }, 0);
    }

    async function fetchPools() {
        try {
            const pools = await thornode.fetch('/thorchain/pools');

            // Filter for Available pools only
            LP_ASSETS = pools
                .filter(pool => pool.status === 'Available')
                .map(pool => pool.asset);

            console.log('Fetched pool assets:', LP_ASSETS);
        } catch (e) {
            console.error('Error fetching pools:', e);
            LP_ASSETS = []; // Reset to empty array on error
        }
    }

    // Update onMount to include pools fetching
    onMount(async () => {
        // Fetch pools first since we need them for LP positions
        await fetchPools();
        
        // Then fetch the rest
        await Promise.all([
            fetchThorBalances(),
            fetchBonds()
        ]);
    });
</script>

<main>
    <div class="container">
        <PageHeader title="Treasury Positions" />

        {#if !loading && !error}
            <div class="total-treasury">
                <span class="total-label">Total Treasury Value</span>
                <span class="total-value">{formatUSD(calculateTotalValue(balances))}</span>
            </div>
            
            <div class="stats-container">
                <div class="stat-box">
                    <span class="stat-label">Bonded Value</span>
                    <span class="stat-value">{formatUSD(getTotalBondValueUSD(bonds))}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Locked LP Value</span>
                    <span class="stat-value">{formatUSD(calculateLockedLPValue(balances))}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Unlocked LP Value</span>
                    <span class="stat-value">{formatUSD(calculateUnlockedLPValue(balances))}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Unallocated Asset Value</span>
                    <span class="stat-value">{formatUSD(calculateFreeAssetValue(balances))}</span>
                </div>
            </div>
        {/if}

        {#if loading}
            <div class="loading">Loading balances...</div>
        {:else if error}
            <div class="error">{error}</div>
        {:else}
            <div class="treasury-container">
                {#each balances as { address, label, balances, lpPositions }}
                    <div class="treasury-card" transition:fade>
                        <div class="card-header">
                            <h2>{label}</h2>
                            <div class="address">{address}</div>
                        </div>

                        <div class="card-content">
                            {#if balances.length > 0 && balances.some(b => Number(b.amount) > 1000000)}
                                <div class="section-container">
                                    <h3>Balances</h3>
                                    <div class="balances-container">
                                        {#each balances.filter(b => Number(b.amount) > 1000000) as balance}
                                            {@const fullAsset = denomToAsset(balance.denom)}
                                            {@const chain = fullAsset.split('.')[0]}
                                            {@const assetPrice = balance.denom.toLowerCase() === 'rune' ? runePrice : assetPrices[fullAsset]}
                                            <div class="amount-row">
                                                <div class="logo-container small">
                                                    <img
                                                        src={getAssetLogo(fullAsset) || '/assets/coins/fallback-logo.svg'}
                                                        alt={getAssetDisplayName(fullAsset)}
                                                        class="asset-icon"
                                                        on:error={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/assets/coins/fallback-logo.svg';
                                                        }}
                                                    />
                                                    <div class="chain-logo-container">
                                                        <img
                                                            src={getChainLogo(chain) || '/assets/chains/fallback-logo.svg'}
                                                            alt={chain}
                                                            class="chain-icon"
                                                            on:error={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = '/assets/chains/fallback-logo.svg';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <span class="asset-label">{getAssetDisplayName(fullAsset)}</span>
                                                <span class="amount">{formatAmount(balance.amount)}</span>
                                                {#if assetPrice}
                                                    <span class="usd-value">
                                                        {formatUSD((Number(balance.amount) / 1e8) * assetPrice)}
                                                    </span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if lpPositions.length > 0 && lpPositions.some(p => {
                                const totalValue = (p.runeAmount * runePrice) + (getAssetUSDValue(p.assetAmount, p.fullPool) || 0);
                                return totalValue > 1;
                            })}
                                <div class="section-container">
                                    <h3>LP Positions</h3>
                                    {#each lpPositions.filter(p => {
                                        const totalValue = (p.runeAmount * runePrice) + (getAssetUSDValue(p.assetAmount, p.fullPool) || 0);
                                        return totalValue > 1;
                                    }) as position}
                                        <div class="lp-container">
                                            <div class="lp-row">
                                                <div class="pool-header">
                                                    <div class="asset-info">
                                                        <div class="logo-container">
                                                            <img 
                                                                src={getAssetLogo(position.fullPool) || '/assets/coins/fallback-logo.svg'}
                                                                alt={position.pool}
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={getChainLogo(position.pool.split('.')[0]) || '/assets/chains/fallback-logo.svg'} 
                                                                    alt={position.pool.split('.')[0]}
                                                                    class="chain-icon"
                                                                    on:error={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = '/assets/chains/fallback-logo.svg';
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div class="pool-info">
                                                            <span class="asset-name">{position.pool}</span>
                                                        </div>
                                                    </div>
                                                    <div class="total-value">
                                                        {formatUSD(
                                                            (position.runeAmount * runePrice) + 
                                                            (getAssetUSDValue(position.assetAmount, position.fullPool) || 0)
                                                        )}
                                                    </div>
                                                </div>
                                                <div class="lp-amounts">
                                                    <div class="amount-row">
                                                        <span class="amount">{formatAmount(position.assetAmount * 1e8)}</span>
                                                        <div class="logo-container small">
                                                            <img 
                                                                src={getAssetLogo(position.fullPool) || '/assets/coins/fallback-logo.svg'}
                                                                alt={position.pool}
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={getChainLogo(position.pool.split('.')[0]) || '/assets/chains/fallback-logo.svg'} 
                                                                    alt={position.pool.split('.')[0]}
                                                                    class="chain-icon"
                                                                    on:error={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = '/assets/chains/fallback-logo.svg';
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {#if assetPrices[position.fullPool]}
                                                            <span class="usd-value">
                                                                {formatUSD(getAssetUSDValue(position.assetAmount, position.fullPool))}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                    <div class="amount-row">
                                                        <span class="amount">{formatAmount(position.runeAmount * 1e8)}</span>
                                                        <div class="logo-container small">
                                                            <img 
                                                                src={getAssetLogo('THOR.RUNE') || '/assets/coins/fallback-logo.svg'} 
                                                                alt="RUNE"
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={getChainLogo('THOR') || '/assets/chains/fallback-logo.svg'} 
                                                                    alt="THOR"
                                                                    class="chain-icon"
                                                                    on:error={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = '/assets/chains/fallback-logo.svg';
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <span class="usd-value">
                                                            {formatUSD(position.runeAmount * runePrice)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            {#if bonds.filter(b => b.bondAddress === address).length > 0}
                                <div class="section-container">
                                    <h3>Node Bonds</h3>
                                    <div class="balances-container">
                                        {#each bonds.filter(b => b.bondAddress === address) as bond}
                                            <div class="amount-row">
                                                <span class="node-address">{getAddressSuffix(bond.nodeAddress, 4)}</span>
                                                <span class="amount">{formatRune(bond.amount)}</span>
                                                <div class="logo-container small">
                                                    <img 
                                                        src={getAssetLogo('THOR.RUNE') || '/assets/coins/fallback-logo.svg'} 
                                                        alt="RUNE"
                                                        class="asset-icon"
                                                        on:error={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/assets/coins/fallback-logo.svg';
                                                        }}
                                                    />
                                                    <div class="chain-logo-container">
                                                        <img 
                                                            src={getChainLogo('THOR') || '/assets/chains/fallback-logo.svg'} 
                                                            alt="THOR"
                                                            class="chain-icon"
                                                            on:error={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = '/assets/chains/fallback-logo.svg';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {#if runePrice}
                                                    <span class="usd-value">
                                                        {formatUSD(bond.amount * runePrice)}
                                                    </span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</main>

<style>
    main {
        padding: 1rem;
        color: var(--text-color);
    }

    .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
    }

    .treasury-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
        max-width: 100%;
    }

    .treasury-card {
        background-color: var(--surface-color-dark);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease;
    }

    .treasury-card:hover {
        transform: translateY(-5px);
    }

    .card-header {
        background-color: #4A90E2;
        padding: 1rem;
    }

    .card-header h2 {
        margin: 0;
        color: #ecf0f1;
        font-size: 1.2rem;
    }

    .address {
        font-family: monospace;
        font-size: 0.8rem;
        color: rgba(236, 240, 241, 0.8);
        margin-top: 0.5rem;
        word-break: break-all;
    }

    .card-content {
        padding: 1.5rem;
        background: var(--surface-color-dark);
    }

    .balance-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        border-bottom: 1px solid var(--border-color);
    }

    .balance-row:last-child {
        border-bottom: none;
    }

    .asset-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .chain-icon {
        width: 16px;
        height: 16px;
        object-fit: contain;
        border: none;
        pointer-events: none;
    }

    .asset-name {
        color: var(--text-color);
        font-weight: 500;
    }

    .amount {
        font-family: monospace;
        color: var(--text-color);
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: var(--text-color);
    }

    .error {
        color: var(--error-color);
        text-align: center;
        padding: 2rem;
    }

    .rune-price {
        text-align: center;
        margin-bottom: 2rem;
        font-size: 1.1rem;
        color: var(--text-color);
        background: var(--surface-color);
        padding: 0.5rem;
        border-radius: 4px;
        display: inline-block;
        position: relative;
        left: 50%;
        transform: translateX(-50%);
    }

    .amount-group {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
    }

    .usd-value {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        opacity: 0.8;
    }

    h3 {
        margin: 1rem 0;
        font-size: 1.1rem;
        color: var(--text-color);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.5rem;
    }

    .lp-row {
        display: flex;
        flex-direction: column;
        padding: 0.75rem 0.5rem;
        border-bottom: 1px solid var(--border-color);
        gap: 0.5rem;
    }

    .pool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .lp-amounts {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-left: 2rem;
        padding-right: 2rem;
    }

    .amount-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: center;
        width: 100%;
    }

    .amount-row .amount,
    .amount-row .usd-value {
        min-width: 120px;
        text-align: right;
    }

    .asset-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #a0a0a0;
        min-width: 50px;
    }

    .total-value {
        font-weight: 500;
        color: var(--text-color);
        font-size: 0.9rem;
    }

    .pool-info {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .asset-address {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--secondary-text-color);
        opacity: 0.8;
    }

    .label {
        color: var(--secondary-text-color);
        font-size: 0.9rem;
        min-width: 3.5rem;
    }

    .amount {
        font-family: monospace;
        color: var(--text-color);
        min-width: 4rem;
    }

    .usd-value {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        opacity: 0.8;
    }

    .stats-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
        max-width: 1200px;
        margin-left: auto;
        margin-right: auto;
    }

    .stat-box {
        background: var(--surface-color);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 200px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .stat-label {
        font-size: 0.9rem;
        color: var(--secondary-text-color);
        margin-bottom: 0.5rem;
    }

    .stat-value {
        font-size: 1.2rem;
        font-weight: 500;
        color: var(--text-color);
    }

    .logo-container {
        position: relative;
        display: flex;
        align-items: center;
        height: 32px;
    }

    .asset-icon {
        width: 32px;
        height: 32px;
        object-fit: contain;
        position: relative;
        z-index: 1;
    }

    .chain-logo-container {
        position: absolute;
        bottom: 0;
        right: -4px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        pointer-events: none;
    }

    .bond-box {
        background: var(--surface-color);
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border: 1px solid var(--border-color);
    }

    .bond-header {
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.5rem;
    }

    .bond-amount {
        display: flex;
        align-items: center;
        gap: 1rem;
        font-size: 1.1rem;
        font-weight: 500;
    }

    .bond-amount .usd-value {
        font-size: 0.9rem;
        font-weight: normal;
    }

    @media (max-width: 600px) {
        .container {
            padding: 0 1rem;
        }

        .treasury-container {
            grid-template-columns: 1fr;
        }

        .stats-container {
            gap: 1rem;
        }

        .stat-box {
            min-width: 150px;
            padding: 0.75rem 1rem;
        }

        .amount-row {
            flex-wrap: wrap;
            gap: 0.5rem;
            padding: 0.5rem 0;
        }

        .amount-row .amount,
        .amount-row .usd-value {
            min-width: 90px;
            font-size: 0.9rem;
        }

        .balances-container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
        }

        .lp-amounts {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
        }

        .pool-header {
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .asset-info {
            flex: 1;
            min-width: 150px;
        }

        .total-value {
            width: 100%;
            text-align: right;
        }

        .node-address {
            min-width: 45px;
        }

        .section-container {
            padding: 0.75rem;
        }

        .lp-container {
            padding: 0.25rem;
        }

        .total-treasury {
            padding: 1rem;
            margin: 0 1rem 1.5rem;
        }

        .total-treasury .total-value {
            font-size: 1.3rem;
        }
    }

    .logo-container.small {
        height: 24px;
        width: 24px;
    }

    .logo-container.small .asset-icon {
        width: 24px;
        height: 24px;
    }

    .logo-container.small .chain-logo-container {
        width: 12px;
        height: 12px;
        right: -2px;
        bottom: -2px;
    }

    .logo-container.small .chain-icon {
        width: 12px;
        height: 12px;
    }

    .amount-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
    }

    .balances-container {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-left: 2rem;
        padding-right: 2rem;
    }

    .node-address {
        font-family: monospace;
        font-size: 0.9rem;
        color: var(--text-color-secondary);
        min-width: 60px;
    }

    .section-container {
        background: var(--surface-color-secondary);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1.5rem;
        border: 1px solid var(--border-color);
    }

    .section-container h3 {
        margin-top: 0;
        color: var(--text-color);
        font-size: 1.1rem;
        padding-bottom: 0.75rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--border-color);
    }

    .lp-container {
        background: var(--surface-color);
        border-radius: 6px;
        margin-bottom: 0.75rem;
        padding: 0.5rem;
        border: 1px solid var(--border-color);
        transition: transform 0.2s ease;
    }

    .lp-container:hover {
        transform: translateY(-2px);
    }

    .lp-row {
        border-bottom: none;
        padding: 0.5rem;
    }

    .balances-container {
        background: var(--surface-color);
        border-radius: 6px;
        padding: 0.75rem;
        border: 1px solid var(--border-color);
    }

    .total-treasury {
        max-width: 400px;
        margin: 0 auto 2rem;
        padding: 1.25rem;
        background: var(--surface-color);
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border: 1px solid var(--border-color);
    }

    .total-label {
        display: block;
        font-size: 1rem;
        color: var(--secondary-text-color);
        margin-bottom: 0.5rem;
    }

    .total-treasury .total-value {
        display: block;
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--text-color);
        letter-spacing: -0.5px;
    }

    :root {
        --surface-color-dark: #1a1b1e;
        --surface-color-secondary: #22242a;
        --border-color: rgba(255, 255, 255, 0.1);
    }
</style>
