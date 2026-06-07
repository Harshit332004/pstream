/**
 * Local Storage Management
 * Handles caching with TTL and size limits
 */

window.Storage = {
    prefix: 'safestream_',
    maxSize: 5 * 1024 * 1024, // 5MB
    
    set: (key, value, ttlHours = 24) => {
        try {
            const item = {
                value,
                expiry: ttlHours > 0 ? Date.now() + (ttlHours * 3600000) : null
            };
            localStorage.setItem(Storage.prefix + key, JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    get: (key) => {
        try {
            const item = JSON.parse(localStorage.getItem(Storage.prefix + key));
            if (!item) return null;
            
            if (item.expiry && Date.now() > item.expiry) {
                Storage.remove(key);
                return null;
            }
            
            return item.value;
        } catch (e) {
            return null;
        }
    },
    
    remove: (key) => {
        localStorage.removeItem(Storage.prefix + key);
    },
    
    clear: () => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(Storage.prefix)) {
                localStorage.removeItem(key);
            }
        });
    },
    
    // Watch history management
    history: {
        get: () => Storage.get('history') || [],
        
        set: (items) => Storage.set('history', items, 720), // 30 days
        
        add: (item) => {
            const history = Storage.history.get();
            const key = Storage.history.getKey(item);
            
            const existing = history.findIndex(h => 
                Storage.history.getKey(h) === key
            );
            
            if (existing >= 0) {
                history[existing] = { ...history[existing], ...item };
            } else {
                history.unshift(item);
            }
            
            // Keep only last 100 items
            if (history.length > 100) {
                history.pop();
            }
            
            Storage.history.set(history);
            return history;
        },
        
        getKey: (item) => {
            const season = item.type === 'tv' ? (item.season || 0) : 0;
            const episode = item.type === 'tv' ? (item.episode || 0) : 0;
            return `${item.tmdbId}_${item.type}_${season}_${episode}`;
        },
        
        remove: (tmdbId, type, season = 0, episode = 0) => {
            let history = Storage.history.get();
            history = history.filter(h => Storage.history.getKey(h) !== Storage.history.getKey({ tmdbId, type, season, episode }));
            Storage.history.set(history);
            return history;
        },
        
        clear: () => {
            Storage.history.set([]);
        }
    },
    
    // User preferences
    preferences: {
        get: () => Storage.get('prefs') || {},
        
        set: (prefs) => Storage.set('prefs', prefs, 3650), // 10 years
        
        update: (key, value) => {
            const prefs = Storage.preferences.get();
            prefs[key] = value;
            Storage.preferences.set(prefs);
        }
    },
    
    // Check available space
    getAvailableSpace: () => {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
};

// Expose to window
window.UserHistory = Storage.history;
window.UserPreferences = Storage.preferences;
