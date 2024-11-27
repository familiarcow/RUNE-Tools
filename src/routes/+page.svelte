<script>
  import Thorchad from '$lib/Thorchad.svelte';
  import UploadIcon from '@assets/upload.svelte';
  import DownloadIcon from '@assets/download.svelte';
</script>

<main>
  <h1>Thorchad Profile Picture Editor</h1>
  <Thorchad />
  <div class="flex justify-center space-x-4 mt-4">
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
      on:click={handleImageUpload}
    >
      <UploadIcon size={24} color="#ffffff" />
      <span class="ml-2">Choose Another Image</span>
    </button>

    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
      on:click={handleDownload}
      disabled={!$processedImageStore}
    >
      <DownloadIcon size={24} color="#ffffff" />
      <span class="ml-2">Download</span>
    </button>

    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      on:click={handleOdinRequest}
      disabled={!$imageStore}
    >
      Ask Odin
    </button>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
  }

  h1 {
    margin-bottom: 2rem;
  }
</style>
