<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  const emojis = ['🫡', '✍️', '💪', '🧙‍♂️', '🕺', '🏃‍♂️‍➡️', '🦅', '🐋', '🐉', '⚡️', '🌊', '🍷', '🍻', '🏄‍♂️', '🏆', '🎸', '🚀', '🗿', '🗽', '🏗️', '📠', '🔌', '🔮', '🔭', '💯', '🏴‍☠️', '🥷', '👑', '🪐', '🍦', '🍾', '🎯', '❤️', '☑️', '🆒'];

  function getRandomEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  let randomEmoji;
  let currentPage = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  const totalPages = 2;
  let autoScrollTimer;
  let isUserInteracting = false;

  const FIRST_PAGE_DURATION = 15000;  // 15 seconds
  const OTHER_PAGE_DURATION = 10000;  // 10 seconds

  const pages = [
    {
      content: {
        type: 'links',
        elements: [
          { href: "https://github.com/cow9r/RUNE-Tools", text: "Source" },
          { text: " by " },
          { href: "https://x.com/familiarcow", text: "familiarcow" },
          { emoji: true },
          { href: "https://x.com/RuneDotTools", text: "Follow on 𝕏" }
        ]
      }
    },
    {
      content: {
        type: 'vultisig',
        href: "https://t.me/vultirefbot/app?startapp=ref_3a5c3bba-9c5f-47ed-a2fc-6f659476404a",
        text: "Secure your RUNE & register for the Vultisig airdrop campaign"
      }
    }
  ];

  function startAutoScroll() {
    clearTimeout(autoScrollTimer);
    const duration = currentPage === 0 ? FIRST_PAGE_DURATION : OTHER_PAGE_DURATION;
    
    autoScrollTimer = setTimeout(() => {
      if (!isUserInteracting) {
        if (currentPage < totalPages - 1) {
          currentPage++;
          startAutoScroll(); // Schedule next scroll
        } else {
          currentPage = 0; // Reset to first page
          startAutoScroll(); // Restart cycle
        }
      }
    }, duration);
  }

  function handleUserInteraction() {
    isUserInteracting = true;
    clearTimeout(autoScrollTimer);
    
    // Reset auto-scroll after 30 seconds of no interaction
    setTimeout(() => {
      isUserInteracting = false;
      startAutoScroll();
    }, 30000);
  }

  function handleTouchStart(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    handleUserInteraction();
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = startX - currentX;
    const diffY = startY - currentY;
    
    // If horizontal movement is greater than vertical, handle as horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 20) {
        if (diffX > 0) {
          // Swipe left - next page
          currentPage = (currentPage + 1) % totalPages;
          isDragging = false;
        } else {
          // Swipe right - previous page
          currentPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
          isDragging = false;
        }
      }
    } else if (Math.abs(diffY) > 20) {
      // Handle vertical swipe as before
      if (diffY > 0) {
        currentPage = (currentPage + 1) % totalPages;
        isDragging = false;
      } else if (diffY < 0) {
        currentPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
        isDragging = false;
      }
    }
  }

  function handleTouchEnd() {
    isDragging = false;
  }

  function handleWheel(e) {
    handleUserInteraction();
    if (Math.abs(e.deltaY) > 10) {
      if (e.deltaY > 0) {
        currentPage = (currentPage + 1) % totalPages;
      } else if (e.deltaY < 0) {
        currentPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
      }
    }
  }

  // Add keyboard navigation
  function handleKeydown(e) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      handleUserInteraction();
      if (e.key === 'ArrowDown') {
        currentPage = (currentPage + 1) % totalPages;
      } else {
        currentPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
      }
    }
  }

  onMount(() => {
    randomEmoji = getRandomEmoji();
    startAutoScroll();
  });

  onDestroy(() => {
    clearTimeout(autoScrollTimer);
  });
</script>

<footer
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  on:wheel={handleWheel}
  on:mouseenter={handleUserInteraction}
  on:keydown={handleKeydown}
>
  <div class="page-container">
    {#key currentPage}
      <div 
        class="page"
        in:slide={{ 
          duration: 300,
          easing: cubicInOut,
          axis: 'y'
        }}
      >
        {#if pages[currentPage].content.type === 'links'}
          <span>
            {#each pages[currentPage].content.elements as element}
              {#if element.href}
                <a href={element.href} target="_blank" class="source-link">
                  {element.text}
                </a>
              {:else if element.emoji}
                {" "}{getRandomEmoji()}{" "}
              {:else}
                {element.text}
              {/if}
            {/each}
          </span>
        {:else if pages[currentPage].content.type === 'vultisig'}
          <span>
            <a 
              href={pages[currentPage].content.href}
              target="_blank" 
              class="source-link"
            >
              {pages[currentPage].content.text}
            </a>
          </span>
        {:else if pages[currentPage].content.type === 'feedback'}
          <span>
            <a 
              href={pages[currentPage].content.href}
              target="_blank" 
              class="source-link"
            >
              {pages[currentPage].content.text}
            </a>
          </span>
        {/if}
      </div>
    {/key}
  </div>
  
  <div class="page-indicator">
    {#each Array(totalPages) as _, i}
      <button 
        class="dot" 
        class:active={currentPage === i}
        on:click={() => {
          currentPage = i;
          handleUserInteraction();
        }}
        aria-label={`Go to page ${i + 1}`}
      ></button>
    {/each}
  </div>
</footer>

<style>
  footer {
    padding: 0.5rem 1.5rem;
    background-color: var(--surface-color);
    box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    user-select: none;
    touch-action: pan-x pan-y;
    position: relative;
    min-height: 40px;
  }

  .page-container {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    overflow: hidden;
    height: 24px;
  }

  .page {
    width: 100%;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 24px;
    white-space: nowrap;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Add media query for smaller screens */
  @media (max-width: 600px) {
    .page {
      font-size: 0.8rem;  /* Smaller font size for mobile */
    }
    
    /* Adjust container height for smaller text */
    .page-container {
      height: 20px;
    }
    
    /* Adjust line height to match new container height */
    .page {
      line-height: 20px;
    }
  }

  @media (max-width: 400px) {
    .page {
      font-size: 0.75rem;
    }
  }

  /* Reset all link styles in footer */
  footer a,
  footer a:visited,
  footer a:active,
  footer a:link {
    color: #31FD9D;
    text-decoration: none;
  }

  .source-link,
  .source-link:visited,
  .source-link:active,
  .source-link:link {
    color: #31FD9D;
    text-decoration: none;
    font-weight: 600;
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.95;
  }

  .source-link:hover {
    opacity: 1;
  }

  footer span {
    color: rgba(255, 255, 255, 0.8);
  }

  .page-indicator {
    display: flex;
    gap: 4px;
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px;
    z-index: 10;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--text-color);
    opacity: 0.3;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border: none;
    padding: 0;
    margin: 0;
  }

  .dot:hover {
    opacity: 0.5;
    transform: scale(1.1);
  }

  .dot.active {
    opacity: 0.8;
    transform: scale(1.1);
  }
</style> 