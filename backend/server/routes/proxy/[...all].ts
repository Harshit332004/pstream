import { defineEventHandler, getRouterParam, getQuery, setResponseHeaders, setResponseHeader, sendStream, getHeader, createError } from 'h3';
import { gotScraping } from 'got-scraping';

export default defineEventHandler(async (event) => {
  // 1. Global CORS - NEVER fail a preflight
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Range, Accept, Referer, User-Agent',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return '';
  }

  // 2. Parse upstream URL
  const query = getQuery(event);
  const host = query.host as string;
  if (!host) throw createError({ statusCode: 400, message: 'Missing host query parameter' });

  const allPath = getRouterParam(event, 'all') || '';
  let targetUrl: URL;
  try {
    targetUrl = new URL(allPath, host);
  } catch (err) {
    throw createError({ statusCode: 400, message: 'Invalid target host' });
  }

  // Preserve auth/tokens in the URL
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'host' && key !== 'headers' && value !== undefined) {
      targetUrl.searchParams.set(key, String(value));
    }
  }

  // 3. Header Sanitization
  const queryHeadersStr = query.headers as string | undefined;
  const upstreamHeaders: Record<string, string> = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
  };

  if (queryHeadersStr) {
    try {
      let decoded = decodeURIComponent(queryHeadersStr);
      if (decoded.includes('%22') || decoded.includes('%7B')) decoded = decodeURIComponent(decoded);

      const parsed = JSON.parse(decoded);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          const lowerKey = k.toLowerCase();
          if (lowerKey === 'user-agent') upstreamHeaders['user-agent'] = v;
          else if (lowerKey === 'referer') upstreamHeaders['referer'] = v;
          else if (lowerKey === 'origin') upstreamHeaders['origin'] = v;
          else upstreamHeaders[k] = v;
        }
      }
    } catch (e) {
      // ignore parse errors silently to prevent crashes
    }
  }

  // Range header is critical for video scrubbing
  const rangeHeader = getHeader(event, 'range');
  if (rangeHeader) upstreamHeaders['range'] = rangeHeader;

  const method = (event.node.req.method || 'GET') as any;
  const isM3u8 = targetUrl.pathname.endsWith('.m3u8') || targetUrl.pathname.includes('m3u8');

  try {
    // ==========================================
    // PATH A: PLAYLIST INTERCEPTION (TEXT)
    // ==========================================
    if (isM3u8) {
      // Use gotScraping to bypass Cloudflare TLS fingerprinting
      const response = await gotScraping({
        url: targetUrl.toString(),
        method: method,
        headers: upstreamHeaders,
        responseType: 'text',
        throwHttpErrors: false // We will handle errors manually
      });

      if (response.statusCode >= 400) {
        event.node.res.statusCode = response.statusCode;
        return response.body;
      }

      // Rewrite chunk URLs inside the M3U8 so they route back through our proxy
      const lines = response.body.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            const chunkUrl = new URL(trimmed, targetUrl.toString());
            const proxyParams = new URLSearchParams();
            proxyParams.set('host', chunkUrl.origin);
            if (queryHeadersStr) proxyParams.set('headers', queryHeadersStr);
            for (const [key, val] of chunkUrl.searchParams.entries()) {
              proxyParams.set(key, val);
            }
            return `/proxy${chunkUrl.pathname}?${proxyParams.toString()}`;
          } catch (e) {
            return line;
          }
        }
        return line;
      });

      const rewrittenM3u8 = rewrittenLines.join('\n');

      // Pass back safe headers
      const headersToForward = ['content-type', 'cache-control', 'expires'];
      for (const h of headersToForward) {
        if (response.headers[h]) setResponseHeader(event, h, response.headers[h] as string);
      }
      setResponseHeader(event, 'content-length', Buffer.byteLength(rewrittenM3u8));

      return rewrittenM3u8;
    }

    // ==========================================
    // PATH B: VIDEO CHUNK PIPING (BINARY STREAM)
    // ==========================================
    else {
      return new Promise((resolve, reject) => {
        // Create a read stream that spoofs a real browser
        const stream = gotScraping.stream({
          url: targetUrl.toString(),
          method: method,
          headers: upstreamHeaders,
        });

        stream.on('response', (response) => {
          const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
          for (const h of headersToForward) {
            if (response.headers[h]) setResponseHeader(event, h, response.headers[h] as string);
          }
          event.node.res.statusCode = response.statusCode || 200;

          // Pipe the secure stream directly to the client
          resolve(sendStream(event, stream));
        });

        stream.on('error', (error: any) => {
          console.error("Chunk stream error:", error.message);
          reject(createError({ statusCode: 502, message: 'Chunk stream failed' }));
        });
      });
    }

  } catch (error: any) {
    console.error('GotScraping Fatal Error:', error.message);
    throw createError({
      statusCode: 502,
      message: 'Proxy failed to bypass upstream security',
    });
  }
});