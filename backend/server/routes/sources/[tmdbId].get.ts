import { defineEventHandler, getRouterParam, getQuery } from 'h3';

/**
 * GET /sources/:tmdbId
 * Fetch video sources using @p-stream/providers scraping library
 */

// Dynamic import for @p-stream/providers (ESM-only package)
let providersModule: any = null;
async function getProvidersModule() {
  if (!providersModule) {
    try {
      providersModule = await import('@p-stream/providers');
    } catch (e) {
      console.error('Failed to import @p-stream/providers:', e);
      providersModule = null;
    }
  }
  return providersModule;
}

export default defineEventHandler(async (event) => {
  const tmdbId = getRouterParam(event, 'tmdbId');
  const type = (getQuery(event).type as string) || 'movie';
  const season = getQuery(event).season as string | undefined;
  const episode = getQuery(event).episode as string | undefined;

  if (!tmdbId) {
    return {
      error: 'Missing tmdbId',
      sources: [],
      subtitles: []
    };
  }

  try {
    const mod = await getProvidersModule();

    if (!mod || !mod.makeProviders || !mod.makeStandardFetcher) {
      console.warn('P-Stream providers module not available, returning empty sources');
      return {
        responseId: 'backend-sources-v1',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sources: [],
        subtitles: [],
        error: 'Provider library not available'
      };
    }

    const { makeProviders, makeStandardFetcher, targets } = mod;

    // Create provider instance with server-side fetch
    const providers = makeProviders({
      fetcher: makeStandardFetcher(fetch),
      target: targets?.NATIVE || 'native',
    });

    // Build media input
    const media: any = {
      tmdbId: tmdbId,
      type: type === 'tv' ? 'show' : 'movie',
    };

    if (type === 'tv' && season && episode) {
      media.season = {
        number: parseInt(season),
        tmdbId: tmdbId,
      };
      media.episode = {
        number: parseInt(episode),
        tmdbId: tmdbId,
      };
    }

    // Run all providers with a timeout
    const timeoutMs = 30000;
    const scrapePromise = providers.runAll({ media });

    const result = await Promise.race([
      scrapePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Provider scraping timed out')), timeoutMs)
      ),
    ]) as any;

    // Transform output to our API format
    const sources: any[] = [];
    const subtitles: any[] = [];

    if (result && result.stream) {
      const stream = result.stream;

      if (stream.type === 'hls') {
        sources.push({
          url: stream.playlist,
          type: 'hls',
          provider: result.sourceId || 'P-Stream',
          quality: 'Auto',
          headers: stream.headers || {},
        });
      } else if (stream.type === 'file') {
        // File-based streams have quality tiers
        const qualities = stream.qualities || {};
        const qualityOrder = ['4k', '1080', '720', '480', '360'];

        for (const q of qualityOrder) {
          if (qualities[q]) {
            sources.push({
              url: qualities[q].url,
              type: 'mp4',
              provider: `${result.sourceId || 'P-Stream'} (${q}p)`,
              quality: `${q}p`,
              headers: qualities[q].headers || {},
            });
          }
        }

        // If no named qualities, check for a direct URL
        if (sources.length === 0 && stream.url) {
          sources.push({
            url: stream.url,
            type: 'mp4',
            provider: result.sourceId || 'P-Stream',
            quality: 'Auto',
            headers: stream.headers || {},
          });
        }
      }

      // Extract captions/subtitles
      if (stream.captions && Array.isArray(stream.captions)) {
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
      subtitles: []
    };
  }
});
