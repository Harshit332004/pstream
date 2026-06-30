import axios from 'axios';

const TMDB_API_KEY = '797f74f09af514f1d6f9ecdbf70e8597';

function resolveNuxtData(data, index) {
    if (typeof index !== 'number' || index < 0 || index >= data.length) {
        return index;
    }
    const val = data[index];
    if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
            return val.map(i => resolveNuxtData(data, i));
        } else {
            const resolved = {};
            for (const [k, v] of Object.entries(val)) {
                resolved[k] = resolveNuxtData(data, v);
            }
            return resolved;
        }
    }
    return val;
}

export async function scrapeMoviebox(tmdbId, type, season, episode) {
    try {
        console.log('[MovieBox] Step 1: Querying TMDB for ID:', tmdbId);
        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await axios.get(tmdbUrl, { timeout: 8000 });
        const tmdbData = tmdbRes.data;

        const title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
        const releaseDate = tmdbData.release_date || tmdbData.first_air_date || '';
        const releaseYear = releaseDate.split('-')[0];

        if (!title) {
            throw new Error(`Failed to retrieve title for TMDB ID: ${tmdbId}`);
        }

        console.log('[MovieBox] Step 2: Searching title:', title);
        const searchUrl = 'https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search';
        const searchPayload = {
            keyword: title,
            perPage: 30,
            page: 1
        };
        const searchRes = await axios.post(searchUrl, searchPayload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'X-Client-Info': '{"timezone":"Asia/Dhaka"}',
                'X-Client-Type': 'h5',
                'X-App-Version': '1.0.0'
            },
            timeout: 10000
        });

        const items = searchRes.data?.data?.items || [];
        if (items.length === 0) {
            throw new Error(`No search results on MovieBox for title: ${title}`);
        }

        // 3. Find closest match
        let bestMatch = null;
        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const item of items) {
            if (!item.detailPath) continue;
            const itemTitle = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            // Check if title matches
            if (itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle)) {
                bestMatch = item;
                break;
            }
        }

        if (!bestMatch) {
            bestMatch = items[0]; // fallback to first result
        }

        const detailPath = bestMatch.detailPath;

        console.log('[MovieBox] Step 3: Loading detail page for slug:', detailPath);
        const detailUrl = `https://moviebox.ph/detail/${detailPath}`;
        const detailRes = await axios.get(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });

        const html = detailRes.data;
        const nuxtMatch = html.match(/<script\s+type="application\/json"\s+data-nuxt-data="nuxt-app"\s+data-ssr="true"\s+id="__NUXT_DATA__"\s*>\s*([\s\S]*?)\s*<\/script>/);
        
        let subjectId = null;
        if (nuxtMatch) {
            const data = JSON.parse(nuxtMatch[1]);
            for (let i = 0; i < data.length; i++) {
                const v = data[i];
                if (v && typeof v === 'object' && !Array.isArray(v) && 'subjectId' in v && 'title' in v) {
                    const resolved = resolveNuxtData(data, i);
                    subjectId = resolved.subjectId;
                    break;
                }
            }
        }

        if (!subjectId) {
            throw new Error(`Could not extract subjectId from Nuxt data for: ${detailPath}`);
        }

        console.log('[MovieBox] Step 4: Got subjectId:', subjectId, '. Resolving domain...');
        let domain = 'https://123movienow.cc';
        try {
            const domainRes = await axios.get('https://h5-api.aoneroom.com/wefeed-h5api-bff/media-player/get-domain', {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'X-Client-Info': '{"timezone":"Asia/Dhaka"}',
                    'X-Client-Type': 'h5',
                    'X-App-Version': '1.0.0'
                },
                timeout: 5000
            });
            if (domainRes.data?.data) {
                domain = domainRes.data.data;
                if (domain.endsWith('/')) {
                    domain = domain.slice(0, -1);
                }
            }
        } catch (e) {
            console.warn(`[MovieBox] Failed to retrieve domain, using fallback: ${domain}`);
        }

        console.log('[MovieBox] Step 5: Resolving streams using domain:', domain);
        const se = type === 'tv' ? (season || 1) : 0;
        const ep = type === 'tv' ? (episode || 1) : 0;

        const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`;
        
        const playRes = await axios.get(playUrl, {
            headers: {
                'accept': 'application/json',
                'accept-language': 'en-US,en;q=0.9',
                'referer': `${domain}/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'x-client-info': '{"timezone":"Asia/Dhaka"}',
                'x-source': '',
                'cookie': 'uuid=d8c3539e-2e46-4000-af20-7046a856e30a'
            },
            timeout: 15000
        });

        const streamsData = playRes.data?.data?.streams || [];
        if (streamsData.length === 0) {
            throw new Error(`No streams found in MovieBox play response for: ${detailPath}`);
        }

        const streams = streamsData.map(s => ({
            provider: 'MovieBox',
            url: s.url,
            type: s.format === 'm3u8' ? 'hls' : 'mp4',
            quality: s.resolutions ? `${s.resolutions}p` : 'Auto'
        }));

        return {
            success: true,
            streams,
            subtitles: [] // MovieBox typically embeds subs directly or doesn't expose clean SRTs
        };

    } catch (err) {
        console.error(`[MovieBox Scraper] Error: ${err.message}`);
        return {
            success: false,
            error: err.message
        };
    }
}
