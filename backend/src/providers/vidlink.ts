import _sodium from 'libsodium-wrappers';
import { config } from '../config';
import { fetchJsonWithRetry } from '../utils/http';
import { StreamCandidate, selectBestStream } from '../utils/quality';
import { filterEnglishSubtitles } from '../utils/subs';
import { NormalizedResponse } from './index';

const FALLBACK_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

export async function encryptToken(mediaId: string): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;

  let keyHex = config.vidlinkKeyHex;
  if (!keyHex) {
    console.warn('WARNING: VIDLINK_KEY_HEX is not set in environment. Using fallback key. Please rotate your secret.');
    keyHex = FALLBACK_KEY_HEX;
  }

  const key = Buffer.from(keyHex, 'hex');
  const nonce = Buffer.alloc(24); // 24 zero bytes

  const timestamp = Math.floor(Date.now() / 1000) + 480;
  
  const mediaIdBuf = Buffer.from(mediaId, 'utf-8');
  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigUInt64BE(BigInt(timestamp));

  const message = Buffer.concat([mediaIdBuf, timestampBuf]);

  // crypto_secretbox_easy returns MAC + ciphertext
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);

  // full_payload = NONCE + MAC + ciphertext
  const fullPayload = Buffer.concat([nonce, Buffer.from(ciphertext)]);

  // base64url encode and strip trailing '='
  const token = fullPayload.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return token;
}

function parseVidlinkResponse(data: any): NormalizedResponse | null {
  if (!data || (!data.stream && !data.streams && !data.hls && !data.dash)) return null;

  const candidates: StreamCandidate[] = [];

  // Extract from streams array if present
  if (data.stream && Array.isArray(data.stream)) {
      data.stream.forEach((s: any) => {
          if (s.url) candidates.push({ url: s.url, quality: s.quality || '1080p', format: 'MP4' });
      });
  }
  
  if (data.streams && Array.isArray(data.streams)) {
      data.streams.forEach((s: any) => {
          if (s.url) candidates.push({ url: s.url, quality: s.quality || '1080p', format: 'MP4' });
      });
  }

  // Extract from hls/dash strings
  if (data.hls && typeof data.hls === 'string') {
    candidates.push({ url: data.hls, quality: 'auto', format: 'HLS' });
  }

  if (candidates.length === 0) return null;

  const bestStream = selectBestStream(candidates);
  if (!bestStream) return null;

  const rawSubtitles = data.captions || data.subtitles || [];
  const subtitles = filterEnglishSubtitles(rawSubtitles.map((s: any) => ({ label: s.label || s.language || '', url: s.url || s.file })));

  return {
    provider: 'vidlink',
    fallback: false,
    quality: bestStream.quality || 'auto',
    stream: bestStream.url,
    subtitles,
    raw: data,
  };
}

export const vidlinkProvider = {
  async fetchMovie(tmdbId: string): Promise<NormalizedResponse | null> {
    const token = await encryptToken(tmdbId);
    const url = `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
    const data = await fetchJsonWithRetry(url, { headers: { Origin: 'https://vidlink.pro', Referer: 'https://vidlink.pro/' } });
    return parseVidlinkResponse(data);
  },

  async fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
    const mediaId = `${tmdbId}-${season}-${episode}`; // Vidlink might just use tmdbId for tv token, but let's stick to endpoint structure:
    const token = await encryptToken(tmdbId);
    const url = `https://vidlink.pro/api/b/tv/${token}/${season}/${episode}?multiLang=1`;
    const data = await fetchJsonWithRetry(url, { headers: { Origin: 'https://vidlink.pro', Referer: 'https://vidlink.pro/' } });
    return parseVidlinkResponse(data);
  },
};
