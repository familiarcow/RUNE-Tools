<script>
  export let text = '';
  export let typingSpeed = 15; // milliseconds per character
  
  let displayedText = '';
  let cursorVisible = true;
  let containerDiv;
  let blinkCount = 0;
  let blinkInterval;
  
  $: {
    displayedText = '';
    typeText();
  }
  
  async function typeText() {
    displayedText = '';
    // Clear any existing interval
    if (blinkInterval) {
      clearInterval(blinkInterval);
    }
    
    // Reset cursor state
    cursorVisible = true;
    blinkCount = 0;
    
    // Type out the text
    for (let i = 0; i < text.length; i++) {
      displayedText += text[i];
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    
    // Start blinking after typing is complete
    blinkInterval = setInterval(() => {
      if (blinkCount >= 6) { // 6 state changes = 3 full blinks
        clearInterval(blinkInterval);
        cursorVisible = false;
        return;
      }
      cursorVisible = !cursorVisible;
      blinkCount++;
    }, 530);
  }
  
  // Clean up interval on component destruction
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (blinkInterval) {
      clearInterval(blinkInterval);
    }
  });
</script>

<div class="terminal-container" bind:this={containerDiv}>
  <div class="terminal">
    <span class="text">{displayedText}</span>
    {#if cursorVisible}
      <span class="cursor">█</span>
    {/if}
  </div>
</div>

<style>
  .terminal-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }

  .terminal {
    font-family: 'Courier New', monospace;
    color: white;
    position: relative;
    display: inline-block;
    text-align: center;
  }
  
  .text {
    display: inline-block;
    white-space: nowrap;
  }
  
  .cursor {
    position: absolute;
    display: inline-block;
  }
</style> 