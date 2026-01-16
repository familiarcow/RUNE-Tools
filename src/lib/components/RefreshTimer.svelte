<script>
  /**
   * RefreshTimer - Circular progress indicator for refresh countdown
   * Shows visual feedback for data refresh intervals
   *
   * @prop {number} progress - Current progress 0-100
   * @prop {number} size - Diameter in pixels (default: 24)
   * @prop {string} strokeColor - Progress stroke color (default: #4A90E2)
   * @prop {string} bgColor - Background stroke color (default: #2c2c2c)
   */
  export let progress = 0;
  export let size = 24;
  export let strokeColor = '#4A90E2';
  export let bgColor = '#2c2c2c';

  // Calculate circle properties
  $: radius = (size - 4) / 2;
  $: center = size / 2;
  $: circumference = 2 * Math.PI * radius;
  $: strokeDashoffset = (circumference * (100 - progress)) / 100;
</script>

<div class="refresh-timer" style="width: {size}px; height: {size}px;">
  <svg class="progress-ring" width={size} height={size}>
    <circle
      class="progress-ring__circle-bg"
      stroke={bgColor}
      stroke-width="2"
      fill="transparent"
      r={radius}
      cx={center}
      cy={center}
    />
    <circle
      class="progress-ring__circle"
      stroke={strokeColor}
      stroke-width="2"
      fill="transparent"
      r={radius}
      cx={center}
      cy={center}
      style="stroke-dashoffset: {strokeDashoffset}"
    />
  </svg>
</div>

<style>
  .refresh-timer {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring__circle-bg {
    stroke-width: 2;
  }

  .progress-ring__circle {
    stroke-width: 2;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.1s ease-out;
  }
</style>
