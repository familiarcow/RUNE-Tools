# RUNE Tools UI Style Research

This document serves as the source of truth for UI styling patterns, observations, and decisions for the RUNE Tools application.

---

## Table of Contents

1. [Component Inventory](#component-inventory)
2. [Font Analysis](#font-analysis)
3. [Container Widths](#container-widths)
4. [Color Systems](#color-systems)
5. [Shared Patterns](#shared-patterns)
6. [Component Library Structure](#component-library-structure)
7. [Migration Status](#migration-status)
8. [Observations & Notes](#observations--notes)

---

## Component Inventory

### Reference Components (Favorites)

These are the best-designed components to use as reference when building new features:

| Component | Description | Key Strengths |
|-----------|-------------|---------------|
| **BondTracker.svelte** | Bond tracking dashboard | Best card patterns, uses shared components, proper store integration |
| **Version.svelte** | Network version status | Great visual hierarchy, efficient space usage, compact grids |
| **Vaults.svelte** | Asgard vault viewer | Good card patterns, expandable sections, toast notifications |
| **TCY.svelte** | TCY staking tracker | Form patterns, alert system, distribution table |
| **Nodes.svelte** | Node explorer | Complex table styling, sticky headers, row highlighting |

### Shared Components Currently Available

Located in `src/lib/components/`:

| Component | Used By | Purpose |
|-----------|---------|---------|
| `LoadingBar.svelte` | BondTracker, Version | Shimmer loading animation |
| `StatusIndicator.svelte` | BondTracker | Status dot with pulse animation |
| `ActionButton.svelte` | BondTracker | Icon buttons with color variants |
| `PageHeader.svelte` | Version | Section header with gradient |
| `LinkOutIcon.svelte` | Version | External link icon |

---

## Font Analysis

### Current State (Inconsistent)

| Component | Font Family | Notes |
|-----------|-------------|-------|
| BondTracker.svelte | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif` | System fonts |
| Version.svelte | System fonts | Same as BondTracker |
| Vaults.svelte | System fonts | Same as BondTracker |
| **TCY.svelte** | `'Exo', sans-serif` | **Different** |
| **Nodes.svelte** | `'Exo', sans-serif` | **Different** |

### Recommendation

Standardize on system fonts for most components. The 'Exo' font in TCY and Nodes appears to be legacy and should be migrated unless there's a specific branding reason.

**Standard Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

**Fallback (if Exo is intentional):**
```css
font-family: 'Exo', sans-serif;
```

---

## Container Widths

### Current State

| Component | Max Width | Use Case |
|-----------|-----------|----------|
| BondTracker | 650px | Single-focus dashboard |
| TCY | 600px | Single-focus dashboard |
| Version | 900px | Multi-section layout |
| Vaults | 1400px | Wide grid layout (3-column) |
| Nodes | Full width | Data table with many columns |

### Recommended Standard Widths

| Width | Use Case |
|-------|----------|
| 600-650px | Single-focus dashboards, trackers |
| 800-900px | Multi-section layouts, moderate grids |
| 1200-1400px | Wide grids, data tables |
| Full width | Complex tables with many columns |

---

## Color Systems

### Primary Palette (from CLAUDE.md)

```css
/* Backgrounds */
--bg-main: #1a1a1a;
--bg-card: #2c2c2c;
--bg-card-hover: #3a3a3a;

/* Text */
--text-primary: #ffffff;
--text-secondary: #c0c0c0;
--text-muted: #a0a0a0;

/* Accent Gradients */
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--gradient-card: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);

/* Links */
--color-link: #4A90E2;

/* Status Colors */
--color-success: #28a745;
--color-warning: #ff9800;
--color-error: #dc3545;
--color-info: #6366f1;
```

### TCY-Specific Colors

TCY uses a unique teal accent color for branding:

```css
/* TCY Accent */
--tcy-accent: #28f4af;
--tcy-accent-hover: rgba(40, 244, 175, 0.2);
--tcy-border-hover: rgba(40, 244, 175, 0.1);
--tcy-gradient: linear-gradient(90deg, #28f4af 0%, #1eebeb 100%);
```

### Hover/Focus States

```css
/* Card Hover */
--hover-glow: rgba(99, 102, 241, 0.3);
--hover-border: rgba(99, 102, 241, 0.6);
--hover-transform: translateY(-3px);
--hover-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);

/* Focus States */
--focus-ring: 0 0 0 3px rgba(99, 102, 241, 0.2);
--focus-border: rgba(99, 102, 241, 0.6);
```

---

## Shared Patterns

### 1. Card Pattern (120px Fixed Height)

Used in: BondTracker, TCY, Version

```css
.card {
  background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
  border-radius: 12px;
  padding: 16px;
  height: 120px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  border-color: rgba(99, 102, 241, 0.6);
}

/* Title at top */
.card h3 {
  font-size: 12px;
  margin: 0 0 6px 0;
  color: #a0a0a0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Main value centered */
.card .main-value {
  font-size: 24px;
  font-weight: 800;
  color: #ffffff;
  position: absolute;
  top: 50%;
  left: 16px;
  right: 16px;
  transform: translateY(-50%);
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Sub values at bottom */
.card .sub-values {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #c0c0c0;
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
}
```

**Mobile Adaptation:**
```css
@media (max-width: 600px) {
  .card {
    height: auto;
    min-height: 110px;
  }
  .card .main-value {
    position: static;
    transform: none;
    margin: 8px 0;
    font-size: 22px;
  }
  .card .sub-values {
    position: static;
    margin-top: 8px;
  }
}
```

### 2. Section Pattern

Used in: Version

```css
section {
  background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

### 3. Stat Card Pattern (Compact)

Used in: Version (timing-grid)

```css
.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.75rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: #a0a0a0;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
}
```

### 4. Progress Bar Pattern

Used in: Version

```css
.progress-bar {
  position: relative;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: visible;
}

.progress {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Optional threshold marker */
.threshold-marker {
  position: absolute;
  top: -4px;
  right: 34%; /* Position at threshold */
  width: 2px;
  height: calc(100% + 8px);
  background-color: #ffffff;
  opacity: 0.8;
}
```

### 5. Toast Notification Pattern

Used in: BondTracker, Vaults

```css
.toast {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #4A90E2 0%, #357abd 100%);
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-weight: 600;
  z-index: 1000;
  font-size: 14px;
  max-width: 80%;
  text-align: center;
}
```

### 6. Form Input Pattern

Used in: BondTracker, TCY

```css
input {
  padding: 16px 20px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.6);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2),
              0 0 0 3px rgba(99, 102, 241, 0.2),
              0 0 20px rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}

input::placeholder {
  color: #888888;
}
```

### 7. Table Pattern (Nodes)

Used in: Nodes

```css
.table-container {
  overflow-x: auto;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  border-radius: 8px;
  background-color: #2c2c2c;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* Custom Scrollbar */
.table-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-container::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

/* Sticky Header */
thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  background-color: #1a1a1a;
  color: #888;
  font-weight: 500;
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid #3a3a3c;
  font-size: 0.8125rem;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
```

### 8. Alert Pattern

Used in: TCY

```css
.alerts-section {
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin: 0 20px 20px 20px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ffc107;
  font-size: 14px;
  font-weight: 500;
}

.warning-icon {
  flex-shrink: 0;
  color: #ffc107;
}
```

### 9. Loading Shimmer Animation

```css
.loading-bar {
  background: linear-gradient(90deg, #3a3a3a 25%, #5a5a5a 50%, #3a3a3a 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite ease-in-out;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 10. Header Shimmer Effect

Used in: BondTracker, Vaults

```css
h2 {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  color: #ffffff;
  font-size: 26px;
  font-weight: 800;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

h2::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 5s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}
```

---

## Component Library Structure

### Proposed Directory Structure

```
src/lib/components/
├── primitives/
│   ├── Card.svelte           # 120px fixed card with slots
│   ├── StatCard.svelte       # Compact stat display
│   ├── ProgressBar.svelte    # With threshold marker option
│   ├── Badge.svelte          # Status/percentage badges
│   └── Toast.svelte          # Notification system
├── layout/
│   ├── PageHeader.svelte     # (exists) Section header
│   ├── Section.svelte        # Gradient wrapper
│   ├── Grid.svelte           # 2-col, 3-col, auto-fit
│   └── Container.svelte      # Max-width wrapper
├── forms/
│   ├── FormInput.svelte      # With paste button option
│   ├── SearchInput.svelte    # With clear button
│   └── FormSelect.svelte     # Dropdown select
├── data/
│   ├── DataTable.svelte      # Sticky headers, expandable
│   └── DistributionTable.svelte # TCY-style history table
├── feedback/
│   ├── LoadingBar.svelte     # (exists) Shimmer animation
│   ├── StatusIndicator.svelte # (exists) Status dot
│   ├── Alert.svelte          # Warning/info boxes
│   └── Skeleton.svelte       # Loading placeholders
└── buttons/
    ├── ActionButton.svelte   # (exists) Icon buttons
    └── Button.svelte         # Standard button variants
```

---

## Migration Status

### Components Using Shared Components

| Component | LoadingBar | StatusIndicator | ActionButton | PageHeader | Toast | CSS Vars | Shared Utils |
|-----------|:----------:|:---------------:|:------------:|:----------:|:-----:|:--------:|:------------:|
| BondTracker | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Version | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Vaults** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| TCY | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Nodes | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Migration Log

| Date | Component | Change | Status |
|------|-----------|--------|--------|
| 2024-01 | DataCard.svelte | Updated to use CSS variables | ✅ Tested |
| 2024-01 | Toast.svelte | Created new shared component | ✅ Tested |
| 2024-01 | Vaults.svelte | Migrated inline toast to Toast component | ✅ Tested |
| 2025-01 | Vaults.svelte | Full migration: CSS variables, LoadingBar, shared utils (formatting.js), shared constants (assets.js), removed ~70 lines of duplicate code | ✅ Tested |
| 2025-01 | BondTracker.svelte | Full migration: CSS variables, Toast component (was inline), simplified toast logic | ✅ Tested |

### Migration Priority

1. **High Priority**: Create shared Toast component, migrate BondTracker & Vaults
2. **Medium Priority**: Migrate TCY to use shared components
3. **Low Priority**: Nodes (complex, requires careful handling)

---

## Observations & Notes

### 2024-01 Research Session

1. **BondTracker is the gold standard** for card-based layouts. It properly uses:
   - Shared components (LoadingBar, StatusIndicator, ActionButton)
   - Currency store for multi-currency support
   - Proper loading states with content transitions

2. **TCY and Nodes use 'Exo' font** while all other components use system fonts. This creates visual inconsistency. Need to decide:
   - Standardize to system fonts (recommended)
   - Or keep Exo as intentional branding

3. **TCY has unique accent color (#28f4af)** - This appears intentional for TCY product branding. Consider keeping this as a theme variant rather than standardizing.

4. **Toast notifications are duplicated** in BondTracker and Vaults. Should extract to shared component.

5. **Nodes.svelte is delicate** - It has:
   - Complex table with 14+ columns
   - Row color coding based on node status
   - ISP logo and country emoji mapping
   - Expandable bond provider sections
   - Vault color mapping
   - Changes here require extra care

6. **Version.svelte demonstrates good patterns**:
   - Uses PageHeader with actions slot
   - Clean grid layouts (upgrade-info-grid, timing-grid)
   - Compact stat cards
   - Good mobile responsive stacking

### Testing Environment

- **Default browser**: Brave
- **Testing browser**: Google Chrome (Claude Code Chrome Extension is installed here)
- **Dev URL**: `http://localhost:5173` (or similar from `npm run dev`)
- **Prod URL**: `https://rune.tools`

### Migration Best Practices

Learnings from migrating components to use shared utilities:

1. **Avoid helpers with implicit behavior** - Don't create wrapper functions with magic value checks. Example: a `formatVaultUSD(amount, price)` that treated `price === 1` as "already in USD" created confusing semantics. Use explicit calls like `formatUSD(fromBaseUnit(amount) * price)` instead.

2. **Use `{@const}` in templates** - When calling the same function multiple times in a Svelte template, use `{@const}` to avoid repeated function calls:
   ```svelte
   {#each items as item}
     {@const logo = getAssetLogo(item.asset)}
     {@const name = getAssetDisplayName(item.asset)}
     <img src={logo} alt={name} />
     <span>{name}</span>
   {/each}
   ```

3. **Add error handlers to images** - Asset icons should have `on:error` handlers to fall back gracefully:
   ```svelte
   <img
     src={assetLogo}
     alt={assetName}
     on:error={(e) => {
       e.target.onerror = null;
       e.target.src = '/assets/coins/fallback-logo.svg';
     }}
   />
   ```

4. **Remove migration breadcrumb comments** - Comments like `// formatVaultName is now imported from network.js` are useful during migration but should be removed before committing.

5. **CSS imports pattern** - Each component imports `@import '$lib/styles/variables.css';` at the top of its `<style>` block. This is the current per-component pattern.

### Future Considerations

- [x] Create CSS variables file (`src/lib/styles/variables.css`) - **DONE**
- [x] Create base styles file (`src/lib/styles/base.css`) - **DONE**
- [x] Create index.css entry point (`src/lib/styles/index.css`) - **DONE**
- [ ] Consider CSS-in-JS or CSS modules for better scoping
- [ ] Add Storybook for component documentation
- [ ] Create theme system for TCY-specific colors
- [ ] Consider global CSS variables import vs per-component imports

---

*Last updated: 2025-01*
