/**
 * Computes SHA-256 hash of a video URL
 * Ported from web-new/lib/utils/hash.ts
 *
 * @param {string} videoUrl - The video URL to hash
 * @returns {Promise<string>} 64-character hex string
 */
export async function computeVideoHash(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') {
    throw new Error('Invalid video URL provided');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(videoUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Validates if a string is a valid SHA-256 hash
 * @param {string} hash - The hash to validate
 * @returns {boolean}
 */
export function isValidHash(hash) {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
}
