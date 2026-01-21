<script>
  /**
   * ChevronDownIcon - Downward chevron/arrow icon component (Feather icons style)
   * @prop {number} size - Icon size in pixels (default: 16)
   * @prop {string} color - Icon stroke color (default: "currentColor")
   * @prop {string} className - Additional CSS class for the SVG
   */
  export let size = 16;
  export let color = "currentColor";
  let className = "";
  export { className as class };
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
  class={className}
>
  <polyline points="6 9 12 15 18 9"></polyline>
</svg>
