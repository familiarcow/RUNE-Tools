<script>
  import { onMount, onDestroy } from 'svelte';

  let canvas;
  let ctx;
  let particles = [];
  let animationFrame;
  let thorchainIcon = new Image();
  thorchainIcon.src = '/assets/Thorchain_icon.svg';

  // Create a function to set up the white filter
  function setupWhiteFilter(ctx) {
    // Create a white colorization filter
    ctx.filter = 'brightness(0) invert(1)';
  }

  class Particle {
    constructor(x, y, isIcon = false) {
      this.x = x;
      this.y = y;
      this.isIcon = isIcon;
      this.size = isIcon ? (Math.random() * 6 + 6) : (Math.random() * 3 + 1);
      this.speedX = Math.random() * 0.3 - 0.15;
      this.speedY = isIcon ? (Math.random() * 0.3 + 0.1) : (Math.random() * 0.5 + 0.2);
      this.opacity = isIcon ? (Math.random() * 0.3 + 0.5) : (Math.random() * 0.5 + 0.3);
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.01;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.rotation += this.rotationSpeed; // Update rotation

      if (this.y > canvas.height) {
        this.y = -10;
        this.x = Math.random() * canvas.width;
      }
    }

    draw() {
      ctx.save(); // Save the current context state
      
      if (this.isIcon) {
        // Draw THORChain icon
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        
        // Apply white filter before drawing the icon
        setupWhiteFilter(ctx);
        const iconSize = this.size;
        ctx.drawImage(
          thorchainIcon, 
          -iconSize/2, 
          -iconSize/2, 
          iconSize, 
          iconSize
        );
        ctx.filter = 'none'; // Reset filter after drawing
      } else {
        // Draw regular snowflake
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fill();
      }
      
      ctx.restore(); // Restore the context state
    }
  }

  function createParticles() {
    const totalParticles = Math.floor((canvas.width * canvas.height) / 10000);
    const thorchainParticles = Math.floor(totalParticles * 0.04);
    
    // Create regular snowflakes
    for (let i = 0; i < totalParticles - thorchainParticles; i++) {
      particles.push(
        new Particle(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          false
        )
      );
    }
    
    // Create THORChain icon particles
    for (let i = 0; i < thorchainParticles; i++) {
      particles.push(
        new Particle(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          true
        )
      );
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });
    animationFrame = requestAnimationFrame(animate);
  }

  function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = [];
    createParticles();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    
    // Wait for the icon to load before starting
    thorchainIcon.onload = () => {
      handleResize();
      animate();
    };
    
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
