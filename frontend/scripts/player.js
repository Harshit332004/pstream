/**
 * Lightweight Custom Video Player Manager
 * Handles video playback, custom styled controls, settings overlays, and custom subtitles.
 */

// ─── SVG Icon Constants ─────────────────────────────────────────────────────
const Icons = {
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    skipBack: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="16" font-size="7" font-weight="bold" text-anchor="middle" fill="currentColor">10</text></svg>`,
    skipForward: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="14" y="16" font-size="7" font-weight="bold" text-anchor="middle" fill="currentColor">10</text></svg>`,
    volumeHigh: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
    volumeLow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    fullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
    fullscreenExit: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
};

window.Player = {
    hls: null,
    videoElement: null,
    currentMedia: null,
    currentSources: [],       // Currently active source per provider (one entry per provider)
    allQualities: [],         // ALL quality variants from all providers
    currentSourceIndex: 0,
    currentQualityIndex: 0,   // Index into allQualities for the active quality
    currentSubtitles: [],
    activeSubtitleIndex: -1,
    subtitleCues: [],
    controlsTimeout: null,
    progressInterval: null,
    isSettingsOpen: false,
    isHUDVisible: true,
    isFallbackTriggered: false,
    loadTimeout: null,
    currentSpeed: 1.0,
    
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
        
        // Click on blank area (the transparent overlay) = toggle HUD
        // The overlay sits above the video (z-index 1) but below all buttons (z-index 8-9).
        // When HUD is hidden, center controls have pointer-events:none so clicks land here.
        // When HUD is visible, clicking around the buttons lands here too.
        DOM.get('video-click-overlay').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Player.toggleHUD();
        });

        // Center overlay play/pause toggles playback
        DOM.get('overlay-play-pause').addEventListener('click', (e) => {
            e.stopPropagation();
            Player.togglePlay();
        });

        // Bottom bar play button toggles playback
        DOM.get('custom-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            Player.togglePlay();
        });
        
        // Skip buttons
        DOM.get('overlay-skip-back').addEventListener('click', (e) => { e.stopPropagation(); Player.skip(-10); });
        DOM.get('overlay-skip-forward').addEventListener('click', (e) => { e.stopPropagation(); Player.skip(10); });
        DOM.get('custom-skip-back-btn').addEventListener('click', (e) => { e.stopPropagation(); Player.skip(-10); });
        DOM.get('custom-skip-forward-btn').addEventListener('click', (e) => { e.stopPropagation(); Player.skip(10); });
        
        // Close player
        DOM.get('close-player-btn').addEventListener('click', () => Player.close());
        
        // Progress bar seeking
        const progressBar = DOM.get('progress-bar');
        progressBar.addEventListener('input', (e) => Player.onSeekInput(e));
        progressBar.addEventListener('change', (e) => Player.onSeekChange(e));
        
        // Volume controls
        DOM.get('custom-mute-btn').addEventListener('click', (e) => { e.stopPropagation(); Player.toggleMute(); });
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
        DOM.get('custom-fullscreen-btn').addEventListener('click', (e) => { e.stopPropagation(); Player.toggleFullscreen(); });
        
        // Auto-hide controls triggers (desktop mouse only, ignore synthetic touch events)
        const wrapper = DOM.get('player-wrapper');
        let lastTouchTime = 0;
        wrapper.addEventListener('touchstart', () => { lastTouchTime = Date.now(); }, { passive: true });
        wrapper.addEventListener('mousemove', () => {
            if (Date.now() - lastTouchTime > 500) Player.showControlsTemporarily();
        });
        wrapper.addEventListener('mouseleave', () => {
            if (Date.now() - lastTouchTime > 500) Player.hideControlsImmediately();
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => Player.handleKeyboard(e));

        // Set initial SVG icons
        DOM.get('overlay-play-pause').innerHTML = Icons.play;
        DOM.get('custom-play-btn').innerHTML = Icons.play;
        DOM.get('overlay-skip-back').innerHTML = Icons.skipBack;
        DOM.get('overlay-skip-forward').innerHTML = Icons.skipForward;
        DOM.get('custom-skip-back-btn').innerHTML = Icons.skipBack;
        DOM.get('custom-skip-forward-btn').innerHTML = Icons.skipForward;
        DOM.get('custom-mute-btn').innerHTML = Icons.volumeHigh;
        DOM.get('custom-settings-btn').innerHTML = Icons.settings;
        DOM.get('custom-fullscreen-btn').innerHTML = Icons.fullscreen;
        DOM.get('close-player-btn').innerHTML = Icons.close;
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
                console.error(`[Player Error Log] Source lookup failed for TMDB ID: ${media.tmdbId}, Type: ${media.type}, Error: ${result.error || 'No sources found'}`);
                showToast('No sources found', 'error');
                Player.close();
                return;
            }
            
            // Store ALL quality variants
            Player.allQualities = result.sources;
            Player.currentSubtitles = result.subtitles || [];
            Player.activeSubtitleIndex = -1;
            Player.currentSpeed = 1.0;

            // Auto-select English subtitles
            if (Player.currentSubtitles.length > 0) {
                const englishIdx = Player.currentSubtitles.findIndex(sub => {
                    const lang = (sub.language || '').toLowerCase();
                    return lang === 'en' || lang === 'eng' || lang.includes('english');
                });
                if (englishIdx !== -1) {
                    Player.activeSubtitleIndex = englishIdx;
                }
            }
            
            // Group by provider: pick HIGHEST quality per provider as default
            const providerMap = {};
            for (const src of Player.allQualities) {
                const provName = src.provider || 'Unknown';
                if (!providerMap[provName]) {
                    providerMap[provName] = src;
                } else {
                    // Compare quality numerically
                    const existingQ = parseInt(providerMap[provName].quality) || 0;
                    const newQ = parseInt(src.quality) || 0;
                    if (newQ > existingQ) {
                        providerMap[provName] = src;
                    }
                }
            }
            Player.currentSources = Object.values(providerMap);

            // Find the index of the selected source within allQualities
            const selectedSource = Player.currentSources[0];
            Player.currentQualityIndex = Player.allQualities.findIndex(
                q => q.url === selectedSource.url
            );
            if (Player.currentQualityIndex === -1) Player.currentQualityIndex = 0;
            
            Player.switchSource(Player.currentQualityIndex);
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
        if (index < 0 || index >= Player.allQualities.length) return;
        
        Player.currentQualityIndex = index;
        const source = Player.allQualities[index];
        
        Player.showLoader(true, `Loading ${source.quality || source.provider}...`);
        
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
            Player.updateExternalSourceMenu();
            Player.updateSubtitleMenu();
            Player.updateSpeedMenu();
            Player.updateQualityMenu();
            
            // Auto-load selected subtitle
            if (Player.activeSubtitleIndex !== -1 && Player.currentSubtitles[Player.activeSubtitleIndex]) {
                const sub = Player.currentSubtitles[Player.activeSubtitleIndex];
                Player.loadSubtitlesFile(sub.url);
            }
        } catch (e) {
            console.error('Failed to load source:', e);
            Player.handlePlaybackError(e);
        }
    },

    loadHLSStream: (source) => {
        const sanitizedUrl = Player.sanitizeStreamUrl(source.url);
        console.log('Loading HLS stream:', sanitizedUrl);
        
        if (!window.Hls || !Hls.isSupported()) {
            if (Player.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                console.log('[Player] Using native HLS playback (no MSE support)');
                Player.videoElement.src = sanitizedUrl;
                const onNativeMeta = () => {
                    Player.clearLoadTimeout();
                    Player.showLoader(false);
                    if (Player.currentMedia && Player.currentMedia.timestamp) {
                        Player.videoElement.currentTime = Player.currentMedia.timestamp;
                    }
                    Player.videoElement.playbackRate = Player.currentSpeed;
                    Player.videoElement.play().catch(() => console.warn('Autoplay prevented'));
                    Player.videoElement.removeEventListener('loadedmetadata', onNativeMeta);
                };
                Player.videoElement.addEventListener('loadedmetadata', onNativeMeta);
                return;
            }
            showToast('HLS.js not available and no native HLS support', 'error');
            return;
        }
        
        Player.hls = new Hls({
            debug: false,
            enableWorker: true,
            maxBufferLength: 15,
            maxMaxBufferLength: 30,
        });
        
        Player.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            Player.clearLoadTimeout();
            
            // Auto-select highest quality level
            if (Player.hls.levels && Player.hls.levels.length > 0) {
                let highestIdx = 0;
                let maxHeight = 0;
                Player.hls.levels.forEach((level, idx) => {
                    if (level.height > maxHeight) {
                        maxHeight = level.height;
                        highestIdx = idx;
                    }
                });
                Player.hls.currentLevel = highestIdx;
                console.log(`[Player] Automatically selected highest HLS level: ${maxHeight}p`);
            }
            
            Player.showLoader(false);
            
            if (Player.currentMedia && Player.currentMedia.timestamp) {
                Player.videoElement.currentTime = Player.currentMedia.timestamp;
            }
            
            Player.videoElement.playbackRate = Player.currentSpeed;
            
            Player.videoElement.play().catch(() => {
                console.warn('Autoplay prevented');
            });
        });
        
        Player.hls.on(Hls.Events.ERROR, (event, data) => {
            const failingUrl = data.url || (data.frag && data.frag.url) || (data.networkDetails && data.networkDetails.url) || 'unknown URL';
            console.error(`[Player Error Log] Event: ${event}, Type: ${data.type}, Detail: ${data.details}, URL: ${failingUrl}, Fatal: ${data.fatal}`);
            if (data.fatal) {
                Player.handlePlaybackError(new Error(`HLS Fatal Error: [${data.details || data.type}] at ${failingUrl}`));
            }
        });
        
        Player.hls.loadSource(sanitizedUrl);
        Player.hls.attachMedia(Player.videoElement);
    },
    
    loadDirectStream: (source) => {
        const sanitizedUrl = Player.sanitizeStreamUrl(source.url);
        console.log('Loading Direct stream:', sanitizedUrl);
        
        Player.videoElement.src = sanitizedUrl;
        Player.videoElement.onloadedmetadata = () => {
            Player.clearLoadTimeout();
            Player.showLoader(false);
            
            if (Player.currentMedia && Player.currentMedia.timestamp) {
                Player.videoElement.currentTime = Player.currentMedia.timestamp;
            }
            
            Player.videoElement.playbackRate = Player.currentSpeed;
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

    toggleHUD: () => {
        const wrapper = DOM.get('player-wrapper');
        // Clear any existing auto-hide timer
        if (Player.controlsTimeout) {
            clearTimeout(Player.controlsTimeout);
            Player.controlsTimeout = null;
        }
        if (Player.isHUDVisible) {
            // Hide HUD
            wrapper.classList.add('player-controls-hidden');
            Player.isHUDVisible = false;
        } else {
            // Show HUD
            wrapper.classList.remove('player-controls-hidden');
            Player.isHUDVisible = true;
            // Auto-hide after 3s if video is playing
            if (!Player.videoElement.paused && !Player.isSettingsOpen) {
                Player.controlsTimeout = setTimeout(() => {
                    if (!Player.videoElement.paused && !Player.isSettingsOpen) {
                        wrapper.classList.add('player-controls-hidden');
                        Player.isHUDVisible = false;
                    }
                }, 3000);
            }
        }
    },
    
    onPlayStateChange: (isPlaying) => {
        const overlayPlay = DOM.get('overlay-play-pause');
        const customPlay = DOM.get('custom-play-btn');
        
        if (isPlaying) {
            overlayPlay.innerHTML = Icons.pause;
            customPlay.innerHTML = Icons.pause;
            Player.showControlsTemporarily();
        } else {
            overlayPlay.innerHTML = Icons.play;
            customPlay.innerHTML = Icons.play;
            Player.showControlsTemporarily(true);
        }
    },
    
    onTimeUpdate: () => {
        const time = Player.videoElement.currentTime;
        const duration = Player.videoElement.duration || 0;
        
        DOM.get('custom-time-display').textContent = `${formatTime(time)} / ${formatTime(duration)}`;
        
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
            muteBtn.innerHTML = Icons.volumeMute;
            volumeSlider.value = 0;
        } else {
            muteBtn.innerHTML = Icons.volumeHigh;
            volumeSlider.value = Player.videoElement.volume;
        }
        showToast(Player.videoElement.muted ? 'Muted' : 'Unmuted', 'info', 800);
    },
    
    setVolume: (volume) => {
        Player.videoElement.volume = volume;
        Player.videoElement.muted = (volume === 0);
        
        const muteBtn = DOM.get('custom-mute-btn');
        if (volume === 0) {
            muteBtn.innerHTML = Icons.volumeMute;
        } else if (volume < 0.5) {
            muteBtn.innerHTML = Icons.volumeLow;
        } else {
            muteBtn.innerHTML = Icons.volumeHigh;
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

        // For HLS streams, show HLS level picker
        if (Player.hls && Player.hls.levels && Player.hls.levels.length > 0) {
            // Auto option
            const autoOpt = document.createElement('div');
            autoOpt.className = 'settings-option' + (Player.hls.autoLevelEnabled ? ' active' : '');
            autoOpt.textContent = 'Auto';
            autoOpt.addEventListener('click', () => {
                Player.hls.currentLevel = -1;
                showToast('Quality: Auto', 'info', 1000);
                Player.toggleSettings(false);
                Player.updateQualityMenu();
            });
            listContainer.appendChild(autoOpt);

            Player.hls.levels.forEach((level, index) => {
                const opt = document.createElement('div');
                opt.className = 'settings-option' + (Player.hls.currentLevel === index ? ' active' : '');
                opt.textContent = `${level.height}p`;
                opt.addEventListener('click', () => {
                    Player.hls.currentLevel = index;
                    showToast(`Quality: ${level.height}p`, 'info', 1000);
                    Player.toggleSettings(false);
                    Player.updateQualityMenu();
                });
                listContainer.appendChild(opt);
            });
            return;
        }

        // For direct MP4 sources, show all available qualities from allQualities
        if (Player.allQualities && Player.allQualities.length > 0) {
            // Sort qualities descending (highest first)
            const sortedQualities = [...Player.allQualities].sort((a, b) => {
                return (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0);
            });

            sortedQualities.forEach((q) => {
                const originalIdx = Player.allQualities.findIndex(aq => aq.url === q.url);
                const opt = document.createElement('div');
                opt.className = 'settings-option' + (Player.currentQualityIndex === originalIdx ? ' active' : '');
                opt.textContent = q.quality || 'Standard';
                opt.addEventListener('click', () => {
                    showToast(`Quality: ${q.quality || 'Standard'}`, 'info', 1000);
                    Player.toggleSettings(false);
                    Player.switchSource(originalIdx);
                });
                listContainer.appendChild(opt);
            });
        } else {
            const fallbackOpt = document.createElement('div');
            fallbackOpt.className = 'settings-option active';
            fallbackOpt.textContent = 'Standard';
            listContainer.appendChild(fallbackOpt);
        }
    },
    
    updateSpeedMenu: () => {
        const listContainer = DOM.get('settings-speed-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
        speeds.forEach((speed) => {
            const opt = document.createElement('div');
            opt.className = 'settings-option' + (Player.currentSpeed === speed ? ' active' : '');
            opt.textContent = speed === 1.0 ? 'Normal' : `${speed}x`;
            opt.addEventListener('click', () => {
                Player.currentSpeed = speed;
                if (Player.videoElement) {
                    Player.videoElement.playbackRate = speed;
                }
                showToast(`Speed: ${speed === 1.0 ? 'Normal' : speed + 'x'}`, 'info', 1000);
                Player.toggleSettings(false);
                Player.updateSpeedMenu();
            });
            listContainer.appendChild(opt);
        });
    },
    
    updateSubtitleMenu: () => {
        const listContainer = DOM.get('settings-subtitle-list');
        listContainer.innerHTML = '';
        
        const offOpt = document.createElement('div');
        offOpt.className = 'settings-option' + (Player.activeSubtitleIndex === -1 ? ' active' : '');
        offOpt.textContent = 'Off';
        offOpt.addEventListener('click', () => {
            Player.activeSubtitleIndex = -1;
            Player.subtitleCues = [];
            DOM.get('subtitle-overlay').classList.add('hidden');
            showToast('Subtitles turned off', 'info', 1000);
            Player.toggleSettings(false);
            Player.updateSubtitleMenu();
        });
        listContainer.appendChild(offOpt);
        
        if (Player.currentSubtitles && Player.currentSubtitles.length > 0) {
            Player.currentSubtitles.forEach((sub, i) => {
                const opt = document.createElement('div');
                opt.className = 'settings-option' + (Player.activeSubtitleIndex === i ? ' active' : '');
                opt.textContent = sub.language;
                opt.addEventListener('click', async () => {
                    Player.activeSubtitleIndex = i;
                    Player.toggleSettings(false);
                    Player.updateSubtitleMenu();
                    showToast(`Loading Subtitles: ${sub.language}...`, 'info', 1500);
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
        
        // Show one entry per provider (not per quality)
        Player.currentSources.forEach((src, i) => {
            const opt = document.createElement('div');
            const isActive = Player.allQualities[Player.currentQualityIndex]?.provider === src.provider;
            opt.className = 'settings-option' + (isActive ? ' active' : '');
            opt.textContent = src.provider;
            opt.addEventListener('click', () => {
                // Switch to the highest quality of this provider
                const highestForProvider = Player.allQualities
                    .map((q, idx) => ({ ...q, _idx: idx }))
                    .filter(q => q.provider === src.provider)
                    .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))[0];
                if (highestForProvider) {
                    Player.switchSource(highestForProvider._idx);
                }
                Player.toggleSettings(false);
            });
            listContainer.appendChild(opt);
        });
    },

    updateExternalSourceMenu: () => {
        const selector = DOM.get('external-source-selector');
        if (!selector) return;

        if (!Player.currentSources || Player.currentSources.length === 0) {
            selector.classList.add('hidden');
            return;
        }

        selector.classList.remove('hidden');
        selector.innerHTML = '';

        const label = document.createElement('span');
        label.className = 'source-selector-label';
        label.textContent = 'Sources';
        selector.appendChild(label);
        
        // One button per provider (no quality suffix)
        Player.currentSources.forEach((src, i) => {
            const btn = document.createElement('button');
            const isActive = Player.allQualities[Player.currentQualityIndex]?.provider === src.provider;
            btn.className = 'source-btn' + (isActive ? ' active' : '');
            btn.textContent = src.provider;
            btn.addEventListener('click', () => {
                const highestForProvider = Player.allQualities
                    .map((q, idx) => ({ ...q, _idx: idx }))
                    .filter(q => q.provider === src.provider)
                    .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))[0];
                if (highestForProvider) {
                    Player.switchSource(highestForProvider._idx);
                }
            });
            selector.appendChild(btn);
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
            showToast('Subtitles loaded', 'success', 1500);
        } catch (e) {
            console.error('Subtitle file load error:', e);
            showToast('Failed to load subtitles', 'error');
        }
    },
    
    parseSubtitlesText: (text) => {
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        const cues = [];
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
            const content = textLines.join('<br>').replace(/<[^>]*>/g, '');
            
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
        Player.isHUDVisible = true;
        
        if (Player.controlsTimeout) {
            clearTimeout(Player.controlsTimeout);
        }
        
        if (!keepOpen && !Player.videoElement.paused && !Player.isSettingsOpen) {
            Player.controlsTimeout = setTimeout(() => {
                if (!Player.videoElement.paused && !Player.isSettingsOpen) {
                    wrapper.classList.add('player-controls-hidden');
                    Player.isHUDVisible = false;
                }
            }, 3000);
        }
    },
    
    hideControlsImmediately: () => {
        if (!Player.videoElement.paused && !Player.isSettingsOpen) {
            DOM.get('player-wrapper').classList.add('player-controls-hidden');
            Player.isHUDVisible = false;
        }
    },
    
    toggleFullscreen: () => {
        const wrapper = DOM.get('player-wrapper');
        if (!document.fullscreenElement) {
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen();
            } else if (wrapper.webkitRequestFullscreen) {
                wrapper.webkitRequestFullscreen();
            } else if (wrapper.msRequestFullscreen) {
                wrapper.msRequestFullscreen();
            }
            DOM.get('custom-fullscreen-btn').innerHTML = Icons.fullscreenExit;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            DOM.get('custom-fullscreen-btn').innerHTML = Icons.fullscreen;
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
        if (!Player.currentMedia) return;
        
        const src = Player.videoElement.src;
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
                showToast(`Volume ${Math.round(newVolUp * 100)}%`, 'info', 800);
                break;
            case 'ArrowDown':
                e.preventDefault();
                const newVolDown = Math.max(0, Player.videoElement.volume - 0.1);
                Player.setVolume(newVolDown);
                DOM.get('volume-slider').value = newVolDown;
                showToast(`Volume ${Math.round(newVolDown * 100)}%`, 'info', 800);
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
                    
                    const scraperUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
                    headersJson['User-Agent'] = scraperUA;
                    headersJson['user-agent'] = scraperUA;
                    
                    queryParams.set('proxyHeaders', btoa(JSON.stringify(headersJson)));
                    queryParams.delete('headers');
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
        
        // Try next quality in allQualities
        const nextIndex = Player.currentQualityIndex + 1;
        if (nextIndex < Player.allQualities.length) {
            showToast(`Stream failed. Trying next quality...`, 'warning', 2500);
            setTimeout(() => {
                Player.isFallbackTriggered = false;
                Player.switchSource(nextIndex);
            }, 1000);
        } else {
            Player.isFallbackTriggered = false;
            Player.showLoader(false);
            showToast('All playback sources failed to load', 'error', 4000);
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
        Player.currentSpeed = 1.0;
        
        DOM.hide('subtitle-overlay');
        DOM.hide('player-section');
        const extSelector = DOM.get('external-source-selector');
        if (extSelector) extSelector.classList.add('hidden');
        Player.toggleSettings(false);
        
        Player.currentMedia = null;
        Player.currentSources = [];
        Player.allQualities = [];
    }
};
