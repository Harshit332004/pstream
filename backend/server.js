import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';
import { scrapeVidlink } from './scrapers/vidlink.js';
import { scrapeVidsrc } from './scrapers/vidsrc.js';
import { scrapeVidsrccc } from './scrapers/vidsrccc.js';
import { scrapeVideasy } from './scrapers/videasy.js';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// ─── Stream Cache ───────────────────────────────────────────────────────────
const streamCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 30, // 30 mins
});

// ─── Watch History Persistence ──────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || '/data';
const HISTORY_FILE = path.join(DATA_DIR, 'watch-history.json');

// Debounced write to avoid excessive disk I/O
let historyWriteTimer = null;
let historyCache = null; // in-memory cache of the full JSON

function ensureDataDir() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    } catch (e) {
        console.warn(`[History] Cannot create data dir ${DATA_DIR}: ${e.message}`);
    }
}

function loadHistory() {
    if (historyCache !== null) return historyCache;
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            historyCache = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } else {
            historyCache = {};
        }
    } catch (e) {
        console.error('[History] Failed to read history file:', e.message);
        historyCache = {};
    }
    return historyCache;
}

function saveHistory() {
    if (historyWriteTimer) clearTimeout(historyWriteTimer);
    historyWriteTimer = setTimeout(() => {
        try {
            ensureDataDir();
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyCache, null, 2), 'utf8');
        } catch (e) {
            console.error('[History] Failed to write history file:', e.message);
        }
    }, 500); // debounce 500ms
}

// ─── Stream Route ───────────────────────────────────────────────────────────
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
    
    const withTimeout = (promise, ms) => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Scraper timed out')), ms);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    };

    console.log(`-> Fetching from VidLink, VidSrc, Vidsrc.cc, and Videasy...`);
    const results = await Promise.allSettled([
        withTimeout(scrapeVidlink(id, type, season, episode), 15000),
        withTimeout(scrapeVidsrc(id, type, season, episode), 20000),
        withTimeout(scrapeVidsrccc(id, type, season, episode), 20000),
        withTimeout(scrapeVideasy(id, type, season, episode), 20000)
    ]);

    const streams = [];
    const subtitles = [];

    // Process VidLink (first priority)
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
        console.error(`-> VidLink FAILED: ${results[0].reason?.message || (results[0].value && results[0].value.error) || 'Unknown'}`);
    }

    // Process VidSrc (second priority)
    if (results[1].status === 'fulfilled' && results[1].value.success) {
        const vidsrcStreams = results[1].value.streams || [];
        for (const s of vidsrcStreams) {
            let streamUrl = s.url;
            if (streamUrl && streamUrl.startsWith('http://') && !streamUrl.includes('localhost')) {
                streamUrl = streamUrl.replace('http://', 'https://');
            }
            streams.push({ 
                provider: s.provider || 'VidSrc', 
                url: streamUrl, 
                type: s.type || 'mp4',
                quality: s.quality || 'Auto'
            });
        }
        if (results[1].value.subtitles) subtitles.push(...results[1].value.subtitles);
    } else {
        console.error(`-> VidSrc FAILED: ${results[1].reason?.message || (results[1].value && results[1].value.error) || 'Unknown'}`);
    }

    // Process Vidsrc.cc Decryptor (third priority)
    if (results[2].status === 'fulfilled' && results[2].value.success) {
        const vidsrcccStreams = results[2].value.streams || [];
        for (const s of vidsrcccStreams) {
            let streamUrl = s.url;
            if (streamUrl && streamUrl.startsWith('http://') && !streamUrl.includes('localhost')) {
                streamUrl = streamUrl.replace('http://', 'https://');
            }
            streams.push({ 
                provider: s.provider || 'Vidsrc.cc (Decryptor)', 
                url: streamUrl, 
                type: s.type || 'mp4',
                quality: s.quality || 'Auto'
            });
        }
        if (results[2].value.subtitles) subtitles.push(...results[2].value.subtitles);
    } else {
        console.error(`-> Vidsrc.cc FAILED: ${results[2].reason?.message || (results[2].value && results[2].value.error) || 'Unknown'}`);
    }

    // Process Videasy Decryptor (fourth priority)
    if (results[3].status === 'fulfilled' && results[3].value.success) {
        const videasyStreams = results[3].value.streams || [];
        for (const s of videasyStreams) {
            let streamUrl = s.url;
            if (streamUrl && streamUrl.startsWith('http://') && !streamUrl.includes('localhost')) {
                streamUrl = streamUrl.replace('http://', 'https://');
            }
            streams.push({ 
                provider: s.provider || 'Videasy (Decryptor)', 
                url: streamUrl, 
                type: s.type || 'mp4',
                quality: s.quality || 'Auto'
            });
        }
        if (results[3].value.subtitles) subtitles.push(...results[3].value.subtitles);
    } else {
        console.error(`-> Videasy FAILED: ${results[3].reason?.message || (results[3].value && results[3].value.error) || 'Unknown'}`);
    }

    if (streams.length > 0) {
        const result = { success: true, streams, subtitles };
        streamCache.set(cacheKey, result);
        return res.json(result);
    }

    return res.status(500).json({ success: false, error: 'Failed to resolve stream' });
});

// ─── Watch History Routes ───────────────────────────────────────────────────

app.get('/users/:userId/watch-history', (req, res) => {
    const { userId } = req.params;
    const history = loadHistory();
    const userHistory = history[userId] || [];
    return res.json(userHistory);
});

app.put('/users/:userId/watch-history/:tmdbId', (req, res) => {
    const { userId, tmdbId } = req.params;
    const body = req.body;

    const history = loadHistory();
    if (!history[userId]) history[userId] = [];

    const seasonNum = body.seasonNumber || body.season?.number || 0;
    const episodeNum = body.episodeNumber || body.episode?.number || 0;
    const entryKey = `${tmdbId}_${seasonNum}_${episodeNum}`;

    const existingIdx = history[userId].findIndex(e => {
        const eSeason = e.seasonNumber || e.season?.number || 0;
        const eEpisode = e.episodeNumber || e.episode?.number || 0;
        return e.tmdbId === String(tmdbId) && eSeason === seasonNum && eEpisode === episodeNum;
    });

    const entry = {
        tmdbId: String(tmdbId),
        duration: Number(body.duration || 0),
        watched: Number(body.watched || 0),
        watchedAt: body.watchedAt || new Date().toISOString(),
        completed: body.completed || false,
        seasonNumber: seasonNum || undefined,
        episodeNumber: episodeNum || undefined,
        meta: body.meta || {},
        _key: entryKey
    };

    if (existingIdx >= 0) {
        const existing = history[userId][existingIdx];
        if (entry.watched >= (existing.watched || 0)) {
            history[userId][existingIdx] = { ...existing, ...entry };
        }
    } else {
        history[userId].unshift(entry);
    }

    if (history[userId].length > 200) {
        history[userId] = history[userId].slice(0, 200);
    }

    historyCache = history;
    saveHistory();

    return res.json({ success: true, entry });
});

app.delete('/users/:userId/watch-history/:tmdbId', (req, res) => {
    const { userId, tmdbId } = req.params;
    const season = req.query.season ? parseInt(req.query.season) : 0;
    const episode = req.query.episode ? parseInt(req.query.episode) : 0;

    const history = loadHistory();
    if (history[userId]) {
        history[userId] = history[userId].filter(e => {
            const eSeason = e.seasonNumber || e.season?.number || 0;
            const eEpisode = e.episodeNumber || e.episode?.number || 0;
            const isMatch = e.tmdbId === String(tmdbId) && eSeason === season && eEpisode === episode;
            return !isMatch;
        });
        historyCache = history;
        saveHistory();
    }

    return res.json({ success: true });
});

app.delete('/users/:userId/watch-history', (req, res) => {
    const { userId } = req.params;
    const history = loadHistory();
    history[userId] = [];
    historyCache = history;
    saveHistory();
    return res.json({ success: true });
});

// ─── Health & Root ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        scrapers: ['vidlink', 'vidsrc', 'vidsrccc', 'videasy'],
        timestamp: Date.now()
    });
});

app.get('/', (req, res) => {
    res.send('P-Stream HF Backend is Running (VidLink, VidSrc, Vidsrc.cc, Videasy)');
});

app.listen(PORT, () => {
    ensureDataDir();
    loadHistory();
    console.log(`Server listening on port ${PORT}`);
});
