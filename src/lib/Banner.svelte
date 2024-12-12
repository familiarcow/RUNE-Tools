<script>
  export let text = "THORChain is undergoing a major upgrade. Please wait until the upgrade is complete.";
  export let backgroundColor = "#31FD9D15";
  export let textColor = "#31FD9D";
</script>

<div class="banner" style="--banner-bg: {backgroundColor}; --banner-text: {textColor}">
  <p class="banner-text">{text}</p>
</div>

<style>
  .banner {
    background-color: var(--banner-bg);
    width: 100%;
    padding: 0.25rem;
    text-align: center;
    font-size: 0.85rem;
    font-weight: 500;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    z-index: 999;
    border-top: 1px solid #31FD9D30;
    border-bottom: 1px solid #31FD9D30;
    backdrop-filter: blur(8px);
  }

  .banner-text {
    margin: 0;
    color: var(--banner-text);
    line-height: 1.2;
    text-shadow: 0 0 10px rgba(49, 253, 157, 0.3);
  }

  @media (max-width: 600px) {
    .banner {
      font-size: 0.75rem;
      padding: 0.2rem;
    }
  }
</style>
