/**
 * Firebase Authentication Manager
 * Handles user authentication, authorization, and WeChat QR code login
 */

class AuthManager {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.qrCodeTimer = null;
        this.qrCodeTimeout = null;
        this.wechatLoginCheckInterval = null;
        this.onAuthStateChangedCallback = null;
    }

    /**
     * Initialize Firebase Authentication
     */
    async init() {
        try {
            // Initialize Firebase Auth
            this.auth = firebase.auth();

            // Set up auth state observer
            this.auth.onAuthStateChanged(async (user) => {
                console.log('Auth state changed:', user ? user.email : 'No user');

                if (user) {
                    // Check if user is authorized
                    const isAuthorized = await this.checkUserAuthorization(user.email);

                    if (isAuthorized) {
                        this.currentUser = user;
                        this.showMainApp();
                        this.updateUserInfo(user.email);

                        // Call callback if set
                        if (this.onAuthStateChangedCallback) {
                            this.onAuthStateChangedCallback(user);
                        }
                    } else {
                        // User not authorized - sign them out
                        await this.auth.signOut();
                        this.showError('emailLoginError', 'Access denied. Your email is not authorized.');
                        this.showLoginModal();
                    }
                } else {
                    this.currentUser = null;
                    this.showLoginModal();
                }
            });

            // Set up login form handlers
            this.setupLoginHandlers();

            console.log('✓ Authentication Manager initialized');
        } catch (error) {
            console.error('Authentication initialization error:', error);
            throw error;
        }
    }

    /**
     * Check if user email is in authorized list
     */
    async checkUserAuthorization(email) {
        if (!email) return false;

        // Check against authorized users list
        if (typeof authorizedUsers !== 'undefined' && Array.isArray(authorizedUsers)) {
            const normalizedEmail = email.toLowerCase().trim();
            const isAuthorized = authorizedUsers.some(
                authEmail => authEmail.toLowerCase().trim() === normalizedEmail
            );

            console.log(`Authorization check for ${email}: ${isAuthorized}`);
            return isAuthorized;
        }

        // If no authorized users list, allow all authenticated users (fallback)
        console.warn('No authorizedUsers list found - allowing all authenticated users');
        return true;
    }

    /**
     * Set up login form event handlers
     */
    setupLoginHandlers() {
        // Email login button
        const emailLoginButton = document.getElementById('emailLoginButton');
        if (emailLoginButton) {
            emailLoginButton.addEventListener('click', () => this.handleEmailLogin());
        }

        // Enter key on password field
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleEmailLogin();
                }
            });
        }

        // Logout button
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => this.handleLogout());
        }

        // WeChat QR code refresh button
        const refreshQRButton = document.getElementById('refreshQRButton');
        if (refreshQRButton) {
            refreshQRButton.addEventListener('click', () => this.generateWeChatQRCode());
        }
    }

    /**
     * Handle email/password login
     */
    async handleEmailLogin() {
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const loginButton = document.getElementById('emailLoginButton');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Clear previous errors
        this.hideError('emailLoginError');

        // Validation
        if (!email || !password) {
            this.showError('emailLoginError', 'Please enter both email and password');
            return;
        }

        try {
            // Disable button and show loading
            loginButton.disabled = true;
            loginButton.innerHTML = '<span class="icon">⏳</span> Signing in...';

            // Sign in with Firebase Auth
            await this.auth.signInWithEmailAndPassword(email, password);

            // Success - auth state change will handle the rest
            console.log('Login successful');

        } catch (error) {
            console.error('Login error:', error);

            let errorMessage = 'Login failed. Please try again.';

            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later';
                    break;
            }

            this.showError('emailLoginError', errorMessage);

        } finally {
            // Re-enable button
            loginButton.disabled = false;
            loginButton.innerHTML = '<span class="icon">🔐</span> Sign In';
        }
    }

    /**
     * Handle user logout
     */
    async handleLogout() {
        try {
            await this.auth.signOut();
            console.log('User logged out');

            // Clear form fields
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';

        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * Generate WeChat QR Code for login
     */
    async generateWeChatQRCode() {
        // Check if WeChat login is enabled
        if (typeof wechatConfig === 'undefined' || !wechatConfig.enabled) {
            this.showError('wechatLoginError', 'WeChat login is not configured');
            return;
        }

        if (!wechatConfig.appId) {
            this.showError('wechatLoginError', 'WeChat App ID not configured');
            return;
        }

        try {
            this.hideError('wechatLoginError');

            // Generate a unique login session ID
            const sessionId = this.generateSessionId();

            // Create QR code data with WeChat mini program/official account schema
            // Format: weixin://dl/business/?t=<encrypted_session_id>
            const qrData = `xteam_login:${sessionId}`;

            // Generate QR code using a library (e.g., qrcode.js)
            // For now, display the session ID and instructions
            const qrCodeContainer = document.getElementById('qrCodeImage');
            qrCodeContainer.innerHTML = `
                <div style="padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
                        Scan this code with WeChat
                    </p>
                    <div style="background: white; padding: 20px; display: inline-block; border-radius: 4px;">
                        <div id="qrcode-${sessionId}"></div>
                    </div>
                    <p style="font-size: 12px; color: #999; margin-top: 10px;">
                        Session: ${sessionId.substring(0, 8)}...
                    </p>
                </div>
            `;

            // Generate QR code using QRCode.js if available
            if (typeof QRCode !== 'undefined') {
                new QRCode(document.getElementById(`qrcode-${sessionId}`), {
                    text: qrData,
                    width: 200,
                    height: 200
                });
            } else {
                // Fallback: show session ID as text
                document.getElementById(`qrcode-${sessionId}`).innerHTML = `
                    <p style="font-family: monospace; word-break: break-all; padding: 10px;">
                        ${qrData}
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        (QRCode library not loaded - install for QR display)
                    </p>
                `;
            }

            // Start timer countdown
            this.startQRCodeTimer();

            // Start polling for login completion
            this.startWeChatLoginCheck(sessionId);

        } catch (error) {
            console.error('QR code generation error:', error);
            this.showError('wechatLoginError', 'Failed to generate QR code');
        }
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Start QR code expiration timer
     */
    startQRCodeTimer() {
        // Clear existing timer
        if (this.qrCodeTimer) {
            clearInterval(this.qrCodeTimer);
        }
        if (this.qrCodeTimeout) {
            clearTimeout(this.qrCodeTimeout);
        }

        const timerElement = document.getElementById('qrTimer');
        let timeLeft = wechatConfig.loginTimeout || 180000; // 3 minutes default

        this.qrCodeTimer = setInterval(() => {
            timeLeft -= 1000;
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(this.qrCodeTimer);
                this.showError('wechatLoginError', 'QR code expired. Please refresh.');
            }
        }, 1000);

        // Auto-refresh on timeout
        this.qrCodeTimeout = setTimeout(() => {
            this.generateWeChatQRCode();
        }, timeLeft);
    }

    /**
     * Poll backend for WeChat login completion
     */
    startWeChatLoginCheck(sessionId) {
        // Clear existing check
        if (this.wechatLoginCheckInterval) {
            clearInterval(this.wechatLoginCheckInterval);
        }

        const checkInterval = wechatConfig.refreshInterval || 3000; // 3 seconds default

        this.wechatLoginCheckInterval = setInterval(async () => {
            try {
                // In a real implementation, this would check your backend API
                // For now, this is a placeholder
                // const response = await fetch(`/api/wechat-login-check/${sessionId}`);
                // const data = await response.json();

                // if (data.authenticated) {
                //     // User scanned and approved - sign them in
                //     await this.auth.signInWithCustomToken(data.firebaseToken);
                //     clearInterval(this.wechatLoginCheckInterval);
                // }

                console.log(`Checking WeChat login status for session: ${sessionId}`);
            } catch (error) {
                console.error('WeChat login check error:', error);
            }
        }, checkInterval);
    }

    /**
     * Show error message
     */
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Hide error message
     */
    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    /**
     * Show login modal
     */
    showLoginModal() {
        const modal = document.getElementById('loginModal');
        const mainApp = document.getElementById('mainApp');

        if (modal) modal.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }

    /**
     * Show main application
     */
    showMainApp() {
        const modal = document.getElementById('loginModal');
        const mainApp = document.getElementById('mainApp');

        if (modal) modal.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
    }

    /**
     * Update user info display
     */
    updateUserInfo(email) {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = email;
        }
    }

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Set callback for auth state changes
     */
    onAuthStateChanged(callback) {
        this.onAuthStateChangedCallback = callback;
    }
}

/**
 * Switch between login tabs
 */
function switchLoginTab(tab) {
    const emailTab = document.getElementById('emailLoginTab');
    const wechatTab = document.getElementById('wechatLoginTab');
    const emailForm = document.getElementById('emailLoginForm');
    const wechatForm = document.getElementById('wechatLoginForm');

    if (tab === 'email') {
        emailTab.classList.add('active');
        wechatTab.classList.remove('active');
        emailForm.style.display = 'block';
        wechatForm.style.display = 'none';
    } else if (tab === 'wechat') {
        emailTab.classList.remove('active');
        wechatTab.classList.add('active');
        emailForm.style.display = 'none';
        wechatForm.style.display = 'block';

        // Generate QR code when switching to WeChat tab
        if (window.authManager) {
            window.authManager.generateWeChatQRCode();
        }
    }
}

// Initialize auth manager when script loads
console.log('✓ Authentication Manager loaded');
