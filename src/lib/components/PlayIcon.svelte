<script>
  /**
   * PlayIcon - Play/resume icon component
   * @prop {number} size - Icon size in pixels (default: 16)
   * @prop {string} color - Icon fill color (default: "currentColor")
   */
  export let size = 16;
  export let color = "currentColor";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={color}
>
  <path d="M8 5v14l11-7z"/>
</svg>
