import { defineEventHandler, getRouterParam, getQuery, setResponseHeaders, setResponseHeader, sendStream, getHeader, createError } from 'h3';
import { Readable } from 'node:stream';

/**
 * GET /proxy/...
 * Catch-all route to proxy HLS (.m3u8) streams and video chunks (.ts, .mp4) through the backend.
 * Bypasses client-side CORS issues, strips leaking browser headers, and spoofs referrer/UA/origin.
 */
export default defineEventHandler(async (event) => {
  // 1. Pre-flight & Global CORS Headers (always applied first)
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Range, Accept, Referer, User-Agent',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  // Handle CORS OPTIONS preflight request immediately
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return '';
  }

  // 2. Parse upstream target URL and query parameters
  const query = getQuery(event);
  const host = query.host as string;
  if (!host) {
    throw createError({
      statusCode: 400,
      message: 'Missing host query parameter',
    });
  }

  const allPath = getRouterParam(event, 'all') || '';
  
  // Construct the target URL (preserving wildcard path and other query parameters like auth)
  let targetUrl: URL;
  try {
    targetUrl = new URL(allPath, host);
  } catch (err) {
    throw createError({
      statusCode: 400,
      message: 'Invalid target host or path combination',
    });
  }

  // Forward all query parameters except our custom routing parameters
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'host' && key !== 'headers' && value !== undefined) {
      targetUrl.searchParams.set(key, String(value));
    }
  }

  // 3. Aggressive Header Sanitization (prevent Cloudflare bot detection / leak of server proxy)
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
          if (lowerKey === 'user-agent') {
            upstreamHeaders['User-Agent'] = v;
          } else if (lowerKey === 'referer') {
            upstreamHeaders['Referer'] = v;
          } else if (lowerKey === 'origin') {
            upstreamHeaders['Origin'] = v;
          } else {
            upstreamHeaders[k] = v;
          }
        }
      }
    } catch (e) {
      console.error('Proxy: Failed to parse query headers JSON:', e);
    }
  }

  // Fallback User-Agent if none specified in the query parameters
  if (!upstreamHeaders['User-Agent']) {
    upstreamHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  }

  // Forward Range header from client if present (essential for seeking/partial content stream requests)
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

    // Handle non-OK upstream responses gracefully (while keeping CORS headers)
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      event.node.res.statusCode = response.status;
      if (response.statusText) {
        event.node.res.statusMessage = response.statusText;
      }
      return errorBody;
    }

    // 5. Copy safe response headers back to client
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'expires',
    ];

    for (const h of headersToForward) {
      const value = response.headers.get(h);
      if (value) {
        setResponseHeader(event, h, value);
      }
    }

    event.node.res.statusCode = response.status;
    if (response.statusText) {
      event.node.res.statusMessage = response.statusText;
    }

    if (!response.body) {
      return '';
    }

    // 6. Seamlessly stream response back using h3 sendStream
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
