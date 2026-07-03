import crypto from 'crypto';
import { fetchJsonWithRetry, fetchWithRetry } from '../utils/http';
import { StreamCandidate, selectBestStream } from '../utils/quality';
import { NormalizedResponse, Provider } from './index';

const VRF_PREFIX = 'Cns#nGelOl';
const BASE_URL = 'https://vidsrc.cc';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

function pkcs7Pad(data: Buffer, blockSize: number = 16): Buffer {
  const padLen = blockSize - (data.length % blockSize);
  const padding = Buffer.alloc(padLen, padLen);
  return Buffer.concat([data, padding]);
}

export function generateVrf(movieId: string, userId: string, prefix: string = VRF_PREFIX): string {
  const secret = `${prefix}X_${userId}`;
  const key = crypto.createHash('sha256').update(secret, 'utf8').digest();
  const plaintext = pkcs7Pad(Buffer.from(movieId, 'utf8'));
  const iv = Buffer.alloc(16, 0); // 16 zero bytes

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false); // We padded manually
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return ciphertext.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getStreamInfo(id: string, isTv = false, season?: number, episode?: number) {
  let url = `${BASE_URL}/v2/embed/movie/${id}`;
  if (isTv) {
    url = `${BASE_URL}/v2/embed/tv/${id}/${season}/${episode}`;
  }

  const res = await fetchWithRetry(url, { headers: { ...BROWSER_HEADERS, 'Referer': 'https://vidsrc.cc/' } });
  const html = await res.body.text();

  const getVar = (name: string, text: string) => {
    let match = new RegExp(`var ${name}\\s*=\\s*"([^"]+)"`).exec(text);
    if (match) return match[1];
    match = new RegExp(`var ${name}\\s*=\\s*([^;]+);`).exec(text);
    if (match) return match[1].replace(/['"]/g, '').trim();
    return null;
  };

  const v = getVar('v', html);
  const userId = getVar('userId', html);
  const movieId = getVar('movieId', html) || getVar('malId', html) || getVar('anilistId', html);
  const imdbId = getVar('imdbId', html) || '';

  if (!v || !userId || !movieId) {
    console.debug(`Vidsrc extraction failed for ${id}. v=${v}, userId=${userId}, movieId=${movieId}`);
    return null;
  }

  const vrf = generateVrf(movieId, userId);

  const params = new URLSearchParams({
    id: movieId,
    type: isTv ? 'tv' : 'movie',
    v,
    vrf,
    imdbId,
  });
  if (isTv && season !== undefined && episode !== undefined) {
    params.append('season', season.toString());
    params.append('episode', episode.toString());
  }

  const serverUrl = `${BASE_URL}/api/${movieId}/servers?${params.toString()}`;
  const serverRes = await fetchJsonWithRetry(serverUrl, { headers: { ...BROWSER_HEADERS, 'Referer': url } });

  if (!serverRes || !serverRes.data || !Array.isArray(serverRes.data) || serverRes.data.length === 0) {
    return null;
  }

  // Typically, we take the first server and get the source
  const serverHash = serverRes.data[0].hash;
  
  const sourceParams = new URLSearchParams({
    id: movieId,
    type: isTv ? 'tv' : 'movie',
    v,
    vrf,
  });
  if (isTv && season !== undefined && episode !== undefined) {
    sourceParams.append('season', season.toString());
    sourceParams.append('episode', episode.toString());
  }

  const sourceUrl = `${BASE_URL}/api/source/${serverHash}?${sourceParams.toString()}`;
  const sourceRes = await fetchJsonWithRetry(sourceUrl, { headers: { ...BROWSER_HEADERS, 'Referer': url } });

  return sourceRes;
}

function parseVidsrcResponse(data: any): NormalizedResponse | null {
  if (!data || !data.data || !data.data.sources) return null;

  const candidates: StreamCandidate[] = [];

  if (Array.isArray(data.data.sources)) {
    data.data.sources.forEach((s: any) => {
      if (s.file) candidates.push({ url: s.file, quality: s.label || '1080p', format: s.type === 'hls' ? 'HLS' : 'MP4' });
    });
  }

  const bestStream = selectBestStream(candidates);
  if (!bestStream) return null;

  return {
    provider: 'vidsrc',
    fallback: false,
    quality: bestStream.quality || 'auto',
    stream: bestStream.url,
    subtitles: [],
    raw: data,
  };
}

export const vidsrcProvider: Provider = {
  async fetchMovie(tmdbId: string): Promise<NormalizedResponse | null> {
    try {
      const data = await getStreamInfo(tmdbId, false);
      return parseVidsrcResponse(data);
    } catch (err) {
      console.debug('Vidsrc movie fetch failed', err);
      return null;
    }
  },

  async fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
    try {
      const data = await getStreamInfo(tmdbId, true, season, episode);
      return parseVidsrcResponse(data);
    } catch (err) {
      console.debug('Vidsrc tv fetch failed', err);
      return null;
    }
  }
};
