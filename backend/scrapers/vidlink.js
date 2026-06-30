import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sodium = require('libsodium-wrappers');
import axios from 'axios';

const KEY_HEX = "c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd";
const REFERER = 'https://vidlink.pro/';
const ORIGIN = 'https://vidlink.pro';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124';

function encryptTokenPureJS(mediaId, timestamp) {
    const key = sodium.from_hex(KEY_HEX);
    const nonce = new Uint8Array(24); // 24 zero bytes
    
    const mediaIdBytes = sodium.from_string(mediaId);
    const tsBuf = new Uint8Array(8);
    const view = new DataView(tsBuf.buffer);
    view.setBigUint64(0, BigInt(timestamp), false); // big-endian
    
    const message = new Uint8Array(mediaIdBytes.length + 8);
    message.set(mediaIdBytes, 0);
    message.set(tsBuf, mediaIdBytes.length);
    
    const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);
    
    const fullPayload = new Uint8Array(nonce.length + ciphertext.length);
    fullPayload.set(nonce, 0);
    fullPayload.set(ciphertext, nonce.length);
    
    return Buffer.from(fullPayload).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function scrapeVidlink(id, type, season, episode) {
    await sodium.ready;
    
    const timestamp = Math.floor(Date.now() / 1000) + 480;
    const token = encryptTokenPureJS(String(id), timestamp);
    if (!token) throw new Error('VidLink pure-js encryptToken returned null');

    const apiUrl = type === 'tv'
        ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode || 1}?multiLang=1`
        : `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;

    const res = await axios.get(apiUrl, {
        headers: { 
            Referer: REFERER, 
            Origin: ORIGIN, 
            'User-Agent': UA,
            'X-Forwarded-For': '172.56.21.89', // Spoof US residential IP
            'X-Real-IP': '172.56.21.89'
        }
    });

    if (res.status !== 200 || !res.data) {
        throw new Error(`VidLink API returned status: ${res.status}`);
    }

    const streamData = res.data.stream;
    if (!streamData) {
        console.error(`[VidLink Debug] Response payload: ${JSON.stringify(res.data)}`);
        throw new Error('No stream data in VidLink response');
    }

    const streams = [];

    // Parse HLS playlist if available
    if (streamData.playlist) {
        streams.push({
            provider: 'VidLink',
            url: streamData.playlist,
            type: 'hls',
            quality: 'Auto'
        });
    }

    // Parse direct MP4 qualities if available
    if (streamData.qualities) {
        Object.keys(streamData.qualities).forEach(qualityKey => {
            const q = streamData.qualities[qualityKey];
            if (q && q.url) {
                streams.push({
                    provider: `VidLink`,
                    url: q.url,
                    type: q.type || 'mp4',
                    quality: qualityKey.includes('p') ? qualityKey : `${qualityKey}p`
                });
            }
        });
    }

    if (streams.length === 0) {
        console.error(`[VidLink Debug] Response payload: ${JSON.stringify(res.data)}`);
        throw new Error('No playlist or direct qualities found in VidLink response');
    }

    const subtitles = [];
    if (streamData.captions && Array.isArray(streamData.captions)) {
        for (const cap of streamData.captions) {
            const lang = (cap.language || 'Unknown').toLowerCase();
            if (lang === 'english' || lang === 'en' || lang === 'eng') {
                subtitles.push({
                    language: cap.language || 'English',
                    url: cap.url
                });
            }
        }
    }

    return {
        success: true,
        streams,
        subtitles
    };
}
