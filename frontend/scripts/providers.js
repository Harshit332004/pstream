window.Providers = {
    apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',

    getSources: async (tmdbId, type, season = null, episode = null, detail_path = null, title = null, year = null) => {
        console.log('🔍 Providers.getSources called with:', { tmdbId, type, season, episode, title });

        let allStreams = [];
        let allSubtitles = [];

        // Helper to parse Vidlink response
        const parseVidlink = (data) => {
            const qualities = data.stream?.qualities || {};
            const streams = [];
            for (const [quality, info] of Object.entries(qualities)) {
                if (info.url) {
                    streams.push({
                        url: info.url,
                        quality: quality + 'p',
                        provider: 'Vidlink'
                    });
                }
            }
            streams.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
            const subtitles = data.stream?.captions || [];
            return { streams, subtitles };
        };

        // --- 1. Try Vidlink ---
        try {
            let url;
            if (type === 'movie') {
                url = new URL(`/vidlink/movie/${tmdbId}`, window.Providers.apiUrl);
            } else if (type === 'tv' && season && episode) {
                url = new URL(`/vidlink/tv/${tmdbId}/${season}/${episode}`, window.Providers.apiUrl);
            } else {
                throw new Error('Invalid type or missing season/episode for TV');
            }
            console.log('📡 Fetching Vidlink URL:', url.toString());
            const response = await fetchWithTimeout(url.toString(), {}, 30000);
            console.log('📡 Vidlink response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('📡 Vidlink raw data:', data);
                const { streams, subtitles } = parseVidlink(data);
                console.log('📡 Vidlink streams:', streams);
                allStreams = allStreams.concat(streams);
                allSubtitles = allSubtitles.concat(subtitles);
            } else {
                console.warn('Vidlink returned non-OK status:', response.status);
            }
        } catch (e) {
            console.warn('Vidlink failed:', e);
        }
        // --- 3. Fallback to Moviebox (using the query endpoint) ---
        try {
            const url = new URL(`/api/stream`, window.Providers.apiUrl);
            url.searchParams.set('id', tmdbId);
            url.searchParams.set('type', type);
            if (season) url.searchParams.set('season', season);
            if (episode) url.searchParams.set('episode', episode);
            if (title) url.searchParams.set('title', title);
            console.log('📡 Fetching Moviebox URL:', url.toString());
            const response = await fetchWithTimeout(url.toString(), {}, 30000);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.streams && data.streams.length > 0) {
                    const streams = data.streams.map(item => ({
                        url: item.url,
                        quality: item.quality || 'Unknown',
                        provider: 'Moviebox'
                    }));
                    allStreams = allStreams.concat(streams);
                    allSubtitles = allSubtitles.concat(data.subtitles || []);
                }
            }
        } catch (e) {
            console.warn('Moviebox fallback failed:', e);
        }

        // --- 4. Try Vidsrc ---
        console.log('🔄 Also fetching Vidsrc');
        try {
            const url = new URL(`/vidsrc/sources`, window.Providers.apiUrl);
            url.searchParams.set('tmdbId', tmdbId);
            url.searchParams.set('mediaType', type);
            if (season) url.searchParams.set('seasonId', season);
            if (episode) url.searchParams.set('episodeId', episode);
            console.log('📡 Fetching Vidsrc URL:', url.toString());
            const response = await fetchWithTimeout(url.toString(), {}, 30000);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.streams) {
                    const streams = data.streams.map(item => ({
                        url: item.url,
                        quality: item.quality || 'Unknown',
                        provider: 'Vidsrc'
                    }));
                    allStreams = allStreams.concat(streams);
                    allSubtitles = allSubtitles.concat(data.subtitles || []);
                }
            }
        } catch (e) {
            console.warn('Vidsrc fallback failed:', e);
        }

        // --- 5. Try Videasy ---
        console.log('🔄 Also fetching Videasy');
        try {
            const url = new URL(`/videasy/sources`, window.Providers.apiUrl);
            url.searchParams.set('tmdbId', tmdbId);
            url.searchParams.set('mediaType', type);
            if (title) url.searchParams.set('title', title);
            if (season) url.searchParams.set('seasonId', season);
            if (episode) url.searchParams.set('episodeId', episode);
            console.log('📡 Fetching Videasy URL:', url.toString());
            const response = await fetchWithTimeout(url.toString(), {}, 30000);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.streams) {
                    const streams = data.streams.map(item => ({
                        url: item.url,
                        quality: item.quality || 'Unknown',
                        provider: 'Videasy'
                    }));
                    allStreams = allStreams.concat(streams);
                    allSubtitles = allSubtitles.concat(data.subtitles || []);
                }
            }
        } catch (e) {
            console.warn('Videasy fallback failed:', e);
        }
        // --- 2. Also try Vidnest (to get more sources) ---
        console.log('🔄 Also fetching Vidnest');
        try {
            const url = new URL(`/vidnest/sources`, window.Providers.apiUrl);
            url.searchParams.set('tmdbId', tmdbId);
            url.searchParams.set('mediaType', type === 'tv' ? 'tv' : 'movie');
            if (season) url.searchParams.set('seasonId', season);
            if (episode) url.searchParams.set('episodeId', episode);
            console.log('📡 Fetching Vidnest URL:', url.toString());
            const response = await fetchWithTimeout(url.toString(), {}, 30000);
            if (response.ok) {
                const data = await response.json();
                console.log('📡 Vidnest raw data:', data);
                const urlList = data.data?.url || [];
                const streams = urlList.map(item => ({
                    url: item.link,
                    quality: item.resolution || 'Unknown',
                    provider: 'Vidnest'
                }));
                console.log('📡 Vidnest streams:', streams);
                allStreams = allStreams.concat(streams);
                // Vidnest doesn't provide subtitles currently
            } else {
                console.warn('Vidnest returned non-OK status:', response.status);
            }
        } catch (e) {
            console.warn('Vidnest fallback failed:', e);
        }

        // --- 6. Add Nepu (Iframe CF Bypass) ---
        try {
            const embedUrl = new URL(`/nepu/embed`, window.Providers.apiUrl);
            embedUrl.searchParams.set('tmdb_id', tmdbId);
            embedUrl.searchParams.set('type', type);
            if (season) embedUrl.searchParams.set('season', season);
            if (episode) embedUrl.searchParams.set('episode', episode);
            
            allStreams.push({
                url: embedUrl.toString(),
                quality: '720p',
                provider: 'Nepu',
                type: 'iframe'
            });
            console.log('📡 Nepu iframe source generated:', embedUrl.toString());
        } catch (e) {
            console.warn('Nepu construction failed:', e);
        }

        // Return combined
        if (allStreams.length > 0) {
            return { sources: allStreams, subtitles: allSubtitles };
        } else {
            return { sources: [], subtitles: [], error: 'No sources available' };
        }
    },

    getDiscovery: async () => {
        // Keep as is
        try {
            const response = await fetchWithTimeout(
                `${window.Providers.apiUrl}/discover`,
                {},
                10000
            );
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.error('Failed to get discovery:', e);
        }
        return { popular: [], trending: [] };
    }
};