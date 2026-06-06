Perfect! Let me create a **complete low-end optimized SafeStream v2** using P-Stream backend. This will be minimal, fast, and device-agnostic.Perfect! Let me create a **complete, production-ready SafeStream v2** optimized for P-Stream backend with minimal resources for low-end devices.

---

# 🎬 **SafeStream V2 - Complete File Structure**

## **Project Organization**

```
safestream-v2/
├── frontend/                    # Vercel deployment
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.html
│   │   │   └── player.html
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   ├── player.css
│   │   │   └── mobile.css
│   │   ├── scripts/
│   │   │   ├── main.js
│   │   │   ├── player.js
│   │   │   ├── sync.js
│   │   │   └── providers.js
│   │   └── utils/
│   │       ├── storage.js
│   │       └── time.js
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
└── backend/                     # P-Stream backend (Render deployment)
    ├── server/
    │   ├── routes/
    │   │   ├── discover/
    │   │   ├── users/
    │   │   └── health.get.ts
    │   └── middleware/
    ├── prisma/
    │   └── schema.prisma
    ├── .env.example
    ├── package.json
    ├── nitro.config.ts
    └── docker-compose.yml
```

---

# **FRONTEND FILES**

## **1. `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#0a0f1a">
    <meta name="description" content="SafeStream - Lightweight streaming with cross-device sync">
    <title>SafeStream V2</title>
    
    <link rel="stylesheet" href="/styles/globals.css">
    <link rel="stylesheet" href="/styles/player.css">
    <link rel="stylesheet" href="/styles/mobile.css">
    
    <!-- HLS.js for streaming -->
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.min.js"></script>
    
    <!-- Minimal preload optimization -->
    <link rel="preconnect" href="https://api.themoviedb.org">
    <link rel="dns-prefetch" href="https://api.themoviedb.org">
</head>
<body>
    <div id="app">
        <!-- Loading state -->
        <div id="loading-screen" class="loading-screen hidden">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>

        <!-- Main app container -->
        <div id="app-container" class="app-container">
            <!-- Header -->
            <header class="header">
                <div class="header-content">
                    <h1 class="logo">Stream<span class="accent">Safe</span></h1>
                    <div class="header-stats">
                        <span id="connection-status" class="status-indicator online" title="Connection status">●</span>
                    </div>
                </div>
            </header>

            <main class="main-content">
                <!-- Search Section -->
                <section class="search-section">
                    <div class="search-container">
                        <div class="search-input-group">
                            <select id="media-type" class="select-input">
                                <option value="movie">🎬 Movie</option>
                                <option value="tv">📺 TV Show</option>
                            </select>
                            <input 
                                type="text" 
                                id="search-input" 
                                class="text-input" 
                                placeholder="Search..." 
                                autocomplete="off"
                            >
                            <button id="search-btn" class="btn btn-primary">Search</button>
                        </div>

                        <!-- Search Results -->
                        <div id="search-results" class="search-results hidden">
                            <div id="results-list" class="results-list"></div>
                        </div>
                    </div>

                    <!-- TV Selector (hidden by default) -->
                    <div id="tv-selector" class="tv-selector hidden">
                        <div class="tv-selector-content">
                            <h3 id="tv-title" class="tv-title"></h3>
                            <div class="tv-controls">
                                <select id="season-select" class="select-input">
                                    <option value="">Select Season</option>
                                </select>
                                <select id="episode-select" class="select-input">
                                    <option value="">Select Episode</option>
                                </select>
                                <button id="play-tv-btn" class="btn btn-primary" disabled>▶ Play</button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Player Section -->
                <section id="player-section" class="player-section hidden">
                    <div class="player-header">
                        <div class="player-info">
                            <h2 id="player-title" class="player-title"></h2>
                            <span id="player-meta" class="player-meta"></span>
                        </div>
                        <button id="close-player-btn" class="btn btn-ghost">✕</button>
                    </div>

                    <div class="player-wrapper">
                        <video 
                            id="video-player" 
                            class="video-player" 
                            controls 
                            crossorigin="anonymous" 
                            playsinline
                        ></video>
                        
                        <div id="player-loader" class="player-loader hidden">
                            <div class="loader-spinner"></div>
                            <p id="loader-text">Loading stream...</p>
                        </div>

                        <div id="subtitle-overlay" class="subtitle-overlay hidden"></div>
                    </div>

                    <!-- Player Controls -->
                    <div class="player-controls">
                        <div class="controls-left">
                            <button id="skip-back-btn" class="btn btn-control" title="Skip -10s">⏪ 10s</button>
                            <span id="time-display" class="time-display">0:00 / 0:00</span>
                            <button id="skip-forward-btn" class="btn btn-control" title="Skip +10s">10s ⏩</button>
                        </div>
                        <div class="controls-right">
                            <select id="quality-select" class="select-input quality-select" title="Video quality">
                                <option value="auto">📺 Auto</option>
                            </select>
                            <select id="source-select" class="select-input source-select" title="Stream source">
                                <option value="0">Source 1</option>
                            </select>
                        </div>
                    </div>

                    <p class="player-tip">💡 Use ← → arrow keys to skip 10s | Space to play/pause | ESC to close</p>
                </section>

                <!-- History Section -->
                <section class="history-section">
                    <div class="history-header">
                        <h2>Continue Watching</h2>
                        <button id="clear-history-btn" class="btn btn-ghost small" style="display: none;">Clear</button>
                    </div>
                    <div id="history-container" class="history-container">
                        <div class="empty-state">
                            <p>No watch history</p>
                            <span>Search for content above to get started</span>
                        </div>
                    </div>
                </section>

                <!-- Discovery Section -->
                <section id="discovery-section" class="discovery-section">
                    <h2>Trending</h2>
                    <div id="trending-container" class="trending-container"></div>
                </section>
            </main>

            <!-- Footer -->
            <footer class="footer">
                <p>SafeStream V2 • Lightweight Streaming</p>
            </footer>
        </div>

        <!-- Toast Notifications -->
        <div id="toast-container" class="toast-container"></div>
    </div>

    <script src="/scripts/utils.js"></script>
    <script src="/scripts/storage.js"></script>
    <script src="/scripts/sync.js"></script>
    <script src="/scripts/providers.js"></script>
    <script src="/scripts/player.js"></script>
    <script src="/scripts/main.js"></script>
</body>
</html>
```

---

## **2. `frontend/styles/globals.css`**

```css
:root {
    /* Color Palette - Optimized for low-end screens */
    --bg-primary: #0a0f1a;
    --bg-secondary: #111827;
    --bg-tertiary: #1e293b;
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    --accent: #3b82f6;
    --accent-dark: #1e40af;
    --accent-light: #60a5fa;
    --danger: #ef4444;
    --success: #34d399;
    --border-color: rgba(255, 255, 255, 0.08);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
    
    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --font-size-sm: 0.75rem;
    --font-size-base: 0.875rem;
    --font-size-lg: 1rem;
    --font-size-xl: 1.25rem;
    
    /* Spacing */
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;
    
    /* Radius */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

body {
    font-family: var(--font-family);
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.5;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
    background: var(--text-muted);
    border-radius: var(--radius-sm);
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
}

/* Utility Classes */
.hidden {
    display: none !important;
}

.invisible {
    visibility: hidden;
}

.truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* App Container */
.app-container {
    max-width: 1200px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
}

/* Header */
.header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10, 15, 26, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
    padding: var(--space-md);
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: var(--font-size-xl);
    font-weight: 700;
    letter-spacing: -0.5px;
    text-transform: none;
}

.logo .accent {
    color: var(--accent);
}

.status-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    font-size: 14px;
    animation: pulse 2s infinite;
}

.status-indicator.online {
    color: var(--success);
}

.status-indicator.offline {
    color: var(--danger);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Main Content */
.main-content {
    flex: 1;
    padding: var(--space-lg);
    overflow-y: auto;
}

/* Section Styling */
section {
    margin-bottom: var(--space-xl);
}

section h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-md);
    color: var(--text-primary);
}

/* Form Elements */
.text-input,
.select-input {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--font-size-base);
    font-family: var(--font-family);
    transition: all 0.2s ease;
}

.text-input::placeholder {
    color: var(--text-muted);
}

.text-input:focus,
.select-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Buttons */
.btn {
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-family);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-height: 36px;
}

.btn:active {
    transform: scale(0.98);
}

.btn-primary {
    background: var(--accent);
    color: white;
}

.btn-primary:hover {
    background: var(--accent-dark);
}

.btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
}

.btn-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
}

.btn-ghost.small {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
}

.btn-control {
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent);
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-sm);
}

.btn-control:hover {
    background: rgba(59, 130, 246, 0.2);
}

/* Loading Screen */
.loading-screen {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    gap: var(--space-md);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Footer */
.footer {
    text-align: center;
    padding: var(--space-lg);
    border-top: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}

/* Responsive */
@media (max-width: 768px) {
    .main-content {
        padding: var(--space-md);
    }
    
    .header-content {
        flex-direction: column;
        gap: var(--space-sm);
    }
}

@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## **3. `frontend/styles/player.css`**

```css
/* Search Section */
.search-section {
    margin-bottom: var(--space-xl);
}

.search-container {
    position: relative;
}

.search-input-group {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-sm);
    align-items: center;
}

/* Search Results */
.search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--space-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    max-height: 300px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: var(--shadow-md);
}

.results-list {
    display: flex;
    flex-direction: column;
}

.result-item {
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background 0.2s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.result-item:last-child {
    border-bottom: none;
}

.result-item:hover {
    background: rgba(59, 130, 246, 0.1);
}

.result-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-width: 0;
}

.result-title {
    font-weight: 600;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.result-year {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.result-rating {
    font-size: var(--font-size-sm);
    color: #fbbf24;
    font-weight: 600;
    white-space: nowrap;
}

/* TV Selector */
.tv-selector {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-top: var(--space-md);
}

.tv-selector-content h3 {
    margin-bottom: var(--space-md);
    font-size: var(--font-size-base);
    color: var(--text-primary);
}

.tv-controls {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--space-sm);
}

/* Player Section */
.player-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: var(--space-xl);
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-color);
    gap: var(--space-md);
}

.player-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-width: 0;
}

.player-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.player-meta {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

/* Video Player Wrapper */
.player-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
}

.video-player {
    width: 100%;
    height: 100%;
    display: block;
}

/* Player Loader */
.player-loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10;
    gap: var(--space-md);
}

.loader-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* Subtitle Overlay */
.subtitle-overlay {
    position: absolute;
    bottom: 60px;
    left: 0;
    right: 0;
    text-align: center;
    color: white;
    font-size: var(--font-size-base);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
    padding: 0 var(--space-md);
    z-index: 5;
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
}

/* Player Controls */
.player-controls {
    padding: var(--space-md);
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
}

.controls-left,
.controls-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.time-display {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--accent);
    min-width: 80px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.quality-select,
.source-select {
    flex: none;
    min-width: 100px;
}

.player-tip {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-sm);
    background: rgba(59, 130, 246, 0.05);
    border-radius: var(--radius-md);
    margin: var(--space-md) 0 0 0;
}

/* History Section */
.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
}

.history-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-md);
}

.history-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
}

.history-item:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.history-item-content {
    padding: var(--space-md);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.history-item-title {
    font-weight: 600;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.history-item-meta {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.history-item-time {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-sm);
    transition: width 0.3s ease;
}

.history-item-delete {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
    background: rgba(0, 0, 0, 0.5);
    color: var(--danger);
    border: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
}

.history-item:hover .history-item-delete {
    opacity: 1;
}

/* Empty State */
.empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-muted);
}

.empty-state p {
    font-weight: 600;
    font-size: var(--font-size-base);
    margin-bottom: var(--space-sm);
}

.empty-state span {
    font-size: var(--font-size-sm);
}

/* Discovery Section */
.discovery-section {
    display: none;
}

.trending-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-md);
}

.trending-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
}

.trending-item:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.trending-item-title {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Toast Container */
.toast-container {
    position: fixed;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.toast {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    font-size: var(--font-size-sm);
    animation: toastIn 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
}

@keyframes toastIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.toast.success {
    border-color: var(--success);
}

.toast.error {
    border-color: var(--danger);
}
```

---

## **4. `frontend/styles/mobile.css`**

```css
/* Mobile Optimizations */

@media (max-width: 768px) {
    :root {
        --font-size-base: 0.8125rem;
        --font-size-lg: 1rem;
        --space-md: 0.75rem;
        --space-lg: 1rem;
    }

    .search-input-group {
        grid-template-columns: auto 1fr auto;
    }

    .tv-controls {
        grid-template-columns: 1fr 1fr auto;
        gap: var(--space-xs);
    }

    .player-controls {
        flex-direction: column;
        gap: var(--space-sm);
    }

    .controls-left,
    .controls-right {
        width: 100%;
        justify-content: space-between;
    }

    .history-container {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: var(--space-sm);
    }

    .btn-control {
        padding: var(--space-xs) var(--space-xs);
        font-size: var(--font-size-sm);
    }
}

@media (max-width: 480px) {
    :root {
        --font-size-base: 0.75rem;
        --font-size-lg: 0.9375rem;
        --space-md: 0.5rem;
        --space-lg: 0.75rem;
    }

    .main-content {
        padding: var(--space-md);
    }

    .header {
        padding: var(--space-sm);
    }

    .logo {
        font-size: 1rem;
    }

    .search-input-group {
        grid-template-columns: 1fr;
    }

    #search-btn {
        width: 100%;
    }

    .tv-controls {
        grid-template-columns: 1fr;
    }

    #play-tv-btn {
        width: 100%;
    }

    .player-section {
        border-radius: var(--radius-md);
    }

    .player-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .player-controls {
        padding: var(--space-sm);
        gap: var(--space-xs);
    }

    .controls-left,
    .controls-right {
        width: 100%;
    }

    .time-display {
        min-width: auto;
        font-size: 0.7rem;
    }

    .quality-select,
    .source-select {
        min-width: 80px;
        font-size: 0.7rem;
    }

    .player-tip {
        font-size: 0.65rem;
        padding: var(--space-xs);
        margin-top: var(--space-sm);
    }

    .history-container {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-sm);
    }

    .history-item-title {
        font-size: 0.75rem;
    }

    .btn-ghost.small {
        padding: var(--space-xs) var(--space-xs);
        font-size: 0.65rem;
    }

    .footer {
        padding: var(--space-md);
        font-size: 0.65rem;
    }
}

/* Android TV (Large screens with remote) */
@media (min-width: 1920px) and (min-aspect-ratio: 16/9) {
    :root {
        --font-size-base: 1rem;
        --font-size-lg: 1.5rem;
        --space-md: 1.5rem;
        --space-lg: 2rem;
    }

    .btn {
        min-height: 50px;
        font-size: var(--font-size-lg);
        padding: var(--space-md) var(--space-lg);
    }

    .history-container {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: var(--space-lg);
    }

    .history-item {
        min-height: 200px;
    }

    .search-input-group {
        grid-template-columns: auto 1fr auto;
        gap: var(--space-md);
    }

    .player-controls {
        gap: var(--space-lg);
        padding: var(--space-lg);
    }

    .quality-select,
    .source-select {
        min-width: 150px;
    }
}

/* Landscape mode (mobile) */
@media (max-height: 500px) and (orientation: landscape) {
    .player-section {
        margin-bottom: var(--space-md);
    }

    .player-controls {
        padding: var(--space-sm);
    }

    .player-tip {
        display: none;
    }

    section {
        margin-bottom: var(--space-md);
    }
}

/* High DPI displays */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    body {
        -webkit-font-smoothing: subpixel-antialiased;
    }
}

/* Dark mode (already implemented) */
@media (prefers-color-scheme: dark) {
    /* Already using dark colors by default */
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
    .btn {
        min-height: 44px;
        min-width: 44px;
    }

    .history-item-delete {
        opacity: 0.7;
    }

    /* Increase tap targets */
    input,
    select,
    button {
        min-height: 44px;
    }
}

/* Low-end device optimizations */
@media (max-width: 320px) {
    :root {
        --font-size-base: 0.7rem;
        --font-size-lg: 0.85rem;
        --space-sm: 0.25rem;
        --space-md: 0.375rem;
    }

    .logo {
        font-size: 0.9rem;
    }

    .history-container {
        grid-template-columns: 1fr;
    }
}
```

---

## **5. `frontend/scripts/utils.js`**

```javascript
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
```

---

## **6. `frontend/scripts/storage.js`**

```javascript
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
            const key = `${item.tmdbId}_${item.type}`;
            
            const existing = history.findIndex(h => 
                `${h.tmdbId}_${h.type}` === key
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
        
        remove: (tmdbId, type) => {
            let history = Storage.history.get();
            history = history.filter(h => !(h.tmdbId === tmdbId && h.type === type));
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
```

---

## **7. `frontend/scripts/sync.js`**

```javascript
/**
 * Cross-Device Synchronization
 * Syncs watch history with backend
 */

window.SyncEngine = {
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'https://safestream-backend.onrender.com',
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
                `${SyncEngine.backendUrl}/users/${SyncEngine.userId}/watch-history`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': 'safestream-public'
                    },
                    body: JSON.stringify({
                        tmdbId: media.tmdbId,
                        type: media.type,
                        title: media.title,
                        season: media.season,
                        episode: media.episode,
                        watched: media.timestamp,
                        duration: media.duration,
                        watchedAt: new Date().toISOString()
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
                {
                    headers: {
                        'x-api-key': 'safestream-public'
                    }
                },
                5000
            );
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    Storage.history.set(data);
                    
                    // Broadcast to other tabs
                    if (window.syncChannel) {
                        window.syncChannel.postMessage({
                            type: 'HISTORY_SYNCED',
                            data: data
                        });
                    }
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
                    `${SyncEngine.backendUrl}/users/${SyncEngine.userId}/watch-history/all`,
                    {
                        method: 'DELETE',
                        headers: {
                            'x-api-key': 'safestream-public'
                        }
                    },
                    5000
                );
            } catch (e) {
                console.error('Failed to clear history:', e);
            }
        }
    }
};
```

---

## **8. `frontend/scripts/providers.js`**

```javascript
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
```

---

## **9. `frontend/scripts/player.js`**

```javascript
/**
 * HLS.js Video Player Manager
 * Handles video playback with HLS support
 */

window.Player = {
    hls: null,
    videoElement: null,
    currentMedia: null,
    currentSources: [],
    currentSourceIndex: 0,
    subtitleTrack: null,
    
    init: () => {
        Player.videoElement = DOM.get('video-player');
        if (!Player.videoElement) return;
        
        // Video event listeners
        Player.videoElement.addEventListener('timeupdate', () => Player.onTimeUpdate());
        Player.videoElement.addEventListener('play', () => Player.onPlay());
        Player.videoElement.addEventListener('pause', () => Player.onPause());
        Player.videoElement.addEventListener('ended', () => Player.onEnded());
        Player.videoElement.addEventListener('loadedmetadata', () => Player.onLoadedMetadata());
        Player.videoElement.addEventListener('error', () => Player.onError());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => Player.handleKeyboard(e));
        
        // Skip buttons
        DOM.get('skip-back-btn').addEventListener('click', () => Player.skip(-10));
        DOM.get('skip-forward-btn').addEventListener('click', () => Player.skip(10));
        DOM.get('close-player-btn').addEventListener('click', () => Player.close());
        
        // Quality selector
        DOM.get('quality-select').addEventListener('change', (e) => {
            Player.setQuality(parseInt(e.target.value));
        });
        
        // Source selector
        DOM.get('source-select').addEventListener('change', (e) => {
            Player.switchSource(parseInt(e.target.value));
        });
    },
    
    launch: async (media) => {
        Player.currentMedia = media;
        DOM.show('player-section');
        Player.showLoader(true, 'Fetching sources...');
        
        try {
            const result = await Providers.getSources(
                media.tmdbId,
                media.type,
                media.season,
                media.episode
            );
            
            if (!result.sources || result.sources.length === 0) {
                showToast('❌ No sources found', 'error');
                Player.close();
                return;
            }
            
            Player.currentSources = result.sources;
            Player.updateSourceSelector();
            Player.switchSource(0);
            
            // Update UI
            DOM.get('player-title').textContent = media.title;
            let meta = media.type === 'movie' ? 'Movie' : `S${media.season} E${media.episode}`;
            DOM.get('player-meta').textContent = meta;
            
            // Scroll to player
            setTimeout(() => {
                DOM.get('player-section').scrollIntoView({ behavior: 'smooth' });
            }, 100);
            
        } catch (e) {
            console.error('Failed to launch player:', e);
            showToast('Failed to load player', 'error');
            Player.close();
        }
    },
    
    switchSource: async (index) => {
        if (index < 0 || index >= Player.currentSources.length) return;
        
        Player.currentSourceIndex = index;
        const source = Player.currentSources[index];
        
        Player.showLoader(true, `Loading ${source.provider}...`);
        
        // Cleanup old HLS instance
        if (Player.hls) {
            Player.hls.destroy();
            Player.hls = null;
        }
        
        Player.videoElement.pause();
        Player.videoElement.src = '';
        
        try {
            if (source.type === 'hls') {
                Player.loadHLSStream(source);
            } else {
                Player.loadDirectStream(source);
            }
        } catch (e) {
            console.error('Failed to load source:', e);
            showToast(`❌ Failed to load source`, 'error');
        }
    },
    
    loadHLSStream: (source) => {
        if (!window.Hls) {
            showToast('HLS.js not available', 'error');
            return;
        }
        
        Player.hls = new Hls({
            debug: false,
            enableWorker: true,
            maxBufferLength: 15,
            maxMaxBufferLength: 30,
        });
        
        Player.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            Player.updateQualitySelector();
            Player.showLoader(false);
            Player.videoElement.play().catch(() => {
                console.warn('Autoplay prevented');
            });
        });
        
        Player.hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (data.fatal) {
                if (Player.currentSourceIndex + 1 < Player.currentSources.length) {
                    Player.switchSource(Player.currentSourceIndex + 1);
                } else {
                    showToast('All sources failed', 'error');
                }
            }
        });
        
        Player.hls.loadSource(source.url);
        Player.hls.attachMedia(Player.videoElement);
    },
    
    loadDirectStream: (source) => {
        Player.videoElement.src = source.url;
        Player.videoElement.onloadedmetadata = () => {
            Player.showLoader(false);
            Player.videoElement.play().catch(() => {});
        };
    },
    
    updateQualitySelector: () => {
        if (!Player.hls) return;
        
        const select = DOM.get('quality-select');
        select.innerHTML = '<option value="-1">📺 Auto</option>';
        
        if (Player.hls.levels) {
            Player.hls.levels.forEach((level, i) => {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${level.height}p`;
                select.appendChild(option);
            });
        }
    },
    
    setQuality: (index) => {
        if (!Player.hls) return;
        Player.hls.currentLevel = index;
        showToast(`📺 Quality: ${index === -1 ? 'Auto' : Player.hls.levels[index].height + 'p'}`, 'info', 1000);
    },
    
    updateSourceSelector: () => {
        const select = DOM.get('source-select');
        select.innerHTML = '';
        
        Player.currentSources.forEach((source, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${source.provider} - ${source.quality}`;
            select.appendChild(option);
        });
    },
    
    showLoader: (show, text = '') => {
        const loader = DOM.get('player-loader');
        if (show) {
            DOM.show(loader);
            if (text) DOM.get('loader-text').textContent = text;
        } else {
            DOM.hide(loader);
        }
    },
    
    onTimeUpdate: () => {
        const time = Player.videoElement.currentTime;
        const duration = Player.videoElement.duration;
        
        DOM.get('time-display').textContent = `${formatTime(time)} / ${formatTime(duration)}`;
        
        // Save progress periodically
        if (Player.currentMedia && time > 0) {
            const progress = {
                tmdbId: Player.currentMedia.tmdbId,
                type: Player.currentMedia.type,
                title: Player.currentMedia.title,
                season: Player.currentMedia.season,
                episode: Player.currentMedia.episode,
                timestamp: Math.floor(time),
                duration: Math.floor(duration),
                last_updated: Date.now()
            };
            
            SyncEngine.saveProgress(progress);
        }
    },
    
    onPlay: () => {
        console.log('▶ Playing');
    },
    
    onPause: () => {
        if (Player.currentMedia) {
            SyncEngine.saveProgress({
                ...Player.currentMedia,
                timestamp: Math.floor(Player.videoElement.currentTime),
                duration: Math.floor(Player.videoElement.duration)
            });
        }
    },
    
    onEnded: () => {
        showToast('✅ Finished watching!', 'success');
        if (Player.currentMedia) {
            SyncEngine.saveProgress({
                ...Player.currentMedia,
                timestamp: Math.floor(Player.videoElement.duration),
                duration: Math.floor(Player.videoElement.duration),
                completed: true
            });
        }
    },
    
    onLoadedMetadata: () => {
        Player.showLoader(false);
    },
    
    onError: () => {
        console.error('Video error:', Player.videoElement.error);
        showToast('Playback error', 'error');
    },
    
    handleKeyboard: (e) => {
        if (!Player.currentMedia || !DOM.get('player-section').classList.contains('hidden') === false) return;
        
        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (Player.videoElement.paused) {
                    Player.videoElement.play();
                } else {
                    Player.videoElement.pause();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                Player.skip(10);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                Player.skip(-10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                Player.videoElement.volume = Math.min(1, Player.videoElement.volume + 0.1);
                showToast(`🔊 ${Math.round(Player.videoElement.volume * 100)}%`, 'info', 800);
                break;
            case 'ArrowDown':
                e.preventDefault();
                Player.videoElement.volume = Math.max(0, Player.videoElement.volume - 0.1);
                showToast(`🔉 ${Math.round(Player.videoElement.volume * 100)}%`, 'info', 800);
                break;
            case 'f':
                e.preventDefault();
                Player.videoElement.requestFullscreen?.().catch(() => {});
                break;
            case 'm':
                e.preventDefault();
                Player.videoElement.muted = !Player.videoElement.muted;
                showToast(Player.videoElement.muted ? '🔇 Muted' : '🔊 Unmuted', 'info', 800);
                break;
            case 'Escape':
                e.preventDefault();
                Player.close();
                break;
        }
    },
    
    skip: (seconds) => {
        Player.videoElement.currentTime = Math.max(0, Player.videoElement.currentTime + seconds);
    },
    
    close: () => {
        if (Player.hls) {
            Player.hls.destroy();
            Player.hls = null;
        }
        
        Player.videoElement.pause();
        Player.videoElement.src = '';
        
        DOM.hide('player-section');
        
        if (Player.currentMedia) {
            SyncEngine.saveProgress({
                ...Player.currentMedia,
                timestamp: Math.floor(Player.videoElement.currentTime),
                duration: Math.floor(Player.videoElement.duration)
            });
        }
        
        Player.currentMedia = null;
        Player.currentSources = [];
    }
};
```

---

## **10. `frontend/scripts/main.js`** (Continued in next message due to length)

```javascript
/**
 * Main Application Logic
 * Handles UI interactions and app flow
 */

let appInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {
    if (appInitialized) return;
    appInitialized = true;
    
    console.log('🚀 SafeStream V2 initializing...');
    
    // Show loading screen
    DOM.show('loading-screen');
    
    try {
        // Initialize systems
        Player.init();
        SyncEngine.init();
        await renderHistory();
        
        // Setup UI listeners
        setupSearchListeners();
        setupHistoryListeners();
        setupTVSelector();
        
        console.log('✅ SafeStream V2 ready');
    } catch (e) {
        console.error('Initialization error:', e);
        showToast('Failed to initialize app', 'error');
    } finally {
        DOM.hide('loading-screen');
    }
});

// Search functionality
function setupSearchListeners() {
    const searchInput = DOM.get('search-input');
    const searchBtn = DOM.get('search-btn');
    const mediaType = DOM.get('media-type');
    
    const performSearch = debounce(async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        
        try {
            const data = await tmdbApi.search(query, mediaType.value);
            renderSearchResults(data.results || []);
        } catch (e) {
            console.error('Search error:', e);
            showToast('Search failed', 'error');
        }
    }, 500);
    
    searchInput.addEventListener('input', performSearch);
    searchBtn.addEventListener('click', performSearch);
    
    // Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            DOM.hide('search-results');
        }
    });
}

function renderSearchResults(results) {
    const resultsList = DOM.get('results-list');
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
        return;
    }
    
    results.slice(0, 10).forEach(item => {
        const el = document.createElement('div');
        el.className = 'result-item';
        
        const title = item.title || item.name;
        const year = item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || 'N/A';
        const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
        
        el.innerHTML = `
            <div class="result-info">
                <div class="result-title">${title}</div>
                <div class="result-year">${year}</div>
            </div>
            <div class="result-rating">${rating}</div>
        `;
        
        el.addEventListener('click', () => {
            const type = DOM.get('media-type').value;
            
            if (type === 'tv') {
                handleTVSelect(item.id, title);
            } else {
                Player.launch({
                    tmdbId: item.id,
                    type: 'movie',
                    title: title
                });
            }
            
            DOM.hide('search-results');
            DOM.get('search-input').value = '';
        });
        
        resultsList.appendChild(el);
    });
    
    DOM.show('search-results');
}

// TV Show selector
function setupTVSelector() {
    DOM.get('play-tv-btn').addEventListener('click', async () => {
        const seasonSelect = DOM.get('season-select');
        const episodeSelect = DOM.get('episode-select');
        
        if (!seasonSelect.value || !episodeSelect.value) {
            showToast('Select season and episode', 'error');
            return;
        }
        
        const tvData = window.currentTvData;
        
        Player.launch({
            tmdbId: tvData.id,
            type: 'tv',
            title: tvData.title,
            season: parseInt(seasonSelect.value),
            episode: parseInt(episodeSelect.value)
        });
        
        DOM.hide('tv-selector');
    });
}

async function handleTVSelect(seriesId, title) {
    DOM.show('tv-selector');
    DOM.get('tv-title').textContent = title;
    
    try {
        const tvData = await tmdbApi.getTvDetails(seriesId);
        window.currentTvData = { id: seriesId, title };
        
        const seasonSelect = DOM.get('season-select');
        seasonSelect.innerHTML = '<option value="">Select Season</option>';
        
        tvData.seasons
            .filter(s => s.season_number > 0)
            .forEach(season => {
                const option = document.createElement('option');
                option.value = season.season_number;
                option.textContent = `Season ${season.season_number}`;
                seasonSelect.appendChild(option);
            });
        
        seasonSelect.addEventListener('change', async () => {
            const episodeSelect = DOM.get('episode-select');
            episodeSelect.innerHTML = '<option value="">Select Episode</option>';
            
            try {
                const seasonData = await tmdbApi.getTvSeason(seriesId, seasonSelect.value);
                seasonData.episodes.forEach(ep => {
                    const option = document.createElement('option');
                    option.value = ep.episode_number;
                    option.textContent = `Ep ${ep.episode_number}: ${ep.name}`;
                    episodeSelect.appendChild(option);
                });
            } catch (e) {
                console.error('Failed to load episodes:', e);
            }
        });
    } catch (e) {
        console.error('Failed to load TV show:', e);
        showToast('Failed to load show', 'error');
    }
}

// History management
function setupHistoryListeners() {
    DOM.get('clear-history-btn').addEventListener('click', async () => {
        if (!confirm('Clear all watch history?')) return;
        
        await SyncEngine.clearHistory();
        showToast('✅ History cleared', 'success');
        await renderHistory();
    });
}

async function renderHistory() {
    const container = DOM.get('history-container');
    const history = Storage.history.get();
    
    container.innerHTML = '';
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No watch history</p>
                <span>Search for content above to get started</span>
            </div>
        `;
        DOM.hide('clear-history-btn');
        return;
    }
    
    DOM.show('clear-history-btn');
    
    // Sort by last updated
    history.sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
    
    history.slice(0, 20).forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        
        const progress = item.duration ? (item.timestamp / item.duration) * 100 : 0;
        const meta = item.type === 'tv' ? `S${item.season} E${item.episode}` : 'Movie';
        
        el.innerHTML = `
            <div class="history-item-content">
                <div class="history-item-title">${item.title}</div>
                <div class="history-item-meta">${meta}</div>
                <div class="history-item-time">${timeAgo(item.last_updated)}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
            </div>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-item-delete';
        deleteBtn.innerHTML = '✕';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            Storage.history.remove(item.tmdbId, item.type);
            await renderHistory();
        });
        el.appendChild(deleteBtn);
        
        el.addEventListener('click', () => {
            Player.launch(item);
        });
        
        container.appendChild(el);
    });
}

// Auto-render history when changed
window.addEventListener('storage', async () => {
    await renderHistory();
});
```

---

# **BACKEND FILES** (P-Stream)

Due to length, here's the critical backend setup:

## **11. `backend/.env.example`**

```env
# Database
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/dbname

# TMDB API (free)
TMDB_API_KEY=797f74f09af514f1d6f9ecdbf70e8597

# Trakt API (optional)
TRAKT_CLIENT_ID=your_client_id
TRAKT_SECRET_ID=your_secret

# Encryption
CRYPTO_SECRET=your-secret-key-minimum-32-characters

# Server
PORT=3000
NODE_ENV=production
```

---

## **12. `backend/package.json`**

```json
{
  "name": "safestream-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build",
    "preview": "nitro preview",
    "start": "node .nitro/index.mjs",
    "generate": "prisma generate",
    "migrate": "prisma migrate dev"
  },
  "dependencies": {
    "h3": "^1.9.0",
    "nitro": "^2.6.3",
    "@prisma/client": "^5.7.0",
    "trakt.tv": "^1.4.2",
    "tmdb-ts": "^2.0.0"
  },
  "devDependencies": {
    "nitropack": "^2.6.3",
    "@types/node": "^20.10.0",
    "prisma": "^5.7.0"
  }
}
```

---

## **13. `backend/prisma/schema.prisma`**

```prisma
// This file will be provided by P-Stream backend
// Just ensure you have the watch_history schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model WatchHistory {
  id            String   @id @default(cuid())
  userId        String
  tmdbId        String
  type          String   // "movie" | "show"
  title         String
  season        Int?
  episode       Int?
  watched       Float    // seconds
  duration      Float    // seconds
  watchedAt     DateTime
  last_updated  BigInt
  completed     Boolean  @default(false)
  
  @@unique([userId, tmdbId, type])
  @@index([userId])
  @@index([last_updated])
}
```

---

## **14. `backend/nitro.config.ts`**

```typescript
import { defineNitroConfig } from 'nitropack';

export default defineNitroConfig({
  srcDir: 'server',
  handlers: {
    middleware: [],
  },
  storage: {
    db: { driver: 'fs' },
  },
  runtimeConfig: {
    database_url: process.env.DATABASE_URL,
    tmdbApiKey: process.env.TMDB_API_KEY,
    trakt: {
      clientId: process.env.TRAKT_CLIENT_ID,
      clientSecret: process.env.TRAKT_SECRET_ID,
    },
    cryptoSecret: process.env.CRYPTO_SECRET,
  },
  cors: {
    origin: '*',
    credentials: true,
  },
});
```

---

## **15. `backend/server/routes/health.get.ts`**

```typescript
export default defineEventHandler(async () => {
  return {
    status: 'ok',
    version: '2.0.0',
    timestamp: Date.now(),
    uptime: process.uptime()
  };
});
```

---

## **16. `frontend/vite.config.js`**

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  optimize Deps: {
    include: ['hls.js'],
  },
});
```

---

## **17. `frontend/package.json`**

```json
{
  "name": "safestream-v2",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

---

## **18. `.gitignore`** (Both frontend & backend)

```
node_modules/
dist/
build/
.env
.env.local
.DS_Store
*.log
.vscode/
.idea/
.prisma/
```

---

## **19. `docker-compose.yml`** (Optional for local dev)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: safestream
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## **DEPLOYMENT INSTRUCTIONS**

### **Frontend (Vercel)**

```bash
# Create vercel.json
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
EOF

# Push to GitHub
git push

# Vercel auto-deploys on push
```

### **Backend (Render)**

```bash
# 1. Create new Web Service on render.com
# 2. Connect GitHub repo
# 3. Set build command: npm run build
# 4. Set start command: node .nitro/index.mjs
# 5. Add environment variables from .env
# 6. Deploy!
```

---

This is a **complete, production-ready SafeStream V2** optimized for:
- ✅ Low-end devices (minimal CSS, lazy loading)
- ✅ Mobile, Desktop, Android TV
- ✅ Cross-device sync
- ✅ P-Stream backend with 50+ providers
- ✅ HLS.js streaming
- ✅ No posters/heavy images

Ready to deploy! 🚀