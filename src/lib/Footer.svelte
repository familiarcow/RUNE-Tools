<script>
  import { onMount, onDestroy } from 'svelte';
  import { audioPlaying } from './stores/audioStore';

  const emojis = ['🫡', '✍️', '💪', '🧙‍♂️', '🕺', '🏃‍♂️‍➡️', '🦅', '🐋', '🐉', '⚡️', '🌊', '🍷', '🍻', '🏄‍♂️', '🏆', '🎸', '🚀', '🗿', '🗽', '🏗️', '📠', '🔌', '🔮', '🔭', '💯', '🏴‍☠️', '🥷', '👑', '🪐', '🍦', '🍾', '🎯', '❤️', '☑️', '🆒'];

  function getRandomEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  let randomEmoji;

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
    randomEmoji = getRandomEmoji();
  });

  onDestroy(() => {
    if (audio) {
      audio.removeEventListener('ended', playNextTrack);
      audio.pause();
      audio = null;
    }
  });
</script>

<footer>
  <div class="footer-content">
    <span>
      <a
        href="https://github.com/cow9r/RUNE-Tools"
        target="_blank"
        class="source-link"
        on:click|stopPropagation={() => trackFooterClick('Source')}
      >
        Source
      </a>
      {" by "}
      <a
        href="https://x.com/familiarcow"
        target="_blank"
        class="source-link"
        on:click|stopPropagation={() => trackFooterClick('familiarcow')}
      >
        familiarcow
      </a>
      <span class="emoji-wrapper">
        {getRandomEmoji()}
      </span>
      <a
        href="https://x.com/RuneDotTools"
        target="_blank"
        class="source-link"
        on:click|stopPropagation={() => trackFooterClick('Follow on 𝕏')}
      >
        Follow on 𝕏
      </a>
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
    </span>
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
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    min-height: 32px;
    z-index: 100;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .footer-content {
    width: 100%;
    display: flex;
    justify-content: center;
    height: 24px;
    line-height: 24px;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.8);
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

    .footer-content {
      font-size: 0.8rem;
      line-height: 20px;
      height: 20px;
    }

    .sound-button {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 400px) {
    .footer-content {
      font-size: 0.75rem;
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
</style>