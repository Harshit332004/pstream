/**
 * Lightweight Custom Video Player Manager
 * Handles video playback, custom styled controls, settings overlays, and custom subtitles.
 */

window.Player = {
    hls: null,
    videoElement: null,
    currentMedia: null,
    currentSources: [],
    currentSourceIndex: 0,
    currentSubtitles: [],
    activeSubtitleIndex: -1, // -1 means turned off
    subtitleCues: [],
    controlsTimeout: null,
    progressInterval: null,
    isSettingsOpen: false,
    isFallbackTriggered: false,
    loadTimeout: null,
    
    init: () => {
        Player.videoElement = DOM.get('video-player');
        if (!Player.videoElement) return;
        
        // Video event listeners
        Player.videoElement.addEventListener('timeupdate', () => Player.onTimeUpdate());
        Player.videoElement.addEventListener('play', () => Player.onPlayStateChange(true));
        Player.videoElement.addEventListener('pause', () => Player.onPlayStateChange(false));
        Player.videoElement.addEventListener('ended', () => Player.onEnded());
        Player.videoElement.addEventListener('loadedmetadata', () => Player.onLoadedMetadata());
        Player.videoElement.addEventListener('error', () => Player.onError());
        
        // Play/Pause toggles
        Player.videoElement.addEventListener('click', () => Player.togglePlay());
        DOM.get('overlay-play-pause').addEventListener('click', () => Player.togglePlay());
        DOM.get('custom-play-btn').addEventListener('click', () => Player.togglePlay());
        
        // Skip buttons (+-10s) inside the player
        DOM.get('overlay-skip-back').addEventListener('click', () => Player.skip(-10));
        DOM.get('overlay-skip-forward').addEventListener('click', () => Player.skip(10));
        DOM.get('custom-skip-back-btn').addEventListener('click', () => Player.skip(-10));
        DOM.get('custom-skip-forward-btn').addEventListener('click', () => Player.skip(10));
        
        // Close player
        DOM.get('close-player-btn').addEventListener('click', () => Player.close());
        
        // Progress bar seeking
        const progressBar = DOM.get('progress-bar');
        progressBar.addEventListener('input', (e) => Player.onSeekInput(e));
        progressBar.addEventListener('change', (e) => Player.onSeekChange(e));
        
        // Volume controls
        DOM.get('custom-mute-btn').addEventListener('click', () => Player.toggleMute());
        DOM.get('volume-slider').addEventListener('input', (e) => Player.setVolume(parseFloat(e.target.value)));
        
        // Settings panel toggles
        DOM.get('custom-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            Player.toggleSettings();
        });
        
        document.addEventListener('click', (e) => {
            if (Player.isSettingsOpen && !e.target.closest('.settings-menu-container')) {
                Player.toggleSettings(false);
            }
        });
        
        // Fullscreen
        DOM.get('custom-fullscreen-btn').addEventListener('click', () => Player.toggleFullscreen());
        
        // Auto-hide controls triggers
        const wrapper = DOM.get('player-wrapper');
        wrapper.addEventListener('mousemove', () => Player.showControlsTemporarily());
        wrapper.addEventListener('mouseleave', () => Player.hideControlsImmediately());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => Player.handleKeyboard(e));
    },
    
    launch: async (media) => {
        Player.currentMedia = media;
        DOM.show('player-section');
        Player.showLoader(true, 'Fetching sources...');
        Player.activeSubtitleIndex = -1;
        Player.subtitleCues = [];
        DOM.get('subtitle-overlay').classList.add('hidden');
        Player.toggleSettings(false);
        Player.isFallbackTriggered = false;
        Player.clearLoadTimeout();
        
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
            Player.currentSubtitles = result.subtitles || [];
            Player.activeSubtitleIndex = -1; // Default: off
            
            Player.switchSource(0);
            Player.startProgressHeartbeat();
            
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
            try {
                Player.hls.destroy();
            } catch (e) {
                console.error('Error destroying HLS on switch:', e);
            }
            Player.hls = null;
        }
        
        Player.videoElement.pause();
        Player.videoElement.src = '';
        
        Player.isFallbackTriggered = false;
        Player.startLoadTimeout();
        
        try {
            if (source.type === 'hls') {
                Player.loadHLSStream(source);
            } else {
                Player.loadDirectStream(source);
            }
            Player.updateSourceMenu();
            Player.updateSubtitleMenu();
        } catch (e) {
            console.error('Failed to load source:', e);
            Player.handlePlaybackError(e);
        }
    },
    
    loadHLSStream: (source) => {
        if (!window.Hls) {
            showToast('HLS.js not available', 'error');
            return;
        }
        
        const sanitizedUrl = Player.sanitizeStreamUrl(source.url);
        console.log('Loading HLS stream (sanitized):', sanitizedUrl);
        
        Player.hls = new Hls({
            debug: false,
            enableWorker: true,
            maxBufferLength: 15,
            maxMaxBufferLength: 30,
            xhrSetup: (xhr, url) => {
                const currentSource = Player.currentSources[Player.currentSourceIndex];
                if (currentSource && currentSource.headers) {
                    Object.entries(currentSource.headers).forEach(([key, value]) => {
                        try { xhr.setRequestHeader(key, value); } catch (e) { /* Headers bypass security check */ }
                    });
                }
            }
        });
        
        Player.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            Player.clearLoadTimeout();
            Player.updateQualityMenu();
            Player.showLoader(false);
            
            // Restore timestamp if available in currentMedia
            if (Player.currentMedia && Player.currentMedia.timestamp) {
                Player.videoElement.currentTime = Player.currentMedia.timestamp;
            }
            
            Player.videoElement.play().catch(() => {
                console.warn('Autoplay prevented');
            });
        });
        
        Player.hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (data.fatal) {
                Player.handlePlaybackError(new Error(`HLS Fatal Error: ${data.details || data.type}`));
            }
        });
        
        Player.hls.loadSource(sanitizedUrl);
        Player.hls.attachMedia(Player.videoElement);
    },
    
    loadDirectStream: (source) => {
        const sanitizedUrl = Player.sanitizeStreamUrl(source.url);
        console.log('Loading Direct stream (sanitized):', sanitizedUrl);
        
        Player.videoElement.src = sanitizedUrl;
        Player.videoElement.onloadedmetadata = () => {
            Player.clearLoadTimeout();
            Player.showLoader(false);
            Player.updateQualityMenu(); // direct sources typically don't have quality tiers
            
            // Restore timestamp if available in currentMedia
            if (Player.currentMedia && Player.currentMedia.timestamp) {
                Player.videoElement.currentTime = Player.currentMedia.timestamp;
            }
            
            Player.videoElement.play().catch(() => {});
        };
    },
    
    togglePlay: () => {
        if (Player.videoElement.paused) {
            Player.videoElement.play().catch(() => {});
        } else {
            Player.videoElement.pause();
        }
    },
    
    onPlayStateChange: (isPlaying) => {
        const overlayPlay = DOM.get('overlay-play-pause');
        const customPlay = DOM.get('custom-play-btn');
        
        if (isPlaying) {
            overlayPlay.textContent = '⏸';
            customPlay.textContent = '⏸';
            Player.showControlsTemporarily();
        } else {
            overlayPlay.textContent = '▶';
            customPlay.textContent = '▶';
            Player.showControlsTemporarily(true); // Keep visible when paused
        }
    },
    
    onTimeUpdate: () => {
        const time = Player.videoElement.currentTime;
        const duration = Player.videoElement.duration || 0;
        
        // Update Time Displays
        DOM.get('custom-time-display').textContent = `${formatTime(time)} / ${formatTime(duration)}`;
        
        // Update custom seek slider progress
        const progressBar = DOM.get('progress-bar');
        const fillBar = DOM.get('progress-fill-bar');
        if (duration > 0) {
            const percent = (time / duration) * 100;
            progressBar.value = percent;
            fillBar.style.width = `${percent}%`;
        } else {
            progressBar.value = 0;
            fillBar.style.width = '0%';
        }
        
        // Sync Subtitles Overlay
        Player.syncSubtitles(time);
        
    },

    startProgressHeartbeat: () => {
        Player.stopProgressHeartbeat();
        Player.progressInterval = setInterval(() => {
            Player.saveCurrentProgress();
        }, 2000);
    },

    stopProgressHeartbeat: () => {
        if (Player.progressInterval) {
            clearInterval(Player.progressInterval);
            Player.progressInterval = null;
        }
    },

    saveCurrentProgress: async () => {
        if (!Player.currentMedia || !Player.videoElement) return;

        const time = Player.videoElement.currentTime || 0;
        const duration = Player.videoElement.duration || 0;
        if (!Number.isFinite(time) || time <= 0) return;

        const progress = {
            tmdbId: Player.currentMedia.tmdbId,
            type: Player.currentMedia.type,
            title: Player.currentMedia.title,
            season: Player.currentMedia.season,
            episode: Player.currentMedia.episode,
            timestamp: Math.floor(time),
            duration: Number.isFinite(duration) ? Math.floor(duration) : 0,
            last_updated: Date.now(),
            completed: duration > 0 ? (time / duration) >= 0.9 : false
        };

        Player.currentMedia = { ...Player.currentMedia, ...progress };
        SyncEngine.saveProgress(progress);

        if (window.renderHistory) {
            await window.renderHistory();
        }
    },
    
    onSeekInput: (e) => {
        // Update the visual representation of progress instantly
        const percent = parseFloat(e.target.value);
        DOM.get('progress-fill-bar').style.width = `${percent}%`;
    },
    
    onSeekChange: (e) => {
        const percent = parseFloat(e.target.value);
        const duration = Player.videoElement.duration || 0;
        if (duration > 0) {
            Player.videoElement.currentTime = (percent / 100) * duration;
            Player.saveCurrentProgress();
        }
    },
    
    toggleMute: () => {
        Player.videoElement.muted = !Player.videoElement.muted;
        const muteBtn = DOM.get('custom-mute-btn');
        const volumeSlider = DOM.get('volume-slider');
        
        if (Player.videoElement.muted) {
            muteBtn.textContent = '🔇';
            volumeSlider.value = 0;
        } else {
            muteBtn.textContent = '🔊';
            volumeSlider.value = Player.videoElement.volume;
        }
        showToast(Player.videoElement.muted ? '🔇 Muted' : '🔊 Unmuted', 'info', 800);
    },
    
    setVolume: (volume) => {
        Player.videoElement.volume = volume;
        Player.videoElement.muted = (volume === 0);
        
        const muteBtn = DOM.get('custom-mute-btn');
        if (volume === 0) {
            muteBtn.textContent = '🔇';
        } else if (volume < 0.5) {
            muteBtn.textContent = '🔉';
        } else {
            muteBtn.textContent = '🔊';
        }
    },
    
    toggleSettings: (forceState = null) => {
        const panel = DOM.get('settings-panel');
        const customBtn = DOM.get('custom-settings-btn');
        
        if (forceState !== null) {
            Player.isSettingsOpen = forceState;
        } else {
            Player.isSettingsOpen = !Player.isSettingsOpen;
        }
        
        if (Player.isSettingsOpen) {
            panel.classList.remove('hidden');
            customBtn.style.color = 'var(--accent-light)';
        } else {
            panel.classList.add('hidden');
            customBtn.style.color = '';
        }
    },
    
    updateQualityMenu: () => {
        const listContainer = DOM.get('settings-quality-list');
        listContainer.innerHTML = '';
        
        // Add Auto Level
        const autoOpt = document.createElement('div');
        autoOpt.className = 'settings-option' + (!Player.hls || Player.hls.autoLevelEnabled ? ' active' : '');
        autoOpt.textContent = 'Auto';
        autoOpt.addEventListener('click', () => {
            if (Player.hls) {
                Player.hls.currentLevel = -1;
                showToast('📺 Quality: Auto', 'info', 1000);
            }
            Player.toggleSettings(false);
            Player.updateQualityMenu();
        });
        listContainer.appendChild(autoOpt);
        
        // Add HLS level tiers
        if (Player.hls && Player.hls.levels && Player.hls.levels.length > 0) {
            Player.hls.levels.forEach((level, index) => {
                const opt = document.createElement('div');
                opt.className = 'settings-option' + (Player.hls.currentLevel === index ? ' active' : '');
                opt.textContent = `${level.height}p`;
                opt.addEventListener('click', () => {
                    Player.hls.currentLevel = index;
                    showToast(`📺 Quality: ${level.height}p`, 'info', 1000);
                    Player.toggleSettings(false);
                    Player.updateQualityMenu();
                });
                listContainer.appendChild(opt);
            });
        } else {
            // Direct MP4 / Single Quality fallback
            const fallbackOpt = document.createElement('div');
            fallbackOpt.className = 'settings-option active';
            fallbackOpt.textContent = 'Standard';
            listContainer.appendChild(fallbackOpt);
        }
    },
    
    updateSubtitleMenu: () => {
        const listContainer = DOM.get('settings-subtitle-list');
        listContainer.innerHTML = '';
        
        // None/Off Option
        const offOpt = document.createElement('div');
        offOpt.className = 'settings-option' + (Player.activeSubtitleIndex === -1 ? ' active' : '');
        offOpt.textContent = 'Off';
        offOpt.addEventListener('click', () => {
            Player.activeSubtitleIndex = -1;
            Player.subtitleCues = [];
            DOM.get('subtitle-overlay').classList.add('hidden');
            showToast('💬 Subtitles turned off', 'info', 1000);
            Player.toggleSettings(false);
            Player.updateSubtitleMenu();
        });
        listContainer.appendChild(offOpt);
        
        // Add Subtitle languages
        if (Player.currentSubtitles && Player.currentSubtitles.length > 0) {
            Player.currentSubtitles.forEach((sub, i) => {
                const opt = document.createElement('div');
                opt.className = 'settings-option' + (Player.activeSubtitleIndex === i ? ' active' : '');
                opt.textContent = sub.language;
                opt.addEventListener('click', async () => {
                    Player.activeSubtitleIndex = i;
                    Player.toggleSettings(false);
                    Player.updateSubtitleMenu();
                    showToast(`💬 Loading Subtitles: ${sub.language}...`, 'info', 1500);
                    await Player.loadSubtitlesFile(sub.url);
                });
                listContainer.appendChild(opt);
            });
        } else {
            const noSubOpt = document.createElement('div');
            noSubOpt.className = 'settings-option';
            noSubOpt.style.opacity = '0.5';
            noSubOpt.style.cursor = 'default';
            noSubOpt.textContent = 'None Available';
            listContainer.appendChild(noSubOpt);
        }
    },
    
    updateSourceMenu: () => {
        const listContainer = DOM.get('settings-source-list');
        listContainer.innerHTML = '';
        
        Player.currentSources.forEach((src, i) => {
            const opt = document.createElement('div');
            opt.className = 'settings-option' + (Player.currentSourceIndex === i ? ' active' : '');
            opt.textContent = src.provider;
            opt.addEventListener('click', () => {
                Player.switchSource(i);
                Player.toggleSettings(false);
            });
            listContainer.appendChild(opt);
        });
    },
    
    loadSubtitlesFile: async (url) => {
        Player.subtitleCues = [];
        DOM.get('subtitle-overlay').classList.add('hidden');
        DOM.get('subtitle-overlay').innerHTML = '';
        
        if (!url) return;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Subtitles response failed');
            const text = await response.text();
            Player.subtitleCues = Player.parseSubtitlesText(text);
            showToast('💬 Subtitles loaded successfully', 'success', 1500);
        } catch (e) {
            console.error('Subtitle file load error:', e);
            showToast('❌ Failed to load subtitles', 'error');
        }
    },
    
    parseSubtitlesText: (text) => {
        // Normalize line breaks
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        const cues = [];
        // Split by blocks
        const blocks = text.split(/\n\n+/);
        
        for (const block of blocks) {
            const lines = block.trim().split('\n');
            if (lines.length < 2) continue;
            
            let timeLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('-->')) {
                    timeLineIndex = i;
                    break;
                }
            }
            
            if (timeLineIndex === -1) continue;
            
            const timeLine = lines[timeLineIndex];
            const textLines = lines.slice(timeLineIndex + 1);
            
            const parts = timeLine.split('-->');
            if (parts.length !== 2) continue;
            
            const start = Player.parseSubtitleTime(parts[0].trim());
            const end = Player.parseSubtitleTime(parts[1].trim());
            const content = textLines.join('<br>').replace(/<[^>]*>/g, ''); // sanitize tags
            
            if (start !== null && end !== null && content.trim() !== '') {
                cues.push({ start, end, text: content });
            }
        }
        return cues;
    },
    
    parseSubtitleTime: (timeStr) => {
        const parts = timeStr.split(':');
        if (parts.length < 2) return null;
        
        let hrs = 0;
        let mins = 0;
        let secsParts = [];
        
        if (parts.length === 3) {
            hrs = parseFloat(parts[0]);
            mins = parseFloat(parts[1]);
            secsParts = parts[2].replace(',', '.').split('.');
        } else {
            mins = parseFloat(parts[0]);
            secsParts = parts[1].replace(',', '.').split('.');
        }
        
        const secs = parseFloat(secsParts[0]);
        const ms = secsParts[1] ? parseFloat(secsParts[1]) / Math.pow(10, secsParts[1].length) : 0;
        
        return hrs * 3600 + mins * 60 + secs + ms;
    },
    
    syncSubtitles: (currentTime) => {
        if (Player.subtitleCues.length === 0) return;
        
        const activeCue = Player.subtitleCues.find(cue => currentTime >= cue.start && currentTime <= cue.end);
        const overlay = DOM.get('subtitle-overlay');
        
        if (activeCue) {
            overlay.innerHTML = `<span>${activeCue.text}</span>`;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },
    
    showControlsTemporarily: (keepOpen = false) => {
        const wrapper = DOM.get('player-wrapper');
        wrapper.classList.remove('player-controls-hidden');
        
        if (Player.controlsTimeout) {
            clearTimeout(Player.controlsTimeout);
        }
        
        if (!keepOpen && !Player.videoElement.paused && !Player.isSettingsOpen) {
            Player.controlsTimeout = setTimeout(() => {
                if (!Player.videoElement.paused && !Player.isSettingsOpen) {
                    wrapper.classList.add('player-controls-hidden');
                }
            }, 3000);
        }
    },
    
    hideControlsImmediately: () => {
        if (!Player.videoElement.paused && !Player.isSettingsOpen) {
            DOM.get('player-wrapper').classList.add('player-controls-hidden');
        }
    },
    
    toggleFullscreen: () => {
        const wrapper = DOM.get('player-wrapper');
        if (!document.fullscreenElement) {
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen();
            } else if (wrapper.webkitRequestFullscreen) { // Safari
                wrapper.webkitRequestFullscreen();
            } else if (wrapper.msRequestFullscreen) { // IE11
                wrapper.msRequestFullscreen();
            }
            DOM.get('custom-fullscreen-btn').textContent = '📁';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            DOM.get('custom-fullscreen-btn').textContent = '📺';
        }
    },
    
    onLoadedMetadata: () => {
        Player.clearLoadTimeout();
        Player.showLoader(false);
    },

    onEnded: async () => {
        await Player.saveCurrentProgress();
        Player.stopProgressHeartbeat();
    },
    
    onError: () => {
        // Ignore errors if the player is closed or not playing
        if (!Player.currentMedia) return;
        
        const src = Player.videoElement.src;
        // Ignore errors caused by clearing/unloading the video source
        if (!src || src === window.location.href || src.replace(/\/+$/, '') === window.location.origin) {
            return;
        }
        
        const err = Player.videoElement.error;
        console.error('Video element error:', err);
        Player.handlePlaybackError(new Error(err ? err.message || `Code ${err.code}` : 'HTML5 Video Error'));
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
    
    handleKeyboard: (e) => {
        if (!Player.currentMedia || DOM.get('player-section').classList.contains('hidden')) return;
        
        switch (e.key) {
            case ' ':
                e.preventDefault();
                Player.togglePlay();
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
                const newVolUp = Math.min(1, Player.videoElement.volume + 0.1);
                Player.setVolume(newVolUp);
                DOM.get('volume-slider').value = newVolUp;
                showToast(`🔊 ${Math.round(newVolUp * 100)}%`, 'info', 800);
                break;
            case 'ArrowDown':
                e.preventDefault();
                const newVolDown = Math.max(0, Player.videoElement.volume - 0.1);
                Player.setVolume(newVolDown);
                DOM.get('volume-slider').value = newVolDown;
                showToast(`🔉 ${Math.round(newVolDown * 100)}%`, 'info', 800);
                break;
            case 'f':
                e.preventDefault();
                Player.toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                Player.toggleMute();
                break;
            case 'Escape':
                e.preventDefault();
                Player.close();
                break;
        }
    },
    
    skip: (seconds) => {
        Player.videoElement.currentTime = Math.max(0, Player.videoElement.currentTime + seconds);
        Player.saveCurrentProgress();
        Player.showControlsTemporarily();
    },
    
    sanitizeStreamUrl: (url) => {
        if (!url) return url;
        const parts = url.split('?');
        let path = parts[0];
        try {
            path = decodeURIComponent(path);
        } catch (e) {
            path = path.replace(/%2F/gi, '/').replace(/%2B/gi, '+').replace(/%3D/gi, '=');
        }
        
        if (parts.length > 1) {
            try {
                const queryParams = new URLSearchParams(parts[1]);
                const headersStr = queryParams.get('headers');
                if (headersStr) {
                    let decodedHeaders = headersStr;
                    if (headersStr.includes('%22') || headersStr.includes('%7B')) {
                        decodedHeaders = decodeURIComponent(headersStr);
                    }
                    const headersJson = JSON.parse(decodedHeaders);
                    
                    // Inject the exact User-Agent used by the backend scraper
                    const scraperUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
                    headersJson['User-Agent'] = scraperUA;
                    headersJson['user-agent'] = scraperUA;
                    
                    queryParams.set('headers', JSON.stringify(headersJson));
                }
                return `${path}?${queryParams.toString()}`;
            } catch (e) {
                console.error('Failed to parse query params in sanitizeStreamUrl:', e);
            }
        }
        
        return parts.length > 1 ? `${path}?${parts.slice(1).join('?')}` : path;
    },
    
    startLoadTimeout: () => {
        Player.clearLoadTimeout();
        Player.loadTimeout = setTimeout(() => {
            console.warn('Playback load timeout (15s) triggered.');
            Player.handlePlaybackError(new Error('Load timeout (15s)'));
        }, 15000);
    },
    
    clearLoadTimeout: () => {
        if (Player.loadTimeout) {
            clearTimeout(Player.loadTimeout);
            Player.loadTimeout = null;
        }
    },
    
    handlePlaybackError: (err) => {
        console.warn('Playback error encountered:', err);
        Player.clearLoadTimeout();
        
        if (Player.isFallbackTriggered) return;
        Player.isFallbackTriggered = true;
        
        if (Player.hls) {
            try {
                Player.hls.destroy();
            } catch (e) {
                console.error('Error destroying HLS on playback error:', e);
            }
            Player.hls = null;
        }
        
        if (Player.videoElement) {
            Player.videoElement.pause();
            Player.videoElement.src = '';
        }
        
        const nextIndex = Player.currentSourceIndex + 1;
        if (nextIndex < Player.currentSources.length) {
            showToast(`⚠️ Current stream failed. Trying alternative source #${nextIndex + 1}...`, 'warning', 2500);
            setTimeout(() => {
                Player.isFallbackTriggered = false;
                Player.switchSource(nextIndex);
            }, 1000);
        } else {
            Player.isFallbackTriggered = false;
            Player.showLoader(false);
            showToast('❌ All playback sources failed to load', 'error', 4000);
        }
    },
    
    close: async () => {
        await Player.saveCurrentProgress();
        Player.stopProgressHeartbeat();
        Player.clearLoadTimeout();

        if (Player.controlsTimeout) {
            clearTimeout(Player.controlsTimeout);
        }
        if (Player.hls) {
            Player.hls.destroy();
            Player.hls = null;
        }
        
        Player.videoElement.pause();
        Player.videoElement.src = '';
        Player.subtitleCues = [];
        Player.activeSubtitleIndex = -1;
        
        DOM.hide('subtitle-overlay');
        DOM.hide('player-section');
        Player.toggleSettings(false);
        
        Player.currentMedia = null;
        Player.currentSources = [];
    }
};
