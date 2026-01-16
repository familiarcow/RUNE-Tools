<script>
  /**
   * CurrencyToggle - RUNE/USD toggle switch
   * Allows switching between RUNE and USD display modes
   *
   * @prop {boolean} showUSD - Current state (true = USD, false = RUNE)
   */
  import { createEventDispatcher } from 'svelte';

  export let showUSD = false;

  const dispatch = createEventDispatcher();

  // Dispatch change event when checkbox state changes
  // Note: bind:checked handles the state update, we just dispatch the event
  function handleChange() {
    dispatch('change', { showUSD });
  }
</script>

<label class="toggle" title={showUSD ? 'Switch to RUNE' : 'Switch to USD'}>
  <input
    type="checkbox"
    bind:checked={showUSD}
    on:change={handleChange}
  />
  <span class="slider">
    <span class="knob">
      <img
        src="/assets/coins/RUNE-ICON.svg"
        alt="RUNE"
        class="knob-icon rune"
        class:hidden={showUSD}
      />
      <span class="knob-icon dollar" class:hidden={!showUSD}>$</span>
    </span>
  </span>
</label>

<style>
  .toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 26px;
    cursor: pointer;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .toggle:hover .slider {
    border-color: rgba(99, 102, 241, 0.4);
  }

  .knob {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    background: linear-gradient(145deg, #31FD9D 0%, #28d584 100%);
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle input:checked + .slider .knob {
    left: calc(100% - 22px);
    background: linear-gradient(145deg, #ffc107 0%, #e0a800 100%);
  }

  .knob-icon {
    width: 12px;
    height: 12px;
    transition: opacity 0.2s ease;
  }

  .knob-icon.hidden {
    opacity: 0;
    position: absolute;
  }

  .knob-icon.dollar {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .knob-icon.rune {
    filter: brightness(0) saturate(100%);
  }

  @media (max-width: 600px) {
    .toggle {
      width: 44px;
      height: 24px;
    }

    .knob {
      width: 18px;
      height: 18px;
    }

    .toggle input:checked + .slider .knob {
      left: calc(100% - 20px);
    }

    .knob-icon {
      width: 10px;
      height: 10px;
    }

    .knob-icon.dollar {
      font-size: 10px;
    }
  }
</style>
