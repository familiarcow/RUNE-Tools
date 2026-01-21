<script>
  /**
   * BookmarkIcon - Bookmark icon component (Feather icons style)
   * @prop {number} size - Icon size in pixels (default: 20)
   * @prop {string} color - Icon stroke color (default: "currentColor")
   */
  export let size = 20;
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
  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
</svg>
