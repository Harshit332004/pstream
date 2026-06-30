/**
 * Provider Management
 * Handles streaming provider selection and fallback.
 *
 * Uses relative URLs (/sources, /proxy, etc.) so that:
 * - In production: requests go to pstream-kappa-seven.vercel.app (same-origin, no CORS)
 * - In dev: Vite proxy forwards requests to localhost:3000 (same-origin, no CORS)
 * This eliminates all cross-origin issues on Chrome, mobile, and all other browsers.
 */

window.Providers = {
    // Empty — we use relative URLs, so no absolute backend URL needed
    apiUrl: import.meta.env.VITE_HF_API_URL || 'http://localhost:7860',
    currentBackendIndex: 0,

    getSources: async (tmdbId, type, season = null, episode = null) => {
        const url = new URL(`/api/stream`, window.Providers.apiUrl);
        url.searchParams.set('id', tmdbId);
        url.searchParams.set('type', type);
        if (season) url.searchParams.set('season', season);
        if (episode) url.searchParams.set('episode', episode);

        const response = await fetchWithTimeout(url.toString(), {}, 30000);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.streams && data.streams.length > 0) {
                return {
                    sources: data.streams,
                    subtitles: data.subtitles || [],
                    provider: data.streams[0].provider // Default to first provider for backwards compatibility if needed
                };
            }
        }

        return {
            sources: [],
            subtitles: [],
            error: 'No sources available'
        };
    },

    getDiscovery: async () => {
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
