# RUNE Tools Shared Infrastructure Reference

This document serves as the reference guide for migrating components to use shared utilities.

---

## Quick Reference: Import Paths

```javascript
// Formatting utilities
import { formatNumber, formatUSD, formatPercentage, simplifyNumber, formatPrice } from '$lib/utils';

// Blockchain utilities
import { fromBaseUnit, toBaseUnit, parseAsset, getAssetShortName, THOR_BASE } from '$lib/utils';

// Asset constants
import { ASSET_LOGOS, getAssetLogo, COINGECKO_IDS, getAssetDisplayName } from '$lib/constants';

// API clients
import { thornode, midgard } from '$lib/api';

// Stores
import { runePrice, subscribeToRunePrice, pools, subscribeToPools } from '$lib/stores';

// UI Components
import { LoadingBar, DataCard, PageHeader, ActionButton, StatusIndicator, AssetIcon, CurrencyToggle } from '$lib/components';
```

---

## 1. FORMATTING UTILITIES

**File:** `/src/lib/utils/formatting.js`

### Available Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `formatNumber(num, options)` | Locale-aware number formatting | `formatNumber(1234567)` → `"1,234,567"` |
| `formatUSD(amount, options)` | USD currency formatting (no decimals) | `formatUSD(1234.56)` → `"$1,235"` |
| `formatUSDWithDecimals(amount, decimals)` | USD with specified decimals | `formatUSDWithDecimals(1.234, 2)` → `"$1.23"` |
| `formatPercentage(num, decimals)` | Percentage with +/- sign | `formatPercentage(0.1523)` → `"+15.23%"` |
| `formatPercentageNoSign(num, decimals)` | Percentage without sign | `formatPercentageNoSign(0.1523)` → `"15.23%"` |
| `simplifyNumber(num)` | Human-readable large numbers | `simplifyNumber(1500000)` → `"1.5M"` |
| `formatPrice(price)` | Dynamic decimals based on magnitude | `formatPrice(0.00123)` → `"0.001230"` |
| `formatCryptoAmount(amount, decimals)` | Crypto amounts (default 8 decimals) | `formatCryptoAmount(1.23456789)` |
| `formatTime(seconds)` | Duration from seconds | `formatTime(90)` → `"1m 30s"` |
| `formatDate(date)` | Date formatting | `formatDate(new Date())` → `"Jan 15, 2026"` |

### Migration Examples

**Before:**
```javascript
const formatNumber = (num) => {
  return new Intl.NumberFormat().format(Math.round(num));
};

const formatUSD = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};
```

**After:**
```javascript
import { formatNumber, formatUSD } from '$lib/utils';
// Just use them directly - no local definitions needed
```

---

## 2. BLOCKCHAIN UTILITIES

**File:** `/src/lib/utils/blockchain.js`

### Available Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `THOR_BASE` | Constant `1e8` | Use instead of hardcoded `1e8` |
| `fromBaseUnit(amount)` | Convert from base units | `fromBaseUnit(100000000)` → `1` |
| `toBaseUnit(amount)` | Convert to base units | `toBaseUnit(1)` → `100000000` |
| `parseAsset(asset)` | Parse asset identifier | Returns `{ chain, symbol, contractAddress, isNative, isSynth }` |
| `getAssetShortName(asset)` | Display-friendly name | `getAssetShortName('ETH.USDC-0X...')` → `"USDC (ETH)"` |
| `getChainFromAsset(asset)` | Extract chain | `getChainFromAsset('ETH.USDC-0X...')` → `"ETH"` |
| `isNativeAsset(asset)` | Check if native | `isNativeAsset('BTC.BTC')` → `true` |
| `isStablecoin(asset)` | Check if stablecoin | `isStablecoin('ETH.USDC-0X...')` → `true` |
| `isEVMChain(chain)` | Check if EVM chain | `isEVMChain('ETH')` → `true` |

### Migration Examples

**Before:**
```javascript
const runeValue = Number(data.balance_rune) / 1e8;
const assetPrice = Number(pool.asset_tor_price) / 1e8;
```

**After:**
```javascript
import { fromBaseUnit } from '$lib/utils';

const runeValue = fromBaseUnit(data.balance_rune);
const assetPrice = fromBaseUnit(pool.asset_tor_price);
```

---

## 3. ASSET CONSTANTS

**File:** `/src/lib/constants/assets.js`

### Available Exports

| Export | Purpose |
|--------|---------|
| `ASSET_LOGOS` | Object mapping asset identifiers to logo paths |
| `getAssetLogo(asset)` | Get logo path with fallback matching |
| `CHAIN_LOGOS` | Object mapping chain names to logo paths |
| `getChainLogo(chain)` | Get chain logo path |
| `COINGECKO_IDS` | Object mapping assets to CoinGecko IDs |
| `getCoinGeckoId(asset)` | Get CoinGecko ID for an asset |
| `ASSET_DISPLAY_NAMES` | Object mapping assets to short display names |
| `getAssetDisplayName(asset)` | Get display name with fallback parsing |

### Migration Examples

**Before:**
```javascript
const assetLogos = {
  'BTC.BTC': '/assets/coins/bitcoin-btc-logo.svg',
  'ETH.ETH': '/assets/coins/ethereum-eth-logo.svg',
  // ... 35+ more entries
};

const logo = assetLogos[pool.asset] || '';
```

**After:**
```javascript
import { getAssetLogo } from '$lib/constants';

const logo = getAssetLogo(pool.asset);
// Handles fallback matching automatically
```

---

## 4. API CLIENTS

**File:** `/src/lib/api/thornode.js` and `/src/lib/api/midgard.js`

### THORNode Client

**Provider Strategy:**

THORNode API providers are defined in array `THORNODE_PROVIDERS`.  Each entry is an object containing multiple attributes:

- `base` (string): base API URL without trailing slash (required)
- `headers` (object): key/value pair of parameters passed to fetch() (optional)
- `supportsBlockHeight` (boolean): whether or not API endpoints supports `?height` HTTP parameter (optional, default false)

### Method Options

All THORNode Client methods support an optional `options` object as the last parameter.

This object is passed onto the private method called `#fetch()` which can contain header information (for standard
JavaScript fetch()) as well keys that act as "control" capabilities for the fetch mechanism itself:

- `cache` (boolean, true): whether or not to cache responses
- `cacheTTL` (integer, 60000): cache entry time-to-live in milliseconds
- `blockHeight` (integer|null): block height to query API information for. Only works with `supportsBlockHeight: true` providers

### Available Methods

| Method | Purpose |
|--------|---------|
| `thornode.getNetwork()` | Get network data (includes RUNE price) |
| `thornode.getUpgradeProposals()` | Get current upgrade proposals |
| `thornode.getUpgradeProposal(name)` | Get current upgrade proposals for the provided name |
| `thornode.getLastBlocks()` | Get last block info for all chains |
| `thornode.getLastBlock(chain)` | Get last block info for provided chain |
| `thornode.getPools()` | Get all pools |
| `thornode.getPool(asset)` | Get specific pool |
| `thornode.getNodes()` | Get all nodes |
| `thornode.getNode(address)` | Get node information via address |
| `thornode.getMimir(key)` | Get Mimir value |
| `thornode.getAllMimir()` | Get all Mimir values |
| `thornode.getMimirAllNodeVotes()` | Get all current node Mimir votes |
| `thornode.getBalance(address)` | Get address balance |
| `thornode.getLiquidityProviders(pool)` | Get all liquidity providers for a pool |
| `thornode.getLiquidityProvider(pool, address)` | Get liquidity provider data via pool and address |
| `thornode.getVaults()` | Get Asgard vaults |
| `thornode.getInboundAddresses()` | Get inbound addresses |
| `thornode.getConstants()` | Get protocol constants |
| `thornode.getStatus()` | Get current block status |
| `thornode.getSwapQuote(params)` | Get swap quote |
| `thornode.getSaver(asset, address)` | Get saver data for asset and address |
| `thornode.getSaverWithdrawQuote(params)` | Get saver withdraw quote |
| `thornode.getThorname(name)` | Get THORName data for name |
| `thornode.getRunePool()` | Get all RUNE Pool information |
| `thornode.getRuneProviders()` | Get all RUNE providers |
| `thornode.getRuneProvider(address)` | Get information for RUNE Provider via address |
| `thornode.getTxStatus(txid)` | Get transaction status via txid |
| `thornode.getLoanQuote(params)` | Get loan open quote |
| `thornode.getLimitSwapsSummary()` | Get limit swaps summary |
| `thornode.getLimitSwaps(params)` | Get limit swaps |
| `thornode.getOutboundFees()` | Get all outbound fees |
| `thornode.getTcyStakers()` | Get all TCY stakers |
| `thornode.getTcyStaker(address)` | Get TCY staker position details via address |
| `thornode.getTcyStakeModuleBalance()` | Get TCY stake module balance (accrued RUNE for distribution) |
| `thornode.getTcyClaimers()` | Get all pending TCY claimants (those who have unclaimed TCY) |
| `thornode.getTcyTotalSupply()` | Get total TCY supply via CMC data |
| `thornode.getSupplyByDenomination(denom)` | Get total supply by asset denomination |
| `thornode.getCosmosBlockByHeight(height)` | Get block details from Cosmos SDK/RPC layer (GetBlockByHeight) |
| `thornode.getOraclePrices()` | Get all available oracle prices |
| `thornode.getSecuredAssets()` | Get total size and ratio of all secured assets |
| `thornode.getSwapperClout(address)` | Get the clout score of an address |
| `thornode.getTradeUnits()` | Get total units and depth for all Trade Assets |
| `thornode.getTreasuryInfo()` | Get Treasury module address and assets/balances |

### Options

```javascript
// Default: Uses Liquify with Nine Realms fallback
await thornode.getNetwork();

// Historical query with block height (uses Archive)
await thornode.getLiquidityProvider(pool, address, { blockHeight: 12345678 });

// Disable caching
await thornode.getNetwork({ cache: false });
```

### Migration Examples

**Before:**
```javascript
const fetchRunePrice = async () => {
  try {
    const response = await fetch('https://thornode.ninerealms.com/thorchain/network');
    const data = await response.json();
    runePrice = Number(data.rune_price_in_tor) / 1e8;
  } catch (err) {
    console.error('Failed to fetch RUNE price:', err);
  }
};
```

**After:**
```javascript
import { getRunePrice } from '$lib/utils/network';

const fetchRunePrice = async () => {
  try {
    runePrice = await getRunePrice();
  } catch (err) {
    console.error('Failed to fetch RUNE price:', err);
  }
};
```

### Midgard Client

**Provider Strategy:**

Midgard API providers are defined in array `MIDGARD_PROVIDERS`.  Each entry is an object containing multiple attributes:

- `base` (string): base API URL without trailing slash (required)
- `headers` (object): key/value pair of parameters passed to fetch() (optional)

### Method Options

All Midgard Client methods support an optional `options` object as the last parameter.

This object is passed onto the private method called `#fetch()` which can contain header information (for standard
JavaScript fetch()) as well keys that act as "control" capabilities for the fetch mechanism itself:

- `cache` (boolean, true): whether or not to cache responses
- `cacheTTL` (integer, 60000): cache entry time-to-live in milliseconds

### Available Methods

| Method | Purpose |
|--------|---------|
| `midgard.getStats()` | Get network stats |
| `midgard.getPoolStats(pool)` | Get pool statistics |
| `midgard.getPools()` | Get all pools |
| `midgard.getSwapHistory(params)` | Get swap history |
| `midgard.getEarningsHistory(params)` | Get earnings history |
| `midgard.getRuneHistory(params)` | Get RUNE price history |
| `midgard.getMember(address)` | Get LP member data |
| `midgard.getActions(params)` | Get transaction actions |
| `midgard.getChurns()` | Get churn history |
| `midgard.getTCYDistribution(address)` | Get TCY distribution |
| `midgard.getBonderDetails(address)` | Get bond provider details |

---

## 5. STORES

**File:** `/src/lib/stores/runePrice.js` and `/src/lib/stores/pools.js`

### RUNE Price Store

Use this instead of fetching RUNE price independently in each component.

```javascript
import { onMount, onDestroy } from 'svelte';
import { runePrice, subscribeToRunePrice } from '$lib/stores';

let unsubscribe;

onMount(() => {
  unsubscribe = subscribeToRunePrice();
});

onDestroy(() => {
  unsubscribe?.();
});

// Use $runePrice in template - auto-updates every 6 seconds
```

**Available Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `runePrice` | Writable store | Current RUNE price in USD |
| `runePriceHistory` | Writable store | Array of `{ price, timestamp }` for charts |
| `runePriceLoading` | Writable store | Loading state |
| `runePriceError` | Writable store | Error message if failed |
| `runePriceFormatted` | Derived store | Formatted price string (`"$1.234567"`) |
| `runePriceChange` | Derived store | `{ absolute, percentage, direction }` |
| `subscribeToRunePrice()` | Function | Start updates, returns unsubscribe fn |
| `refreshRunePrice()` | Function | Force refresh |
| `getRunePriceNow()` | Function | Get current price synchronously |

### Pools Store

Use this instead of fetching pools independently.

```javascript
import { onMount, onDestroy } from 'svelte';
import { pools, poolsWithPrices, subscribeToPools } from '$lib/stores';

let unsubscribe;

onMount(() => {
  unsubscribe = subscribeToPools();
});

onDestroy(() => {
  unsubscribe?.();
});

// Use $pools or $poolsWithPrices in template
```

**Available Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `pools` | Writable store | Raw pool data from THORNode |
| `poolsLoading` | Writable store | Loading state |
| `poolsError` | Writable store | Error message |
| `poolsByAsset` | Derived store | Map of asset → pool for quick lookup |
| `availablePools` | Derived store | Only pools with status "Available" |
| `totalPooledRune` | Derived store | Sum of RUNE across all pools |
| `poolCounts` | Derived store | `{ available, staged, suspended, total }` |
| `poolsWithPrices` | Derived store | Pools with calculated USD prices |
| `subscribeToPools()` | Function | Start updates (60s interval) |
| `getPoolByAsset(asset)` | Function | Get pool by asset synchronously |
| `getAssetPrice(asset)` | Function | Get asset USD price |

---

## 6. MIGRATION CHECKLIST

When migrating a component, check for these patterns:

### Replace Inline Formatting
- [ ] `new Intl.NumberFormat()` → `formatNumber()` or `formatUSD()`
- [ ] `toLocaleString()` for numbers → `formatNumber()`
- [ ] `toFixed()` for percentages → `formatPercentage()`
- [ ] Large number abbreviations → `simplifyNumber()`

### Replace Inline Asset Logos
- [ ] `const assetLogos = { ... }` → `import { getAssetLogo } from '$lib/constants'`
- [ ] Direct object access → `getAssetLogo(asset)`

### Replace Base Unit Conversions
- [ ] `/ 1e8` → `fromBaseUnit()`
- [ ] `* 1e8` → `toBaseUnit()`
- [ ] Hardcoded `1e8` → `THOR_BASE`

### Replace Direct API Calls
- [X] `fetch('https://thornode.ninerealms.com/...')` → `thornode.fetch()` or convenience method
- [X] `fetch('https://midgard.ninerealms.com/...')` → `midgard.fetch()` or convenience method

### Replace Independent Data Fetching
- [ ] RUNE price fetching → `subscribeToRunePrice()` + `$runePrice`
- [ ] Pool data fetching → `subscribeToPools()` + `$pools`

---

## 7. FILE STRUCTURE

```
/src/lib/
├── api/
│   ├── index.js          # Re-exports: thornode, midgard, ENDPOINTS
│   ├── thornode.js       # THORNode client with Liquify/Nine Realms failover
│   └── midgard.js        # Midgard client with 30s caching
├── components/
│   ├── index.js          # Re-exports all UI components
│   ├── LoadingBar.svelte # Shimmer loading placeholder
│   ├── DataCard.svelte   # Card container with loading/error states
│   ├── PageHeader.svelte # Section header with gradient
│   ├── ActionButton.svelte # Action button with variants
│   ├── StatusIndicator.svelte # Status dot with pulse
│   ├── AssetIcon.svelte  # Asset logo with fallback
│   └── CurrencyToggle.svelte # RUNE/USD toggle
├── constants/
│   ├── index.js          # Re-exports all constants
│   └── assets.js         # ASSET_LOGOS, CHAIN_LOGOS, COINGECKO_IDS
├── stores/
│   ├── index.js          # Re-exports all stores
│   ├── audioStore.js     # Existing audio state
│   ├── runePrice.js      # Shared RUNE price (6s refresh)
│   └── pools.js          # Shared pool data (60s refresh)
├── utils/
│   ├── index.js          # Re-exports all utilities
│   ├── formatting.js     # formatNumber, formatUSD, simplifyNumber, etc.
│   └── blockchain.js     # fromBaseUnit, parseAsset, THOR_BASE, etc.
└── [64 existing components]
```

---

## 8. UI COMPONENTS

**Directory:** `/src/lib/components/`

### Quick Reference: Import Paths

```javascript
import {
  LoadingBar,
  DataCard,
  PageHeader,
  ActionButton,
  StatusIndicator,
  AssetIcon,
  CurrencyToggle
} from '$lib/components';
```

### LoadingBar

Shimmer loading placeholder for skeleton loading states.

```svelte
<script>
  import { LoadingBar } from '$lib/components';
</script>

<!-- Preset variants -->
<LoadingBar variant="main" />   <!-- 28px height, 60% width -->
<LoadingBar variant="sub" />    <!-- 12px height, 80% width -->
<LoadingBar variant="inline" /> <!-- 16px height, 100px width -->

<!-- Custom dimensions -->
<LoadingBar variant="custom" width="200px" height="24px" />

<!-- Override width on any variant -->
<LoadingBar variant="main" width="80%" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'main'` \| `'sub'` \| `'inline'` \| `'custom'` | `'main'` | Preset size variant |
| `width` | `string` | Based on variant | CSS width value |
| `height` | `string` | Based on variant | CSS height value (custom only) |

---

### DataCard

Standard card container with loading and error states.

```svelte
<script>
  import { DataCard } from '$lib/components';

  let loading = true;
  let error = null;
</script>

<DataCard title="Total Value" {loading} {error}>
  <span class="main-value">$1,234,567</span>
  <span class="sub-value">12,345 RUNE</span>
</DataCard>

<!-- Compact variant -->
<DataCard title="Price" compact height="80px">
  <span>$1.23</span>
</DataCard>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `''` | Card title (uppercase, small) |
| `loading` | `boolean` | `false` | Show loading shimmer |
| `error` | `string` | `null` | Error message to display |
| `height` | `string` | `'120px'` | Card height |
| `compact` | `boolean` | `false` | Use compact padding |

---

### PageHeader

Section header with gradient background and shimmer effect.

```svelte
<script>
  import { PageHeader, ActionButton } from '$lib/components';
</script>

<PageHeader title="Supply Tracker" subtitle="Real-time RUNE metrics">
  <div slot="actions">
    <ActionButton variant="refresh" on:click={handleRefresh}>
      ↻
    </ActionButton>
  </div>
</PageHeader>

<!-- Without shimmer -->
<PageHeader title="Settings" showShimmer={false} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `''` | Header title |
| `subtitle` | `string` | `''` | Optional subtitle |
| `showShimmer` | `boolean` | `true` | Enable shimmer animation |

**Slots:**
- `actions` - Content displayed on the right side (buttons, etc.)

---

### ActionButton

Standard action button with color variants.

```svelte
<script>
  import { ActionButton } from '$lib/components';
</script>

<ActionButton variant="refresh" title="Refresh" on:click={handleRefresh}>
  ↻
</ActionButton>

<ActionButton variant="bookmark" title="Save" active={isSaved}>
  ★
</ActionButton>

<ActionButton variant="copy" size="small" on:click={handleCopy}>
  📋
</ActionButton>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'refresh'` \| `'bookmark'` \| `'copy'` \| `'currency'` \| `'external'` \| `'default'` | `'default'` | Color scheme |
| `title` | `string` | `''` | Tooltip text |
| `disabled` | `boolean` | `false` | Disable button |
| `active` | `boolean` | `false` | Active/selected state |
| `size` | `'small'` \| `'medium'` \| `'large'` | `'medium'` | Button size (32/44/56px) |

**Variant Colors:**
- `refresh`: Purple (`#6366f1`)
- `bookmark`: Green (`#28a745`)
- `copy`: Blue (`#4A90E2`)
- `currency`: Yellow (`#ffc107`)
- `external`: Gray (`#6c757d`)

---

### StatusIndicator

Colored status dot with optional pulse animation.

```svelte
<script>
  import { StatusIndicator } from '$lib/components';
</script>

<StatusIndicator status="active" />
<StatusIndicator status="standby" label="Standby" />
<StatusIndicator status="inactive" pulse={false} />
<StatusIndicator status="error" size="large" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'active'` \| `'standby'` \| `'inactive'` \| `'disabled'` \| `'warning'` \| `'error'` | `'inactive'` | Status type |
| `pulse` | `boolean` | Auto (true for active) | Enable pulse animation |
| `size` | `'small'` \| `'medium'` \| `'large'` | `'medium'` | Dot size (8/10/12px) |
| `label` | `string` | `''` | Optional text label |

**Status Colors:**
- `active`: Green (`#28a745`)
- `standby` / `warning`: Orange (`#ff9800`)
- `inactive` / `disabled`: Gray (`#6c757d` / `#4a4a4a`)
- `error`: Red (`#dc3545`)

---

### AssetIcon

Asset logo with automatic fallback.

```svelte
<script>
  import { AssetIcon } from '$lib/components';
</script>

<AssetIcon asset="BTC.BTC" />
<AssetIcon asset="ETH.USDC-0X..." size="large" />
<AssetIcon asset="UNKNOWN.TOKEN" showFallback />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asset` | `string` | `''` | Asset identifier |
| `size` | `'small'` \| `'medium'` \| `'large'` \| `'xlarge'` | `'medium'` | Icon size (16/24/32/48px) |
| `alt` | `string` | Asset display name | Alt text |
| `showFallback` | `boolean` | `true` | Show letter fallback if no logo |

---

### CurrencyToggle

RUNE/USD toggle switch.

```svelte
<script>
  import { CurrencyToggle } from '$lib/components';

  let showUSD = false;
</script>

<CurrencyToggle bind:showUSD />

<!-- With change handler -->
<CurrencyToggle
  {showUSD}
  on:change={(e) => showUSD = e.detail.showUSD}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showUSD` | `boolean` | `false` | Current state (true = USD) |

**Events:**
- `change` - Fired when toggled, with `{ detail: { showUSD: boolean } }`

---

### Migration Examples

**Before (inline loading bar):**
```svelte
<div class="loading-bar" style="height: 28px; width: 60%;"></div>

<style>
  .loading-bar {
    background: linear-gradient(90deg, #3a3a3a 25%, #5a5a5a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite ease-in-out;
    border-radius: 4px;
  }
  @keyframes shimmer { ... }
</style>
```

**After:**
```svelte
<script>
  import { LoadingBar } from '$lib/components';
</script>

<LoadingBar variant="main" />
```

**Before (inline status indicator):**
```svelte
<span class="status-dot {pool.status.toLowerCase()}"></span>

<style>
  .status-dot { width: 10px; height: 10px; border-radius: 50%; }
  .status-dot.available { background: #28a745; }
  .status-dot.staged { background: #ff9800; }
</style>
```

**After:**
```svelte
<script>
  import { StatusIndicator } from '$lib/components';

  $: status = pool.status === 'Available' ? 'active' :
              pool.status === 'Staged' ? 'standby' : 'inactive';
</script>

<StatusIndicator {status} />
```

---

### Pending UI Components

These patterns may be extracted as needed during migrations:

| Pattern | Used In | Notes |
|---------|---------|-------|
| Toast/Notification | SaversPosition, Rune, Supply | Success/error messages |
| ProgressBar | Supply, ChurnCountdown | Timed progress indicators |
| Tooltip | Various | Hover information |
| Modal | Various | Popup dialogs |

---

## 9. ORIGINAL ANALYSIS STATISTICS

| Category | Count | Impact |
|----------|-------|--------|
| Components with duplicate `assetLogos` | 11 | ~385 lines saved |
| Components fetching RUNE price independently | 9 | Eliminated redundant calls |
| Components with inline formatting functions | 15+ | ~200 lines saved |
| `/ 1e8` conversions | 70+ instances | Consistent handling |
| `/thorchain/network` calls | 10+ | Shared via store |
| `/thorchain/pools` calls | 15+ | Shared via store |
