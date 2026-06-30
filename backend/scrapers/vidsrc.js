import crypto from 'crypto';

const BASE_URL = 'https://vidsrc.cc';

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
};

function generateVrf(movieId, userId) {
    const secret = `Cns#nGelOlX_${userId}`;
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(movieId, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function cleanMatch(match) {
    if (!match) return null;
    return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function extractStreamToken(html) {
    const xyWsMatch = html.match(/window\._xy_ws\s*=\s*"([^"]+)"/);
    if (xyWsMatch) {
        const rawToken = xyWsMatch[1];
        return rawToken.endsWith('X') ? rawToken.slice(0, -1) : rawToken;
    }

    const isThMatch = html.match(/<!--\s*_is_th:([^\s<]+)\s*-->/);
    if (isThMatch) return isThMatch[1];

    const metaMatch = html.match(/<meta\s+name="_gg_fb"\s+content="([^"]+)"/);
    if (metaMatch) return metaMatch[1];

    return null;
}

export async function scrapeVidsrc(id, type, season, episode) {
    try {
        let embedUrl = '';
        if (type === 'anime') {
            embedUrl = `${BASE_URL}/v2/embed/anime/${id}/${episode || 1}/sub?autoPlay=false`;
        } else if (type === 'tv') {
            embedUrl = `${BASE_URL}/v2/embed/tv/${id}/${season || 1}/${episode || 1}`;
        } else {
            embedUrl = `${BASE_URL}/v2/embed/movie/${id}`;
        }

        const res = await fetch(embedUrl, {
            headers: {
                ...browserHeaders,
                'Referer': 'https://vidsrc.cc/'
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch embed page: status ${res.status}`);
        }

        const html = await res.text();
        const vMatch = html.match(/var\s+v\s*=\s*"([^"]+)"/) || html.match(/var\s+v\s*=\s*([^;]+)/);
        const userMatch = html.match(/var\s+userId\s*=\s*"([^"]+)"/) || html.match(/var\s+userId\s*=\s*([^;]+)/);
        const movieMatch = html.match(/var\s+(?:movieId|malId|anilistId)\s*=\s*"([^"]+)"/) || html.match(/var\s+(?:movieId|malId|anilistId)\s*=\s*([^;]+)/);
        const imdbMatch = html.match(/var\s+imdbId\s*=\s*"([^"]+)"/) || html.match(/var\s+imdbId\s*=\s*([^;]+)/);

        const v = cleanMatch(vMatch);
        const userId = cleanMatch(userMatch);
        const movieId = cleanMatch(movieMatch);
        const imdbId = cleanMatch(imdbMatch) || '';

        if (!v || !userId || !movieId) {
            throw new Error(`Failed to extract variables: v=${v}, userId=${userId}, movieId=${movieId}`);
        }

        const vrf = generateVrf(movieId, userId);

        const queryParams = new URLSearchParams({
            id: movieId,
            type: type === 'anime' ? 'anime' : (type === 'tv' ? 'tv' : 'movie'),
            v: v,
            vrf: vrf,
            imdbId: imdbId
        });

        if (type === 'anime') {
            queryParams.set('episode', episode || 1);
        } else if (type === 'tv') {
            queryParams.set('season', season || 1);
            queryParams.set('episode', episode || 1);
        }

        let serverUrl = `${BASE_URL}/api/${movieId}/servers?${queryParams.toString()}`;
        let serverRes = await fetch(serverUrl, {
            headers: {
                ...browserHeaders,
                'Referer': embedUrl
            }
        });

        if (serverRes.status === 404) {
            serverUrl = `${BASE_URL}/api/episodes/${movieId}/servers?${queryParams.toString()}`;
            serverRes = await fetch(serverUrl, {
                headers: {
                    ...browserHeaders,
                    'Referer': embedUrl
                }
            });
        }

        if (!serverRes.ok) {
            throw new Error(`Server lookup failed: status ${serverRes.status}`);
        }

        const servers = await serverRes.json();
        if (!servers || !servers.success || !servers.data || servers.data.length === 0) {
            throw new Error('Server API returned failure or empty data');
        }

        const hash = servers.data[0].hash;
        if (!hash) {
            throw new Error('Failed to extract hash from server data');
        }

        const sourceRes = await fetch(`${BASE_URL}/api/source/${hash}`, {
            headers: {
                ...browserHeaders,
                'Referer': embedUrl
            }
        });

        if (!sourceRes.ok) {
            throw new Error(`Source lookup failed: status ${sourceRes.status}`);
        }

        const sourceData = await sourceRes.json();
        if (!sourceData || !sourceData.success || !sourceData.data || !sourceData.data.source) {
            throw new Error('Source API returned failure or empty source');
        }

        let iframeUrl = decodeURIComponent(sourceData.data.source);
        if (iframeUrl.startsWith('//')) {
            iframeUrl = 'https:' + iframeUrl;
        } else if (iframeUrl.startsWith('/')) {
            iframeUrl = BASE_URL + iframeUrl;
        }

        const luckyRes = await fetch(iframeUrl, {
            headers: {
                ...browserHeaders,
                'Referer': BASE_URL + '/'
            }
        });

        if (!luckyRes.ok) {
            throw new Error(`Lucky iframe fetch failed: status ${luckyRes.status}`);
        }

        const luckyHtml = await luckyRes.text();
        const nextUrlMatch = luckyHtml.match(/var\s+source\s*=\s*"([^"]+)"/);
        if (!nextUrlMatch) {
            throw new Error(`Failed to find source variable on page: ${iframeUrl}`);
        }

        let nextUrl = nextUrlMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        if (nextUrl.startsWith('//')) {
            nextUrl = 'https:' + nextUrl;
        } else if (nextUrl.startsWith('/')) {
            nextUrl = new URL(iframeUrl).origin + nextUrl;
        }

        const embedRes = await fetch(nextUrl, {
            headers: {
                ...browserHeaders,
                'Referer': iframeUrl
            }
        });

        if (!embedRes.ok) {
            throw new Error(`Embed frame fetch failed: status ${embedRes.status}`);
        }

        const embedHtml = await embedRes.text();
        const fileIdMatch = nextUrl.match(/\/e-1\/([^\?]+)/);
        if (!fileIdMatch) {
            throw new Error(`Failed to extract file_id from: ${nextUrl}`);
        }
        const fileId = fileIdMatch[1];

        const baseParts = nextUrl.split('/embed-')[0];
        const embedIdMatch = nextUrl.match(/\/(embed-\d+)\//);
        if (!embedIdMatch) {
            throw new Error(`Failed to extract embed_id from: ${nextUrl}`);
        }
        const embedId = embedIdMatch[1];

        let sourcesUrl = '';
        if (nextUrl.includes('rapid-cloud')) {
            sourcesUrl = `${baseParts}/${embedId}/v2/e-1/getSources?id=${fileId}`;
        } else {
            let kToken = extractStreamToken(embedHtml);
            if (!kToken) {
                // HTTP token fallback: fetch page again
                const retryRes = await fetch(nextUrl, {
                    headers: {
                        ...browserHeaders,
                        'Referer': iframeUrl,
                        'Sec-Fetch-Dest': 'iframe',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'cross-site'
                    }
                });
                if (retryRes.ok) {
                    const retryHtml = await retryRes.text();
                    kToken = extractStreamToken(retryHtml);
                }
            }

            if (!kToken) {
                throw new Error(`Failed to find _k token on: ${nextUrl}`);
            }

            sourcesUrl = `${baseParts}/${embedId}/v3/e-1/getSources?id=${fileId}&_k=${kToken}`;
        }

        const finalRes = await fetch(sourcesUrl, {
            headers: {
                ...browserHeaders,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': nextUrl
            }
        });

        if (!finalRes.ok) {
            throw new Error(`getSources request failed: status ${finalRes.status}`);
        }

        const result = await finalRes.json();
        if (!result || !result.sources || result.sources.length === 0) {
            throw new Error('getSources API returned no streams');
        }

        const streams = result.sources.map(src => ({
            provider: 'VidSrc.cc',
            url: src.file,
            type: src.type === 'hls' ? 'hls' : 'mp4',
            quality: 'Auto'
        }));

        const subtitles = [];
        if (result.tracks && Array.isArray(result.tracks)) {
            result.tracks.forEach(track => {
                if (track.kind === 'captions' && track.file) {
                    subtitles.push({
                        language: track.label || 'English',
                        url: track.file
                    });
                }
            });
        }

        return {
            success: true,
            streams,
            subtitles
        };

    } catch (err) {
        console.error(`[VidSrc.cc Scraper] Error: ${err.message}`);
        return {
            success: false,
            error: err.message,
            stack: err.stack
        };
    }
}
