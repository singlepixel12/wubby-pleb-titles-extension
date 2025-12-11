/**
 * Background Service Worker
 * ALL CODE INLINED to avoid ES module issues
 */

// ========== CONFIG ==========
const SUPABASE_URL = 'https://sbvaclmypokafpxebusn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmFjbG15cG9rYWZweGVidXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NDI3MTUsImV4cCI6MjA2MzExODcxNX0.7yr-OxNKpoeMstxyOG79ms4F_7eSADLBSROBgwtqTSE';

// ========== CACHE ==========
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(hash) {
  const entry = cache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(hash);
    return null;
  }
  return entry.data;
}

function setCache(hash, data) {
  cache.set(hash, { data, timestamp: Date.now() });
}

// ========== API ==========
async function getVideoByHash(hash) {
  if (!hash || hash.length !== 64) {
    console.warn('[WubbyExt BG] Invalid hash:', hash);
    return null;
  }

  try {
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${hash}&select=pleb_title,platform,summary`;

    console.log('[WubbyExt BG] Fetching:', queryUrl.substring(0, 80) + '...');

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[WubbyExt BG] Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[WubbyExt BG] API error:', response.status, text);
      return null;
    }

    const data = await response.json();
    console.log('[WubbyExt BG] API returned:', data);

    if (!data || data.length === 0) {
      return null;
    }

    return {
      plebTitle: data[0].pleb_title || null,
      platform: data[0].platform || 'unknown',
      summary: data[0].summary || null,
    };
  } catch (error) {
    console.error('[WubbyExt BG] Fetch error:', error);
    return null;
  }
}

// ========== MESSAGE HANDLER ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WubbyExt BG] Received message:', message.type);

  if (message.type === 'LOOKUP_HASH') {
    handleLookupHash(message.hash).then(result => {
      console.log('[WubbyExt BG] Sending response:', result);
      sendResponse(result);
    });
    return true; // Keep channel open for async
  }

  if (message.type === 'GET_STATS') {
    sendResponse({ cacheSize: cache.size });
    return false;
  }

  return false;
});

async function handleLookupHash(hash) {
  // Check cache
  const cached = getCached(hash);
  if (cached !== null) {
    console.log('[WubbyExt BG] Cache hit:', hash.substring(0, 8));
    return cached;
  }

  console.log('[WubbyExt BG] Cache miss, fetching:', hash.substring(0, 8));
  const result = await getVideoByHash(hash);
  setCache(hash, result);
  return result;
}

console.log('[WubbyExt BG] Service worker initialized!');
console.log('[WubbyExt BG] Supabase URL:', SUPABASE_URL);
