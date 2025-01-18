<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

//This app currently does not check free asset value on chains other than THORChain

    const THOR_ADDRESSES = [
        {
            address: 'thor10qh5272ktq4wes8ex343ky9rsuehcypddjh08k',
            label: 'Treasury Vultisig'
        }
    ];

    const LP_ASSETS = [
        'BCH.BCH',
        'BSC.BNB',
        'BTC.BTC',
        'ETH.ETH',
        'LTC.LTC',
        'DOGE.DOGE',
        'AVAX.AVAX',
        'GAIA.ATOM',
        'THOR.THOR',
        'BASE.ETH',
        'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
        'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
        'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
        'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
        'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0',
        'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1',
        'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD',
        'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF',
        'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913'
    ];

    const THOR_API = 'https://thornode.ninerealms.com/cosmos/bank/v1beta1/balances';
    const MIDGARD_API = 'https://midgard.ninerealms.com/v2/member';
    const TREASURY_LP_API = 'https://thornode.ninerealms.com/thorchain/balance/module/treasury';
    
    const chainIcons = {
        BTC: '/assets/chains/BTC.svg',
        ETH: '/assets/chains/ETH.svg',
        BCH: '/assets/chains/BCH.svg',
        LTC: '/assets/chains/LTC.svg',
        DOGE: '/assets/chains/DOGE.svg',
        AVAX: '/assets/chains/AVAX.svg',
        BSC: '/assets/chains/BSC.svg',
        GAIA: '/assets/chains/GAIA.svg',
        THOR: '/assets/chains/THOR.svg',
        BASE: '/assets/chains/BASE.svg'
    };
    
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
        'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'assets/coins/usd-coin-usdc-logo.svg',
        'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'assets/coins/tether-usdt-logo.svg',
        'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599': 'assets/coins/wrapped-bitcoin-wbtc-logo.svg',
        'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'assets/coins/usd-coin-usdc-logo.svg',
        'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'assets/coins/tether-usdt-logo.svg',
        'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D': 'assets/coins/usd-coin-usdc-logo.svg',
        'BSC.USDT-0X55D398326F99059FF775485246999027B3197955': 'assets/coins/tether-usdt-logo.svg',
        'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'assets/coins/multi-collateral-dai-dai-logo.svg',
        'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD': 'assets/coins/gemini-dollar-gusd-logo.svg',
        'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0': 'assets/coins/liquity-usd-logo.svg',
        'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1': 'assets/coins/paxos-standard-usdp-logo.svg',
        'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9': 'assets/coins/aave-aave-logo.svg',
        'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B': 'assets/coins/dpi-logo.png',
        'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA': 'assets/coins/chainlink-link-logo.svg',
        'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F': 'assets/coins/synthetix-snx-logo.svg',
        'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D': 'assets/coins/fox-token-fox-logo.svg',
        'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F': 'assets/coins/solana-sol-logo.svg',
        'BASE.ETH': 'assets/coins/ethereum-eth-logo.svg',
        'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913': 'assets/coins/usd-coin-usdc-logo.svg',
        'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF': 'assets/coins/coinbase-wrapped-btc-logo.svg',
        'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003': 'assets/coins/twt-logo.png',
        'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044': 'assets/coins/thorswap-logo.png',
        'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D': 'assets/coins/thorswap-logo.png',
        'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C': 'assets/coins/xrune-logo.png',
        'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325': 'assets/coins/tgt-logo.png'
    };
    
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
        }).format(Number(amount) / 1e8);
    }

    function formatUSD(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    function formatUSDWithDecimals(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function formatAssetName(denom) {
        if (denom === 'rune') return 'RUNE';
        return denom.toUpperCase();
    }

    function formatPoolName(pool) {
        // Split on hyphen and take the first part
        return pool.split('-')[0];
    }

    async function fetchRunePrice() {
        try {
            const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
            const data = await response.json();
            runePrice = Number(data.rune_price_in_tor) / 1e8;
        } catch (e) {
            console.error('Error fetching RUNE price:', e);
        }
    }

    async function fetchAssetPrices() {
        try {
            const response = await fetch('https://thornode.ninerealms.com/thorchain/pools');
            const pools = await response.json();
            
            // Create a price map for all assets
            const priceMap = pools.reduce((acc, pool) => {
                acc[pool.asset] = Number(pool.asset_tor_price) / 1e8;
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
                const encodedAsset = encodeURIComponent(asset);
                const url = `https://thornode.ninerealms.com/thorchain/pool/${encodedAsset}/liquidity_provider/${address}`;
                
                try {
                    const response = await fetch(url);
                    
                    // If response is not ok (404 etc), skip this asset
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    // Only add if there are actual LP positions (units > 0)
                    if (data.units && Number(data.units) > 0) {
                        lpPositions.push({
                            pool: formatPoolName(data.asset),
                            fullPool: data.asset,
                            assetAmount: Number(data.asset_redeem_value) / 1e8,
                            runeAmount: Number(data.rune_redeem_value) / 1e8,
                            assetAddress: data.rune_address // Using rune_address as identifier
                        });
                    }
                } catch (e) {
                    console.error(`Error fetching LP position for ${asset}:`, e);
                    // Continue with next asset even if one fails
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
            const treasuryResponse = await fetch(TREASURY_LP_API);
            const treasuryData = await treasuryResponse.json();
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
                fetchRunePrice(),
                fetchAssetPrices()
            ]);
            
            // Use the updated addresses array
            const results = await Promise.all(
                addresses.map(async ({address, label}) => {
                    const balanceResponse = await fetch(`${THOR_API}/${address}`);
                    const balanceData = await balanceResponse.json();
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

    function shortenAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 8)}...${address.slice(-8)}`;
    }

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

        // Add up bond values
        for (const bond of bonds) {
            total += (Number(bond.amount) / 1e8) * runePrice;
        }

        return total;
    }

    // Helper function to format RUNE amount
    function formatRune(amount) {
        return (amount / 1e8).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Helper function to get last 4 chars of address
    function getLastFour(address) {
        return address.slice(-4);
    }

    // Add the nodes API endpoint
    const NODES_API = 'https://thornode.ninerealms.com/thorchain/nodes';

    // Add function to fetch and process bonds
    async function fetchBonds() {
        try {
            const response = await fetch(NODES_API);
            const nodes = await response.json();
            
            // Process each node to find bonds from our addresses
            const allBonds = [];
            
            nodes.forEach(node => {
                if (node.bond_providers?.providers) {
                    node.bond_providers.providers.forEach(provider => {
                        // Check if the provider is one of our tracked addresses
                        const matchingAddress = THOR_ADDRESSES.find(addr => addr.address === provider.bond_address);
                        if (matchingAddress) {
                            allBonds.push({
                                nodeAddress: node.node_address,
                                amount: Number(provider.bond),
                                bondAddress: provider.bond_address
                            });
                        }
                    });
                }
            });
            
            bonds = allBonds;
        } catch (e) {
            console.error('Failed to fetch bonds:', e);
            bonds = [];
        }
    }

    function calculateTotalBondValue(bondsList) {
        return bondsList.reduce((total, bond) => {
            return total + ((Number(bond.amount) / 1e8) * runePrice);
        }, 0);
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

    // Update onMount to include bond fetching
    onMount(() => {
        Promise.all([
            fetchThorBalances(),
            fetchBonds()
        ]);
    });
</script>

<main>
    <div class="container">
        <h1>Treasury Positions</h1>
        
        {#if !loading && !error}
            <div class="stats-container">
                <div class="stat-box">
                    <span class="stat-label">Total Treasury Value</span>
                    <span class="stat-value">{formatUSD(calculateTotalValue(balances))}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Total Bond Value</span>
                    <span class="stat-value">{formatUSD(calculateTotalBondValue(bonds))}</span>
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
                            {#if balances.length > 0 && balances.some(b => b.denom === 'rune' && Number(b.amount) > 0)}
                                <div class="section-container">
                                    <h3>Balances</h3>
                                    <div class="balances-container">
                                        {#each balances as balance}
                                            <div class="amount-row">
                                                <div class="logo-container small">
                                                    <img 
                                                        src={assetLogos['THOR.RUNE']} 
                                                        alt="THOR"
                                                        class="asset-icon"
                                                        on:error={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/assets/coins/fallback-logo.svg';
                                                        }}
                                                    />
                                                    <div class="chain-logo-container">
                                                        <img 
                                                            src={chainIcons['THOR']} 
                                                            alt="THOR"
                                                            class="chain-icon"
                                                            on:error={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = '/assets/chains/fallback-logo.svg';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <span class="amount">{formatAmount(balance.amount)}</span>
                                                {#if balance.denom === 'rune' && runePrice}
                                                    <span class="usd-value">
                                                        {formatUSD((Number(balance.amount) / 1e8) * runePrice)}
                                                    </span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if lpPositions.length > 0}
                                <div class="section-container">
                                    <h3>LP Positions</h3>
                                    {#each lpPositions as position}
                                        <div class="lp-container">
                                            <div class="lp-row">
                                                <div class="pool-header">
                                                    <div class="asset-info">
                                                        <div class="logo-container">
                                                            <img 
                                                                src={assetLogos[position.fullPool] || `/assets/coins/fallback-logo.svg`}
                                                                alt={position.pool}
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={chainIcons[position.pool.split('.')[0]]} 
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
                                                        <span class="amount">{position.assetAmount.toFixed(2)}</span>
                                                        <div class="logo-container small">
                                                            <img 
                                                                src={assetLogos[position.fullPool] || `/assets/coins/fallback-logo.svg`}
                                                                alt={position.pool}
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={chainIcons[position.pool.split('.')[0]]} 
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
                                                        <span class="amount">{position.runeAmount.toFixed(2)}</span>
                                                        <div class="logo-container small">
                                                            <img 
                                                                src={assetLogos['THOR.RUNE']} 
                                                                alt="RUNE"
                                                                class="asset-icon"
                                                                on:error={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/assets/coins/fallback-logo.svg';
                                                                }}
                                                            />
                                                            <div class="chain-logo-container">
                                                                <img 
                                                                    src={chainIcons['THOR']} 
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
                                                <span class="node-address">{getLastFour(bond.nodeAddress)}</span>
                                                <span class="amount">{formatRune(bond.amount)}</span>
                                                <div class="logo-container small">
                                                    <img 
                                                        src={assetLogos['THOR.RUNE']} 
                                                        alt="RUNE"
                                                        class="asset-icon"
                                                        on:error={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = '/assets/coins/fallback-logo.svg';
                                                        }}
                                                    />
                                                    <div class="chain-logo-container">
                                                        <img 
                                                            src={chainIcons['THOR']} 
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
                                                        {formatUSD((bond.amount / 1e8) * runePrice)}
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

    h1 {
        text-align: center;
        margin-bottom: 2rem;
        font-size: 1.5rem;
        color: var(--text-color);
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
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
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

        h1 {
            font-size: 1.2rem;
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

    :root {
        --surface-color-dark: #1a1b1e;
        --surface-color-secondary: #22242a;
        --border-color: rgba(255, 255, 255, 0.1);
    }
</style>
