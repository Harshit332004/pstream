import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse

app = FastAPI(title="VidNest API")

_VIDNEST_ALPHA = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/="

BASE_URL = "https://new.vidnest.fun"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Origin": "https://vidnest.fun",
    "Referer": "https://vidnest.fun/",
}


def _decode_vidnest(data: str) -> str:
    alpha = _VIDNEST_ALPHA
    table = {ch: idx for idx, ch in enumerate(alpha)}
    result = []
    i = 0
    while i < len(data):
        chunk = data[i:i+4]
        while len(chunk) < 4:
            chunk += "="
        i += 4

        indices = [table.get(c, 64) for c in chunk]
        l0, l1, l2, l3 = indices

        result.append((l0 << 2) | (l1 >> 4))
        if l2 != 64:
            result.append(((l1 & 15) << 4) | (l2 >> 2))
        if l3 != 64:
            result.append(((l2 & 3) << 6) | l3)

    return bytes(result).decode("utf-8", errors="replace")


def _fetch(url: str) -> dict:
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(status_code=404, detail="Resource not found on VidNest (Invalid ID or missing content)")
        raise HTTPException(status_code=502, detail=f"VidNest Upstream Error: {exc.code}")
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"VidNest connection failed: {exc.reason}")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="VidNest returned non-JSON response")

    if payload.get("encrypted"):
        enc_data = payload.get("data", "")
        if not isinstance(enc_data, str):
            raise HTTPException(status_code=502, detail="Missing encrypted data field")
        decrypted_str = _decode_vidnest(enc_data)
        try:
            return json.loads(decrypted_str)
        except json.JSONDecodeError:
            return {"raw": decrypted_str}

    return payload


@app.get("/", response_class=HTMLResponse)
def root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VidNest.Engine | API Gateway</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-main: #0a0a0c;
                --bg-card: #121216;
                --text-bright: #e0e0e0;
                --text-dim: #8b8b99;
                --neon-cyan: #00f3ff;
                --neon-pink: #ff007f;
                --border-color: #24242d;
            }
            body { 
                font-family: 'Space Grotesk', sans-serif; 
                background-color: var(--bg-main); 
                color: var(--text-bright); 
                margin: 0; 
                padding: 0;
                line-height: 1.6;
                background-image: radial-gradient(circle at 15% 50%, rgba(0, 243, 255, 0.03), transparent 25%), 
                                  radial-gradient(circle at 85% 30%, rgba(255, 0, 127, 0.03), transparent 25%);
            }
            .navbar {
                padding: 1.5rem 3rem;
                display: flex;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                background: rgba(10, 10, 12, 0.8);
                backdrop-filter: blur(10px);
                position: sticky;
                top: 0;
                z-index: 100;
            }
            .brand {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--text-bright);
                text-transform: uppercase;
                letter-spacing: 2px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .brand::before {
                content: '';
                display: inline-block;
                width: 12px;
                height: 12px;
                background: var(--neon-cyan);
                box-shadow: 0 0 10px var(--neon-cyan);
                border-radius: 50%;
            }
            .hero-section {
                text-align: center;
                padding: 5rem 2rem;
            }
            .hero-title {
                font-size: 3.5rem;
                margin: 0 0 1rem 0;
                background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 0 30px rgba(0, 243, 255, 0.2);
            }
            .hero-subtitle {
                font-size: 1.2rem;
                color: var(--text-dim);
                max-width: 600px;
                margin: 0 auto;
            }
            .main-content {
                max-width: 1100px;
                margin: 0 auto;
                padding: 2rem;
            }
            .section-tag {
                display: inline-block;
                padding: 0.4rem 1rem;
                border: 1px solid var(--neon-pink);
                color: var(--neon-pink);
                border-radius: 4px;
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 2rem;
                box-shadow: inset 0 0 10px rgba(255, 0, 127, 0.1);
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 2rem;
                margin-bottom: 4rem;
            }
            .card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 2rem;
                transition: transform 0.2s, border-color 0.2s;
                position: relative;
                overflow: hidden;
            }
            .card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; width: 100%; height: 2px;
                background: var(--neon-cyan);
                opacity: 0;
                transition: opacity 0.3s;
            }
            .card:hover {
                border-color: rgba(0, 243, 255, 0.3);
                transform: translateY(-5px);
            }
            .card:hover::before { opacity: 1; }
            .card-title {
                font-size: 1.4rem;
                margin: 0 0 1rem 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .route-method {
                background: rgba(0, 243, 255, 0.1);
                color: var(--neon-cyan);
                padding: 4px 8px;
                border-radius: 4px;
                font-family: 'Fira Code', monospace;
                font-size: 0.8rem;
                border: 1px solid rgba(0, 243, 255, 0.2);
            }
            .code-block {
                background: #050506;
                border: 1px solid var(--border-color);
                padding: 1rem;
                border-radius: 6px;
                font-family: 'Fira Code', monospace;
                font-size: 0.85rem;
                color: #a9a9b3;
                overflow-x: auto;
                margin: 1.5rem 0;
            }
            .params-table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
            }
            .params-table th {
                text-align: left;
                padding: 0.5rem;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-dim);
                font-weight: 500;
                font-size: 0.9rem;
            }
            .params-table td {
                padding: 0.5rem;
                border-bottom: 1px solid rgba(36, 36, 45, 0.5);
                font-size: 0.95rem;
            }
            .params-table code {
                font-family: 'Fira Code', monospace;
                color: var(--neon-pink);
                font-size: 0.85em;
            }
            .test-btn {
                display: inline-block;
                padding: 0.8rem 1.5rem;
                background: transparent;
                color: var(--neon-cyan);
                border: 1px solid var(--neon-cyan);
                text-decoration: none;
                font-family: 'Fira Code', monospace;
                font-size: 0.9rem;
                border-radius: 4px;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .test-btn:hover {
                background: rgba(0, 243, 255, 0.1);
                box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
            }
            .btn-group {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                margin-top: 1rem;
            }
            .code-block::-webkit-scrollbar {
                height: 4px;
            }
            .code-block::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.2);
            }
            .code-block::-webkit-scrollbar-thumb {
                background: var(--neon-cyan);
                border-radius: 10px;
                box-shadow: 0 0 5px var(--neon-cyan);
            }
            .code-block.anime-code::-webkit-scrollbar-thumb {
                background: var(--neon-pink);
                box-shadow: 0 0 5px var(--neon-pink);
            }
        </style>
    </head>
    <body>
        <nav class="navbar">
            <div class="brand">VidNest.Engine</div>
        </nav>

        <header class="hero-section">
            <h1 class="hero-title">Decryption API Gateway</h1>
            <p class="hero-subtitle">High-performance Native Python engine for decoding custom VidNest payload ciphers. Optimized for speed and security.</p>
        </header>

        <main class="main-content">
            <div class="section-tag">Internal Mechanics</div>
            <div class="card" style="margin-bottom: 3rem; border-color: rgba(255, 0, 127, 0.2);">
                <h2 class="card-title" style="color: var(--neon-pink);">About the Engine</h2>
                <p style="color: var(--text-dim); margin-top: 0;">VidNest.Engine is a specialized decryption gateway built to bypass proprietary payload obfuscation. It utilizes a zero-dependency bit-stream decoder to translate custom byte-mapped ciphers into structured JSON data in real-time.</p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 1rem;">
                    <span class="route-method" style="background: rgba(255, 0, 127, 0.1); color: var(--neon-pink); border-color: rgba(255, 0, 127, 0.2);">#reverse-engineering</span>
                    <span class="route-method">#fastapi-core</span>
                    <span class="route-method" style="background: rgba(255, 0, 127, 0.1); color: var(--neon-pink); border-color: rgba(255, 0, 127, 0.2);">#native-decryption</span>
                </div>
            </div>

            <div class="section-tag">API Endpoints</div>
            
            <div class="grid">
                <div class="card">
                    <h2 class="card-title">
                        <span class="route-method">GET</span> /sources
                    </h2>
                    <p style="color: var(--text-dim); font-size: 0.95rem;">Extracts encrypted streams for Movies and TV Series.</p>
                    <table class="params-table">
                        <tr><th>Param</th><th>Format</th></tr>
                        <tr><td><code>tmdbId</code></td><td>1396</td></tr>
                        <tr><td><code>mediaType</code></td><td>movie | tv</td></tr>
                        <tr><td><code>seasonId</code></td><td>1 (tv only)</td></tr>
                        <tr><td><code>episodeId</code></td><td>1 (tv only)</td></tr>
                    </table>
                    <div class="code-block">/sources?tmdbId=95479&mediaType=tv&seasonId=1&episodeId=2</div>
                    <div class="btn-group">
                        <a href="/sources?tmdbId=95479&mediaType=tv&seasonId=1&episodeId=1" target="_blank" class="test-btn">S01 E01 &rarr;</a>
                        <a href="/sources?tmdbId=95479&mediaType=tv&seasonId=1&episodeId=2" target="_blank" class="test-btn" style="border-color: var(--neon-pink); color: var(--neon-pink);">S01 E02 &rarr;</a>
                    </div>
                </div>

                <div class="card">
                    <h2 class="card-title">
                        <span class="route-method">GET</span> /anime
                    </h2>
                    <p style="color: var(--text-dim); font-size: 0.95rem;">Resolves streams for Anime via multiple providers.</p>
                    <table class="params-table">
                        <tr><th>Param</th><th>Format</th></tr>
                        <tr><td><code>anilistId</code></td><td>154587</td></tr>
                        <tr><td><code>episode</code></td><td>1</td></tr>
                        <tr><td><code>type</code></td><td>sub | dub</td></tr>
                        <tr><td><code>provider</code></td><td>hianime | animepahe</td></tr>
                    </table>
                    <div class="code-block anime-code">/anime?anilistId=154587&episode=1&type=sub&provider=hianime</div>
                    <div class="btn-group">
                        <a href="/anime?anilistId=154587&episode=1&type=sub&provider=hianime" target="_blank" class="test-btn" style="border-color: var(--neon-pink); color: var(--neon-pink);">Hianime &rarr;</a>
                        <a href="/anime?anilistId=16498&episode=1&type=sub&provider=animepahe" target="_blank" class="test-btn" style="border-color: var(--neon-cyan); color: var(--neon-cyan);">AnimePahe &rarr;</a>
                    </div>
                </div>

                <div class="card">
                    <h2 class="card-title">
                        <span class="route-method">GET</span> /subtitles
                    </h2>
                    <p style="color: var(--text-dim); font-size: 0.95rem;">Fetches direct VTT subtitle tracks (CDN cache).</p>
                    <table class="params-table">
                        <tr><th>Param</th><th>Format</th></tr>
                        <tr><td><code>tmdbId</code></td><td>666243</td></tr>
                        <tr><td><code>mediaType</code></td><td>movie | tv</td></tr>
                        <tr><td><code>seasonId</code></td><td>1 (tv only)</td></tr>
                        <tr><td><code>episodeId</code></td><td>1 (tv only)</td></tr>
                    </table>
                    <div class="code-block">/subtitles?tmdbId=666243&mediaType=movie</div>
                    <div class="btn-group">
                        <a href="/subtitles?tmdbId=666243&mediaType=movie" target="_blank" class="test-btn">Run Query &rarr;</a>
                    </div>
                </div>
            </div>
        </main>
    </body>
    </html>
    """


@app.get("/sources")
def get_sources(
    tmdbId: str = Query(...),
    mediaType: str = Query(...),
    seasonId: str = Query(default="1"),
    episodeId: str = Query(default="1"),
) -> dict[str, Any]:
    if mediaType == "movie":
        url = f"{BASE_URL}/moviebox/movie/{tmdbId}"
    elif mediaType == "tv":
        url = f"{BASE_URL}/moviebox/tv/{tmdbId}/{seasonId}/{episodeId}"
    else:
        raise HTTPException(status_code=400, detail="mediaType must be 'movie' or 'tv'")

    data = _fetch(url)
    return {
        "provider": "vidnest",
        "mediaType": mediaType,
        "tmdbId": tmdbId,
        "source_url": url,
        "data": data,
    }


@app.get("/anime")
def get_anime(
    anilistId: str = Query(...),
    episode: str = Query(default="1"),
    type: str = Query(default="sub"),
    provider: str = Query(default="hianime"),
) -> dict:
    if type not in ("sub", "dub"):
        raise HTTPException(status_code=400, detail="type must be 'sub' or 'dub'")
    if provider not in ("hianime", "animepahe"):
        raise HTTPException(status_code=400, detail="provider must be 'hianime' or 'animepahe'")
    
    url = f"{BASE_URL}/{provider}/{anilistId}/{episode}/1/{type}"
    data = _fetch(url)
    return {
        "provider": "vidnest",
        "anime_provider": provider,
        "anilistId": anilistId,
        "episode": episode,
        "type": type,
        "source_url": url,
        "data": data,
    }


@app.get("/subtitles")
def get_subtitles(
    tmdbId: str = Query(...),
    mediaType: str = Query(...),
    seasonId: str = Query(default="1"),
    episodeId: str = Query(default="1"),
) -> dict[str, Any]:
    if mediaType == "movie":
        url = f"{BASE_URL}/subtitles/{tmdbId}"
    elif mediaType == "tv":
        url = f"{BASE_URL}/subtitles/{tmdbId}/{seasonId}/{episodeId}"
    else:
        raise HTTPException(status_code=400, detail="mediaType must be 'movie' or 'tv'")

    data = _fetch(url)
    return {
        "provider": "vidnest",
        "mediaType": mediaType,
        "tmdbId": tmdbId,
        "source_url": url,
        "data": data,
    }
