import { defineEventHandler, getRouterParam, getQuery, setResponseHeaders, setResponseHeader, sendStream, getHeader, createError } from 'h3';
import { gotScraping } from 'got-scraping';
import { Readable } from 'stream';

export default defineEventHandler(async (event) => {
  // ─── 1. Bulletproof CORS ────────────────────────────────────────────
  // Wildcard Access-Control-Allow-Headers prevents Chrome/Safari CORS
  // preflight failures for any custom or standard headers.
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  });

  // Immediately terminate OPTIONS preflight with 204 No Content
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }

  // ─── 2. Parse upstream target URL ───────────────────────────────────
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

  // Forward query params to upstream (excluding internal proxy control params)
  const INTERNAL_PARAMS = new Set(['host', 'headers', 'proxyHeaders']);
  for (const [key, value] of Object.entries(query)) {
    if (!INTERNAL_PARAMS.has(key) && value !== undefined) {
      targetUrl.searchParams.set(key, String(value));
    }
  }

  // ─── 3. Header extraction ──────────────────────────────────────────
  // Supports both new Base64-encoded `proxyHeaders` and legacy raw JSON `headers`.
  // Scraping headers (User-Agent, Referer, Origin) are applied ONLY to the
  // backend-to-CDN upstream request, never on the client-facing response.
  const proxyHeadersB64 = query.proxyHeaders as string | undefined;
  const queryHeadersStr = query.headers as string | undefined;

  const upstreamHeaders: Record<string, string> = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
  };

  if (proxyHeadersB64) {
    // Preferred: Base64-encoded JSON headers (safe for URL transport)
    try {
      const decoded = Buffer.from(proxyHeadersB64, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          const lk = k.toLowerCase();
          if (lk === 'user-agent') upstreamHeaders['user-agent'] = v;
          else if (lk === 'referer') upstreamHeaders['referer'] = v;
          else if (lk === 'origin') upstreamHeaders['origin'] = v;
          else upstreamHeaders[k] = v;
        }
      }
    } catch (e) { /* ignore parse errors */ }
  } else if (queryHeadersStr) {
    // Legacy: raw JSON headers (possibly double-URL-encoded)
    try {
      let decoded = decodeURIComponent(queryHeadersStr);
      if (decoded.includes('%22') || decoded.includes('%7B')) decoded = decodeURIComponent(decoded);
      const parsed = JSON.parse(decoded);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          const lk = k.toLowerCase();
          if (lk === 'user-agent') upstreamHeaders['user-agent'] = v;
          else if (lk === 'referer') upstreamHeaders['referer'] = v;
          else if (lk === 'origin') upstreamHeaders['origin'] = v;
          else upstreamHeaders[k] = v;
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Forward Range header from client for video scrubbing / seek support
  const rangeHeader = getHeader(event, 'range');
  if (rangeHeader) upstreamHeaders['range'] = rangeHeader;

  // Compute a stable Base64 proxyHeaders value to embed in rewritten m3u8 URLs
  let rewriteHeadersParam = '';
  if (proxyHeadersB64) {
    rewriteHeadersParam = proxyHeadersB64;
  } else if (queryHeadersStr) {
    try {
      let decoded = decodeURIComponent(queryHeadersStr);
      if (decoded.includes('%22') || decoded.includes('%7B')) decoded = decodeURIComponent(decoded);
      JSON.parse(decoded); // validate
      rewriteHeadersParam = Buffer.from(decoded).toString('base64');
    } catch (e) {
      try { rewriteHeadersParam = Buffer.from(queryHeadersStr).toString('base64'); } catch (_) {}
    }
  }

  const method = (event.node.req.method || 'GET') as any;
  const pathname = targetUrl.pathname.toLowerCase();
  const isM3u8 = pathname.endsWith('.m3u8') || pathname.includes('m3u8');

  try {
    if (isM3u8) {
      // ═══════════════════════════════════════════════════════════════
      // PATH A: M3U8 PLAYLIST (TEXT)
      // Uses gotScraping for Cloudflare TLS fingerprint bypass.
      // CRITICAL FIX: Rewrites ALL URLs (segments, sub-playlists, keys,
      // init segments) to route back through this proxy. This eliminates
      // cross-origin CORS failures that broke Chrome/Safari/mobile.
      // ═══════════════════════════════════════════════════════════════
      const response = await gotScraping({
        url: targetUrl.toString(),
        method,
        headers: upstreamHeaders,
        responseType: 'text',
        throwHttpErrors: false,
      });

      if (response.statusCode >= 400) {
        event.node.res.statusCode = response.statusCode;
        return response.body;
      }

      // Helper: rewrite any URL to route through our proxy
      const rewriteUrl = (rawUrl: string): string => {
        const absUrl = new URL(rawUrl, targetUrl.toString());
        const params = new URLSearchParams();
        params.set('host', absUrl.origin);
        if (rewriteHeadersParam) params.set('proxyHeaders', rewriteHeadersParam);
        for (const [k, v] of absUrl.searchParams.entries()) params.set(k, v);
        return `/proxy${absUrl.pathname}?${params.toString()}`;
      };

      // Rewrite ALL URLs in the playlist (segments, sub-playlists, keys, etc.)
      const lines = response.body.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();

        // Rewrite URI="..." inside HLS directives (#EXT-X-KEY, #EXT-X-MAP, etc.)
        if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
            try {
              if (uri.startsWith('data:')) return _match; // Skip data: URIs
              return `URI="${rewriteUrl(uri)}"`;
            } catch (e) {
              return _match;
            }
          });
        }

        // Rewrite bare segment/playlist URLs on their own line
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            return rewriteUrl(trimmed);
          } catch (e) {
            return line;
          }
        }

        return line;
      });

      const rewrittenM3u8 = rewrittenLines.join('\n');

      // Set response headers
      const headersToForward = ['cache-control', 'expires'];
      for (const h of headersToForward) {
        if (response.headers[h]) setResponseHeader(event, h, response.headers[h] as string);
      }
      setResponseHeader(event, 'content-type', 'application/vnd.apple.mpegurl');
      setResponseHeader(event, 'content-length', Buffer.byteLength(rewrittenM3u8));

      return rewrittenM3u8;

    } else {
      // ═══════════════════════════════════════════════════════════════
      // PATH B: BINARY MEDIA CHUNKS (.ts, .mp4, encryption keys)
      // Uses native Node fetch for clean HTTP Range / 206 Partial Content
      // support required by Chrome, Safari, and mobile browsers.
      // Falls back to gotScraping if native fetch is blocked (TLS fingerprint).
      // ═══════════════════════════════════════════════════════════════
      let fetchResponse: Response;
      try {
        fetchResponse = await fetch(targetUrl.toString(), {
          method,
          headers: upstreamHeaders as any,
          redirect: 'follow',
        });

        // If CDN returns 403, it might be checking TLS fingerprints — fall through to gotScraping
        if (fetchResponse.status === 403) {
          throw new Error('403 Forbidden - possible TLS fingerprint block');
        }
      } catch (fetchErr: any) {
        // Fallback: use gotScraping which spoofs browser TLS fingerprints
        console.warn('[Proxy] Native fetch failed, falling back to gotScraping:', fetchErr.message);
        return new Promise((resolve, reject) => {
          const stream = gotScraping.stream({
            url: targetUrl.toString(),
            method,
            headers: upstreamHeaders,
          });
          stream.on('response', (gsResponse) => {
            const hf = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
            for (const h of hf) {
              if (gsResponse.headers[h]) setResponseHeader(event, h, gsResponse.headers[h] as string);
            }
            event.node.res.statusCode = gsResponse.statusCode || 200;
            resolve(sendStream(event, stream));
          });
          stream.on('error', (error: any) => {
            console.error('[Proxy] gotScraping fallback stream error:', error.message);
            reject(createError({ statusCode: 502, message: 'Chunk stream failed' }));
          });
        });
      }

      // Forward upstream HTTP status (200 OK or 206 Partial Content)
      event.node.res.statusCode = fetchResponse.status;

      // Forward critical streaming headers for proper browser media handling
      const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag'];
      for (const h of headersToForward) {
        const val = fetchResponse.headers.get(h);
        if (val) setResponseHeader(event, h, val);
      }

      if (!fetchResponse.body) {
        return '';
      }

      // Convert Web ReadableStream to Node Readable for h3's sendStream
      const reader = fetchResponse.body.getReader();
      const nodeStream = new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(Buffer.from(value));
            }
          } catch (err) {
            this.destroy(err as Error);
          }
        },
      });

      return sendStream(event, nodeStream);
    }

  } catch (error: any) {
    console.error('[Proxy] Fatal Error:', error.message);
    throw createError({
      statusCode: 502,
      message: 'Proxy failed to fetch upstream resource',
    });
  }
});