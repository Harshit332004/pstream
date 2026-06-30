/**
 * Cross-Device Synchronization
 * Syncs watch history with the HF backend's persistent JSON storage
 */

window.SyncEngine = {
    apiUrl: import.meta.env.VITE_HF_API_URL || 'http://localhost:7860',
    userId: null,
    syncInterval: 10000, // 10 seconds
    syncTimeout: null,
    
    init: () => {
        // Use a single hardcoded global user ID to sync history across all browsers and devices
        SyncEngine.userId = 'global_user';
        Storage.set('userId', SyncEngine.userId, 3650);
        
        // Setup BroadcastChannel for tab communication
        if ('BroadcastChannel' in window) {
            try {
                window.syncChannel = new BroadcastChannel('safestream_sync');
                window.syncChannel.onmessage = (event) => {
                    if (event.data.type === 'HISTORY_UPDATED' || event.data.type === 'HISTORY_SYNCED') {
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
        Storage.history.add(media);
        
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
    
    pushProgress: async (media) => {
        if (!isOnline()) return;
        
        try {
            await fetchWithTimeout(
                `${SyncEngine.apiUrl}/users/${SyncEngine.userId}/watch-history/${media.tmdbId}`,
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
                            poster: media.poster || ''
                        }
                    })
                },
                5000
            );
        } catch (e) {
            // Silently fail — local storage is the fallback
        }
    },
    
    pullHistory: async () => {
        if (!isOnline()) return;
        
        try {
            const response = await fetchWithTimeout(
                `${SyncEngine.apiUrl}/users/${SyncEngine.userId}/watch-history`,
                {},
                5000
            );
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    // Map backend entries to frontend format
                    const mappedData = data.map(item => ({
                        tmdbId: item.tmdbId,
                        type: item.meta?.type === 'show' ? 'tv' : 'movie',
                        title: item.meta?.title || 'Unknown Title',
                        season: item.seasonNumber || undefined,
                        episode: item.episodeNumber || undefined,
                        timestamp: Math.floor(parseFloat(item.watched || '0')),
                        duration: Math.floor(parseFloat(item.duration || '0')),
                        last_updated: new Date(item.watchedAt || Date.now()).getTime(),
                        completed: item.completed || false,
                        poster: item.meta?.poster || ''
                    }));

                    // Merge with local: remote wins for same key if newer
                    const localHistory = Storage.history.get();
                    const mergedMap = {};

                    // Add local entries first
                    for (const item of localHistory) {
                        const key = Storage.history.getKey(item);
                        mergedMap[key] = item;
                    }

                    // Overwrite with remote entries if they have a more recent timestamp
                    for (const item of mappedData) {
                        const key = Storage.history.getKey(item);
                        const existing = mergedMap[key];
                        if (!existing || (item.last_updated || 0) >= (existing.last_updated || 0)) {
                            mergedMap[key] = item;
                        }
                    }

                    const mergedHistory = Object.values(mergedMap)
                        .sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0))
                        .slice(0, 100);

                    Storage.history.set(mergedHistory);
                    
                    window.dispatchEvent(new CustomEvent('sync_completed'));
                }
            }
        } catch (e) {
            // Silently fail — local storage is the fallback
        }
    },
    
    clearHistory: async () => {
        Storage.history.clear();
        
        if (isOnline()) {
            try {
                await fetchWithTimeout(
                    `${SyncEngine.apiUrl}/users/${SyncEngine.userId}/watch-history`,
                    {
                        method: 'DELETE'
                    },
                    5000
                );
            } catch (e) {
                console.error('Failed to clear remote history:', e);
            }
        }
    }
};
