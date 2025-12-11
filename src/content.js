/**
 * Content Script - Wubby Pleb Titles Extension
 * Only processes VISIBLE videos using IntersectionObserver
 */

// Track processed elements to avoid duplicates
let processedElements = new WeakSet();
let pendingElements = new WeakSet();
const videosWithoutTitles = new Set(); // Track links without pleb titles
const urlToPlebTitle = new Map(); // Track URL -> pleb title for downloads
let replacementCount = 0;
let intersectionObserver = null;
let hideUntitled = false; // Toggle state

/**
 * Compute SHA-256 hash
 */
async function computeVideoHash(videoUrl) {
  const encoder = new TextEncoder();
  const data = encoder.encode(videoUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Detect which site we're on
 */
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('parasoci.al')) return 'parasocial';
  if (hostname.includes('archive.wubby.tv')) return 'archive';
  return null;
}

/**
 * Process a single video element when it becomes visible
 */
async function processVisibleVideo(link) {
  if (processedElements.has(link)) return;
  processedElements.add(link);

  const url = link.href;
  if (!url || !url.includes('.mp4')) return;

  // Convert relative to absolute URL
  let fullUrl = new URL(url, window.location.origin).href;

  // IMPORTANT: Transform URL to match database format
  // Archive site uses /video/ but DB stores /vods/public/
  fullUrl = fullUrl.replace('/video/', '/vods/public/');

  try {
    console.log(`[WubbyExt] URL to hash (transformed): "${fullUrl}"`);
    const hash = await computeVideoHash(fullUrl);
    console.log(`[WubbyExt] Hash result: ${hash}`);

    // Lookup single hash
    const result = await chrome.runtime.sendMessage({
      type: 'LOOKUP_HASH',
      hash,
    });

    // Skip play buttons and special links
    const linkText = link.textContent?.trim() || '';
    const shouldSkip =
      linkText.length < 5 ||  // Very short (like "▶" or "Play")
      linkText === '▶' ||
      linkText === '►' ||
      linkText.toLowerCase() === 'play' ||
      linkText.toLowerCase().includes('latest vod') ||  // Skip "Latest VOD" link
      link.querySelector('svg, img, i') ||  // Contains icon
      link.classList.toString().toLowerCase().includes('button') ||
      link.classList.toString().toLowerCase().includes('play') ||
      link.classList.toString().toLowerCase().includes('latest');

    if (shouldSkip) {
      return;
    }

    // Find the row/container element for this video
    // Try multiple selectors - tr for tables, or parent divs/lis
    let row = link.closest('tr') ||
              link.closest('[class*="row"]') ||
              link.closest('[class*="item"]') ||
              link.closest('li') ||
              link.parentElement?.parentElement; // fallback to grandparent

    console.log('[WubbyExt] Row element found:', row?.tagName, row?.className);

    if (result && result.plebTitle) {
      // Store URL -> pleb title mapping for downloads
      urlToPlebTitle.set(fullUrl, result.plebTitle);
      // Also store the original URL format
      urlToPlebTitle.set(fullUrl.replace('/vods/public/', '/video/'), result.plebTitle);

      // Replace the link text with pleb title and add info button
      applyPlebTitle(link, result.plebTitle, result.platform, result.summary, row);

      // Update any download links for this video
      updateDownloadLinks(fullUrl, result.plebTitle);

      // Mark row as having a title
      if (row) {
        row.dataset.hasPlebTitle = 'true';
        row.classList.add('wubby-has-title');
      }
    } else {
      // No pleb title - track for filtering
      if (row) {
        row.dataset.hasPlebTitle = 'false';
        row.classList.add('wubby-no-title');
        videosWithoutTitles.add(row);
        // Apply hide state if toggle is on
        if (hideUntitled) {
          row.style.display = 'none';
        }
      }
    }

    // Update count after each video processed
    updateCount();
  } catch (err) {
    console.warn('[WubbyExt] Process error:', err);
  }
}

/**
 * Inject toggle UI into the page
 */
function injectToggleUI() {
  // Don't inject twice
  if (document.getElementById('wubby-ext-toggle')) return;

  // Create toggle container - matches archive.wubby.tv dark theme
  const container = document.createElement('div');
  container.id = 'wubby-ext-toggle';
  container.innerHTML = `
    <style>
      #wubby-ext-toggle {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 8px 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      #wubby-ext-toggle label {
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        user-select: none;
      }
      #wubby-ext-toggle input[type="checkbox"] {
        display: none;
      }
      #wubby-ext-toggle .toggle-switch {
        width: 36px;
        height: 20px;
        background: #333;
        border-radius: 10px;
        position: relative;
        transition: background 0.2s;
      }
      #wubby-ext-toggle .toggle-switch::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        background: #666;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: all 0.2s;
      }
      #wubby-ext-toggle input:checked + .toggle-switch {
        background: #6441A5;
      }
      #wubby-ext-toggle input:checked + .toggle-switch::after {
        left: 18px;
        background: #fff;
      }
      #wubby-ext-toggle .count {
        background: #6441A5;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        margin-left: 4px;
      }
    </style>
    <label>
      <span>Hide untitled</span>
      <input type="checkbox" id="wubby-hide-toggle">
      <span class="toggle-switch"></span>
    </label>
    <span class="count" id="wubby-count">0</span>
  `;

  document.body.appendChild(container);

  // Add event listener
  const checkbox = document.getElementById('wubby-hide-toggle');
  checkbox.addEventListener('change', (e) => {
    hideUntitled = e.target.checked;
    toggleUntitledVideos();
    updateCount();
  });

  console.log('[WubbyExt] Toggle UI injected');
}

/**
 * Toggle visibility of videos without pleb titles
 */
function toggleUntitledVideos() {
  const rows = document.querySelectorAll('.wubby-no-title');
  rows.forEach(row => {
    row.style.display = hideUntitled ? 'none' : '';
  });
  console.log(`[WubbyExt] ${hideUntitled ? 'Hidden' : 'Showing'} ${rows.length} untitled videos`);
}

/**
 * Update the count display
 */
function updateCount() {
  const countEl = document.getElementById('wubby-count');
  if (countEl) {
    const titledCount = document.querySelectorAll('.wubby-has-title').length;
    const untitledCount = document.querySelectorAll('.wubby-no-title').length;
    countEl.textContent = `${titledCount}/${titledCount + untitledCount}`;
  }
}

/**
 * Apply pleb title to element and add info button if summary exists
 */
function applyPlebTitle(element, plebTitle, platform, summary, row) {
  if (!element || !plebTitle) return;

  // Store original title
  if (!element.dataset.originalTitle) {
    element.dataset.originalTitle = element.textContent;
  }

  // Apply new title
  element.textContent = plebTitle;

  // Add visual indicator
  element.style.cssText += `
    border-left: 3px solid ${platform === 'kick' ? '#28a745' : '#6441A5'};
    padding-left: 8px;
  `;

  element.title = `Pleb Title (Original: ${element.dataset.originalTitle})`;

  // Add info button if we have a summary
  if (summary && row) {
    addInfoButton(element, summary, platform, row);
  }

  replacementCount++;
  console.log(`[WubbyExt] Replaced: "${element.dataset.originalTitle}" -> "${plebTitle}"`);
}

/**
 * Add info button next to title that toggles summary
 */
function addInfoButton(titleElement, summary, platform, row) {
  // Don't add twice
  if (titleElement.nextElementSibling?.classList?.contains('wubby-info-btn')) return;

  // Create info button
  const infoBtn = document.createElement('button');
  infoBtn.className = 'wubby-info-btn';
  infoBtn.innerHTML = 'i';
  infoBtn.title = 'Show summary';
  infoBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: 8px;
    background: ${platform === 'kick' ? '#28a745' : '#6441A5'};
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 11px;
    font-weight: bold;
    font-style: italic;
    font-family: Georgia, serif;
    cursor: pointer;
    vertical-align: middle;
    transition: transform 0.2s, opacity 0.2s;
    opacity: 0.8;
  `;

  // Create summary panel (hidden initially)
  const summaryId = 'wubby-summary-' + Math.random().toString(36).substr(2, 9);
  const summaryPanel = document.createElement('div');
  summaryPanel.id = summaryId;
  summaryPanel.className = 'wubby-summary-panel';
  summaryPanel.style.cssText = `
    display: none;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-left: 3px solid ${platform === 'kick' ? '#28a745' : '#6441A5'};
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 0 8px 8px 0;
    color: #e0e0e0;
    font-size: 13px;
    line-height: 1.5;
    max-width: 100%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  summaryPanel.textContent = summary;

  // Toggle on click
  infoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isVisible = summaryPanel.style.display !== 'none';
    summaryPanel.style.display = isVisible ? 'none' : 'block';
    infoBtn.style.transform = isVisible ? '' : 'rotate(180deg)';
    infoBtn.style.opacity = isVisible ? '0.8' : '1';
    infoBtn.title = isVisible ? 'Show summary' : 'Hide summary';
  });

  // Hover effect
  infoBtn.addEventListener('mouseenter', () => {
    infoBtn.style.opacity = '1';
    infoBtn.style.transform = 'scale(1.1)';
  });
  infoBtn.addEventListener('mouseleave', () => {
    const isVisible = summaryPanel.style.display !== 'none';
    infoBtn.style.opacity = isVisible ? '1' : '0.8';
    infoBtn.style.transform = isVisible ? 'rotate(180deg)' : '';
  });

  // Insert button after title
  titleElement.parentNode.insertBefore(infoBtn, titleElement.nextSibling);

  // Insert summary panel after the row
  if (row && row.parentNode) {
    // For table rows, insert after the row
    row.parentNode.insertBefore(summaryPanel, row.nextSibling);
  } else {
    // Fallback: insert after button
    infoBtn.parentNode.insertBefore(summaryPanel, infoBtn.nextSibling);
  }
}

/**
 * Update download links to use pleb title as filename
 */
function updateDownloadLinks(videoUrl, plebTitle) {
  // Sanitize pleb title for filename (remove invalid chars)
  const safeTitle = plebTitle
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim()
    .substring(0, 100);            // Limit length

  const filename = safeTitle + '.mp4';

  // Find all download links that match this video URL
  // Check both URL formats
  const videoUrlAlt = videoUrl.replace('/vods/public/', '/video/');

  const allLinks = document.querySelectorAll('a[href*=".mp4"], a[download]');

  for (const link of allLinks) {
    const href = link.href || '';

    // Check if this link is for our video
    if (href.includes(videoUrl) || href.includes(videoUrlAlt) ||
        href === videoUrl || href === videoUrlAlt) {

      // Set the download attribute to override filename
      link.setAttribute('download', filename);
      console.log('[WubbyExt] Updated download filename:', filename);
    }
  }

  // Also intercept clicks on download buttons in the same row
  // Some sites use buttons that trigger downloads via JS
}

/**
 * Global click handler for download links
 * Intercepts downloads and renames them
 */
function setupDownloadInterceptor() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*=".mp4"]');
    if (!link) return;

    const href = link.href;

    // Check if we have a pleb title for this URL
    let plebTitle = urlToPlebTitle.get(href);

    // Try alternate URL format
    if (!plebTitle) {
      const altHref = href.replace('/video/', '/vods/public/');
      plebTitle = urlToPlebTitle.get(altHref);
    }
    if (!plebTitle) {
      const altHref = href.replace('/vods/public/', '/video/');
      plebTitle = urlToPlebTitle.get(altHref);
    }

    if (plebTitle) {
      // Sanitize for filename
      const safeTitle = plebTitle
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);

      const filename = safeTitle + '.mp4';

      // Set download attribute
      link.setAttribute('download', filename);
      console.log('[WubbyExt] Download intercepted, filename:', filename);
    }
  }, true); // Use capture phase to run before other handlers

  console.log('[WubbyExt] Download interceptor active');
}

/**
 * Set up IntersectionObserver for visible elements only
 */
function setupIntersectionObserver() {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const link = entry.target;
          intersectionObserver.unobserve(link); // Stop observing once visible
          processVisibleVideo(link);
        }
      }
    },
    {
      root: null, // viewport
      rootMargin: '100px', // Start loading slightly before visible
      threshold: 0.1,
    }
  );

  console.log('[WubbyExt] IntersectionObserver ready');
}

/**
 * Find and observe all video links
 */
function observeVideoLinks() {
  const links = document.querySelectorAll('a[href*="/video/"], a[href*=".mp4"]');

  let newCount = 0;
  for (const link of links) {
    if (pendingElements.has(link) || processedElements.has(link)) continue;

    pendingElements.add(link);
    intersectionObserver.observe(link);
    newCount++;
  }

  if (newCount > 0) {
    console.log(`[WubbyExt] Observing ${newCount} new video links`);
  }
}

/**
 * Set up MutationObserver to catch dynamically loaded content
 */
function setupMutationObserver() {
  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(observeVideoLinks, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[WubbyExt] MutationObserver active');
}

/**
 * Check if we're on a video detail page and update the title there
 */
async function handleVideoDetailPage() {
  const url = window.location.href;

  // Check if we're on a video detail page
  if (!url.includes('/video/') || !url.includes('.mp4')) {
    return false;
  }

  console.log('[WubbyExt] Detected video detail page:', url);

  // Transform URL to match database format
  const dbUrl = url.replace('/video/', '/vods/public/');

  try {
    const hash = await computeVideoHash(dbUrl);
    console.log('[WubbyExt] Video page hash:', hash);

    const result = await chrome.runtime.sendMessage({
      type: 'LOOKUP_HASH',
      hash,
    });

    if (result && result.plebTitle) {
      console.log('[WubbyExt] Found pleb title for video page:', result.plebTitle);

      // Replace title elements based on filename pattern
      replaceTitleElements(result.plebTitle);

      return true;
    } else {
      console.log('[WubbyExt] No pleb title found for this video');
    }
  } catch (err) {
    console.error('[WubbyExt] Error on video detail page:', err);
  }

  return false;
}

/**
 * Find and replace title elements with the pleb title
 * Matches based on filename pattern from URL
 */
function replaceTitleElements(plebTitle) {
  // Extract filename from URL (e.g., "4_no-title_1764815834_000" from the .mp4 URL)
  const url = window.location.href;
  const match = url.match(/\/([^\/]+)\.mp4/);
  if (!match) {
    console.log('[WubbyExt] Could not extract filename from URL');
    return;
  }

  const filename = match[1]; // e.g., "4_no-title_1764815834_000"
  console.log('[WubbyExt] Looking for filename:', filename);

  // Also extract just the title part (between first _ and last _timestamp_000)
  // Format: "4_TITLE_1764815834_000" -> extract "TITLE"
  const titleMatch = filename.match(/^\d+_(.+)_\d+_\d+$/);
  const titlePart = titleMatch ? titleMatch[1] : null;
  console.log('[WubbyExt] Title part:', titlePart);

  // Walk through all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToReplace = [];
  let node;

  while (node = walker.nextNode()) {
    const text = node.textContent;
    // Match if text contains the filename, title part, or "no-title"
    if (text.includes(filename) ||
        (titlePart && text.includes(titlePart)) ||
        text.includes('no-title')) {
      nodesToReplace.push({ node, filename, titlePart });
    }
  }

  // Replace the text
  for (const { node, filename, titlePart } of nodesToReplace) {
    let newText = node.textContent;

    // Replace filename first
    if (newText.includes(filename)) {
      newText = newText.replace(filename, plebTitle);
    }
    // Then title part
    else if (titlePart && newText.includes(titlePart)) {
      newText = newText.replace(titlePart, plebTitle);
    }
    // Fallback to no-title
    else if (newText.includes('no-title')) {
      newText = newText.replace(/no-title/g, plebTitle);
    }

    node.textContent = newText;
    console.log('[WubbyExt] Replaced title with:', plebTitle);
  }

  console.log(`[WubbyExt] Replaced ${nodesToReplace.length} occurrences`);
}

/**
 * Initialize or re-initialize on navigation
 */
async function init() {
  const site = detectSite();
  if (!site) {
    console.log('[WubbyExt] Not on a supported site');
    return;
  }

  console.log(`[WubbyExt] Initialized on ${site}, URL: ${window.location.href}`);

  // Check if we're on a video detail page first
  if (site === 'archive') {
    const isVideoPage = await handleVideoDetailPage();
    if (isVideoPage) {
      console.log('[WubbyExt] Video detail page handled');
      return; // Don't run list logic on video pages
    }

    // We're on the list page - inject toggle
    injectToggleUI();
  }

  console.log('[WubbyExt] Running in list mode (viewport-only)');

  // Set up download interceptor
  setupDownloadInterceptor();

  // Set up observers
  setupIntersectionObserver();
  setupMutationObserver();

  // Initial scan
  observeVideoLinks();

  // Update count periodically as videos load
  setInterval(updateCount, 2000);
}

/**
 * Handle SPA navigation - re-run init when URL changes
 */
let lastUrl = window.location.href;

function setupNavigationListener() {
  // Check for URL changes periodically (works for all SPA routers)
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      console.log('[WubbyExt] Navigation detected:', lastUrl, '->', window.location.href);
      lastUrl = window.location.href;

      // Reset state
      processedElements = new WeakSet();
      pendingElements = new WeakSet();

      // Re-initialize
      init();
    }
  }, 500);

  // Also listen for popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    console.log('[WubbyExt] Popstate navigation detected');
    setTimeout(init, 100);
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupNavigationListener();
  });
} else {
  init();
  setupNavigationListener();
}
