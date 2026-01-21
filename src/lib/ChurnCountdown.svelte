<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { thornode } from '$lib/api';
  import { getRecentChurns, getChurnInfo } from '$lib/utils/nodes';
  import { getCurrentBlock } from '$lib/utils/network';
  import { CopyIcon, CheckIcon, ChevronDownIcon } from '$lib/components';

  // State
  let isLoading = true;
  let errorMessage = '';
  let isChurningHalted = false;         // from Mimir HALTCHURNING

  let churnIntervalBlocks = 0;          // from Mimir CHURNINTERVAL
  let lastChurnHeight = 0;              // from Midgard churns
  let lastChurnTimestampSec = 0;        // from Midgard churns
  let nextChurnHeight = 0;              // from Network (if provided) or computed

  let currentHeight = 0;                // from Cosmos latest block

  // Dynamic seconds-per-block sampling (reduces reliance on constant 6s)
  const spbSamples = [];                // recent seconds-per-block samples
  const maxSamples = 8;
  let lastSample = null;                // { tSec, height }

  let blocksRemaining = 0;
  let percentComplete = 0;              // 0..100
  let formattedCountdown = '--:--:--';
  let etaSecRemaining = 0;
  let remainingH = 0, remainingM = 0, remainingS = 0;
  let showCopiedNext = false;
  let showCopiedCurrent = false;
  let spbEst = 6;                       // seconds-per-block estimate (last N blocks)

  // SVG ring geometry
  const RADIUS = 100;
  const STROKE = 12;
  const CIRC = 2 * Math.PI * RADIUS;
  let fractionComplete = 0;             // 0..1 (time-based for smoothness)
  let strokeOffset = CIRC;              // stroke-dashoffset
  let estNextSec = 0;                   // smoothed estimate of next churn unix seconds
  const SMOOTH_ALPHA = 0.08;            // smoothing factor for ETA corrections (0..1)
  const MAX_CORRECTION_PER_TICK = 2;    // cap ETA adjustments per recompute (seconds)
  let displayEtaSecRemaining = 0;       // monotonic, smoothed countdown for display (float seconds)
  let lastTickNowSec = 0;               // last time we updated display ETA
  const MAX_DROP_PER_TICK = 0.8;        // cap downward jump per tick (seconds)

  
  async function copyNextChurn() {
    try {
      await navigator.clipboard.writeText(String(nextChurnHeight));
      showCopiedNext = true;
      setTimeout(() => (showCopiedNext = false), 1500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }

  async function copyCurrentHeight() {
    try {
      await navigator.clipboard.writeText(String(currentHeight));
      showCopiedCurrent = true;
      setTimeout(() => (showCopiedCurrent = false), 1500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }

  let recentChurns = [];
  let showChurns = false;

  let tickTimer;        // updates display every second
  let sampleTimer;      // polls height every few seconds and updates SPB
  let metadataTimer;    // refreshes churn interval and network hints

  // Data loaders
  async function loadChurnData() {
    // Fetch recent churns from shared utility
    const churns = await getRecentChurns(10, { cache: false });
    if (churns.length === 0) throw new Error('No churns returned');

    const latest = churns[0];
    lastChurnHeight = latest.height;
    lastChurnTimestampSec = latest.timestampSec;

    // Keep a small list of recent churns for expandable view
    recentChurns = churns.map((c) => ({
      height: c.height,
      tsSec: c.timestampSec,
      delta: c.deltaBlocks
    }));

    // Get churn interval and halt status from shared utility
    const churnInfo = await getChurnInfo(lastChurnTimestampSec, { cache: false });
    churnIntervalBlocks = churnInfo.churnIntervalBlocks;
    isChurningHalted = churnInfo.isHalted;
  }

  async function loadNetworkNextChurnHint() {
    const data = await thornode.fetch('/thorchain/network', { cache: false });
    // Try a few common field names used over time
    const candidates = ['next_churn_height', 'churn_height', 'churnHeight', 'nextChurnHeight'];
    for (const key of candidates) {
      if (data && data[key] != null) {
        const val = Number(data[key]);
        if (Number.isFinite(val) && val > 0) {
          nextChurnHeight = val;
          return;
        }
      }
    }
    // If network does not expose next churn height, compute from last churn + interval
    if (lastChurnHeight && churnIntervalBlocks) {
      nextChurnHeight = lastChurnHeight + churnIntervalBlocks;
    }
  }

  async function loadCurrentHeight() {
    // Use shared utility with fallback endpoints
    const height = await getCurrentBlock();
    if (height > 0) {
      currentHeight = height;
    } else {
      throw new Error('Could not resolve current block height');
    }
  }

  // Estimate seconds-per-block using the average over last N blocks (default 10)
  async function updateSpbFromLastN(n = 10) {
    if (!currentHeight || currentHeight <= n + 1) return;
    try {
      const [newest, oldest] = await Promise.all([
        thornode.fetch(`/cosmos/base/tendermint/v1beta1/blocks/${currentHeight}`, { cache: false }),
        thornode.fetch(`/cosmos/base/tendermint/v1beta1/blocks/${currentHeight - n}`, { cache: false })
      ]);
      const tNewStr = newest?.block?.header?.time;
      const tOldStr = oldest?.block?.header?.time;
      if (!tNewStr || !tOldStr) return;
      const tNew = new Date(tNewStr).getTime() / 1000;
      const tOld = new Date(tOldStr).getTime() / 1000;
      const dSec = tNew - tOld;
      const spb = dSec / n;
      if (Number.isFinite(spb) && spb > 0.5 && spb < 60) {
        spbEst = spb;
      }
    } catch (e) {
      console.warn('SPB lastN update failed', e);
    }
  }

  async function seedSpbFromHistory(lookback = 120) {
    if (!currentHeight || currentHeight <= lookback + 1) return; // not enough history
    try {
      const [newest, oldest] = await Promise.all([
        thornode.fetch(`/cosmos/base/tendermint/v1beta1/blocks/${currentHeight}`, { cache: false }),
        thornode.fetch(`/cosmos/base/tendermint/v1beta1/blocks/${currentHeight - lookback}`, { cache: false })
      ]);
      const tNewStr = newest?.block?.header?.time;
      const tOldStr = oldest?.block?.header?.time;
      if (!tNewStr || !tOldStr) return;
      const tNew = new Date(tNewStr).getTime() / 1000;
      const tOld = new Date(tOldStr).getTime() / 1000;
      const dSec = tNew - tOld;
      const spb = dSec / lookback;
      if (Number.isFinite(spb) && spb > 0.5 && spb < 60) {
        // seed samples with this baseline
        spbSamples.length = 0;
        const seedCount = Math.min(maxSamples, 4);
        for (let i = 0; i < seedCount; i++) spbSamples.push(spb);
      }
    } catch (e) {
      console.warn('SPB seed failed', e);
    }
  }

  function sampleSecondsPerBlock(newHeight) {
    const nowSec = Date.now() / 1000;
    if (lastSample) {
      const dBlocks = newHeight - lastSample.height;
      const dSec = nowSec - lastSample.tSec;
      if (dBlocks > 0 && dSec > 0) {
        const spb = dSec / dBlocks;
        spbSamples.push(spb);
        if (spbSamples.length > maxSamples) spbSamples.shift();
      }
    }
    lastSample = { tSec: nowSec, height: newHeight };
  }

  function getAvgSecondsPerBlock() {
    // Retained for fallback/compat but we prefer spbEst from last N blocks.
    if (spbSamples.length === 0) return spbEst;
    const sorted = [...spbSamples].sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function updateComputed(isTick = false) {
    if (!currentHeight || !nextChurnHeight || !lastChurnHeight) return;
    const spb = spbEst || getAvgSecondsPerBlock();
    const totalBlocks = Math.max(1, nextChurnHeight - lastChurnHeight);
    const progressedBlocks = Math.max(0, Math.min(totalBlocks, currentHeight - lastChurnHeight));
    blocksRemaining = Math.max(0, nextChurnHeight - currentHeight);
    percentComplete = Math.round((progressedBlocks / totalBlocks) * 100);

    // Time estimates
    const rawNextSec = lastChurnTimestampSec + (totalBlocks * spb);
    // Initialize smoothed target once
    if (!estNextSec) estNextSec = rawNextSec;
    // Smoothly correct towards new raw estimate to avoid jumps
    const delta = rawNextSec - estNextSec;
    const correction = Math.max(-MAX_CORRECTION_PER_TICK, Math.min(MAX_CORRECTION_PER_TICK, delta * SMOOTH_ALPHA));
    estNextSec = estNextSec + correction;

    const now = Math.floor(Date.now() / 1000);
    etaSecRemaining = Math.max(0, estNextSec - now);

    // Initialize display on first compute
    if (!displayEtaSecRemaining) {
      displayEtaSecRemaining = etaSecRemaining;
      lastTickNowSec = now;
    }

    // Only update the visible countdown on the 1s tick; other refreshes won't cause extra drops
    if (isTick) {
      // Always drop ~1s per tick
      displayEtaSecRemaining = Math.max(0, displayEtaSecRemaining - 1);
      // Apply small additional catch-up if our internal target is earlier, but never more than MAX_DROP_PER_TICK
      const delta = etaSecRemaining - displayEtaSecRemaining; // negative => need to catch up (drop more)
      if (delta < 0) {
        const extra = Math.min(MAX_DROP_PER_TICK, -delta);
        displayEtaSecRemaining = Math.max(0, displayEtaSecRemaining - extra);
      }
      lastTickNowSec = now;
    }

    remainingH = Math.floor(displayEtaSecRemaining / 3600);
    remainingM = Math.floor((displayEtaSecRemaining % 3600) / 60);
    remainingS = Math.floor(displayEtaSecRemaining % 60);

    const hh = String(remainingH).padStart(2, '0');
    const mm = String(remainingM).padStart(2, '0');
    const ss = String(remainingS).padStart(2, '0');
    formattedCountdown = `${hh}:${mm}:${ss}`;

    // Smooth ring progress based on time
    const denom = Math.max(1, estNextSec - lastChurnTimestampSec);
    fractionComplete = Math.max(0, Math.min(1, (now - lastChurnTimestampSec) / denom));
    strokeOffset = CIRC * (1 - fractionComplete);
  }

  // Reactive split digits for animated rendering
  $: hStr = String(remainingH).padStart(2, '0');
  $: mStr = String(remainingM).padStart(2, '0');
  $: sStr = String(remainingS).padStart(2, '0');
  $: h0 = hStr[0]; $: h1 = hStr[1];
  $: m0 = mStr[0]; $: m1 = mStr[1];
  $: s0 = sStr[0]; $: s1 = sStr[1];

  // Expose current estimated seconds-per-block for display (prefer last-N average)
  $: estSecondsPerBlock = (Number.isFinite(spbEst) && spbEst > 0) ? spbEst : getAvgSecondsPerBlock();

  async function initialize() {
    isLoading = true;
    errorMessage = '';
    try {
      // Load churn data (recent churns, interval, halt status) using shared utilities
      await loadChurnData();
      await loadNetworkNextChurnHint();
      await loadCurrentHeight();
      await updateSpbFromLastN(10);
      sampleSecondsPerBlock(currentHeight);
      updateComputed(true);

      // Sample height every 5 seconds to refine SPB and progress
      sampleTimer = setInterval(async () => {
        try {
          await loadCurrentHeight();
          await updateSpbFromLastN(10);
          sampleSecondsPerBlock(currentHeight);
          updateComputed(false);
        } catch (e) {
          console.error('Height sample failed', e);
        }
      }, 5000);

      // UI tick every 1s to keep the countdown smooth
      tickTimer = setInterval(() => {
        updateComputed(true);
      }, 1000);

      // Refresh churn data periodically (in case of parameter change or churn)
      metadataTimer = setInterval(async () => {
        try {
          await loadChurnData();
          await loadNetworkNextChurnHint();
          updateComputed(false);
        } catch (e) {
          console.error('Metadata refresh failed', e);
        }
      }, 60_000);
    } catch (e) {
      console.error(e);
      errorMessage = e.message || 'Failed to load churn data';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    initialize();
    return () => {
      if (tickTimer) clearInterval(tickTimer);
      if (sampleTimer) clearInterval(sampleTimer);
      if (metadataTimer) clearInterval(metadataTimer);
    };
  });
</script>

<div class="cc-card">
  <div class="app-header">
    <img src="assets/coins/thorchain-rune-logo.svg" alt="THORChain Logo" class="cc-logo" />
    <div class="cc-titles">
      <h2>THORChain Churn Countdown</h2>
      <div class="cc-sub-row">
        <div class="cc-sub">
          <span class="pill-label">Next</span>
          <span class="mono">{nextChurnHeight?.toLocaleString?.() || '-'}</span>
          {#if nextChurnHeight}
            <button
              class="copy-btn"
              aria-label="Copy next churn height"
              title="Copy next churn height"
              on:click={copyNextChurn}
            >
              {#if showCopiedNext}
                <CheckIcon size={16} color="#11d48a" />
              {:else}
                <CopyIcon size={16} />
              {/if}
            </button>
          {/if}
        </div>
        <div class="cc-sub">
          <span class="pill-label alt">Current</span>
          <span class="mono">{currentHeight ? currentHeight.toLocaleString() : '-'}</span>
          {#if currentHeight}
            <button
              class="copy-btn"
              aria-label="Copy current height"
              title="Copy current height"
              on:click={copyCurrentHeight}
            >
              {#if showCopiedCurrent}
                <CheckIcon size={16} color="#11d48a" />
              {:else}
                <CopyIcon size={16} />
              {/if}
            </button>
          {/if}
        </div>
        <div class="cc-sub">
          <span class="pill-label">Est. sec/block</span>
          <span class="mono">{estSecondsPerBlock.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="cc-loading">Loading…</div>
  {:else if errorMessage}
    <div class="cc-error">{errorMessage}</div>
  {:else}
    <div class="cc-body">
      {#if isChurningHalted}
        <div class="halted-banner" transition:fade={{ duration: 200 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Churning is currently <strong>PAUSED</strong> by mimir</span>
        </div>
      {/if}
      <div class="digital" class:dimmed={isChurningHalted} style="--digit-h: 86px; --digit-w: 64px; justify-content: center;">
        <div class="group">
          <div class="digit">
            {#key h0}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{h0}</span>
            {/key}
          </div>
          <div class="digit">
            {#key h1}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{h1}</span>
            {/key}
          </div>
          <div class="label">Hours</div>
        </div>
        <div class="colon-wrap"><span class="colon">:</span></div>
        <div class="group">
          <div class="digit">
            {#key m0}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{m0}</span>
            {/key}
          </div>
          <div class="digit">
            {#key m1}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{m1}</span>
            {/key}
          </div>
          <div class="label">Minutes</div>
        </div>
        <div class="colon-wrap"><span class="colon">:</span></div>
        <div class="group">
          <div class="digit">
            {#key s0}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{s0}</span>
            {/key}
          </div>
          <div class="digit">
            {#key s1}
              <span class="digit-face" in:fly={{ y: -18, duration: 180 }}>{s1}</span>
            {/key}
          </div>
          <div class="label">Seconds</div>
        </div>
      </div>

      <div class="cc-stats">
        <div class="cc-stat">
          <div class="cc-label">Blocks left</div>
          <div class="cc-value">{blocksRemaining.toLocaleString()}</div>
        </div>
        <div class="cc-stat">
          <div class="cc-label">Interval</div>
          <div class="cc-value">{churnIntervalBlocks.toLocaleString()} blocks</div>
        </div>
        <div class="cc-stat">
          <div class="cc-label">Last churn</div>
          <div class="cc-value">{lastChurnTimestampSec ? new Date(lastChurnTimestampSec * 1000).toLocaleString() : '-'}</div>
        </div>
      </div>

      <div class="recent">
        <button class="recent-toggle" on:click={() => showChurns = !showChurns} aria-expanded={showChurns}>
          <span>Recent churns</span>
          <ChevronDownIcon size={16} class={showChurns ? 'rotated' : ''} />
        </button>
        {#if showChurns}
          <div class="recent-list">
            {#each recentChurns as c, i}
              <div class="recent-item">
                <div class="row">
                  <span class="key">Height</span>
                  <span class="val mono">{c.height.toLocaleString()}</span>
                </div>
                <div class="row">
                  <span class="key">Time</span>
                  <span class="val">{new Date(c.tsSec * 1000).toLocaleString()}</span>
                </div>
                {#if c.delta}
                <div class="row">
                  <span class="key">Δ blocks</span>
                  <span class="val mono">{c.delta.toLocaleString()}</span>
                </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .cc-card {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 20px;
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(52,52,52,0.9), rgba(34,34,34,0.9));
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    color: #e8e8e8;
  }
  .app-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
    text-align: center;
  }
  .cc-logo {
    width: 28px;
    height: 28px;
  }
  .cc-titles h2 { margin: 0; font-size: 1.2rem; font-weight: 700; letter-spacing: .02em; }
  .cc-sub-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; justify-content: center; }
  .cc-sub { display: inline-flex; align-items: center; gap: 8px; color: #c7d2de; font-size: 0.9rem; background: #1f242a; border: 1px solid rgba(255,255,255,0.06); border-radius: 999px; padding: 4px 8px; }
  .pill-label { background: #2a3139; color: #9fb3c8; border-radius: 6px; padding: 2px 6px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .06em; }
  .pill-label.alt { background: #26313a; color: #b4c6d8; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: #2a2f35;
    border: 1px solid rgba(255,255,255,0.08);
    color: #c7d2de;
    cursor: pointer;
    transition: background .2s ease, border-color .2s ease, transform .1s ease;
  }
  .copy-btn:hover { background: #323842; border-color: rgba(255,255,255,0.14); }
  .copy-btn:active { transform: translateY(1px); }

  .cc-loading, .cc-error { text-align: center; color: #9aa3ad; padding: 20px 0; }
  .cc-error { color: #ff8080; }

  .halted-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(220, 53, 69, 0.15) 100%);
    border: 1px solid rgba(255, 152, 0, 0.4);
    border-radius: 10px;
    color: #ffa94d;
    font-size: 0.95rem;
    margin-bottom: 16px;
  }
  .halted-banner svg {
    flex-shrink: 0;
    color: #ff6b6b;
  }
  .halted-banner strong {
    color: #ff6b6b;
    letter-spacing: 0.5px;
  }

  .digital.dimmed {
    opacity: 0.4;
    filter: grayscale(0.5);
  }

  .cc-body { display: grid; gap: 20px; }

  /* Digital countdown style (inspired by referenced CodePen) */
  .digital { display: inline-grid; grid-auto-flow: column; align-items: end; justify-content: center; gap: 14px; }
  .group { display: grid; grid-template-columns: var(--digit-w) var(--digit-w); gap: 10px; align-items: end; justify-items: center; }
  .digit {
    width: var(--digit-w); height: var(--digit-h); border-radius: 10px;
    display: grid; place-items: center; font-variant-numeric: tabular-nums;
    font-size: 2.4rem; font-weight: 800; color: #eaf2ff;
    background: linear-gradient(180deg, #1f2328, #14181d);
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: inset 0 -2px 6px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.35);
  }
  .digit-face { display: inline-block; }
  .group .label { grid-column: span 2; margin-top: 6px; color: #9AA3AD; font-size: 0.8rem; text-transform: uppercase; letter-spacing: .08em; }
  .colon-wrap { display: grid; align-items: end; height: calc(var(--digit-h)); padding-bottom: 8px; }
  .colon { display: inline-block; font-size: 2.2rem; color: #7b8792; line-height: 1; }

  .cc-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .cc-stat { 
    background: #262626; 
    border: 1px solid rgba(255,255,255,0.06); 
    border-radius: 12px; 
    padding: 12px; 
    text-align: center; 
  }
  .cc-label { color: #97a0aa; font-size: 0.85rem; margin-bottom: 6px; }
  .cc-value { color: #e4e8ee; font-weight: 600; font-size: 1rem; }

  .recent { margin-top: 6px; }
  .recent-toggle {
    display: inline-flex; align-items: center; gap: 8px;
    background: #262b31; color: #c7d2de; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 8px 12px; cursor: pointer;
  }
  .recent-toggle :global(svg) { transition: transform .2s ease; }
  .recent-toggle :global(svg.rotated) { transform: rotate(180deg); }
  .recent-list { display: grid; gap: 10px; margin-top: 12px; }
  .recent-item { background: #23272d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px; }
  .row { display: flex; justify-content: space-between; gap: 12px; font-size: 0.95rem; }
  .key { color: #9AA3AD; }
  .val { color: #E4E8EE; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

  @media (max-width: 640px) {
    .cc-stats { grid-template-columns: 1fr; }
    .digital { gap: 12px; }
    .group { grid-template-columns: 54px 54px; }
    .digit { width: 54px; height: 76px; font-size: 2.1rem; }
    .colon-wrap { height: 76px; padding-bottom: 6px; }
  }
</style>
