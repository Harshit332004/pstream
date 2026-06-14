import { defineEventHandler, getRouterParam, getQuery, setResponseHeaders, setResponseHeader, sendStream, getHeader, createError } from 'h3';
import { Readable } from 'node:stream';

export default defineEventHandler(async (event) => {
  // 1. Pre-flight & Global CORS Headers
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

  // 2. Parse upstream target URL and query parameters
  const query = getQuery(event);
  const host = query.host as string;
  if (!host) {
    throw createError({ statusCode: 400, message: 'Missing host query parameter' });
  }

  const allPath = getRouterParam(event, 'all') || '';

  let targetUrl: URL;
  try {
    targetUrl = new URL(allPath, host);
  } catch (err) {
    throw createError({ statusCode: 400, message: 'Invalid target host or path combination' });
  }

  for (const [key, value] of Object.entries(query)) {
    if (key !== 'host' && key !== 'headers' && value !== undefined) {
      targetUrl.searchParams.set(key, String(value));
    }
  }

  // 3. Aggressive Header Sanitization
  const queryHeadersStr = query.headers as string | undefined;
  const upstreamHeaders: Record<string, string> = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
  };

  if (queryHeadersStr) {
    try {
      let decoded = decodeURIComponent(queryHeadersStr);
      if (decoded.includes('%22') || decoded.includes('%7B')) {
        decoded = decodeURIComponent(decoded);
      }

      const parsed = JSON.parse(decoded);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          const lowerKey = k.toLowerCase();
          if (lowerKey === 'user-agent') upstreamHeaders['User-Agent'] = v;
          else if (lowerKey === 'referer') upstreamHeaders['Referer'] = v;
          else if (lowerKey === 'origin') upstreamHeaders['Origin'] = v;
          else upstreamHeaders[k] = v;
        }
      }
    } catch (e) {
      console.error('Proxy: Failed to parse query headers JSON:', e);
    }
  }

  if (!upstreamHeaders['User-Agent']) {
    upstreamHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  }

  const rangeHeader = getHeader(event, 'range');
  if (rangeHeader) {
    upstreamHeaders['range'] = rangeHeader;
  }

  const method = event.node.req.method || 'GET';

  // 4. Fetch the upstream stream target
  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers: upstreamHeaders,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      event.node.res.statusCode = response.status;
      if (response.statusText) event.node.res.statusMessage = response.statusText;
      return errorBody;
    }

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'expires',
    ];

    // ==========================================
    // NEW LOGIC: THE M3U8 INTERCEPTOR & REWRITER
    // ==========================================
    const contentType = response.headers.get('content-type') || '';
    const isM3u8 = contentType.includes('mpegurl') || contentType.includes('mpegURL') || targetUrl.pathname.endsWith('.m3u8');

    if (isM3u8) {
      const text = await response.text();
      const lines = text.split('\n');

      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        // If the line is not empty and doesn't start with '#', it is a media URI
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            // Resolve the chunk URI against the target URL
            const chunkUrl = new URL(trimmed, targetUrl.toString());

            // Construct the NEW proxy route for this chunk
            const proxyPath = `/proxy${chunkUrl.pathname}`;
            const proxyParams = new URLSearchParams();

            // 1. Force the target host to remain the same
            proxyParams.set('host', chunkUrl.origin);

            // 2. Persist our spoofed headers for the chunk
            if (queryHeadersStr) {
              proxyParams.set('headers', queryHeadersStr);
            }

            // 3. Keep any auth/tokens that were on the chunk URL itself
            for (const [key, val] of chunkUrl.searchParams.entries()) {
              proxyParams.set(key, val);
            }

            return `${proxyPath}?${proxyParams.toString()}`;
          } catch (e) {
            return line; // Fallback
          }
        }
        return line;
      });

      const rewrittenM3u8 = rewrittenLines.join('\n');

      // Set headers, but manually calculate the new Content-Length
      for (const h of headersToForward) {
        if (h === 'content-length') continue;
        const value = response.headers.get(h);
        if (value) setResponseHeader(event, h, value);
      }
      setResponseHeader(event, 'content-length', Buffer.byteLength(rewrittenM3u8));
      event.node.res.statusCode = response.status;
      return rewrittenM3u8;
    }

    // ==========================================
    // 5. Standard streaming for binary Video Chunks (.ts, .mp4)
    // ==========================================
    for (const h of headersToForward) {
      const value = response.headers.get(h);
      if (value) setResponseHeader(event, h, value);
    }

    event.node.res.statusCode = response.status;
    if (response.statusText) event.node.res.statusMessage = response.statusText;

    if (!response.body) return '';

    const nodeStream = Readable.fromWeb(response.body as any);
    return sendStream(event, nodeStream);

  } catch (error: any) {
    console.error('Proxy upstream fetch failed:', error);
    throw createError({
      statusCode: 502,
      message: error?.message || 'Upstream proxy request failed',
    });
  }
});