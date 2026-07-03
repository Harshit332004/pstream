import { fetchJsonWithRetry, fetchWithRetry } from '../utils/http';
import { cache } from '../utils/cache';
import { config } from '../config';
import { StreamCandidate, selectBestStream } from '../utils/quality';
import { filterEnglishSubtitles } from '../utils/subs';
import { NormalizedResponse, Provider } from './index';

const API_BASE = config.movieboxApiBase;

async function getGuestToken(): Promise<string | null> {
  const cacheKey = 'moviebox:guestToken';
  let token = cache.get(cacheKey) as string | undefined;

  if (token) return token;

  try {
    const response = await fetchWithRetry(`${API_BASE}/home?host=moviebox.ph`);
    const xUserHeader = response.headers['x-user'];
    
    if (xUserHeader && typeof xUserHeader === 'string') {
      const xUser = JSON.parse(xUserHeader);
      if (xUser && xUser.token) {
        token = xUser.token;
        cache.set(cacheKey, token, { ttl: 1000 * 60 * 60 * 24 }); // Cache for 24h as these usually last a while
        return token as string;
      }
    }
  } catch (err) {
    console.debug('Failed to fetch moviebox guest token:', err);
  }

  return null;
}

async function getDomain(): Promise<string> {
  const cacheKey = 'moviebox:domain';
  let domain = cache.get(cacheKey) as string | undefined;
  if (domain) return domain;

  try {
    const data = await fetchJsonWithRetry<{ domain?: string }>(`${API_BASE}/media-player/get-domain`);
    domain = data.domain || 'https://netfilm.world';
    cache.set(cacheKey, domain, { ttl: 1000 * 60 * 60 * 24 });
  } catch (err) {
    console.debug('Failed to fetch moviebox domain:', err);
    domain = 'https://netfilm.world';
  }

  return domain;
}

function parseMovieboxResponse(data: any): NormalizedResponse | null {
  if (!data || (!data.streams && !data.hls && !data.dash)) return null;

  const candidates: StreamCandidate[] = [];

  if (data.streams && Array.isArray(data.streams)) {
    data.streams.forEach((s: any) => {
      if (s.url) candidates.push({ url: s.url, quality: s.format || '1080p', format: 'MP4' });
    });
  }

  if (data.hls && typeof data.hls === 'string') {
    candidates.push({ url: data.hls, quality: 'auto', format: 'HLS' });
  }

  const bestStream = selectBestStream(candidates);
  if (!bestStream) return null;

  return {
    provider: 'moviebox',
    fallback: false,
    quality: bestStream.quality || 'auto',
    stream: bestStream.url,
    subtitles: [], // Fetched separately later if needed, Python script logic says we'd need another call.
    raw: data,
  };
}

export const movieboxProvider: Provider = {
  async fetchMovie(tmdbId: string): Promise<NormalizedResponse | null> {
    const token = await getGuestToken();
    const domain = await getDomain();
    const detailPath = tmdbId; // Moviebox often uses tmdb as subject_id

    const referer = `${domain}/spa/videoPlayPage/movies/${detailPath}?id=${tmdbId}&type=/movie/detail&detailSe=&detailEp=&lang=en`;
    const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${tmdbId}&se=&ep=&detailPath=${detailPath}`;

    const headers: Record<string, string> = {
      'Referer': referer,
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const data = await fetchJsonWithRetry(playUrl, { headers });
      return parseMovieboxResponse(data);
    } catch (e) {
      console.debug('Moviebox fetch failed', e);
      return null;
    }
  },

  async fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
    const token = await getGuestToken();
    const domain = await getDomain();
    const detailPath = tmdbId; // Simplification

    const referer = `${domain}/spa/videoPlayPage/movies/${detailPath}?id=${tmdbId}&type=/movie/detail&detailSe=${season}&detailEp=${episode}&lang=en`;
    const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${tmdbId}&se=${season}&ep=${episode}&detailPath=${detailPath}`;

    const headers: Record<string, string> = {
      'Referer': referer,
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const data = await fetchJsonWithRetry(playUrl, { headers });
      return parseMovieboxResponse(data);
    } catch (e) {
      console.debug('Moviebox fetch failed', e);
      return null;
    }
  }
};
