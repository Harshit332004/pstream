import { defineEventHandler, getRouterParam, getQuery } from 'h3';
import { makeProviders, makeStandardFetcher, targets } from '@p-stream/providers';

/**
 * GET /sources/:tmdbId
 *
 * Scrapes stream sources using @p-stream/providers.
 * NOTE: @p-stream/providers already returns URLs pre-proxied through this
 * backend's /proxy/ endpoint — DO NOT wrap them again.
 */
export default defineEventHandler(async (event) => {
  const tmdbId = getRouterParam(event, 'tmdbId');
  const type = (getQuery(event).type as string) || 'movie';
  const season = getQuery(event).season as string | undefined;
  const episode = getQuery(event).episode as string | undefined;

  if (!tmdbId) {
    return { error: 'Missing tmdbId', sources: [], subtitles: [] };
  }

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
        // stream.playlist is ALREADY proxied through /proxy/ by @p-stream/providers
        sources.push({
          url: stream.playlist,
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
            sources.push({
              url: qualities[q].url,
              type: 'mp4',
              provider: `${result.sourceId || 'P-Stream'} (${q}p)`,
              quality: `${q}p`,
              headers: qualities[q].headers || streamHeaders,
            });
          }
        }

        if (sources.length === 0 && stream.url) {
          sources.push({
            url: stream.url,
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
