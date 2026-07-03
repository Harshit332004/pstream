import { fetchJsonWithRetry } from '../utils/http';
import { StreamCandidate, selectBestStream } from '../utils/quality';
import { NormalizedResponse, Provider } from './index';

const BASE_URL = 'https://new.vidnest.fun';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Origin': 'https://vidnest.fun',
  'Referer': 'https://vidnest.fun/',
};

const _VIDNEST_ALPHA = 'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';

function decodeVidnest(data: string): string {
  const table: Record<string, number> = {};
  for (let idx = 0; idx < _VIDNEST_ALPHA.length; idx++) {
    table[_VIDNEST_ALPHA[idx]] = idx;
  }

  const result: number[] = [];
  let i = 0;
  while (i < data.length) {
    let chunk = data.substring(i, i + 4);
    while (chunk.length < 4) {
      chunk += '=';
    }
    i += 4;

    const l0 = table[chunk[0]] ?? 64;
    const l1 = table[chunk[1]] ?? 64;
    const l2 = table[chunk[2]] ?? 64;
    const l3 = table[chunk[3]] ?? 64;

    result.push((l0 << 2) | (l1 >> 4));
    if (l2 !== 64) {
      result.push(((l1 & 15) << 4) | (l2 >> 2));
    }
    if (l3 !== 64) {
      result.push(((l2 & 3) << 6) | l3);
    }
  }

  return Buffer.from(result).toString('utf-8');
}

async function fetchVidnest(url: string): Promise<any> {
  const data = await fetchJsonWithRetry(url, { headers: HEADERS });
  
  if (data && data.encrypted) {
    if (typeof data.data !== 'string') {
      throw new Error('Vidnest returned encrypted=true but data is not string');
    }
    const decryptedStr = decodeVidnest(data.data);
    try {
      return JSON.parse(decryptedStr);
    } catch (e) {
      return { raw: decryptedStr };
    }
  }

  return data;
}

function parseVidnestResponse(data: any): NormalizedResponse | null {
  if (!data || !data.streams) return null;

  const candidates: StreamCandidate[] = [];

  if (Array.isArray(data.streams)) {
    data.streams.forEach((s: any) => {
      if (s.url) {
        candidates.push({ url: s.url, quality: s.quality || 'auto', format: s.url.includes('.m3u8') ? 'HLS' : 'MP4' });
      }
    });
  } else if (typeof data.streams === 'string') {
    candidates.push({ url: data.streams, quality: 'auto', format: data.streams.includes('.m3u8') ? 'HLS' : 'MP4' });
  }

  if (data.hls && typeof data.hls === 'string') {
    candidates.push({ url: data.hls, quality: 'auto', format: 'HLS' });
  }

  const bestStream = selectBestStream(candidates);
  if (!bestStream) return null;

  return {
    provider: 'vidnest',
    fallback: false,
    quality: bestStream.quality || 'auto',
    stream: bestStream.url,
    subtitles: [],
    raw: data,
  };
}

export const vidnestProvider: Provider = {
  async fetchMovie(tmdbId: string): Promise<NormalizedResponse | null> {
    try {
      const url = `${BASE_URL}/moviebox/movie/${tmdbId}`;
      const data = await fetchVidnest(url);
      return parseVidnestResponse(data);
    } catch (err) {
      console.debug('Vidnest movie fetch failed', err);
      return null;
    }
  },

  async fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
    try {
      const url = `${BASE_URL}/moviebox/tv/${tmdbId}/${season}/${episode}`;
      const data = await fetchVidnest(url);
      return parseVidnestResponse(data);
    } catch (err) {
      console.debug('Vidnest tv fetch failed', err);
      return null;
    }
  }
};
