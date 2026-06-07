/**
 * Cross-Device Synchronization
 * Syncs watch history with official P-Stream backend
 */

window.SyncEngine = {
    backendUrl: (import.meta.env.VITE_BACKEND_URL || 'https://safestream-backend.onrender.com').replace(/\/+$/, ''),
    userId: null,
    syncInterval: 10000, // 10 seconds
    syncTimeout: null,
    
    init: () => {
        // Generate or retrieve user ID
        SyncEngine.userId = Storage.get('userId');
        if (!SyncEngine.userId) {
            SyncEngine.userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            Storage.set('userId', SyncEngine.userId, 3650);
        }
        
        // Setup BroadcastChannel for tab communication
        if ('BroadcastChannel' in window) {
            try {
                window.syncChannel = new BroadcastChannel('safestream_sync');
                window.syncChannel.onmessage = (event) => {
                    if (event.data.type === 'HISTORY_UPDATED') {
                        SyncEngine.pullHistory();
                    }
                };
            } catch (e) {
                console.warn('BroadcastChannel not supported');
            }
        }
        
        // Initial sync and setup interval
        SyncEngine.pullHistory();
        SyncEngine.startAutoSync();
        
        // Sync on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                SyncEngine.pullHistory();
            }
        });
    },
    
    startAutoSync: () => {
        SyncEngine.syncTimeout = setInterval(() => {
            SyncEngine.pullHistory();
        }, SyncEngine.syncInterval);
    },
    
    stopAutoSync: () => {
        clearInterval(SyncEngine.syncTimeout);
    },
    
    saveProgress: (media) => {
        if (!media) return;
        
        // Local save
        const history = Storage.history.add(media);
        
        // Broadcast to other tabs
        if (window.syncChannel) {
            window.syncChannel.postMessage({
                type: 'HISTORY_UPDATED',
                data: media
            });
        }
        
        // Network save (debounced)
        SyncEngine.pushProgress(media);
    },
    
    pushProgress: debounce(async (media) => {
        if (!isOnline()) return;
        
        try {
            await fetchWithTimeout(
                `${SyncEngine.backendUrl}/users/${SyncEngine.userId}/watch-history/${media.tmdbId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tmdbId: String(media.tmdbId),
                        duration: Number(media.duration || 0),
                        watched: Number(media.timestamp || 0),
                        watchedAt: new Date().toISOString(),
                        completed: media.completed || false,
                        seasonNumber: media.season ? Number(media.season) : undefined,
                        episodeNumber: media.episode ? Number(media.episode) : undefined,
                        meta: {
                            title: media.title,
                            type: media.type === 'tv' ? 'show' : 'movie',
                            year: media.year ? Number(media.year) : undefined,
                            poster: media.poster || ''
                        }
                    })
                },
                5000
            );
        } catch (e) {
            console.error('Failed to push progress:', e);
        }
    }, 3000),
    
    pullHistory: async () => {
        if (!isOnline()) return;
        
        try {
            const response = await fetchWithTimeout(
                `${SyncEngine.backendUrl}/users/${SyncEngine.userId}/watch-history`,
                {},
                5000
            );
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    // Map official backend watch history items to frontend format
                    const mappedData = data.map(item => ({
                        tmdbId: item.tmdbId,
                        type: item.meta?.type === 'show' ? 'tv' : 'movie',
                        title: item.meta?.title || 'Unknown Title',
                        season: item.season?.number || undefined,
                        episode: item.episode?.number || undefined,
                        timestamp: Math.floor(parseFloat(item.watched || '0')),
                        duration: Math.floor(parseFloat(item.duration || '0')),
                        last_updated: new Date(item.watchedAt || Date.now()).getTime(),
                        completed: item.completed || false
                    }));

                    Storage.history.set(mappedData);
                    
                    // Broadcast to other tabs
                    if (window.syncChannel) {
                        window.syncChannel.postMessage({
                            type: 'HISTORY_SYNCED',
                            data: mappedData
                        });
                    }
                    
                    window.dispatchEvent(new CustomEvent('sync_completed'));
                }
            }
        } catch (e) {
            console.warn('Failed to pull history:', e);
        }
    },
    
    clearHistory: async () => {
        Storage.history.clear();
        
        if (isOnline()) {
            try {
                await fetchWithTimeout(
                    `${SyncEngine.backendUrl}/users/${SyncEngine.userId}/watch-history`,
                    {
                        method: 'DELETE'
                    },
                    5000
                );
            } catch (e) {
                console.error('Failed to clear history:', e);
            }
        }
    }
};
