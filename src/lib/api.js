import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/**
 * Fetches video metadata by hash from Supabase
 *
 * @param {string} hash - 64-character SHA-256 hash
 * @returns {Promise<{plebTitle: string, platform: string} | null>}
 */
export async function getVideoByHash(hash) {
  if (!hash || hash.length !== 64) {
    console.warn('[WubbyExt] Invalid hash:', hash);
    return null;
  }

  try {
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${hash}&select=pleb_title,platform`;

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[WubbyExt] API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    return {
      plebTitle: data[0].pleb_title || null,
      platform: data[0].platform || 'unknown',
    };
  } catch (error) {
    console.error('[WubbyExt] API fetch error:', error);
    return null;
  }
}

/**
 * Batch lookup multiple hashes at once
 * Chunks requests to avoid URL length limits
 *
 * @param {string[]} hashes - Array of 64-character SHA-256 hashes
 * @returns {Promise<Map<string, {plebTitle: string, platform: string}>>}
 */
export async function getVideosByHashes(hashes) {
  const results = new Map();

  if (!hashes || hashes.length === 0) {
    return results;
  }

  // Filter valid hashes
  const validHashes = hashes.filter(h => h && h.length === 64);

  if (validHashes.length === 0) {
    return results;
  }

  // Chunk into batches of 50 to stay under URL length limits
  // 50 hashes * 65 chars (hash + comma) = ~3,250 chars, safe under 8KB
  const BATCH_SIZE = 50;
  const chunks = [];

  for (let i = 0; i < validHashes.length; i += BATCH_SIZE) {
    chunks.push(validHashes.slice(i, i + BATCH_SIZE));
  }

  console.log(`[WubbyExt] Fetching ${validHashes.length} hashes in ${chunks.length} batches`);

  // Process chunks in parallel (max 5 concurrent)
  const MAX_CONCURRENT = 5;

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map(chunk => fetchHashBatch(chunk));

    try {
      const batchResults = await Promise.all(promises);

      for (const map of batchResults) {
        for (const [hash, data] of map.entries()) {
          results.set(hash, data);
        }
      }
    } catch (error) {
      console.error('[WubbyExt] Batch error:', error);
    }
  }

  console.log(`[WubbyExt] Found ${results.size} pleb titles`);
  return results;
}

/**
 * Fetch a single batch of hashes
 */
async function fetchHashBatch(hashes) {
  const results = new Map();

  try {
    const hashList = hashes.join(',');
    const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=in.(${hashList})&select=video_hash,pleb_title,platform`;

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[WubbyExt] Batch API error:', response.status);
      return results;
    }

    const data = await response.json();

    for (const row of data) {
      if (row.video_hash && row.pleb_title) {
        results.set(row.video_hash, {
          plebTitle: row.pleb_title,
          platform: row.platform || 'unknown',
        });
      }
    }
  } catch (error) {
    console.error('[WubbyExt] Fetch batch error:', error);
  }

  return results;
}
