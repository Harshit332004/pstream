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
    backends: [''],

    currentBackendIndex: 0,

    getSources: async (tmdbId, type, season = null, episode = null) => {
        const url = new URL(`/sources/${tmdbId}`, window.location.origin);
        url.searchParams.set('type', type);
        if (season) url.searchParams.set('season', season);
        if (episode) url.searchParams.set('episode', episode);

        const response = await fetchWithTimeout(url.toString(), {}, 20000);

        if (response.ok) {
            const data = await response.json();
            if (data.sources && data.sources.length > 0) {
                return data;
            }
        }

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
                `${window.location.origin}/discover`,
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
