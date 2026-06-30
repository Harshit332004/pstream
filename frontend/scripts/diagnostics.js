/**
 * Diagnostics and Health Monitoring System
 * Intercepts console logs and checks backend/microservice status in real-time.
 */

window.Diagnostics = {
    logs: [],
    maxLogs: 100,
    isOpen: false,
    
    init: () => {
        // Intercept console functions to print to diagnostic UI
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.log = (...args) => {
            originalLog.apply(console, args);
            Diagnostics.addLog('info', args.join(' '));
        };
        
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            Diagnostics.addLog('warning', args.join(' '));
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            Diagnostics.addLog('error', args.join(' '));
        };
        
        // Listeners for diagnostics UI toggle
        const diagBtn = document.getElementById('diagnostics-btn');
        const closeBtn = document.getElementById('close-diagnostics-btn');
        const clearBtn = document.getElementById('clear-logs-btn');
        
        if (diagBtn) diagBtn.addEventListener('click', () => Diagnostics.toggle(true));
        if (closeBtn) closeBtn.addEventListener('click', () => Diagnostics.toggle(false));
        if (clearBtn) clearBtn.addEventListener('click', () => Diagnostics.clearLogs());
        
        // Close on clicking outside the panel content
        const overlay = document.getElementById('diagnostics-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) Diagnostics.toggle(false);
            });
        }
        
        console.log('🩺 Diagnostics system initialized.');
    },
    
    toggle: (state) => {
        Diagnostics.isOpen = state;
        const overlay = document.getElementById('diagnostics-overlay');
        if (!overlay) return;
        
        if (state) {
            overlay.classList.remove('hidden');
            Diagnostics.runHealthCheck();
        } else {
            overlay.classList.add('hidden');
        }
    },
    
    addLog: (type, message) => {
        const timestamp = new Date().toLocaleTimeString();
        Diagnostics.logs.push({ type, message, timestamp });
        
        if (Diagnostics.logs.length > Diagnostics.maxLogs) {
            Diagnostics.logs.shift();
        }
        
        // Update UI if open or panel is loaded
        const container = document.getElementById('diagnostics-logs');
        if (container) {
            const el = document.createElement('div');
            el.className = `log-entry log-${type}`;
            el.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-msg">${Diagnostics.escapeHtml(message)}</span>`;
            container.appendChild(el);
            container.scrollTop = container.scrollHeight;
        }
    },
    
    clearLogs: () => {
        Diagnostics.logs = [];
        const container = document.getElementById('diagnostics-logs');
        if (container) container.innerHTML = '';
        console.log('🧹 Log console cleared.');
    },
    
    escapeHtml: (unsafe) => {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    },
    
    runHealthCheck: async () => {
        const apiVal = document.getElementById('diag-api-url');
        const backendVal = document.getElementById('diag-backend-status');
        const cineproVal = document.getElementById('diag-cinepro-status');
        const tmdbVal = document.getElementById('diag-tmdb-status');
        
        if (apiVal) apiVal.textContent = window.Providers.apiUrl;
        
        // 1. Check TMDB Connection
        if (tmdbVal) {
            Diagnostics.setLoadingStatus(tmdbVal);
            try {
                // Fetch simple TMDB configuration to verify connectivity
                const tmdbRes = await fetch('https://api.themoviedb.org/3/configuration?api_key=797f74f09af514f1d6f9ecdbf70e8597', { signal: AbortSignal.timeout(4000) });
                if (tmdbRes.ok) {
                    Diagnostics.setSuccessStatus(tmdbVal, 'connected');
                } else {
                    Diagnostics.setErrorStatus(tmdbVal, `error (${tmdbRes.status})`);
                }
            } catch (err) {
                Diagnostics.setErrorStatus(tmdbVal, `failed (${err.message})`);
            }
        }
        
        // 2. Check Backend Server and CinePro via /api/health
        if (backendVal && cineproVal) {
            Diagnostics.setLoadingStatus(backendVal);
            Diagnostics.setLoadingStatus(cineproVal);
            
            try {
                const healthUrl = `${window.Providers.apiUrl}/api/health`;
                const res = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
                if (res.ok) {
                    const data = await res.json();
                    Diagnostics.setSuccessStatus(backendVal, 'online');
                    if (data.cinepro === 'online') {
                        Diagnostics.setSuccessStatus(cineproVal, 'online');
                    } else {
                        Diagnostics.setErrorStatus(cineproVal, data.cinepro);
                    }
                } else {
                    Diagnostics.setErrorStatus(backendVal, `error (${res.status})`);
                    Diagnostics.setErrorStatus(cineproVal, 'unknown');
                }
            } catch (err) {
                Diagnostics.setErrorStatus(backendVal, `offline (${err.message})`);
                Diagnostics.setErrorStatus(cineproVal, 'unreachable');
            }
        }
    },
    
    setLoadingStatus: (el) => {
        el.className = 'diag-status status-checking';
        el.textContent = 'Checking...';
    },
    
    setSuccessStatus: (el, text) => {
        el.className = 'diag-status status-online';
        el.textContent = text;
    },
    
    setErrorStatus: (el, text) => {
        el.className = 'diag-status status-offline';
        el.textContent = text;
    }
};

// Start system on load
Diagnostics.init();
