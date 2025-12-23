// ===== UI HELPER FUNCTIONS =====

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--success-color)' :
            type === 'error' ? 'var(--danger-color)' :
                type === 'warning' ? 'var(--warning-color)' : 'var(--primary-color)'};
        color: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform var(--transition-normal);
        max-width: 300px;
        font-weight: 600;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

// ===== CANDY ANIMATION EFFECTS =====
function animateCandyPick(element, callback) {
    element.style.transform = 'scale(1.2) rotate(10deg)';
    element.style.transition = 'all 0.3s ease-out';

    setTimeout(() => {
        element.style.transform = 'scale(0) rotate(360deg)';
        element.style.opacity = '0';

        setTimeout(() => {
            if (callback) callback();
        }, 300);
    }, 200);
}

function animateCandyAdd(element) {
    element.style.transform = 'scale(0)';
    element.style.opacity = '0';

    setTimeout(() => {
        element.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';
    }, 10);
}

function createFloatingCandy(candy, startX, startY, endX, endY, callback) {
    const floatingCandy = document.createElement('div');
    floatingCandy.textContent = candy;
    floatingCandy.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: 2rem;
        z-index: 1000;
        pointer-events: none;
        transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    document.body.appendChild(floatingCandy);

    setTimeout(() => {
        floatingCandy.style.left = `${endX}px`;
        floatingCandy.style.top = `${endY}px`;
        floatingCandy.style.transform = 'scale(0.8)';
        floatingCandy.style.opacity = '0.8';

        setTimeout(() => {
            document.body.removeChild(floatingCandy);
            if (callback) callback();
        }, 1000);
    }, 10);
}

// ===== SCREEN TRANSITION EFFECTS =====
function fadeTransition(fromScreen, toScreen, callback) {
    fromScreen.style.opacity = '0';
    fromScreen.style.transform = 'translateY(-20px)';

    setTimeout(() => {
        fromScreen.classList.remove('active');
        toScreen.classList.add('active');
        toScreen.style.opacity = '0';
        toScreen.style.transform = 'translateY(20px)';

        setTimeout(() => {
            toScreen.style.opacity = '1';
            toScreen.style.transform = 'translateY(0)';
            if (callback) callback();
        }, 10);
    }, 300);
}

// ===== LOADING STATES =====
function showLoadingState(element, message = 'Loading...') {
    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;

    element.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>${message}</span>
        </div>
    `;
    element.disabled = true;
}

function hideLoadingState(element) {
    const originalContent = element.dataset.originalContent;
    if (originalContent) {
        element.innerHTML = originalContent;
        delete element.dataset.originalContent;
    }
    element.disabled = false;
}

// ===== PARTICLE EFFECTS =====
function createConfetti(x, y, colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7']) {
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 8 + 4;
        const angle = (Math.PI * 2 * i) / 15;
        const velocity = Math.random() * 100 + 50;

        particle.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            pointer-events: none;
            z-index: 10000;
        `;

        document.body.appendChild(particle);

        const endX = x + Math.cos(angle) * velocity;
        const endY = y + Math.sin(angle) * velocity + Math.random() * 100;

        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${endX - x}px, ${endY - y}px) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => {
            document.body.removeChild(particle);
        };
    }
}

// ===== SOUND EFFECTS =====
class SoundManager {
    constructor() {
        this.sounds = {};
        this.volume = 0.5;
        this.enabled = true;
    }

    createAudioContext() {
        // Create simple beep sounds using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.sounds.pick = (frequency = 440, duration = 0.1) => {
            if (!this.enabled) return;

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(this.volume * 0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        };

        this.sounds.success = () => {
            if (!this.enabled) return;
            this.sounds.pick(523.25, 0.2); // C5
            setTimeout(() => this.sounds.pick(659.25, 0.2), 100); // E5
            setTimeout(() => this.sounds.pick(783.99, 0.3), 200); // G5
        };

        this.sounds.error = () => {
            if (!this.enabled) return;
            this.sounds.pick(200, 0.3);
        };

        this.sounds.win = () => {
            if (!this.enabled) return;
            const notes = [261.63, 329.63, 392.00, 523.25]; // C-E-G-C
            notes.forEach((note, index) => {
                setTimeout(() => this.sounds.pick(note, 0.4), index * 150);
            });
        };

        // Poison selected sound - descending ominous tones
        this.sounds.poison = () => {
            if (!this.enabled) return;
            const notes = [392.00, 349.23, 293.66]; // G-F-D descending
            notes.forEach((note, index) => {
                setTimeout(() => this.sounds.pick(note, 0.25), index * 120);
            });
        };

        // Timer tick sound - quick beep for last 5 seconds
        this.sounds.tick = () => {
            if (!this.enabled) return;
            this.sounds.pick(880, 0.05); // High A, very short
        };

        // Lose sound - sad descending notes
        this.sounds.lose = () => {
            if (!this.enabled) return;
            const notes = [329.63, 293.66, 261.63, 196.00]; // E-D-C-G (low)
            notes.forEach((note, index) => {
                setTimeout(() => this.sounds.pick(note, 0.3), index * 200);
            });
        };

        // Turn start - your turn notification
        this.sounds.turnStart = () => {
            if (!this.enabled) return;
            this.sounds.pick(587.33, 0.15); // D5
            setTimeout(() => this.sounds.pick(783.99, 0.2), 100); // G5
        };
    }


    play(soundName, ...args) {
        if (this.sounds[soundName]) {
            this.sounds[soundName](...args);
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

// ===== GLOBAL SOUND MANAGER =====
const soundManager = new SoundManager();

// Initialize sound manager when user first interacts
document.addEventListener('click', function initializeAudio() {
    soundManager.createAudioContext();
    document.removeEventListener('click', initializeAudio);
}, { once: true });

// ===== SETTINGS MANAGEMENT =====
function loadSettings() {
    const settings = {
        sfxVolume: parseInt(localStorage.getItem('pcd_sfx_volume') || '50'),
        musicVolume: parseInt(localStorage.getItem('pcd_music_volume') || '30'),
        theme: localStorage.getItem('pcd_theme') || 'default',
        animations: localStorage.getItem('pcd_animations') !== 'false',
        autoConfirm: localStorage.getItem('pcd_auto_confirm') === 'true',
        showHints: localStorage.getItem('pcd_show_hints') !== 'false'
    };

    // Apply settings to UI
    const sfxSlider = document.getElementById('sfx-volume');
    const musicSlider = document.getElementById('music-volume');
    const themeSelector = document.getElementById('theme-selector');
    const animationsToggle = document.getElementById('animations-toggle');
    const autoConfirmToggle = document.getElementById('auto-confirm');
    const showHintsToggle = document.getElementById('show-hints');

    if (sfxSlider) {
        sfxSlider.value = settings.sfxVolume;
        sfxSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            soundManager.setVolume(volume / 100);
            localStorage.setItem('pcd_sfx_volume', volume.toString());
        });
    }

    if (musicSlider) {
        musicSlider.value = settings.musicVolume;
        musicSlider.addEventListener('input', (e) => {
            localStorage.setItem('pcd_music_volume', e.target.value);
        });
    }

    if (themeSelector) {
        themeSelector.value = settings.theme;
        themeSelector.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            localStorage.setItem('pcd_theme', e.target.value);
        });
    }

    if (animationsToggle) {
        animationsToggle.checked = settings.animations;
        animationsToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('no-animations', !e.target.checked);
            localStorage.setItem('pcd_animations', e.target.checked.toString());
        });
    }

    if (autoConfirmToggle) {
        autoConfirmToggle.checked = settings.autoConfirm;
        autoConfirmToggle.addEventListener('change', (e) => {
            localStorage.setItem('pcd_auto_confirm', e.target.checked.toString());
        });
    }

    if (showHintsToggle) {
        showHintsToggle.checked = settings.showHints;
        showHintsToggle.addEventListener('change', (e) => {
            localStorage.setItem('pcd_show_hints', e.target.checked.toString());
        });
    }

    // Apply initial settings
    soundManager.setVolume(settings.sfxVolume / 100);
    applyTheme(settings.theme);
    if (!settings.animations) {
        document.body.classList.add('no-animations');
    }

    return settings;
}

function applyThemeDirectly(theme) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
}

// ===== RESPONSIVE HELPERS =====
function isMobile() {
    return window.innerWidth <= 768;
}

function isTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // ESC key - go back or close
    if (e.key === 'Escape') {
        if (gameState.currentScreen !== 'page1') {
            if (gameState.currentScreen === 'page3') {
                if (confirm('Are you sure you want to return to the main menu? Your game will be lost.')) {
                    showScreen('page1');
                }
            } else {
                showScreen('page1');
            }
        }
    }

    // Space key - confirm/continue
    if (e.key === ' ' || e.key === 'Enter') {
        const confirmBtn = document.querySelector('.confirm-btn:not(:disabled)');
        const primaryBtn = document.querySelector('.menu-btn.primary, .start-game-btn, .end-btn.primary');

        if (confirmBtn) {
            e.preventDefault();
            confirmBtn.click();
        } else if (primaryBtn) {
            e.preventDefault();
            primaryBtn.click();
        }
    }
});

// ===== TOUCH GESTURES =====
if (isTouch()) {
    let startX, startY;

    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        // Swipe right - go back
        if (deltaX > 100 && Math.abs(deltaY) < 50) {
            if (gameState.currentScreen !== 'page1') {
                showScreen('page1');
            }
        }

        startX = startY = null;
    });
}

// ===== PERFORMANCE MONITORING =====
function trackPerformance(action, callback) {
    const start = performance.now();

    const result = callback();

    if (result instanceof Promise) {
        return result.then(value => {
            const end = performance.now();
            console.log(`${action} took ${end - start} milliseconds`);
            return value;
        });
    } else {
        const end = performance.now();
        console.log(`${action} took ${end - start} milliseconds`);
        return result;
    }
}

// ===== ENHANCED SETTINGS FUNCTIONS =====
function updateVolumeDisplay(type) {
    const slider = document.getElementById(`${type}-volume`);
    const display = document.getElementById(`${type}-volume-display`);
    if (slider && display) {
        const value = slider.value;
        display.textContent = `${value}%`;

        // Update sound manager
        if (type === 'sfx') {
            soundManager.setVolume(value / 100);
            localStorage.setItem('pcd_sfx_volume', value);
        } else if (type === 'music') {
            localStorage.setItem('pcd_music_volume', value);
        } else if (type === 'master') {
            localStorage.setItem('pcd_master_volume', value);
        }
    }
}

function applyTheme() {
    const themeSelector = document.getElementById('theme-selector');
    const theme = themeSelector.value;

    // Remove existing theme classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '');

    // Apply new theme
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }

    localStorage.setItem('pcd_theme', theme);
    showNotification(`Theme changed to ${theme}`, 'success', 2000);
}

function toggleAnimations() {
    const toggle = document.getElementById('animations-toggle');
    const enabled = toggle.checked;

    if (enabled) {
        document.body.classList.remove('no-animations');
    } else {
        document.body.classList.add('no-animations');
    }

    localStorage.setItem('pcd_animations', enabled.toString());
    showNotification(`Animations ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
}

function toggleReducedMotion() {
    const toggle = document.getElementById('reduce-motion');
    const enabled = toggle.checked;

    if (enabled) {
        document.body.classList.add('reduce-motion');
    } else {
        document.body.classList.remove('reduce-motion');
    }

    localStorage.setItem('pcd_reduce_motion', enabled.toString());
    showNotification(`Reduced motion ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
}

function toggleAutoConfirm() {
    const toggle = document.getElementById('auto-confirm');
    const enabled = toggle.checked;

    localStorage.setItem('pcd_auto_confirm', enabled.toString());
    showNotification(`Auto-confirm ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
}

function toggleHints() {
    const toggle = document.getElementById('show-hints');
    const enabled = toggle.checked;

    localStorage.setItem('pcd_show_hints', enabled.toString());
    showNotification(`Hints ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
}

function setGameSpeed() {
    const selector = document.getElementById('game-speed');
    const speed = selector.value;

    localStorage.setItem('pcd_game_speed', speed);
    showNotification(`Game speed set to ${speed}`, 'info', 2000);
}

function toggleDebugMode() {
    const toggle = document.getElementById('debug-mode');
    const enabled = toggle.checked;

    if (enabled) {
        document.body.classList.add('debug-mode');
        console.log('Debug mode enabled');
    } else {
        document.body.classList.remove('debug-mode');
        console.log('Debug mode disabled');
    }

    localStorage.setItem('pcd_debug_mode', enabled.toString());
    showNotification(`Debug mode ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'warning' : 'info', 2000);
}

function toggleOfflineMode() {
    const toggle = document.getElementById('offline-mode');
    const enabled = toggle.checked;

    localStorage.setItem('pcd_offline_mode', enabled.toString());
    showNotification(`Offline mode ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'warning' : 'info', 2000);
}

function resetAllSettings() {
    if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
        // Clear all localStorage settings
        const keys = Object.keys(localStorage).filter(key => key.startsWith('pcd_'));
        keys.forEach(key => localStorage.removeItem(key));

        // Reset all form elements to defaults
        document.getElementById('sfx-volume').value = 50;
        document.getElementById('music-volume').value = 30;
        document.getElementById('master-volume').value = 75;
        document.getElementById('theme-selector').value = 'default';
        document.getElementById('animations-toggle').checked = true;
        document.getElementById('reduce-motion').checked = false;
        document.getElementById('auto-confirm').checked = false;
        document.getElementById('show-hints').checked = true;
        document.getElementById('game-speed').value = 'normal';
        document.getElementById('debug-mode').checked = false;
        document.getElementById('offline-mode').checked = false;

        // Update volume displays
        updateVolumeDisplay('sfx');
        updateVolumeDisplay('music');
        updateVolumeDisplay('master');

        // Apply defaults
        applyTheme();
        toggleAnimations();

        showNotification('All settings reset to default', 'success', 3000);
    }
}

// ===== INITIALIZE UI HELPERS =====
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    // Initialize volume displays
    setTimeout(() => {
        updateVolumeDisplay('sfx');
        updateVolumeDisplay('music');
        updateVolumeDisplay('master');
    }, 100);

    // Add visual feedback for all interactive elements
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .candy-item, .mode-card, .difficulty-card')) {
            soundManager.play('pick', 440, 0.1);
        }
    });

    // Add hover effects for touch devices
    if (isTouch()) {
        document.addEventListener('touchstart', (e) => {
            if (e.target.matches('button, .candy-item')) {
                e.target.classList.add('touch-active');
            }
        });

        document.addEventListener('touchend', (e) => {
            setTimeout(() => {
                document.querySelectorAll('.touch-active').forEach(el => {
                    el.classList.remove('touch-active');
                });
            }, 150);
        });
    }
});