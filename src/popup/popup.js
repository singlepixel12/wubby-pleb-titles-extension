/**
 * Popup Script - Wubby Pleb Titles Extension
 */

async function updateStats() {
  try {
    // Get cache stats from background
    const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (stats) {
      document.getElementById('cacheCount').textContent = stats.cacheSize || 0;
    }

    // Update status
    document.getElementById('statusDot').classList.remove('inactive');
    document.getElementById('statusText').textContent = 'Active';
  } catch (err) {
    document.getElementById('statusDot').classList.add('inactive');
    document.getElementById('statusText').textContent = 'Error';
    console.error('Popup error:', err);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', updateStats);
