<script>
  /**
   * LinkOutIcon - External link icon component
   * Used for links that open in new tabs
   *
   * @prop {number} size - Icon size in pixels (default: 24)
   * @prop {string} color - Icon color (default: "#ffffff")
   *
   * @example
   * <LinkOutIcon size={16} color="#4A90E2" />
   */
  export let size = 24;
  export let color = "#ffffff";
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  <polyline points="15 3 21 3 21 9" />
  <line x1="10" y1="14" x2="21" y2="3" />
</svg>
