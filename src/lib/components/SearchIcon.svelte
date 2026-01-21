<script>
  /**
   * SearchIcon - Magnifying glass search icon component (Feather icons style)
   * @prop {number} size - Icon size in pixels (default: 16)
   * @prop {string} color - Icon stroke color (default: "currentColor")
   */
  export let size = 16;
  export let color = "currentColor";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
