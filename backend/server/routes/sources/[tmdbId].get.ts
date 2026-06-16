import { defineEventHandler, getRouterParam, getQuery, getRequestURL } from 'h3';
import { makeProviders, makeStandardFetcher, targets } from '@p-stream/providers';

/**
 * Wraps a raw CDN stream URL through our backend /proxy/ endpoint.
 *
 * Why this matters:
 *  1. Auth tokens are IP-locked — the scraper (running on Vercel) got the token
 *     for Vercel's IP. Any other IP (user's phone, desktop) will get 403.
 *  2. got-scraping impersonates Chrome's TLS fingerprint, bypassing WAF checks.
 *  3. CORS is handled server-side, so any client (browser, mobile, desktop) works.
 */
function wrapProxy(rawUrl: string, headers: Record<string, string>, baseUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const origin = parsed.origin;          // e.g. https://vod2.ironwallnet.com:6069
    const pathname = parsed.pathname;      // e.g. /wiwii/.../playlist.m3u8

    const params = new URLSearchParams();
    params.set('host', origin);

    // Forward auth/token query params from the raw CDN URL
    for (const [k, v] of parsed.searchParams.entries()) {
      params.set(k, v);
    }

    // Embed headers so the proxy can spoof Referer/Origin/User-Agent upstream
    if (headers && Object.keys(headers).length > 0) {
      params.set('headers', JSON.stringify(headers));
    }

    return `${baseUrl}/proxy${pathname}?${params.toString()}`;
  } catch {
    return rawUrl; // Fallback: return as-is if URL parsing fails
  }
}

/**
 * GET /sources/:tmdbId
 * Scrapes stream sources using @p-stream/providers and returns them
 * wrapped through this backend's /proxy/ endpoint.
 */
export default defineEventHandler(async (event) => {
  const tmdbId = getRouterParam(event, 'tmdbId');
  const type = (getQuery(event).type as string) || 'movie';
  const season = getQuery(event).season as string | undefined;
  const episode = getQuery(event).episode as string | undefined;

  if (!tmdbId) {
    return { error: 'Missing tmdbId', sources: [], subtitles: [] };
  }

  // Determine this backend's base URL for building proxy URLs.
  // BACKEND_BASE_URL env var takes priority (set this in Vercel dashboard).
  const reqUrl = getRequestURL(event);
  const backendBase = (process.env.BACKEND_BASE_URL || `${reqUrl.protocol}//${reqUrl.host}`).replace(/\/+$/, '');

  try {
    const providers = makeProviders({
      fetcher: makeStandardFetcher(fetch),
      target: targets?.NATIVE || 'native',
    });

    const media: any = {
      tmdbId,
      type: type === 'tv' ? 'show' : 'movie',
    };

    if (type === 'tv' && season && episode) {
      media.season = { number: parseInt(season), tmdbId };
      media.episode = { number: parseInt(episode), tmdbId };
    }

    const timeoutMs = 8000;
    const result = await Promise.race([
      providers.runAll({ media }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Provider scraping timed out')), timeoutMs)
      ),
    ]) as any;

    const sources: any[] = [];
    const subtitles: any[] = [];

    if (result?.stream) {
      const stream = result.stream;
      const streamHeaders: Record<string, string> = stream.headers || {};

      if (stream.type === 'hls') {
        sources.push({
          url: wrapProxy(stream.playlist, streamHeaders, backendBase),
          type: 'hls',
          provider: result.sourceId || 'P-Stream',
          quality: 'Auto',
          headers: streamHeaders,
        });
      } else if (stream.type === 'file') {
        const qualities = stream.qualities || {};
        const qualityOrder = ['4k', '1080', '720', '480', '360'];

        for (const q of qualityOrder) {
          if (qualities[q]) {
            const qHeaders = qualities[q].headers || streamHeaders;
            sources.push({
              url: wrapProxy(qualities[q].url, qHeaders, backendBase),
              type: 'mp4',
              provider: `${result.sourceId || 'P-Stream'} (${q}p)`,
              quality: `${q}p`,
              headers: qHeaders,
            });
          }
        }

        if (sources.length === 0 && stream.url) {
          sources.push({
            url: wrapProxy(stream.url, streamHeaders, backendBase),
            type: 'mp4',
            provider: result.sourceId || 'P-Stream',
            quality: 'Auto',
            headers: streamHeaders,
          });
        }
      }

      // Captions are plain CDN URLs — no proxy needed
      if (Array.isArray(stream.captions)) {
        for (const caption of stream.captions) {
          subtitles.push({
            url: caption.url,
            language: caption.language || 'Unknown',
            type: caption.type || 'srt',
          });
        }
      }
    }

    const labelSuffix = type === 'tv' ? ` (S${season}E${episode})` : '';

    return {
      responseId: 'backend-sources-v1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      sources: sources.map((s, i) => ({
        ...s,
        provider: s.provider + (i === 0 ? '' : ` #${i + 1}`) + labelSuffix,
      })),
      subtitles,
    };
  } catch (error: any) {
    console.error('Error fetching sources:', error?.message || error);
    return {
      error: 'Failed to fetch sources',
      message: error?.message || 'Unknown error',
      sources: [],
      subtitles: [],
    };
  }
});
