/**
 * Utility Functions
 * Minimal, performance-optimized utilities
 */

// Time formatting
window.formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
};

// Relative time formatting
window.timeAgo = (timestamp) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
};

// DOM utilities
window.DOM = {
    get: (id) => document.getElementById(id),
    qs: (selector) => document.querySelector(selector),
    qsa: (selector) => document.querySelectorAll(selector),
    
    show: (id) => {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.classList.remove('hidden');
    },
    
    hide: (id) => {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.classList.add('hidden');
    },
    
    toggle: (id) => {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.classList.toggle('hidden');
    },
    
    setAttr: (el, attrs) => {
        Object.entries(attrs).forEach(([key, value]) => {
            el.setAttribute(key, value);
        });
    },
    
    addClass: (el, cls) => el.classList.add(cls),
    removeClass: (el, cls) => el.classList.remove(cls),
    hasClass: (el, cls) => el.classList.contains(cls),
};

// Toast notifications
window.showToast = (message, type = 'info', duration = 3000) => {
    const container = DOM.get('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    return toast;
};

// Debounce helper
window.debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Throttle helper
window.throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Network status
window.isOnline = () => navigator.onLine;

window.addEventListener('online', () => {
    const status = DOM.get('connection-status');
    if (status) {
        DOM.removeClass(status, 'offline');
        DOM.addClass(status, 'online');
    }
});

window.addEventListener('offline', () => {
    const status = DOM.get('connection-status');
    if (status) {
        DOM.removeClass(status, 'online');
        DOM.addClass(status, 'offline');
    }
    showToast('Lost connection', 'error', 5000);
});

// Fetch with timeout
window.fetchWithTimeout = (url, options = {}, timeout = 10000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout)
        )
    ]);
};

// TMDB API helper
window.tmdbApi = {
    baseUrl: 'https://api.themoviedb.org/3',
    key: '797f74f09af514f1d6f9ecdbf70e8597',
    
    search: (query, type = 'movie') => {
        return fetch(
            `${tmdbApi.baseUrl}/search/${type}?api_key=${tmdbApi.key}&query=${encodeURIComponent(query)}`
        ).then(r => r.json());
    },
    
    getTvDetails: (seriesId) => {
        return fetch(
            `${tmdbApi.baseUrl}/tv/${seriesId}?api_key=${tmdbApi.key}`
        ).then(r => r.json());
    },
    
    getTvSeason: (seriesId, seasonNum) => {
        return fetch(
            `${tmdbApi.baseUrl}/tv/${seriesId}/season/${seasonNum}?api_key=${tmdbApi.key}`
        ).then(r => r.json());
    }
};

// Platform detection
window.getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|tablet/.test(ua)) return 'mobile';
    if (/tv|googletv|hbbtv/.test(ua)) return 'tv';
    return 'desktop';
};

// Performance utilities
window.measurePerf = (name, fn) => {
    if (!window.performance) return fn();
    performance.mark(`${name}-start`);
    const result = fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    return result;
};
