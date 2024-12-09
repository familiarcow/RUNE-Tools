<script>
  import { onMount, onDestroy } from 'svelte';

  let canvas;
  let ctx;
  let snowflakes = [];
  let animationFrame;

  class Snowflake {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 3 + 1;
      this.speedX = Math.random() * 0.5 - 0.25;
      this.speedY = Math.random() * 1 + 0.5;
      this.opacity = Math.random() * 0.5 + 0.3;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.y > canvas.height) {
        this.y = -10;
        this.x = Math.random() * canvas.width;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      ctx.fill();
    }
  }

  function createSnowflakes() {
    const numberOfSnowflakes = Math.floor((canvas.width * canvas.height) / 10000);
    for (let i = 0; i < numberOfSnowflakes; i++) {
      snowflakes.push(
        new Snowflake(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        )
      );
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    snowflakes.forEach((snowflake) => {
      snowflake.update();
      snowflake.draw();
    });
    animationFrame = requestAnimationFrame(animate);
  }

  function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    snowflakes = [];
    createSnowflakes();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    handleResize();
    animate();
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
</script>

<canvas
  bind:this={canvas}
  style="position: fixed; top: 0; left: 0; pointer-events: none; z-index: 0;"
/>
