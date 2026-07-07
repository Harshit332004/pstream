"""
Unified Streaming Scraper API
==============================
Endpoints match the frontend's Providers.js expectations exactly:

  GET /vidlink/movie/{tmdbId}              → raw vidlink response
  GET /vidlink/tv/{tmdbId}/{season}/{ep}   → raw vidlink response
  GET /api/stream?id=...&type=...&title=... → {success, streams, subtitles}
  GET /vidnest/sources?tmdbId=...&mediaType=... → {data: {url: [...]}}
  GET /videasy/sources?tmdbId=...&mediaType=... → {success, streams, subtitles}
  GET /api/sources?tmdb_id=...              → unified (all providers)
  GET /nepu/embed?path=...                  → nepu.to iframe proxy (CF bypass)
  ANY /nepu/proxy/{path}                    → nepu.to asset proxy
"""

import asyncio
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from urllib.parse import quote, urljoin

import httpcore
import httpx
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, HTMLResponse, JSONResponse

import config
import sync
from scrapers import moviebox, vidsrc, vidlink, vidnest, videasy

# ── ViperTLS import (optional — only needed for nepu.to proxy) ──
try:
    from viper_client import fetch, fetch_raw, close_client
    _VIPER_AVAILABLE = True
except ImportError:
    _VIPER_AVAILABLE = False
    logging.warning("viper_client not found — /nepu/* endpoints will be disabled. "
                    "Install with: pip install vipertls")

# ── Watch history in-memory store ─────────────────────────────
watch_history: Dict[str, Any] = {}


# ── App Lifespan ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if _VIPER_AVAILABLE:
        await close_client()


app = FastAPI(title="Unified Streaming Scraper API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync.router)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-12s  %(levelname)-5s  %(message)s",
)
logger = logging.getLogger("main")
if _VIPER_AVAILABLE:
    logger.info("ViperTLS integration loaded — nepu.to proxy uses browser TLS fingerprint spoofing")


# ═══════════════════════════════════════════════════════════
#  1. VIDLINK — raw proxy (frontend parses the response)
# ═══════════════════════════════════════════════════════════

@app.get("/vidlink/movie/{tmdb_id}")
async def vidlink_movie(tmdb_id: str):
    """Raw vidlink.pro response — frontend's parseVidlink() handles it."""
    try:
        data = await asyncio.to_thread(vidlink.fetch_movie_raw, tmdb_id)
        return data
    except Exception as e:
        logger.error("Vidlink movie error: %s", e)
        return {"error": str(e)}


@app.get("/vidlink/tv/{tmdb_id}/{season}/{episode}")
async def vidlink_tv(tmdb_id: str, season: int, episode: int):
    """Raw vidlink.pro response for TV."""
    try:
        data = await asyncio.to_thread(vidlink.fetch_tv_raw, tmdb_id, season, episode)
        return data
    except Exception as e:
        logger.error("Vidlink TV error: %s", e)
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════
#  STREAM PROXY — bypasses CDN hotlink protection (Referer checks)
# ═══════════════════════════════════════════════════════════

@app.get("/api/proxy")
async def proxy_stream(request: Request, url: str, referer: str = ""):
    """
    Proxy a stream URL with a spoofed Referer header.
    Used by MovieBox (and any provider whose CDN blocks direct browser access).
    Supports Range requests so video seeking works.
    """
    upstream_headers = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/148.0.0.0 Safari/537.36"),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if referer:
        upstream_headers["Referer"] = referer

    range_hdr = request.headers.get("range")
    if range_hdr:
        upstream_headers["Range"] = range_hdr

    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=httpx.Timeout(None, connect=15.0)
        ) as client:
            async with client.stream("GET", url, headers=upstream_headers) as resp:
                resp_headers = {
                    "Content-Type": resp.headers.get("content-type", "video/mp4"),
                    "Accept-Ranges": "bytes",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-store",
                }

                if resp.status_code == 206:
                    cr = resp.headers.get("content-range")
                    if cr:
                        resp_headers["Content-Range"] = cr
                        try:
                            range_part = cr.split(" ")[-1]
                            start_s, end_s = range_part.split("/")[0].split("-")
                            resp_headers["Content-Length"] = str(int(end_s) - int(start_s) + 1)
                        except (ValueError, IndexError):
                            pass
                elif resp.status_code == 200:
                    cl = resp.headers.get("content-length")
                    if cl:
                        resp_headers["Content-Length"] = cl

                if resp.status_code >= 400:
                    await resp.aread()
                    return Response(
                        content=f"Upstream CDN returned {resp.status_code}",
                        status_code=resp.status_code,
                        media_type="text/plain",
                    )

                async def stream_generator():
                    try:
                        async for chunk in resp.aiter_bytes(65536):
                            yield chunk
                    except (httpx.ReadError, httpcore.ReadError):
                        pass
                    finally:
                        try:
                            await resp.aclose()
                        except Exception:
                            pass

                return StreamingResponse(
                    stream_generator(),
                    status_code=resp.status_code,
                    headers=resp_headers,
                )
    except httpx.ConnectTimeout:
        return Response(content="Proxy connect timeout", status_code=504, media_type="text/plain")
    except Exception as e:
        logger.error("Proxy error for %s: %s", url[:80], e)
        return Response(content=f"Proxy error: {e}", status_code=502, media_type="text/plain")


# ═══════════════════════════════════════════════════════════
#  2. MOVIEBOX — frontend expects {success, streams, subtitles}
# ═══════════════════════════════════════════════════════════

@app.get("/api/stream")
async def moviebox_stream(
    request: Request,
    id: str = Query(..., description="TMDb ID"),
    type: str = Query("movie", description="movie or tv"),
    season: Optional[int] = Query(None),
    episode: Optional[int] = Query(None),
    title: Optional[str] = Query(None),
):
    try:
        result = await moviebox.get_sources(
            tmdb_id=id,
            media_type=type,
            season=season or 1,
            episode=episode or 1,
            title=title,
        )

        proxy_domain = result.pop("proxy_domain", "")
        proxy_ref = f"{proxy_domain}/" if proxy_domain else ""

        host = request.headers.get("host", "127.0.0.1:8000")
        scheme = request.headers.get("x-forwarded-proto", "http")
        proxy_base = f"{scheme}://{host}"

        streams = result.get("streams", [])
        h264_streams = [s for s in streams if "/h265/" not in s.get("url", "")]
        if h264_streams:
            result["streams"] = h264_streams

        for stream in result.get("streams", []):
            orig_url = stream.get("url", "")
            if orig_url:
                stream["url"] = (
                    f"{proxy_base}/api/proxy?url={quote(orig_url, safe='')}"
                    f"&referer={quote(proxy_ref, safe='')}"
                )

        for sub in result.get("subtitles", []):
            orig_url = sub.get("url", "")
            if orig_url:
                sub["url"] = (
                    f"{proxy_base}/api/proxy?url={quote(orig_url, safe='')}"
                    f"&referer={quote(proxy_ref, safe='')}"
                )

        return {
            "success": True,
            "streams": result.get("streams", []),
            "subtitles": result.get("subtitles", []),
        }
    except Exception as e:
        logger.error("MovieBox error: %s", e)
        return {"success": False, "streams": [], "subtitles": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════
#  3. VIDNEST — frontend expects {data: {url: [{link, resolution}]}}
# ═══════════════════════════════════════════════════════════

def _vidnest_to_frontend(data: dict) -> dict:
    url_list = []
    raw_sources = data.get("url") or data.get("sources") or data.get("streams") or []

    if not raw_sources and isinstance(data.get("data"), dict):
        raw_sources = (data["data"].get("url") or data["data"].get("sources") or
                       data["data"].get("streams") or [])
    if not raw_sources:
        raw_sources = data.get("results") or []

    if isinstance(raw_sources, dict):
        for quality, info in raw_sources.items():
            link = (info.get("url") or info.get("file") or
                    info.get("src") or info.get("link") or "")
            if isinstance(info, str) and ("m3u8" in info or "mp4" in info):
                link = info
            if link:
                url_list.append({"link": link, "resolution": quality})
        raw_sources = []

    if isinstance(raw_sources, list):
        for item in raw_sources:
            if not isinstance(item, dict):
                continue
            link = (item.get("url") or item.get("file") or
                    item.get("src") or item.get("link") or "")
            if not link:
                continue
            resolution = (item.get("quality") or item.get("label") or
                          item.get("resolution") or "Unknown")
            url_list.append({"link": link, "resolution": resolution})

    return {"data": {"url": url_list}}


@app.get("/vidnest/sources")
async def vidnest_sources(
    tmdbId: str = Query(...),
    mediaType: str = Query(...),
    seasonId: Optional[str] = Query("1"),
    episodeId: Optional[str] = Query("1"),
):
    try:
        raw = await asyncio.to_thread(
            vidnest.fetch_raw,
            tmdbId,
            mediaType,
            int(seasonId) if seasonId else 1,
            int(episodeId) if episodeId else 1,
        )
        return _vidnest_to_frontend(raw)
    except Exception as e:
        logger.error("Vidnest error: %s", e)
        return {"data": {"url": []}, "error": str(e)}


# ═══════════════════════════════════════════════════════════
#  4. VIDEASY — WASM-decrypted streams (Node.js subprocess)
# ═══════════════════════════════════════════════════════════

@app.get("/videasy/sources")
async def videasy_sources(
    tmdbId: str = Query(...),
    mediaType: str = Query(...),
    seasonId: Optional[str] = Query("1"),
    episodeId: Optional[str] = Query("1"),
    title: Optional[str] = Query(""),
):
    try:
        result = await asyncio.to_thread(
            videasy.get_sources,
            tmdbId,
            mediaType,
            int(seasonId) if seasonId else 1,
            int(episodeId) if episodeId else 1,
            title=title or None,
        )
        return {
            "success": True,
            "streams": result.get("streams", []),
            "subtitles": result.get("subtitles", []),
        }
    except Exception as e:
        logger.error("Videasy error: %s", e)
        return {"success": False, "streams": [], "subtitles": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════
#  5. UNIFIED — all providers in one call
# ═══════════════════════════════════════════════════════════

PROVIDER_NAMES = ["moviebox", "vidsrc", "vidlink", "vidnest", "videasy"]

async def _tmdb_title(tmdb_id: str, media_type: str) -> str | None:
    if not config.TMDB_API_KEY or config.TMDB_API_KEY.startswith("PASTE_"):
        return None
    try:
        endpoint = "tv" if media_type == "tv" else "movie"
        url = f"{config.TMDB_BASE_URL}/{endpoint}/{tmdb_id}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(url, params={"api_key": config.TMDB_API_KEY})
            resp.raise_for_status()
            data = resp.json()
            return data.get("title") or data.get("name")
    except Exception as e:
        logger.warning("TMDb title lookup failed: %s", e)
        return None


async def _tmdb_meta(tmdb_id: str, media_type: str) -> tuple[str, str]:
    if not config.TMDB_API_KEY or config.TMDB_API_KEY.startswith("PASTE_"):
        return "show", "2024"
    try:
        endpoint = "tv" if media_type == "tv" else "movie"
        url = f"{config.TMDB_BASE_URL}/{endpoint}/{tmdb_id}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(url, params={"api_key": config.TMDB_API_KEY})
            resp.raise_for_status()
            data = resp.json()
            title = data.get("title") or data.get("name") or "show"
            date_str = data.get("release_date") or data.get("first_air_date") or "2024"
            year = date_str.split("-")[0] if "-" in date_str else "2024"
            return title, year
    except Exception as e:
        logger.warning("TMDb meta lookup failed: %s", e)
        return "show", "2024"



async def _imdb_to_tmdb(imdb_id: str) -> str | None:
    if not config.TMDB_API_KEY or config.TMDB_API_KEY.startswith("PASTE_"):
        return None
    try:
        url = f"{config.TMDB_BASE_URL}/find/{imdb_id}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(url, params={
                "api_key": config.TMDB_API_KEY,
                "external_source": "imdb_id",
            })
            resp.raise_for_status()
            data = resp.json()
            for key in ("movie_results", "tv_results", "tv_episode_results"):
                for item in data.get(key, []):
                    if item.get("id"):
                        return str(item["id"])
    except Exception as e:
        logger.warning("IMDB→TMDb conversion failed: %s", e)
    return None


@app.get("/api/sources")
async def get_sources_unified(
    tmdb_id: Optional[str] = Query(None, description="TMDb ID (e.g. 533535)"),
    imdb_id: Optional[str] = Query(None, description="IMDB ID (e.g. tt0816692)"),
    type: str = Query("movie", description="movie or tv"),
    season: Optional[int] = Query(None),
    episode: Optional[int] = Query(None),
):
    if not tmdb_id and not imdb_id:
        return {"error": "Provide either tmdb_id or imdb_id"}

    if imdb_id and not tmdb_id:
        tmdb_id = await _imdb_to_tmdb(imdb_id)
        if not tmdb_id:
            return {"error": f"Could not resolve IMDB ID '{imdb_id}' to TMDb."}

    title = await _tmdb_title(tmdb_id, type)
    se = season or 1
    ep = episode or 1

    tasks = [
        moviebox.get_sources(tmdb_id, type, se, ep, title=title),
        asyncio.to_thread(vidsrc.get_sources, tmdb_id, type, se, ep),
        asyncio.to_thread(vidlink.get_sources, tmdb_id, type, se, ep),
        asyncio.to_thread(vidnest.get_sources, tmdb_id, type, se, ep),
        asyncio.to_thread(videasy.get_sources, tmdb_id, type, se, ep, title=title),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    providers = {}
    for name, result in zip(PROVIDER_NAMES, results):
        if isinstance(result, Exception):
            providers[name] = {"status": "error", "streams": [], "subtitles": [], "error": str(result)}
        elif isinstance(result, dict):
            providers[name] = {
                "status": "success" if result.get("streams") else "empty",
                "streams": result.get("streams", []),
                "subtitles": result.get("subtitles", []),
                "error": None,
            }
        else:
            providers[name] = {"status": "error", "streams": [], "subtitles": [], "error": "Unexpected return type"}

    return {
        "tmdb_id": tmdb_id,
        "imdb_id": imdb_id or None,
        "type": type,
        "title": title,
        "season": season,
        "episode": episode,
        "providers": providers,
    }


# ═══════════════════════════════════════════════════════════
#  6. NEPU IFRAME PROXY — ViperTLS-powered (bypasses Cloudflare)
#     Strips X-Frame-Options so you can embed nepu.to in an iframe.
# ═══════════════════════════════════════════════════════════

_STRIP_HEADERS = {
    "x-frame-options", "content-security-policy",
    "content-security-policy-report-only",
    "cross-origin-opener-policy", "cross-origin-embedder-policy",
    "cross-origin-resource-policy", "permissions-policy",
}


def _rewrite_html(html: str, proxy_base: str, nepu_base: str) -> str:
    """Rewrite nepu.to URLs in HTML to route through our proxy."""
    html = re.sub(
        rf'href=["\']({re.escape(nepu_base)})(/[^"\']*)["\']',
        lambda m: f'href="{proxy_base}/nepu/proxy{m.group(2)}"',
        html,
    )
    html = re.sub(
        rf'src=["\']({re.escape(nepu_base)})(/[^"\']*)["\']',
        lambda m: f'src="{proxy_base}/nepu/proxy{m.group(2)}"',
        html,
    )
    html = re.sub(
        rf'<link([^>]*?)href=["\']({re.escape(nepu_base)})(/[^"\']*)["\']',
        lambda m: f'<link{m.group(1)}href="{proxy_base}/nepu/proxy{m.group(3)}"',
        html,
    )
    html = re.sub(
        rf'url\(\s*["\']?({re.escape(nepu_base)})(/[^"\')\s]*)["\']?\s*\)',
        lambda m: f'url("{proxy_base}/nepu/proxy{m.group(2)}")',
        html,
    )
    return html


def _inject_watch_tracker(html: str, proxy_base: str, nepu_path: str) -> str:
    """Inject JS that monitors video playback and posts progress to parent window."""
    tracker_js = f"""
<script>
(function() {{
    const NEPU_PATH = {json.dumps(nepu_path)};
    const PROXY_BASE = {json.dumps(proxy_base)};
    let lastReported = 0;
    const REPORT_INTERVAL = 10;
    let videoEl = null;

    function findVideo() {{
        if (window.fluidPlayer && window.fluidPlayer.instances) {{
            const ids = Object.keys(window.fluidPlayer.instances);
            if (ids.length) {{
                const fp = window.fluidPlayer.instances[ids[0]];
                if (fp && fp.domRef && fp.domRef.video) return fp.domRef.video;
            }}
        }}
        return document.querySelector('video');
    }}

    function attachTracker() {{
        videoEl = findVideo();
        if (!videoEl) return false;

        videoEl.addEventListener('timeupdate', function() {{
            const cur = videoEl.currentTime || 0;
            const dur = videoEl.duration || 0;
            if (cur - lastReported >= REPORT_INTERVAL || cur >= dur - 2) {{
                lastReported = cur;
                window.parent.postMessage({{
                    type: 'watch-progress',
                    path: NEPU_PATH,
                    currentTime: Math.round(cur),
                    duration: Math.round(dur),
                    timestamp: Date.now()
                }}, '*');
            }}
        }});

        videoEl.addEventListener('ended', function() {{
            window.parent.postMessage({{
                type: 'watch-completed',
                path: NEPU_PATH,
                currentTime: Math.round(videoEl.duration || 0),
                duration: Math.round(videoEl.duration || 0),
                timestamp: Date.now()
            }}, '*');
        }});

        return true;
    }}

    if (!attachTracker()) {{
        let attempts = 0;
        const interval = setInterval(function() {{
            if (attachTracker() || ++attempts > 30) {{
                clearInterval(interval);
            }}
        }}, 1000);
    }}
}})();
</script>
"""
    if '</body>' in html:
        return html.replace('</body>', tracker_js + '</body>')
    return html + tracker_js


@app.get("/nepu/embed")
async def nepu_embed(
    request: Request,
    path: str = Query("", description="nepu.to path, e.g. /show/..."),
    tmdb_id: Optional[str] = Query(None),
    type: str = Query("movie"),
    season: Optional[int] = Query(None),
    episode: Optional[int] = Query(None),
):
    """
    Embed a nepu.to page in an iframe using ViperTLS (CF bypass).

    Usage in frontend:
      <iframe src="http://localhost:8000/nepu/embed?tmdb_id=550&type=movie" />
    """
    if not _VIPER_AVAILABLE:
        return HTMLResponse(
            content="<h3>ViperTLS not installed</h3><p>Run: pip install vipertls && playwright install chromium</p>",
            status_code=503,
        )

    if tmdb_id:
        title, year = await _tmdb_meta(tmdb_id, type)
        clean_title = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        path = f"/show/{clean_title}-{year}-{year}-{tmdb_id}"
        if type == "tv" and season and episode:
            path += f"/season/{season}/episode/{episode}"

    upstream_url = f"{config.NEPU_BASE_URL}/{path.lstrip('/')}"
    proxy_base = f"{'https' if request.headers.get('x-forwarded-proto') == 'https' else 'http'}://{request.headers.get('host', '127.0.0.1:8000')}"

    try:
        resp = await fetch(upstream_url, timeout=60)

        logger.info(
            "nepu embed %s → %d (solved_by=%s, from_cache=%s, len=%d)",
            path[:60], resp.status_code, resp.solved_by, resp.from_cache,
            len(resp.content),
        )

        _SKIP_HEADERS = _STRIP_HEADERS | {
            "content-length", "content-encoding", "transfer-encoding",
        }
        resp_headers = {}
        for k, v in resp.headers.items():
            if k.lower() not in _SKIP_HEADERS:
                resp_headers[k] = v

        resp_headers["Access-Control-Allow-Origin"] = "*"
        resp_headers["X-Frame-Options"] = "ALLOWALL"

        content_type = resp.headers.get("content-type", "text/html")

        if resp.status_code >= 400:
            return HTMLResponse(
                content=f"<h3>nepu.to returned {resp.status_code}</h3>"
                        f"<p>Path: {path}</p>"
                        f"<p>ViperTLS solved_by: {resp.solved_by}</p>",
                status_code=resp.status_code,
            )

        body = resp.text

        if "text/html" in content_type:
            body = _rewrite_html(body, proxy_base, config.NEPU_BASE_URL)
            body = _inject_watch_tracker(body, proxy_base, path)

        return Response(content=body.encode("utf-8"), status_code=resp.status_code, headers=resp_headers, media_type="text/html; charset=utf-8")

    except Exception as e:
        logger.error("Nepu proxy error: %s", e)
        return HTMLResponse(content=f"<h3>Proxy error: {e}</h3>", status_code=502)


@app.api_route("/nepu/proxy/{path:path}", methods=["GET", "POST", "HEAD", "OPTIONS"])
async def nepu_proxy_assets(request: Request, path: str):
    """Proxies individual nepu.to assets (JS, CSS, images, XHR) via ViperTLS."""
    if not _VIPER_AVAILABLE:
        return Response(content="ViperTLS not installed", status_code=503, media_type="text/plain")

    upstream_url = f"{config.NEPU_BASE_URL}/{path}"

    upstream_headers = {}
    for hdr in ("accept", "accept-language", "content-type", "referer", "origin"):
        val = request.headers.get(hdr)
        if val:
            upstream_headers[hdr] = val

    cookie = request.headers.get("cookie")
    if cookie:
        upstream_headers["cookie"] = cookie

    try:
        method = request.method
        body = await request.body() if method in ("POST", "PUT", "PATCH") else None

        resp = await fetch_raw(
            upstream_url,
            method=method,
            headers=upstream_headers if upstream_headers else None,
            body=body,
            timeout=30,
        )

        _ASSET_SKIP = _STRIP_HEADERS | {"content-length", "content-encoding", "transfer-encoding"}
        resp_headers = {}
        for k, v in resp.headers.items():
            if k.lower() not in _ASSET_SKIP:
                resp_headers[k] = v
        resp_headers["Access-Control-Allow-Origin"] = "*"
        resp_headers["Access-Control-Allow-Headers"] = "*"
        resp_headers["Access-Control-Allow-Methods"] = "*"

        content_type = resp.headers.get("content-type", "application/octet-stream")

        if resp.status_code >= 400 or method == "HEAD":
            return Response(
                content=resp.content if method == "HEAD" else b"",
                status_code=resp.status_code,
                media_type=content_type,
                headers=resp_headers,
            )

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=content_type,
            headers=resp_headers,
        )

    except Exception as e:
        logger.error("Nepu asset proxy error for %s: %s", path, e)
        return Response(content=f"Proxy error: {e}", status_code=502, media_type="text/plain")


# ═══════════════════════════════════════════════════════════
#  7. WATCH HISTORY
# ═══════════════════════════════════════════════════════════

@app.post("/api/watch-history")
async def save_watch_history(request: Request):
    """
    Receive watch progress from the injected iframe tracker.
    Expected body: { "path": "...", "currentTime": 120, "duration": 3600, "timestamp": ... }
    """
    try:
        data = await request.json()
        nepu_path = data.get("path", "")
        current_time = data.get("currentTime", 0)
        duration = data.get("duration", 0)
        timestamp = data.get("timestamp", int(time.time() * 1000))

        user_key = request.headers.get("x-user-id", request.client.host if request.client else "unknown")

        entry = {
            "path": nepu_path,
            "currentTime": current_time,
            "duration": duration,
            "timestamp": timestamp,
            "updated_at": time.time(),
        }

        if user_key not in watch_history:
            watch_history[user_key] = {}
        watch_history[user_key][nepu_path] = entry

        logger.info("Watch history saved: %s @ %ss/%ss (%s)",
                     nepu_path[:50], current_time, duration, user_key)

        return {"success": True, "saved": entry}
    except Exception as e:
        logger.error("Watch history save error: %s", e)
        return JSONResponse({"success": False, "error": str(e)}, status_code=400)


@app.get("/api/watch-history")
async def get_watch_history(request: Request):
    user_key = request.query_params.get("user_id") or \
               request.headers.get("x-user-id", "")
    if not user_key and request.client:
        user_key = request.client.host

    entries = watch_history.get(user_key, {})
    sorted_entries = sorted(
        entries.values(), key=lambda x: x.get("updated_at", 0), reverse=True
    )
    return {"success": True, "user": user_key, "history": sorted_entries}


@app.delete("/api/watch-history")
async def clear_watch_history(request: Request):
    user_key = request.query_params.get("user_id") or \
               request.headers.get("x-user-id", "")
    if not user_key and request.client:
        user_key = request.client.host

    if user_key in watch_history:
        del watch_history[user_key]
    return {"success": True, "cleared": user_key}


@app.get("/api/watch-history/stats")
async def watch_history_stats():
    total_users = len(watch_history)
    total_entries = sum(len(entries) for entries in watch_history.values())
    return {
        "success": True,
        "total_users": total_users,
        "total_entries": total_entries,
    }


# ═══════════════════════════════════════════════════════════
#  Health check
# ═══════════════════════════════════════════════════════════

@app.get("/")
def health():
    return {
        "status": "online",
        "docs": "/docs",
        "nepu_proxy": _VIPER_AVAILABLE,
    }


@app.get("/api/health")
def api_health():
    return {
        "status": "online",
        "cinepro": "online",
    }