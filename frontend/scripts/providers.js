/**
 * Provider Management
 * Handles streaming provider selection and fallback
 */

window.Providers = {
    backends: [
        import.meta.env.VITE_BACKEND_URL || 'https://safestream-backend.onrender.com',
        'https://safestream-fallback.onrender.com' // Optional fallback
    ],
    
    currentBackendIndex: 0,
    
    getSources: async (tmdbId, type, season = null, episode = null) => {
        const attempts = [];
        
        for (let i = 0; i < Providers.backends.length; i++) {
            const backend = Providers.backends[i];
            
            try {
                const url = new URL(`${backend}/sources/${tmdbId}`);
                url.searchParams.set('type', type);
                if (season) url.searchParams.set('season', season);
                if (episode) url.searchParams.set('episode', episode);
                
                const response = await fetchWithTimeout(url.toString(), {
                    headers: {
                        'x-api-key': 'safestream-public'
                    }
                }, 20000);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.sources && data.sources.length > 0) {
                        Providers.currentBackendIndex = i;
                        return data;
                    }
                }
            } catch (e) {
                console.warn(`Backend ${i} failed:`, e);
                attempts.push(e);
            }
        }
        
        // All backends failed or no sources found
        return {
            sources: [],
            subtitles: [],
            error: 'No sources available'
        };
    },
    
    // Get metadata for discovery
    getDiscovery: async () => {
        try {
            const response = await fetchWithTimeout(
                `${Providers.backends[Providers.currentBackendIndex]}/discover`,
                {
                    headers: {
                        'x-api-key': 'safestream-public'
                    }
                },
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
