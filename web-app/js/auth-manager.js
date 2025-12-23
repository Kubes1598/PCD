/**
 * AuthManager Handles User Authentication with Email/Password
 */
class AuthManager {
    constructor() {
        this.user = null;
        this.isGuest = true;
        this.authMode = 'login'; // 'login' or 'signup'
        this.storagePrefix = 'pcd_';
        this.backendUrl = 'http://localhost:8000';
    }

    init() {
        console.log('🔐 AuthManager initializing...');

        // Check for saved JWT token
        const savedToken = localStorage.getItem(this.storagePrefix + 'auth_token');
        const savedUser = localStorage.getItem(this.storagePrefix + 'user_data');

        if (savedToken && savedUser) {
            try {
                this.user = JSON.parse(savedUser);
                this.isGuest = false;
                console.log('👤 Welcome back,', this.user.username, `(${this.user.id})`);

                // Verify token is still valid
                this.verifyToken(savedToken).then(valid => {
                    if (valid) {
                        this.updateUI();
                        showScreen('page1');
                    } else {
                        // Token expired, show login
                        this.logout(false);
                        showScreen('page0');
                    }
                });
                return;
            } catch (e) {
                console.error('Failed to parse saved user:', e);
            }
        }

        // No saved user, show auth screen after loading
        setTimeout(() => {
            showScreen('page0');
        }, 3000);
    }

    setAuthMode(mode) {
        this.authMode = mode;
        const loginTab = document.getElementById('login-tab');
        const signupTab = document.getElementById('signup-tab');
        const usernameField = document.getElementById('username-field');
        const submitText = document.getElementById('auth-submit-text');

        if (mode === 'login') {
            loginTab.className = 'flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all bg-white shadow text-primary';
            signupTab.className = 'flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all text-gray-500';
            usernameField.classList.add('hidden');
            submitText.textContent = 'Login';
        } else {
            signupTab.className = 'flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all bg-white shadow text-primary';
            loginTab.className = 'flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all text-gray-500';
            usernameField.classList.remove('hidden');
            submitText.textContent = 'Create Account';
        }

        // Reinitialize icons for the form
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async handleAuthSubmit(event) {
        event.preventDefault();

        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const username = document.getElementById('auth-username')?.value.trim();

        if (!email || !password) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        if (this.authMode === 'signup' && !username) {
            showNotification('Please choose a username', 'error');
            return;
        }

        const submitBtn = document.getElementById('auth-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Please wait...</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            if (this.authMode === 'signup') {
                await this.register(email, password, username);
            } else {
                await this.loginWithEmail(email, password);
            }
        } catch (error) {
            showNotification(error.message || 'Authentication failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="log-in" class="w-5 h-5"></i><span>${this.authMode === 'login' ? 'Login' : 'Create Account'}</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async register(email, password, username) {
        const response = await fetch(`${this.backendUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Registration failed');
        }

        // Save token and user data
        localStorage.setItem(this.storagePrefix + 'auth_token', data.data.token);
        localStorage.setItem(this.storagePrefix + 'user_data', JSON.stringify(data.data.user));

        this.user = data.data.user;
        this.isGuest = false;

        console.log('👤 Registered:', this.user.username);
        showNotification(`Welcome, ${this.user.username}!`, 'success');

        this.updateUI();
        showScreen('page1');
    }

    async loginWithEmail(email, password) {
        const response = await fetch(`${this.backendUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Login failed');
        }

        // Save token and user data
        localStorage.setItem(this.storagePrefix + 'auth_token', data.data.token);
        localStorage.setItem(this.storagePrefix + 'user_data', JSON.stringify(data.data.user));

        this.user = data.data.user;
        this.isGuest = false;

        console.log('👤 Logged in:', this.user.username);
        showNotification(`Welcome back, ${this.user.username}!`, 'success');

        this.updateUI();
        showScreen('page1');
    }

    async verifyToken(token) {
        try {
            const response = await fetch(`${this.backendUrl}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async login(method) {
        console.log(`🔑 Logging in with ${method}...`);

        if (method === 'guest') {
            this.handleGuestLogin();
        }
    }

    handleGuestLogin() {
        const guestId = 'Guest_' + Math.floor(1000 + Math.random() * 9000);
        this.user = {
            id: guestId,
            username: guestId,
            isGuest: true,
            loginMethod: 'guest',
            joinedAt: new Date().toISOString()
        };
        this.isGuest = true;

        console.log('👤 Logged in as Guest:', guestId);
        showNotification('Welcome! Playing as Guest', 'success');

        this.updateUI();
        showScreen('page1');
    }

    updateUI() {
        if (!this.user) return;

        // Update profile elements
        const nameElements = document.querySelectorAll('.player-name, #player-name-profile');
        nameElements.forEach(el => el.textContent = this.user.username || this.user.name);

        const idElements = document.querySelectorAll('.player-id-display');
        idElements.forEach(el => el.textContent = 'ID: ' + this.user.id);

        // Update connection icon/badge based on guest status
        const statusBadge = document.getElementById('connection-status');
        if (statusBadge) {
            if (this.isGuest) {
                statusBadge.className = 'absolute -top-2 -right-2 flex items-center px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-full backdrop-blur-sm';
                statusBadge.innerHTML = '<span class="w-2 h-2 bg-gray-400 rounded-full mr-1.5"></span><span class="text-[10px] font-bold text-gray-500 uppercase">Guest Mode</span>';
            } else {
                statusBadge.className = 'absolute -top-2 -right-2 flex items-center px-2 py-0.5 bg-success/10 border border-success/30 rounded-full backdrop-blur-sm';
                statusBadge.innerHTML = '<span class="w-2 h-2 bg-success rounded-full animate-pulse mr-1.5"></span><span class="text-[10px] font-bold text-success uppercase">Synced</span>';
            }
        }

        // Update GameState name
        if (typeof gameState !== 'undefined') {
            gameState.playerName = this.user.username || this.user.name;
        }
    }

    logout(reload = true) {
        localStorage.removeItem(this.storagePrefix + 'auth_token');
        localStorage.removeItem(this.storagePrefix + 'user_data');
        this.user = null;
        this.isGuest = true;
        if (reload) {
            location.reload();
        }
    }

    getUserId() {
        return this.user ? this.user.id : null;
    }

    getToken() {
        return localStorage.getItem(this.storagePrefix + 'auth_token');
    }
}

// Create global instance
window.authManager = new AuthManager();
