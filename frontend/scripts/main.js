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
        
        // Listen for remote sync events
        window.addEventListener('sync_completed', async () => {
            await renderHistory();
        });
        
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
    
    // Disable play button while loading
    DOM.get('play-tv-btn').disabled = true;
    
    try {
        const tvData = await tmdbApi.getTvDetails(seriesId);
        window.currentTvData = { id: seriesId, title };
        
        const seasonSelect = DOM.get('season-select');
        seasonSelect.innerHTML = '<option value="">Select Season</option>';
        
        const episodeSelect = DOM.get('episode-select');
        episodeSelect.innerHTML = '<option value="">Select Episode</option>';
        
        tvData.seasons
            .filter(s => s.season_number > 0)
            .forEach(season => {
                const option = document.createElement('option');
                option.value = season.season_number;
                option.textContent = `Season ${season.season_number}`;
                seasonSelect.appendChild(option);
            });
        
        seasonSelect.addEventListener('change', async () => {
            episodeSelect.innerHTML = '<option value="">Select Episode</option>';
            DOM.get('play-tv-btn').disabled = true;
            
            if (!seasonSelect.value) return;
            
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
        
        episodeSelect.addEventListener('change', () => {
            DOM.get('play-tv-btn').disabled = !episodeSelect.value;
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
        const mediaMeta = item.type === 'tv' ? `S${item.season} E${item.episode}` : 'Movie';
        const watchedMeta = item.duration
            ? `${formatTime(item.timestamp || 0)} / ${formatTime(item.duration || 0)}`
            : formatTime(item.timestamp || 0);
        const meta = `${mediaMeta} - ${watchedMeta}`;
        
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
            Storage.history.remove(item.tmdbId, item.type, item.season, item.episode);
            await renderHistory();
        });
        el.appendChild(deleteBtn);
        
        el.addEventListener('click', () => {
            Player.launch(item);
        });
        
        container.appendChild(el);
    });
}

// Auto-render history when changed via standard storage events
window.addEventListener('storage', async () => {
    await renderHistory();
});

window.renderHistory = renderHistory;
