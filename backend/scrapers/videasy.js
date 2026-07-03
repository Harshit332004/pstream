// backend/scrapers/videasy.js

export async function scrapeVideasy(id, type, season, episode) {
    try {
        // The walterwhite-69 videasy decryptor typically runs on port 8000 (FastAPI).
        // Adjust this environment variable to point to your decryptor instance.
        const DECRYPTOR_URL = process.env.VIDEASY_URL || 'http://127.0.0.1:8000';
        
        let url = `${DECRYPTOR_URL}/scrape?id=${id}&type=${type}`;
        if (type === 'tv' || type === 'show') {
            url += `&season=${season}&episode=${episode}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Videasy decryptor API returned status ${response.status}`);
        }

        const data = await response.json();

        // Standardize the response to match what server.js expects
        return {
            success: true,
            streams: data.streams?.map(stream => ({
                provider: 'Videasy',
                url: stream.url,
                type: stream.type || 'hls',
                quality: stream.quality || 'Auto'
            })) || [],
            subtitles: data.subtitles || []
        };

    } catch (error) {
        return { 
            success: false, 
            error: `Videasy Scraper Error: ${error.message}` 
        };
    }
}
