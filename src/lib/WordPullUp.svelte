<script>
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  export let words = '';
  export let delayMultiple = 1;
  export let className = '';

  const wrapperTransition = { duration: 600, easing: backOut };
  const wordTransition = { y: 50, duration: 800, easing: backOut };

  $: wordArray = words.split(' ');
</script>

<h1
  in:fly={wrapperTransition}
  class="font-display text-center text-4xl font-bold leading-[5rem] tracking-[-0.02em] drop-shadow-sm {className}"
>
  {#each wordArray as word, i}
    <span
      in:fly={{ ...wordTransition, delay: i * 100 * delayMultiple }}
      style="display: inline-block; padding-right: 8px; opacity: 0;"
    >
      {#if word === ''}
        &nbsp;
      {:else}
        {word}
      {/if}
    </span>
  {/each}
</h1>

<style>
  span {
    opacity: 0;
    animation: fadeIn 0.5s forwards;
    animation-delay: calc(var(--word-index) * 100ms);
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }
</style>