<script>
  import { onMount, onDestroy } from 'svelte';
  export let text = '';
  export let typingSpeed = 35; // Controls overall animation speed
  export let charSetName = 'tech'; // Default character set
  
  let displayElement;
  let active = false;
  let frameRequest;
  let frame = 0;
  let queue = [];
  let resolve;
  
  // Multiple character sets for variety
  const charSets = {
    tech: '!<>-_\\/[]{}—=+*^?#$%&()~01︎10︎101︎01︎',
    math: '01︎10︎101︎01︎+=-×÷∑∆√∞≈≠≤≥',
    matrix: 'ラドクリフマラソンわたしワタシんょンョたばこタバコとうきょうトウキョウ日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ',
    crypto: '∞⬨⟡⟢⟣⟤⟥⟦⟧⟨⟩⟪⟫⦵'
  };
  
  // Default values from the example code
  const changeFrequency = 0.28; // Change frequency (28/100)
  const glowIntensity = 1; // Default glow intensity 
  const activeGlowIntensity = 12; // Slightly higher for active characters
  const highlightColor = '#ffffff'; // Default green color

  onMount(() => {
    startScramble();
  });

  $: if (text && active) {
    startNewText(text);
  }

  function randomChar() {
    const currentCharSet = charSets[charSetName] || charSets.tech;
    return currentCharSet[Math.floor(Math.random() * currentCharSet.length)];
  }

  function startNewText(newText) {
    const oldText = displayElement ? displayElement.innerText : '';
    const length = Math.max(oldText.length, newText.length);
    
    // Create new promise to track completion
    const promise = new Promise(res => resolve = res);
    queue = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      // Stagger the start times for a more natural flow
      const start = Math.floor(Math.random() * 20) + (i * 1.5); 
      const end = start + Math.floor(Math.random() * 20) + 10;
      queue.push({ from, to, start, end });
    }

    cancelAnimationFrame(frameRequest);
    frame = 0;
    updateFrame();
    return promise;
  }

  function updateFrame() {
    let output = '';
    let complete = 0;

    for (let i = 0; i < queue.length; i++) {
      let { from, to, start, end, char } = queue[i];

      if (frame >= end) {
        complete++;
        output += to;
      } else if (frame >= start) {
        if (!char || Math.random() < changeFrequency) {
          char = randomChar();
          queue[i].char = char;
        }
        // Use a slightly different color for each character
        const hue = (i * 2) % 40;
        const currentHighlight = adjustColor(highlightColor, hue);
        output += `<span class="scrambling" style="color: ${currentHighlight};">${char}</span>`;
      } else {
        output += from;
      }
    }

    if (displayElement) {
      displayElement.innerHTML = output;
    }

    if (complete === queue.length) {
      if (resolve) resolve();
    } else {
      frameRequest = requestAnimationFrame(updateFrame);
      frame++;
    }
  }

  // Function to slightly adjust colors for variety
  function adjustColor(color, shift) {
    if (color.startsWith('#')) {
      // Simple hue shift for hex colors
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      // Very slight adjustment to avoid drastic changes
      const rNew = Math.min(255, Math.max(0, r + (shift - 20)));
      const gNew = Math.min(255, Math.max(0, g + shift));
      const bNew = Math.min(255, Math.max(0, b));
      
      return `#${rNew.toString(16).padStart(2, '0')}${gNew.toString(16).padStart(2, '0')}${bNew.toString(16).padStart(2, '0')}`;
    }
    return color;
  }

  function startScramble() {
    active = true;
    startNewText(text);
  }

  // Cycle through charsets for variety when text changes
  let charSetIdx = 0;
  $: {
    const charSetKeys = Object.keys(charSets);
    charSetName = charSetKeys[charSetIdx % charSetKeys.length];
    charSetIdx++;
  }

  onDestroy(() => {
    active = false;
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
    }
  });
</script>

<div class="terminal-container">
  <div class="terminal" bind:this={displayElement}></div>
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
    font-size: 1.5rem;
    font-weight: bold;
  }
  
  :global(.scrambling) {
    font-weight: bold;
    transition: color 0.2s ease;
  }
</style> 