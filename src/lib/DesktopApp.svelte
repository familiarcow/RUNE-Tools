<script>
  import { onMount } from 'svelte';
  
  let releaseData = null;
  let loading = true;
  let error = null;

  async function fetchReleaseData() {
    try {
      const response = await fetch('https://api.github.com/repos/familiarcow/rune-tools-desktop/releases/latest');
      if (!response.ok) {
        throw new Error('Failed to fetch release data');
      }
      const data = await response.json();
      releaseData = data;
      loading = false;
    } catch (err) {
      error = err.message;
      loading = false;
      console.error('Error fetching release data:', err);
    }
  }

  onMount(() => {
    fetchReleaseData();
  });

  function getDownloadUrl(platform) {
    if (!releaseData || !releaseData.assets) return null;
    
    const asset = releaseData.assets.find(asset => {
      const name = asset.name.toLowerCase();
      if (platform === 'mac') {
        return name.endsWith('.dmg') && !name.includes('manifest');
      } else if (platform === 'windows') {
        return name.endsWith('.exe') || name.endsWith('.msi') || name.includes('windows');
      }
      return false;
    });
    
    return asset ? asset.browser_download_url : null;
  }

  function getAssetInfo(platform) {
    if (!releaseData || !releaseData.assets) return null;
    
    const asset = releaseData.assets.find(asset => {
      const name = asset.name.toLowerCase();
      if (platform === 'mac') {
        return name.endsWith('.dmg') && !name.includes('manifest');
      } else if (platform === 'windows') {
        return name.endsWith('.exe') || name.endsWith('.msi') || name.includes('windows');
      }
      return false;
    });
    
    if (!asset) return null;
    
    const name = asset.name;
    let arch = 'Universal';
    let type = platform === 'mac' ? 'DMG Installer' : 'EXE Installer';
    
    if (platform === 'mac') {
      if (name.includes('arm64') || name.includes('aarch64')) {
        arch = 'Apple Silicon';
      } else if (name.includes('x64') || name.includes('intel')) {
        arch = 'Intel';
      } else {
        arch = 'Apple Silicon'; // Current releases are ARM64
      }
    } else if (platform === 'windows') {
      if (name.includes('x64')) {
        arch = 'x64';
      } else if (name.includes('x86') || name.includes('win32')) {
        arch = 'x86';
      }
    }
    
    return { arch, type, url: asset.browser_download_url };
  }

  function parseChangelog(text) {
    if (!text) return [];
    
    // Clean up the text and split into lines
    const lines = text.split('\n').map(line => line.trim());
    const items = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Skip empty lines and horizontal rules
      if (line.length === 0 || line === '---') {
        i++;
        continue;
      }
      
      // Handle various header formats
      if (line.startsWith('# ')) {
        items.push({
          type: 'heading',
          text: line.substring(2).trim(),
          level: 1
        });
        i++;
      } else if (line.startsWith('## ')) {
        const headerText = line.substring(3).trim();
        
        // Check if this is Installation Notes or Verification section
        if (headerText.toLowerCase().includes('installation') || 
            headerText.toLowerCase().includes('verification')) {
          // Group all content under this header into a unified container
          const groupedContent = [];
          groupedContent.push({
            type: 'section-header',
            text: headerText
          });
          
          i++; // Move past the header
          
          // Collect all content until next major section or end
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            
            // Stop if we hit another major header (## or #)
            if (nextLine.startsWith('## ') || nextLine.startsWith('# ')) {
              break;
            }
            
            if (nextLine.length === 0 || nextLine === '---') {
              i++;
              continue;
            }
            
            // Add content to the grouped section
            if (nextLine.startsWith('### ')) {
              groupedContent.push({
                type: 'subsection-header',
                text: nextLine.substring(4).trim()
              });
            } else if (nextLine.startsWith('- ') || nextLine.startsWith('• ')) {
              // Collect all bullets in this subsection
              const bulletList = [];
              while (i < lines.length) {
                const bulletLine = lines[i].trim();
                if (bulletLine.startsWith('- ') || bulletLine.startsWith('• ')) {
                  let bulletText = bulletLine.substring(2).trim();
                  bulletText = cleanupBoldText(bulletText);
                  bulletList.push(bulletText);
                  i++;
                } else {
                  break;
                }
              }
              groupedContent.push({
                type: 'bullets',
                bullets: bulletList
              });
              continue; // Skip the i++ at the end since we already moved past bullets
            } else if (nextLine.startsWith('**') && nextLine.endsWith('**')) {
              groupedContent.push({
                type: 'subheading',
                text: nextLine.substring(2, nextLine.length - 2).trim()
              });
            } else if (nextLine.length > 0) {
              let cleanText = cleanupBoldText(nextLine);
              const linkParts = parseMarkdownLinks(cleanText);
              if (linkParts.length === 1 && linkParts[0].type === 'text') {
                groupedContent.push({
                  type: 'text',
                  text: cleanText
                });
              } else {
                groupedContent.push({
                  type: 'rich-text',
                  parts: linkParts
                });
              }
            }
            
            i++;
          }
          
          items.push({
            type: 'unified-section',
            title: headerText,
            content: groupedContent
          });
          continue; // Skip the normal i++ since we handled it in the loop
        } else {
          // Normal section header
          items.push({
            type: 'heading',
            text: headerText,
            level: 2
          });
          i++;
        }
      } else if (line.startsWith('### ')) {
        items.push({
          type: 'heading', 
          text: line.substring(4).trim(),
          level: 3
        });
        i++;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        // Handle bullet points - group consecutive bullets together
        const bulletList = [];
        let bulletText = line.substring(2).trim();
        bulletText = cleanupBoldText(bulletText);
        bulletList.push(bulletText);
        
        // Look ahead for more bullet points
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('- ') || nextLine.startsWith('• ')) {
            i++; // consume the next line
            let nextBulletText = nextLine.substring(2).trim();
            nextBulletText = cleanupBoldText(nextBulletText);
            bulletList.push(nextBulletText);
          } else {
            break;
          }
        }
        
        items.push({
          type: 'bullet-list',
          bullets: bulletList
        });
        i++;
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Handle standalone bold text as subheadings
        items.push({
          type: 'subheading',
          text: line.substring(2, line.length - 2).trim()
        });
        i++;
      } else if (line.length > 0) {
        // Regular paragraph text, clean up any bold formatting and parse links
        let cleanText = cleanupBoldText(line);
        const linkParts = parseMarkdownLinks(cleanText);
        if (linkParts.length === 1 && linkParts[0].type === 'text') {
          items.push({
            type: 'text',
            text: cleanText
          });
        } else {
          items.push({
            type: 'rich-text',
            parts: linkParts
          });
        }
        i++;
      } else {
        i++;
      }
    }
    
    return items;
  }

  function cleanupBoldText(text) {
    // Replace **bold** with just the text content, but preserve it for styling
    return text.replace(/\*\*(.*?)\*\*/g, '$1');
  }

  function parseMarkdownLinks(text) {
    // Parse markdown links [text](url) and return array of parts
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText.trim()) {
          parts.push({
            type: 'text',
            content: beforeText
          });
        }
      }

      // Add the link
      parts.push({
        type: 'link',
        text: match[1],
        url: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last link
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText.trim()) {
        parts.push({
          type: 'text',
          content: remainingText
        });
      }
    }

    // If no links found, return the original text as a single text part
    if (parts.length === 0) {
      return [{
        type: 'text',
        content: text
      }];
    }

    return parts;
  }

  function formatTextWithBold(text) {
    // Split text by **bold** markers and create spans
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return {
          type: 'bold',
          text: part.substring(2, part.length - 2)
        };
      }
      return {
        type: 'normal',
        text: part
      };
    }).filter(part => part.text.length > 0);
  }
</script>

<div class="desktop-app-container">
  <div class="header-section">
    <div class="title-wrapper">
      <h2>🖥️ RUNE Tools Desktop</h2>
      <p class="subtitle">Native wallet companion app for macOS and Windows</p>
    </div>
  </div>

  {#if loading}
    <div class="loading-section">
      <div class="loading-bar"></div>
      <p>Loading release information...</p>
    </div>
  {:else if error}
    <div class="error-section">
      <p>⚠️ Unable to load release data: {error}</p>
      <a href="https://github.com/familiarcow/rune-tools-desktop/releases" target="_blank" class="fallback-link">
        View releases on GitHub →
      </a>
    </div>
  {:else if releaseData}
    <div class="release-section">
      <div class="version-info">
        <h3>Latest Version: {releaseData.tag_name}</h3>
        <p class="release-date">Released: {new Date(releaseData.published_at).toLocaleDateString()}</p>
      </div>

      <div class="download-buttons">
        {#if getAssetInfo('mac')}
          {@const macInfo = getAssetInfo('mac')}
          <a href={macInfo.url} class="download-btn mac-btn" target="_blank">
            <div class="btn-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            <div class="btn-content">
              <div class="btn-title">Download for macOS</div>
              <div class="btn-subtitle">{macInfo.arch}</div>
            </div>
          </a>
        {/if}

        {#if getAssetInfo('windows')}
          {@const windowsInfo = getAssetInfo('windows')}
          <a href={windowsInfo.url} class="download-btn windows-btn" target="_blank">
            <div class="btn-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-8 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m8 .15l8 .09V22l-8-1.35v-7.5z"/>
              </svg>
            </div>
            <div class="btn-content">
              <div class="btn-title">Download for Windows</div>
              <div class="btn-subtitle">{windowsInfo.arch}</div>
            </div>
          </a>
        {:else}
          <div class="download-btn disabled-btn">
            <div class="btn-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-8 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m8 .15l8 .09V22l-8-1.35v-7.5z"/>
              </svg>
            </div>
            <div class="btn-content">
              <div class="btn-title">Windows (Coming Soon)</div>
              <div class="btn-subtitle">In development</div>
            </div>
          </div>
        {/if}

      </div>

      {#if releaseData.body}
        <div class="changelog-section">
          <h3>📋 Changelog - What's New</h3>
          <div class="changelog-content">
            {#each parseChangelog(releaseData.body) as item}
              {#if item.type === 'heading' && item.level === 1}
                <div class="version-header">
                  <h3 class="main-title">{item.text}</h3>
                </div>
              {:else if item.type === 'unified-section'}
                <div class="unified-section-container">
                  <h4 class="unified-section-title">{item.title}</h4>
                  <div class="unified-content">
                    {#each item.content as contentItem}
                      {#if contentItem.type === 'section-header'}
                        <!-- Skip since we already have the title -->
                      {:else if contentItem.type === 'subsection-header'}
                        <h5 class="unified-subsection-title">{contentItem.text}</h5>
                      {:else if contentItem.type === 'bullets'}
                        <ul class="unified-bullet-list">
                          {#each contentItem.bullets as bullet}
                            <li class="unified-bullet">{bullet}</li>
                          {/each}
                        </ul>
                      {:else if contentItem.type === 'subheading'}
                        <div class="unified-subheading">{contentItem.text}</div>
                      {:else if contentItem.type === 'text'}
                        <p class="unified-text">{contentItem.text}</p>
                      {:else if contentItem.type === 'rich-text'}
                        <p class="unified-text">
                          {#each contentItem.parts as part}
                            {#if part.type === 'link'}
                              <a href={part.url} target="_blank" class="changelog-link">{part.text}</a>
                            {:else}
                              {part.content}
                            {/if}
                          {/each}
                        </p>
                      {/if}
                    {/each}
                  </div>
                </div>
              {:else if item.type === 'heading' && item.level === 2}
                <div class="section-container">
                  <h4 class="section-title">{item.text}</h4>
                </div>
              {:else if item.type === 'heading' && item.level === 3}
                <div class="subsection-container">
                  <h5 class="subsection-title">{item.text}</h5>
                </div>
              {:else if item.type === 'subheading'}
                <div class="highlight-container">
                  <div class="changelog-subheading">{item.text}</div>
                </div>
              {:else if item.type === 'bullet-list'}
                <div class="bullet-container">
                  {#each item.bullets as bullet}
                    <div class="changelog-bullet">• {bullet}</div>
                  {/each}
                </div>
              {:else if item.type === 'text'}
                <div class="text-container">
                  <p class="changelog-paragraph">{item.text}</p>
                </div>
              {:else if item.type === 'rich-text'}
                <div class="text-container">
                  <p class="changelog-paragraph">
                    {#each item.parts as part}
                      {#if part.type === 'link'}
                        <a href={part.url} target="_blank" class="changelog-link">{part.text}</a>
                      {:else}
                        {part.content}
                      {/if}
                    {/each}
                  </p>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <div class="features-section">
        <h3>✨ Features</h3>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">💰</div>
            <div class="feature-title">RUNE Wallet</div>
            <div class="feature-desc">Secure RUNE wallet with native transaction support</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔗</div>
            <div class="feature-title">RUNE Bonding</div>
            <div class="feature-desc">Bond RUNE to THORChain nodes directly from desktop</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🪙</div>
            <div class="feature-title">TCY Staking</div>
            <div class="feature-desc">Stake TCY tokens with built-in yield tracking</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📝</div>
            <div class="feature-title">Memoless</div>
            <div class="feature-desc">Use Memoless to easily mint THORChain Secured Assets from native assets</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🛡️</div>
            <div class="feature-title">Secured Asset Swaps</div>
            <div class="feature-desc">Safe cross-chain swaps with native asset security</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🌐</div>
            <div class="feature-title">Access rune.tools</div>
            <div class="feature-desc">Access rune.tools directly from the desktop app</div>
          </div>
        </div>
      </div>

      <div class="verification-section">
        <h3>🔍 Verification</h3>
        <p class="verification-text">Verify the authenticity and security of RUNE Tools Desktop:</p>
        <a href="https://github.com/familiarcow/rune-tools-desktop" class="download-btn source-btn" target="_blank">
          <div class="btn-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
            </svg>
          </div>
          <div class="btn-content">
            <div class="btn-title">View Source</div>
            <div class="btn-subtitle">GitHub Repository</div>
          </div>
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .desktop-app-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    color: #ffffff;
  }

  .header-section {
    text-align: center;
    margin-bottom: 40px;
  }

  .title-wrapper {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .title-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: shimmer 5s infinite;
  }

  .title-wrapper h2 {
    background: transparent;
    color: #ffffff;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin: 0;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .subtitle {
    color: #c0c0c0;
    font-size: 16px;
    font-weight: 500;
    margin: 8px 0 0 0;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .loading-section, .error-section {
    text-align: center;
    padding: 40px 20px;
  }

  .loading-bar {
    width: 200px;
    height: 4px;
    background: linear-gradient(90deg, #3a3a3a 25%, #5a5a5a 50%, #3a3a3a 75%);
    background-size: 200% 100%;
    animation: shimmer-bar 1.5s infinite ease-in-out;
    border-radius: 4px;
    margin: 0 auto 16px auto;
  }

  @keyframes shimmer-bar {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .error-section {
    color: #dc3545;
  }

  .fallback-link {
    color: #4A90E2;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.3s ease;
  }

  .fallback-link:hover {
    color: #31FD9D;
  }

  .release-section {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .version-info {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .version-info h3 {
    color: #ffd700;
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 8px 0;
  }

  .release-date {
    color: #a0a0a0;
    font-size: 14px;
    margin: 0;
  }

  .download-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .download-btn {
    display: flex;
    align-items: center;
    padding: 20px;
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
  }

  .download-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 215, 0, 0.6);
  }

  .download-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 237, 78, 0.05) 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .download-btn:hover::before {
    opacity: 1;
  }

  .disabled-btn {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .disabled-btn:hover {
    transform: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .disabled-btn::before {
    display: none;
  }

  .btn-icon {
    margin-right: 16px;
    z-index: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon svg {
    color: #ffffff;
    transition: color 0.3s ease;
  }

  .download-btn:hover .btn-icon svg {
    color: #ffd700;
  }

  .btn-content {
    z-index: 1;
    position: relative;
  }

  .btn-title {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .btn-subtitle {
    color: #a0a0a0;
    font-size: 13px;
    font-weight: 500;
  }

  .changelog-section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .changelog-section h3 {
    color: #31FD9D;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 16px 0;
  }

  .changelog-content {
    color: #c0c0c0;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Version Header - Dark gradient box with accent */
  .version-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 16px;
    margin: 0 0 20px 0;
    position: relative;
    overflow: hidden;
  }

  .version-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: shimmer 3s infinite;
  }

  .main-title {
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    text-align: center;
    position: relative;
    z-index: 1;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  /* Section Container - Accent border box */
  .section-container {
    background: linear-gradient(145deg, #2a2a2a 0%, #323232 100%);
    border: 2px solid #31FD9D;
    border-radius: 10px;
    padding: 12px 16px;
    margin: 16px 0 8px 0;
  }

  .section-title {
    color: #31FD9D;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  /* Subsection Container - Blue themed */
  .subsection-container {
    background: rgba(99, 102, 241, 0.1);
    border-left: 4px solid #6366f1;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 12px 0 8px 0;
  }

  .subsection-title {
    color: #a5b4fc;
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  /* Highlight Container - Warning/important content */
  .highlight-container {
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid rgba(255, 165, 0, 0.3);
    border-radius: 8px;
    padding: 8px 12px;
    margin: 8px 0;
  }

  .changelog-subheading {
    color: #ffa500;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }

  /* Bullet Container - List items */
  .bullet-container {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    padding: 8px 12px;
    margin: 4px 0;
    border-left: 3px solid #4a4a4a;
  }

  .changelog-bullet {
    color: #e0e0e0;
    margin: 2px 0;
    padding: 0;
    line-height: 1.5;
  }

  /* Text Container - Regular content */
  .text-container {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .changelog-paragraph {
    margin: 0;
    color: #c0c0c0;
    line-height: 1.6;
  }

  /* Unified Section Container - For Installation Notes and Verification */
  .unified-section-container {
    background: linear-gradient(145deg, #2a2a2a 0%, #323232 100%);
    border: 2px solid #31FD9D;
    border-radius: 12px;
    padding: 20px;
    margin: 16px 0;
  }

  .unified-section-title {
    color: #31FD9D;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
    text-align: center;
  }

  .unified-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .unified-subsection-title {
    color: #a5b4fc;
    font-size: 14px;
    font-weight: 600;
    margin: 8px 0 4px 0;
  }

  .unified-bullet-list {
    margin: 0;
    padding-left: 16px;
    list-style: none;
  }

  .unified-bullet {
    color: #e0e0e0;
    margin: 4px 0;
    padding-left: 8px;
    position: relative;
    line-height: 1.5;
  }

  .unified-bullet::before {
    content: '•';
    color: #31FD9D;
    position: absolute;
    left: -8px;
  }

  .unified-subheading {
    color: #ffa500;
    font-size: 15px;
    font-weight: 600;
    margin: 8px 0 4px 0;
  }

  .unified-text {
    margin: 0;
    color: #c0c0c0;
    line-height: 1.6;
    font-size: 14px;
  }

  .changelog-link {
    color: #4A90E2;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .changelog-link:hover {
    color: #31FD9D;
    text-shadow: 0 0 8px rgba(49, 253, 157, 0.3);
  }

  .features-section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .features-section h3 {
    color: #667eea;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 20px 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 16px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .feature-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  .feature-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }

  .feature-title {
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .feature-desc {
    color: #a0a0a0;
    font-size: 12px;
    line-height: 1.4;
  }

  .verification-section {
    background: linear-gradient(145deg, #2c2c2c 0%, #3a3a3a 100%);
    border-radius: 12px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .verification-section h3 {
    color: #ffd700;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 16px 0;
  }

  .verification-text {
    color: #c0c0c0;
    font-size: 14px;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }

  @media (max-width: 600px) {
    .desktop-app-container {
      padding: 16px;
    }

    .download-buttons {
      grid-template-columns: 1fr;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .title-wrapper h2 {
      font-size: 22px;
    }

    .subtitle {
      font-size: 14px;
    }
  }
</style>