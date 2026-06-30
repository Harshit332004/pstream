import express from 'express';
import cors from 'cors';
import { LRUCache } from 'lru-cache';
import { scrapeVidlink } from './scrapers/vidlink.js';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());

// In-memory cache: 30 minutes TTL
const streamCache = new LRUCache({
    max: 500, // max 500 items
    ttl: 1000 * 60 * 30, // 30 mins
});

app.get('/api/stream', async (req, res) => {
    const { id, type, season, episode } = req.query;

    if (!id || !type) {
        return res.status(400).json({ success: false, error: 'Missing id or type' });
    }

    const cacheKey = `${type}-${id}-${season || 'x'}-${episode || 'x'}`;
    const cachedResult = streamCache.get(cacheKey);
    
    if (cachedResult) {
        console.log(`[CACHE HIT] Serving ${cacheKey}`);
        return res.json(cachedResult);
    }

    console.log(`[FETCHING] Resolving streams for ${cacheKey}`);
    
    let result = null;

    // Helper for timeout
    const withTimeout = (promise, ms) => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Scraper timed out')), ms);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    };

    console.log(`-> Fetching from VidLink...`);
    const results = await Promise.allSettled([
        withTimeout(scrapeVidlink(id, type, season, episode), 15000) // 15s limit for WASM startup
    ]);

    const streams = [];
    const subtitles = [];

    // Process VidLink
    if (results[0].status === 'fulfilled' && results[0].value.success) {
        const vidlinkStreams = results[0].value.streams || [];
        for (const s of vidlinkStreams) {
            let streamUrl = s.url;
            if (streamUrl && streamUrl.startsWith('http://') && !streamUrl.includes('localhost')) {
                streamUrl = streamUrl.replace('http://', 'https://');
            }
            streams.push({ 
                provider: s.provider || 'VidLink', 
                url: streamUrl, 
                type: s.type || 'mp4',
                quality: s.quality || 'Auto'
            });
        }
        if (results[0].value.subtitles) subtitles.push(...results[0].value.subtitles);
    } else {
        console.error(`-> VidLink FAILED: ${results[0].reason?.message || 'Unknown'}`);
    }

    if (streams.length > 0) {
        result = { success: true, streams, subtitles };
        streamCache.set(cacheKey, result);
        return res.json(result);
    }

    return res.status(500).json({ success: false, error: 'Failed to resolve stream' });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        scrapers: ['vidlink'],
        timestamp: Date.now()
    });
});

app.get('/', (req, res) => {
    res.send('P-Stream HF Backend is Running (VidLink Scraper Only)');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
