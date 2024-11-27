<script>
  import { onMount, onDestroy } from 'svelte';
  import UploadIcon from '../../public/assets/upload.svelte';
  import DownloadIcon from '../../public/assets/download.svelte';

  let canvas;
  let ctx;
  let image = null;
  let fileInput;
  let selectionCanvas;
  let selectionCtx;
  let selection = { x: 0, y: 0, size: 0 };
  let isDragging = false;
  let startPos = { x: 0, y: 0 };
  let dragOver = false;
  let decreaseInterval;
  let increaseInterval;
  let touchStartTime;
  let longPressTimer;
  let touchStartPos = { x: 0, y: 0 };

  let destroyFunctions = [];

  let rotationAngle = 0;

  let rotateX = 0;
  let rotateY = 0;
  let container;

  function handleMouseMove(event) {
    if (!container || canAdjustImage) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // Reduce the rotation effect by decreasing these multipliers
    rotateY = ((mouseX - centerX) / (rect.width / 2)) * 5; //multiplier at the end changes the rotation amount
    rotateX = -((mouseY - centerY) / (rect.height / 2)) * 5; //multiplier at the end changes the rotation amount
  }

  function handleMouseLeave() {
    if (!canAdjustImage) {
      rotateX = 0;
      rotateY = 0;
    }
  }

  function resetRotation() {
    rotateX = 0;
    rotateY = 0;
  }

  // Add this function to animate the rotation
  function animateRotation() {
    rotationAngle = (rotationAngle + 1) % 360;
    if (!canAdjustImage) {
      requestAnimationFrame(animateRotation);
    }
  }

  $: if (image && selectionCanvas) {
    updateSelectionCanvas();
  }

  $: canDownload = !!image;

  $: canAdjustImage = !!image;

  onMount(() => {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    selectionCanvas = document.getElementById('selection-canvas');
    selectionCtx = selectionCanvas.getContext('2d');

    // Add any cleanup functions here
    destroyFunctions.push(() => {
      // Add any necessary cleanup code here
    });

    if (!canAdjustImage) {
      animateRotation();
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
  });

  onDestroy(() => {
    // Safely run destroy functions
    destroyFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseleave', handleMouseLeave);
  });

  function handleDragOver(event) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragOver = false;
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOver = false;
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      image = new Image();
      image.onload = () => {
        // Set initial selection to largest centered square that fits within the image
        const size = Math.min(image.width, image.height);
        const borderWidth = 20; // Account for the border width
        const maxSize = Math.max(50, size - borderWidth * 2); // Ensure minimum size of 50px
        selection = {
          x: (image.width - maxSize) / 2,
          y: (image.height - maxSize) / 2,
          size: maxSize
        };
        canAdjustImage = true;  // Ensure this is set when the image is loaded
        resetRotation(); // Reset rotation when image is loaded
        updateSelectionCanvas();
      };
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleFileInput(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }

  function updateSelectionCanvas() {
    if (!image || !selectionCtx || !selectionCanvas) return;

    const borderWidth = 20;
    
    // Ensure selection stays within image bounds
    selection.size = Math.min(selection.size, Math.min(image.width, image.height) - borderWidth * 2);
    selection.x = Math.max(borderWidth, Math.min(selection.x, image.width - selection.size - borderWidth));
    selection.y = Math.max(borderWidth, Math.min(selection.y, image.height - selection.size - borderWidth));

    selectionCanvas.width = image.width;
    selectionCanvas.height = image.height;

    // Check if the canvas size is valid before drawing
    if (selectionCanvas.width > 0 && selectionCanvas.height > 0) {
      // Draw the original image
      selectionCtx.drawImage(image, 0, 0);

      // Draw 90% transparent overlay
      selectionCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      selectionCtx.fillRect(0, 0, selectionCanvas.width, selectionCanvas.height);

      // Create a temporary canvas for the circular crop
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = selection.size + borderWidth * 2;
      tempCanvas.height = selection.size + borderWidth * 2;
      const tempCtx = tempCanvas.getContext('2d');

      // Draw the selected portion of the image on the temporary canvas
      tempCtx.drawImage(
        image,
        selection.x - borderWidth,
        selection.y - borderWidth,
        selection.size + borderWidth * 2,
        selection.size + borderWidth * 2,
        0,
        0,
        selection.size + borderWidth * 2,
        selection.size + borderWidth * 2
      );

      // Create a circular clipping path
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.beginPath();
      tempCtx.arc(
        (selection.size + borderWidth * 2) / 2,
        (selection.size + borderWidth * 2) / 2,
        selection.size / 2 + borderWidth,
        0,
        Math.PI * 2
      );
      tempCtx.fill();

      // Draw the circular image from the temporary canvas
      selectionCtx.drawImage(
        tempCanvas,
        selection.x - borderWidth,
        selection.y - borderWidth
      );

      // Draw the gradient border
      const gradient = selectionCtx.createLinearGradient(
        selection.x - borderWidth,
        selection.y - borderWidth,
        selection.x + selection.size + borderWidth,
        selection.y + selection.size + borderWidth
      );
      gradient.addColorStop(0, '#03CFFA');
      gradient.addColorStop(1, '#31FD9D');

      selectionCtx.beginPath();
      selectionCtx.arc(
        selection.x + selection.size / 2,
        selection.y + selection.size / 2,
        selection.size / 2 + borderWidth / 2,
        0,
        Math.PI * 2
      );
      selectionCtx.lineWidth = borderWidth;
      selectionCtx.strokeStyle = gradient;
      selectionCtx.stroke();

      // Removed the white selection rectangle drawing code
    }
  }

  function startDragging(event) {
    if (!image) return;
    isDragging = true;
    startPos = {
      x: event.clientX - selection.x,
      y: event.clientY - selection.y
    };
  }

  function stopDragging() {
    isDragging = false;
  }

  function drag(event) {
    if (!isDragging || !image) return;
    const borderWidth = 20;
    selection.x = Math.max(
      borderWidth,
      Math.min(event.clientX - startPos.x, image.width - selection.size - borderWidth)
    );
    selection.y = Math.max(
      borderWidth,
      Math.min(event.clientY - startPos.y, image.height - selection.size - borderWidth)
    );
    updateSelectionCanvas();
  }

  function handleWheel(event) {
    if (!image) return;
    event.preventDefault();
    const borderWidth = 20;
    const delta = event.deltaY > 0 ? -10 : 10;
    const newSize = Math.max(50, Math.min(selection.size + delta, Math.min(image.width, image.height) - borderWidth * 2));
    const sizeChange = newSize - selection.size;
    selection.size = newSize;
    selection.x = Math.max(borderWidth, Math.min(selection.x - sizeChange / 2, image.width - selection.size - borderWidth));
    selection.y = Math.max(borderWidth, Math.min(selection.y - sizeChange / 2, image.height - selection.size - borderWidth));
    updateSelectionCanvas();
  }

  function drawFinalImage() {
    if (!image || !ctx) return;

    const borderWidth = 20;
    const size = selection.size + borderWidth * 2; // Increase canvas size to accommodate border
    canvas.width = size;
    canvas.height = size;

    // Create a temporary canvas for the circular crop
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');

    // Clear the temporary canvas with a transparent background
    tempCtx.clearRect(0, 0, size, size);

    // Create a circular clipping path
    tempCtx.beginPath();
    tempCtx.arc(size / 2, size / 2, (size - borderWidth) / 2, 0, Math.PI * 2);
    tempCtx.clip();

    // Draw the image on the temporary canvas
    tempCtx.drawImage(
      image,
      selection.x - borderWidth,
      selection.y - borderWidth,
      selection.size + borderWidth * 2,
      selection.size + borderWidth * 2,
      0,
      0,
      size,
      size
    );

    // Clear the main canvas
    ctx.clearRect(0, 0, size, size);

    // Draw the circular image from the temporary canvas onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);

    // Draw the gradient border
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#03CFFA');
    gradient.addColorStop(1, '#31FD9D');

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - borderWidth / 2, 0, Math.PI * 2);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = gradient;
    ctx.stroke();
  }

  function downloadImage() {
    if (!canvas) return;
    drawFinalImage();
    const link = document.createElement('a');
    link.download = 'thorchad.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function increaseCropperSize() {
    if (!image) return;
    const borderWidth = 20;
    const newSize = Math.min(selection.size + 5, Math.min(image.width, image.height) - borderWidth * 2);
    updateCropperSize(newSize);
  }

  function decreaseCropperSize() {
    if (!image) return;
    const newSize = Math.max(50, selection.size - 5);
    updateCropperSize(newSize);
  }

  function updateCropperSize(newSize) {
    const borderWidth = 20;
    const sizeChange = newSize - selection.size;
    selection.size = newSize;
    selection.x = Math.max(borderWidth, Math.min(selection.x - sizeChange / 2, image.width - selection.size - borderWidth));
    selection.y = Math.max(borderWidth, Math.min(selection.y - sizeChange / 2, image.height - selection.size - borderWidth));
    updateSelectionCanvas();
  }

  function startDecreasing() {
    decreaseCropperSize();
    decreaseInterval = setInterval(decreaseCropperSize, 50);
  }

  function stopDecreasing() {
    clearInterval(decreaseInterval);
  }

  function startIncreasing() {
    increaseCropperSize();
    increaseInterval = setInterval(increaseCropperSize, 50);
  }

  function stopIncreasing() {
    clearInterval(increaseInterval);
  }

  function handleTouchStart(event) {
    if (!image || !event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const rect = selectionCanvas.getBoundingClientRect();
    touchStartPos = {
      x: touch.clientX - rect.left - selection.x,
      y: touch.clientY - rect.top - selection.y
    };
  }

  function handleTouchEnd() {
    clearInterval(longPressTimer);
  }

  function handleTouchMove(event) {
    if (!image) return;
    event.preventDefault();
    const touch = event.touches[0];
    const rect = selectionCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left - touchStartPos.x;
    const y = touch.clientY - rect.top - touchStartPos.y;
    
    const borderWidth = 20;
    selection.x = Math.max(
      borderWidth,
      Math.min(x, image.width - selection.size - borderWidth)
    );
    selection.y = Math.max(
      borderWidth,
      Math.min(y, image.height - selection.size - borderWidth)
    );
    updateSelectionCanvas();
  }

  function handleButtonTouchStart(action) {
    return (event) => {
      event.preventDefault();
      action();
      longPressTimer = setInterval(action, 100);
    };
  }

  function handleButtonTouchEnd() {
    clearInterval(longPressTimer);
  }

  // Add this function after the existing functions
  function selectRandomThorWizard() {
    const randomNumber = Math.floor(Math.random() * 100) + 1;
    const paddedNumber = randomNumber.toString().padStart(3, '0');
    const imagePath = `/assets/thorwizards/${paddedNumber}.png`;
    
    fetch(imagePath)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], `thor_wizard_${paddedNumber}.png`, { type: 'image/png' });
        handleFile(file);
      })
      .catch(error => {
        console.error('Error loading random Thor wizard:', error);
      });
  }
</script>

<div 
  class="thorchad-container"
  class:drag-over={dragOver}
  class:image-loaded={canAdjustImage}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  style="transform: {canAdjustImage ? '' : `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`};"
  bind:this={container}
>
  <canvas id="canvas" width="400" height="400" style="display: none;"></canvas>
  <div class="content-wrapper">
    <div class="canvas-container" class:frame={canAdjustImage}>
      <canvas
        id="selection-canvas"
        on:mousedown={startDragging}
        on:mouseup={stopDragging}
        on:mouseleave={stopDragging}
        on:mousemove={drag}
        on:wheel={handleWheel}
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend|preventDefault
      ></canvas>
    </div>
    <div class="button-container">
      <button class="image-button" on:click={selectRandomThorWizard} aria-label="Random Thor Wizard">
        <img src="/assets/odin.png" alt="Random Thor Wizard" />
      </button>
      <button class="primary-button" on:click={() => fileInput.click()} aria-label="Upload Image">
        <UploadIcon size={24} color="#ffffff" />
      </button>
      {#if canAdjustImage}
        <button class="primary-button" on:click={downloadImage} aria-label="Download Image">
          <DownloadIcon size={24} color="#ffffff" />
        </button>
        <button 
          class="secondary-button"
          on:mousedown={startDecreasing}
          on:mouseup={stopDecreasing}
          on:mouseleave={stopDecreasing}
          on:touchstart={handleButtonTouchStart(decreaseCropperSize)}
          on:touchend={handleButtonTouchEnd}
          on:touchcancel={handleButtonTouchEnd}
          aria-label="Decrease Size"
        >-</button>
        <button 
          class="secondary-button"
          on:mousedown={startIncreasing}
          on:mouseup={stopIncreasing}
          on:mouseleave={stopIncreasing}
          on:touchstart={handleButtonTouchStart(increaseCropperSize)}
          on:touchend={handleButtonTouchEnd}
          on:touchcancel={handleButtonTouchEnd}
          aria-label="Increase Size"
        >+</button>
      {/if}
    </div>
  </div>
  <input
    type="file"
    accept="image/*"
    on:change={handleFileInput}
    bind:this={fileInput}
    style="display: none;"
  />
  {#if !canAdjustImage}
    <div class="drag-drop-message">
      <span class="highlight">Drag and drop an image here</span>
    </div>
  {/if}
</div>

<style>
  .thorchad-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    width: 90%;
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
    border: 3px dashed #03CFFA;
    border-radius: 20px;
    transition: all 0.3s ease;
    background-color: rgba(3, 207, 250, 0.05);
    transition: transform 0.1s ease-out, border 0.3s ease, background-color 0.3s ease;
    transform-style: preserve-3d;
  }

  .image-loaded {
    border: none;
    padding: 2.1875rem;
    background-color: transparent;
  }

  .drag-over {
    background-color: rgba(3, 207, 250, 0.2);
    border-color: #31FD9D;
  }

  .drag-drop-message {
    color: #333;
    font-size: 1.2rem;
    text-align: center;
    line-height: 1.6;
  }

  .highlight {
    color: #03CFFA;
    font-weight: bold;
  }

  .content-wrapper {
    display: flex;
    width: 100%;
    gap: 1rem;
    align-items: flex-start;
  }

  .canvas-container {
    flex-grow: 1;
    max-width: calc(100% - 80px);
  }

  .button-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  canvas {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    cursor: move;
    border-radius: 5px;
  }

  .primary-button, .secondary-button, .image-button {
    width: 60px;
    height: 60px;
    padding: 0;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
    font-weight: bold;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .primary-button {
    background: linear-gradient(45deg, #03CFFA, #31FD9D);
  }

  .secondary-button {
    background: linear-gradient(45deg, #FF6B6B, #FFD93D);
    font-size: 1.5rem;
  }

  .primary-button:hover, .secondary-button:hover, .image-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
  }

  .primary-button:active, .secondary-button:active, .image-button:active {
    transform: translateY(1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .image-button {
    background: none;
    padding: 0;
    transition: transform 0.3s ease;
  }

  .image-button img {
    width: 60px;
    height: 60px;
    object-fit: contain;
    border-radius: 20px;
  }

  @media (max-width: 768px) {
    .thorchad-container {
      width: 95%;
      padding: 1.5rem;
    }

    .content-wrapper {
      flex-direction: column;
    }

    .canvas-container {
      max-width: 100%;
    }

    .button-container {
      flex-direction: row;
      justify-content: center;
      width: 100%;
      margin-top: 1rem;
    }

    .primary-button, .secondary-button, .image-button {
      width: 50px;
      height: 50px;
      border-radius: 25px;
    }

    .image-button img {
      width: 50px;
      height: 50px;
      border-radius: 25px;
    }
  }
</style>

