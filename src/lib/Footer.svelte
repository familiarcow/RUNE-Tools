<script>
  import { onMount, onDestroy } from 'svelte';
  import { audioPlaying } from './stores/audioStore';

  const emojis = ['🫡', '✍️', '💪', '🧙‍♂️', '🕺', '🏃‍♂️‍➡️', '🦅', '🐋', '🐉', '⚡️', '🌊', '🍷', '🍻', '🏄‍♂️', '🏆', '🎸', '🚀', '🗿', '🗽', '🏗️', '📠', '🔌', '🔮', '🔭', '💯', '🏴‍☠️', '🥷', '👑', '🪐', '🍦', '🍾', '🎯', '❤️', '☑️', '🆒'];

  function getRandomEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  let currentPage = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  const totalPages = 2;
  let autoScrollTimer;
  let interactionTimer;
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
    return path
      .split('/')
      .pop()
      .replace('-PM-Music.mp3', '')
      .replace(/-/g, ' ');
  }

  const pages = [
    {
      type: 'links',
      elements: [
        { href: 'https://github.com/cow9r/RUNE-Tools', text: 'Source' },
        { text: ' by ' },
        { href: 'https://x.com/familiarcow', text: 'familiarcow' },
        { emoji: true },
        { href: 'https://x.com/RuneDotTools', text: 'Follow on 𝕏' },
        { sound: true }
      ]
    },
    {
      type: 'promo',
      href: 'https://near.com/login?ref=f93b9prp',
      text: 'Trade native assets onchain with privacy at near.com'
    }
  ];

  function nextPage() {
    currentPage = (currentPage + 1) % totalPages;
  }

  function prevPage() {
    currentPage = currentPage === 0 ? totalPages - 1 : currentPage - 1;
  }

  function startAutoScroll() {
    clearTimeout(autoScrollTimer);
    const duration = currentPage === 0 ? FIRST_PAGE_DURATION : OTHER_PAGE_DURATION;
    autoScrollTimer = setTimeout(() => {
      if (!isUserInteracting) {
        nextPage();
        startAutoScroll();
      }
    }, duration);
  }

  function handleUserInteraction() {
    isUserInteracting = true;
    clearTimeout(autoScrollTimer);
    clearTimeout(interactionTimer);
    // Resume auto-scroll after 30 seconds of no interaction
    interactionTimer = setTimeout(() => {
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
    const diffX = startX - e.touches[0].clientX;
    const diffY = startY - e.touches[0].clientY;
    const dominant = Math.abs(diffX) > Math.abs(diffY) ? diffX : diffY;
    if (Math.abs(dominant) > 20) {
      if (dominant > 0) nextPage();
      else prevPage();
      isDragging = false;
    }
  }

  function handleTouchEnd() {
    isDragging = false;
  }

  function handleWheel(e) {
    handleUserInteraction();
    if (Math.abs(e.deltaY) > 10) {
      if (e.deltaY > 0) nextPage();
      else prevPage();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      handleUserInteraction();
      if (e.key === 'ArrowDown') nextPage();
      else prevPage();
    } else if (e.key === 'Enter' || e.key === ' ') {
      handleUserInteraction();
      nextPage();
    }
  }

  function handleClick() {
    handleUserInteraction();
    nextPage();
  }

  function toggleSound() {
    if (!audio) {
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
    startAutoScroll();
  });

  onDestroy(() => {
    clearTimeout(autoScrollTimer);
    clearTimeout(interactionTimer);
    if (audio) {
      audio.removeEventListener('ended', playNextTrack);
      audio.pause();
      audio = null;
    }
  });
</script>

<footer>
  <div
    class="page-container"
    role="button"
    tabindex="0"
    aria-label="Navigate footer pages"
    on:click={handleClick}
    on:keydown={handleKeydown}
    on:wheel={handleWheel}
    on:mouseenter={handleUserInteraction}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
  >
    {#key currentPage}
      <div class="page">
        {#if pages[currentPage].type === 'links'}
          <span>
            {#each pages[currentPage].elements as element}
              {#if element.sound}
                <button
                  class="sound-button"
                  on:click|stopPropagation={() => { toggleSound(); trackFooterClick('sound_button'); }}
                  aria-label={$audioPlaying ? 'Stop music' : 'Play music'}
                  title={currentTrackTitle}
                >
                  {$audioPlaying ? '🔊' : '🔇'}
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
                <span class="emoji-wrapper">{getRandomEmoji()}</span>
              {:else}
                {element.text}
              {/if}
            {/each}
          </span>
        {:else if pages[currentPage].type === 'promo'}
          <span>
            <a
              href={pages[currentPage].href}
              target="_blank"
              class="source-link"
              on:click|stopPropagation={() => trackFooterClick(pages[currentPage].text)}
            >
              {pages[currentPage].text}
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
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
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
    animation: page-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes page-in {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
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
</style>
