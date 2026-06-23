import { defineEventHandler, getRouterParam, getQuery } from 'h3';
import { makeProviders, makeStandardFetcher, targets } from '@p-stream/providers';

/**
 * GET /sources/:tmdbId
 *
 * Scrapes stream sources using @p-stream/providers.
 * NOTE: @p-stream/providers already returns URLs pre-proxied through this
 * backend's /proxy/ endpoint — DO NOT wrap them again.
 */


// Helper to unwrap third-party proxy URLs and wrap them in our own relative proxy endpoint
function wrapProxy(urlStr: string, defaultHeaders: Record<string, string>): { url: string; headers: Record<string, string> } {
  if (!urlStr) return { url: urlStr, headers: defaultHeaders };

  try {
    let targetUrl = urlStr;
    let targetHeaders = { ...defaultHeaders };

    // 1. Unwrap base64 payload format: https://proxy.example.com?payload=BASE64_PAYLOAD
    if (urlStr.includes('proxy.example.com') && urlStr.includes('payload=')) {
      const parsedUrl = new URL(urlStr);
      const payloadBase64 = parsedUrl.searchParams.get('payload');
      if (payloadBase64) {
        try {
          const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
          const payload = JSON.parse(jsonStr);
          if (payload && payload.url) {
            targetUrl = payload.url;
            if (payload.headers) {
              targetHeaders = { ...targetHeaders, ...payload.headers };
            }
          }
        } catch (e) {
          console.error('[sources] Failed to unwrap base64 payload proxy URL:', e);
        }
      }
    }

    // 2. Unwrap query param format: https://proxy.example.com/m3u8-proxy?url=ENCODED_URL&headers=ENCODED_HEADERS
    if (targetUrl.includes('proxy.example.com') && (targetUrl.includes('/m3u8-proxy') || targetUrl.includes('?url='))) {
      try {
        const parsedUrl = new URL(targetUrl);
        const encodedUrl = parsedUrl.searchParams.get('url');
        if (encodedUrl) {
          targetUrl = decodeURIComponent(encodedUrl);
          const encodedHeaders = parsedUrl.searchParams.get('headers');
          if (encodedHeaders) {
            try {
              let decodedHeaders = decodeURIComponent(encodedHeaders);
              if (decodedHeaders.includes('%22') || decodedHeaders.includes('%7B')) {
                decodedHeaders = decodeURIComponent(decodedHeaders);
              }
              const parsedHeaders = JSON.parse(decodedHeaders);
              targetHeaders = { ...targetHeaders, ...parsedHeaders };
            } catch (e) {
              console.error('[sources] Failed to parse nested proxy headers:', e);
            }
          }
        }
      } catch (e) {
        console.error('[sources] Failed to unwrap query param proxy URL:', e);
      }
    }

    // 3. Construct our own local proxy URL
    const parsedTarget = new URL(targetUrl);
    // Avoid double /proxy/ prefix — some CDN URLs (e.g., storm.vodvidl.site/proxy/wiwii/...)
    // already have /proxy/ in the pathname
    const targetPath = parsedTarget.pathname.startsWith('/proxy/')
      ? parsedTarget.pathname
      : `/proxy${parsedTarget.pathname}`;
    const localProxyUrl = new URL(targetPath, 'http://localhost:3000');
    localProxyUrl.searchParams.set('host', parsedTarget.origin);
    if (Object.keys(targetHeaders).length > 0) {
      // Use base64-encoded proxyHeaders (matches what the proxy route expects)
      localProxyUrl.searchParams.set('proxyHeaders', Buffer.from(JSON.stringify(targetHeaders)).toString('base64'));
    }
    for (const [key, value] of parsedTarget.searchParams.entries()) {
      localProxyUrl.searchParams.set(key, value);
    }
    
    return {
      url: localProxyUrl.pathname + localProxyUrl.search,
      headers: targetHeaders
    };
  } catch (err) {
    console.error('[sources] Error in wrapProxy:', err);
    return { url: urlStr, headers: defaultHeaders };
  }
}


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
        const wrapped = wrapProxy(stream.playlist, stream.headers || {});
        sources.push({
          url: wrapped.url,
          type: 'hls',
          provider: result.sourceId || 'P-Stream',
          quality: 'Auto',
          headers: wrapped.headers,
        });
      } else if (stream.type === 'file') {
        const qualities = stream.qualities || {};
        const qualityOrder = ['4k', '1080', '720', '480', '360'];

        for (const q of qualityOrder) {
          if (qualities[q]) {
            const wrapped = wrapProxy(qualities[q].url, qualities[q].headers || {});
            sources.push({
              url: wrapped.url,
              type: 'mp4',
              provider: `${result.sourceId || 'P-Stream'} (${q}p)`,
              quality: `${q}p`,
              headers: wrapped.headers,
            });
          }
        }

        if (sources.length === 0 && stream.url) {
          const wrapped = wrapProxy(stream.url, stream.headers || {});
          sources.push({
            url: wrapped.url,
            type: 'mp4',
            provider: result.sourceId || 'P-Stream',
            quality: 'Auto',
            headers: wrapped.headers,
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
