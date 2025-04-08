<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { audioPlaying } from './stores/audioStore';

  const emojis = ['🫡', '✍️', '💪', '🧙‍♂️', '🕺', '🏃‍♂️‍➡️', '🦅', '🐋', '🐉', '⚡️', '🌊', '🍷', '🍻', '🏄‍♂️', '🏆', '🎸', '🚀', '🗿', '🗽', '🏗️', '📠', '🔌', '🔮', '🔭', '💯', '🏴‍☠️', '🥷', '👑', '🪐', '🍦', '🍾', '🎯', '❤️', '☑️', '🆒'];

  function getRandomEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  let randomEmoji;
  let currentPage = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  const totalPages = 4;
  let autoScrollTimer;
  let isUserInteracting = false;

  const FIRST_PAGE_DURATION = 15000;  // 15 seconds
  const OTHER_PAGE_DURATION = 10000;  // 10 seconds

  // Music tracks array
  const musicTracks = [
    '/assets/music/Also-Sprach-Zarathustra-PM-Music.mp3',
    '/assets/music/Bach-Cello-Suite-No.-1-G-Major-PM-Music.mp3',
    '/assets/music/Blue-Danube-PM-Music.mp3',
    '/assets/music/Ride-of-the-Valkyries-PM-Music.mp3',
    '/assets/music/Romeo-and-Juliet-PM-Music.mp3',
    '/assets/music/Russian-Dance-PM-Music.mp3',
    '/assets/music/The-Flower-Duet-PM-Music.mp3',
    '/assets/music/We-Shop-Song-PM-Music.mp3',
    '/assets/music/Winter-Vivaldi-PM-Music.mp3'
  ];

  let audio;
  let currentTrackIndex = 0;
  let currentTrackTitle = '';

  function getTrackTitle(path) {
    // Extract title from path and format it
    return path
      .split('/')
      .pop()
      .replace('-PM-Music.mp3', '')
      .replace(/-/g, ' ');
  }

  const pages = [
    {
      content: {
        type: 'links',
        elements: [
          { href: "https://github.com/cow9r/RUNE-Tools", text: "Source" },
          { text: " by " },
          { href: "https://x.com/familiarcow", text: "familiarcow" },
          { emoji: true },
          { href: "https://x.com/RuneDotTools", text: "Follow on 𝕏" },
          { type: 'sound' }
        ]
      }
    },
    {
      content: {
        type: 'thorswap',
        href: "https://cbbtc.exchange",
        text: "cbBTC.Exchange 🔵 Swap from Base to Bitcoin & more"
      }
    },
    {
      content: {
        type: 'vultisig',
        href: "https://t.me/vultirefbot/app?startapp=ref_3a5c3bba-9c5f-47ed-a2fc-6f659476404a",
        text: "Register for the Vultisig airdrop campaign"
      }
    },
    {
      content: {
        type: 'thorswap',
        href: "https://app.thorswap.finance/swap?ref=-",
        text: "Trade RUNE and swap native assets on THORSwap"
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

  function toggleSound() {
    if (!audio) {
      // Initialize audio on first play
      audio = new Audio();
      audio.addEventListener('ended', playNextTrack);
      currentTrackIndex = Math.floor(Math.random() * musicTracks.length);
      audio.src = musicTracks[currentTrackIndex];
      currentTrackTitle = getTrackTitle(musicTracks[currentTrackIndex]);
    }

    if ($audioPlaying) {
      audio.pause();
      audioPlaying.set(false);
    } else {
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        audioPlaying.set(false);
      });
      audioPlaying.set(true);
    }
  }

  function playNextTrack() {
    if (!$audioPlaying) return;
    
    currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
    audio.src = musicTracks[currentTrackIndex];
    currentTrackTitle = getTrackTitle(musicTracks[currentTrackIndex]);
    audio.play().catch(err => {
      console.error('Error playing next track:', err);
      audioPlaying.set(false);
    });
  }

  function trackFooterClick(elementName) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'footer_click', {
        element_name: elementName
      });
    }
  }

  onMount(() => {
    randomEmoji = getRandomEmoji();
    startAutoScroll();
  });

  onDestroy(() => {
    clearTimeout(autoScrollTimer);
    if (audio) {
      audio.removeEventListener('ended', playNextTrack);
      audio.pause();
      audio = null;
    }
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
  <div 
    class="page-container"
    on:click={() => {
      currentPage = (currentPage + 1) % totalPages;
      handleUserInteraction();
    }}
  >
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
              {#if element.type === 'sound'}
                <button
                  class="sound-button"
                  on:click|stopPropagation={() => { toggleSound(); trackFooterClick('sound_button'); }}
                  aria-label={$audioPlaying ? 'Stop music' : 'Play music'}
                  title={currentTrackTitle}
                >
                  {#if $audioPlaying}
                    🔊
                  {:else}
                    🔇
                  {/if}
                </button>
              {:else if element.href}
                <a 
                  href={element.href} 
                  target="_blank" 
                  class="source-link"
                  on:click|stopPropagation={() => trackFooterClick(element.text)}
                >
                  {element.text}
                </a>
              {:else if element.emoji}
                <span class="emoji-wrapper">
                  {getRandomEmoji()}
                </span>
              {:else if element.onClick}
                <span 
                  class="clickable-text"
                  on:click={element.onClick}
                >
                  {element.text}
                </span>
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
              on:click|stopPropagation={() => trackFooterClick(pages[currentPage].content.text)}
            >
              {pages[currentPage].content.text}
            </a>
          </span>
        {:else if pages[currentPage].content.type === 'thorswap'}
          <span>
            <a 
              href={pages[currentPage].content.href}
              target="_blank" 
              class="source-link"
              on:click|stopPropagation={() => trackFooterClick(pages[currentPage].content.text)}
            >
              {pages[currentPage].content.text}
            </a>
          </span>
        {/if}
      </div>
    {/key}
  </div>
</footer>

<style>
  footer {
    padding: 0.5rem 1.5rem;
    background: rgba(44, 44, 44, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    user-select: none;
    touch-action: pan-x pan-y;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    min-height: 32px;
    z-index: 100;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .page-container {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    overflow: hidden;
    height: 24px;
    margin-top: 0;
    cursor: pointer;
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
    padding-right: 1.5rem;
  }

  footer span {
    color: rgba(255, 255, 255, 0.8);
  }

  .source-link,
  .source-link:visited,
  .source-link:active,
  .source-link:link {
    color: #31FD9D;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
    opacity: 0.95;
  }

  .source-link:hover {
    opacity: 1;
    text-shadow: 0 0 8px rgba(49, 253, 157, 0.3);
  }

  .sound-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 0 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.2s ease;
    display: inline;
    margin: 0;
    opacity: 0.9;
  }

  .sound-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  @media (max-width: 600px) {
    footer {
      padding: 0.25rem 1rem;
    }

    .page {
      font-size: 0.8rem;
      padding-right: 1rem;
      line-height: 20px;
    }
    
    .page-container {
      height: 20px;
    }
    
    .sound-button {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 400px) {
    .page {
      font-size: 0.75rem;
      padding-right: 0.75rem;
    }
    
    .sound-button {
      font-size: 0.75rem;
    }
  }

  .emoji-wrapper {
    padding: 0 0.5rem;
    opacity: 0.9;
    transition: all 0.2s ease;
    display: inline;
  }

  .emoji-wrapper:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .clickable-text {
    cursor: pointer;
    color: #31FD9D;
    font-weight: 600;
    transition: all 0.2s ease;
    opacity: 0.95;
  }

  .clickable-text:hover {
    opacity: 1;
    text-shadow: 0 0 8px rgba(49, 253, 157, 0.3);
  }
</style> 