import { execFile } from 'child_process';
import path from 'path';
import { fetchJsonWithRetry, fetchWithRetry } from '../utils/http';
import { StreamCandidate, selectBestStream } from '../utils/quality';
import { NormalizedResponse, Provider } from './index';

const API_BASE = 'https://api.videasy.to';
const ORIGIN = 'https://www.vidking.net';
const REFERER = 'https://www.vidking.net/';

const PROVIDERS = [
  { name: 'Oxygen', endpoint: 'mb-flix', active: true },
  { name: 'Hydrogen', endpoint: 'cdn', active: true },
  { name: 'Lithium', endpoint: 'downloader2', active: true },
  { name: 'Helium', endpoint: '1movies', active: false },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Referer': REFERER,
  'Origin': ORIGIN,
};

async function fetchCipher(providerEndpoint: string, params: Record<string, string>): Promise<string | null> {
  const urlParams = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${providerEndpoint}/sources-with-title?${urlParams}`;
  try {
    const res = await fetchWithRetry(url, { headers: HEADERS });
    return (await res.body.text()).trim();
  } catch (err) {
    console.debug(`Videasy fetch failed for ${providerEndpoint}`, err);
    return null;
  }
}

async function nodeDecrypt(cipherHex: string, tmdbId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'videasy_wasm', 'decrypt.js');
    execFile(
      'node',
      [scriptPath, cipherHex, tmdbId],
      { cwd: path.join(__dirname, 'videasy_wasm'), timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Node exited with error: ${stderr || error.message}`));
        }
        try {
          const out = JSON.parse(stdout);
          if (!out.success) {
            return reject(new Error(out.error || 'Unknown decryption error'));
          }
          resolve(out.data);
        } catch (e) {
          reject(new Error(`Failed to parse decrypt.js output: ${stdout}`));
        }
      }
    );
  });
}

async function getSources(params: Record<string, string>): Promise<any | null> {
  const activeProviders = PROVIDERS.filter(p => p.active);

  for (const p of activeProviders) {
    const cipher = await fetchCipher(p.endpoint, params);
    if (!cipher) continue;

    try {
      const data = await nodeDecrypt(cipher, params.tmdbId);
      if (data && (data.stream || data.streams || data.hls || data.dash)) {
        return { provider: p.name, data };
      }
    } catch (err) {
      console.debug(`Videasy provider ${p.name} decrypt failed`, err);
    }
  }
  return null;
}

function parseVideasyResponse(result: any): NormalizedResponse | null {
  if (!result || !result.data) return null;
  const { data } = result;
  
  const candidates: StreamCandidate[] = [];

  if (Array.isArray(data.streams)) {
    data.streams.forEach((s: any) => {
      if (s.url) candidates.push({ url: s.url, quality: s.quality || s.format || '1080p', format: 'MP4' });
    });
  } else if (Array.isArray(data.stream)) {
    data.stream.forEach((s: any) => {
      if (s.url) candidates.push({ url: s.url, quality: s.quality || s.format || '1080p', format: 'MP4' });
    });
  }

  if (data.hls && typeof data.hls === 'string') {
    candidates.push({ url: data.hls, quality: 'auto', format: 'HLS' });
  }

  const bestStream = selectBestStream(candidates);
  if (!bestStream) return null;

  return {
    provider: 'videasy',
    fallback: false,
    quality: bestStream.quality || 'auto',
    stream: bestStream.url,
    subtitles: [],
    raw: data,
  };
}

export const videasyProvider: Provider = {
  async fetchMovie(tmdbId: string): Promise<NormalizedResponse | null> {
    try {
      const result = await getSources({ tmdbId, type: 'movie' });
      return parseVideasyResponse(result);
    } catch (err) {
      console.debug('Videasy movie fetch failed', err);
      return null;
    }
  },

  async fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
    try {
      const result = await getSources({ tmdbId, type: 'tv', season: season.toString(), episode: episode.toString() });
      return parseVideasyResponse(result);
    } catch (err) {
      console.debug('Videasy tv fetch failed', err);
      return null;
    }
  }
};
