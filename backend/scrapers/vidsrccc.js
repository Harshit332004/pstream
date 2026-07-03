// backend/scrapers/vidsrccc.js

export async function scrapeVidsrccc(id, type, season, episode) {
    try {
        // The walterwhite-69 vidsrc.cc decryptor often runs as a local API service.
        // Adjust the URL if you have it hosted elsewhere or running on a different port.
        const DECRYPTOR_URL = process.env.VIDSRCCC_URL || 'http://127.0.0.1:8000';
        
        let url = `${DECRYPTOR_URL}/scrape?id=${id}&type=${type}`;
        if (type === 'tv' || type === 'show') {
            url += `&season=${season}&episode=${episode}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Vidsrc.cc decryptor API returned status ${response.status}`);
        }

        const data = await response.json();

        // Standardize the response to match what server.js expects
        return {
            success: true,
            streams: data.streams?.map(stream => ({
                provider: 'Vidsrc.cc',
                url: stream.url,
                type: stream.type || 'hls',
                quality: stream.quality || 'Auto'
            })) || [],
            subtitles: data.subtitles || []
        };

    } catch (error) {
        return { 
            success: false, 
            error: `Vidsrc.cc Scraper Error: ${error.message}` 
        };
    }
}
