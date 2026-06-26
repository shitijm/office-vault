// SecureVault — Application Code
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const qrLandingContainer = document.getElementById('qr-landing-container');
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    
    const loginForm = document.getElementById('login-form');
    const passkeyInput = document.getElementById('passkey-input');
    const errorMsg = document.getElementById('error-msg');
    const lockBtn = document.getElementById('lock-btn');
    
    const bypassQrBtn = document.getElementById('bypass-qr-btn');
    const backToQrBtn = document.getElementById('back-to-qr-btn');
    const closeLoginBtn = document.getElementById('close-login-btn');
    const toggleAdminModeBtn = document.getElementById('toggle-admin-mode-btn');
    const loginTitle = document.getElementById('login-title');
    const loginSubtitle = document.getElementById('login-subtitle');
    const roleBadge = document.getElementById('role-badge');
    
    const credentialsList = document.getElementById('credentials-list');
    const credCount = document.getElementById('cred-count');
    const landingQrDiv = document.getElementById('landing-qr');
    const qrLoading = document.querySelector('.qr-loading');
    const landingUrlSpan = document.getElementById('landing-url');
    const toast = document.getElementById('toast');

    // Add Credential Modal Elements
    const addCredTrigger = document.getElementById('add-cred-trigger');
    const addCredModal = document.getElementById('add-cred-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addCredForm = document.getElementById('add-cred-form');
    const credItemInput = document.getElementById('cred-item');
    const credTypeInput = document.getElementById('cred-type');
    const credLoginInput = document.getElementById('cred-login');
    const credPassInput = document.getElementById('cred-pass');
    const modalTitle = document.getElementById('modal-title');
    const modalSubmitBtn = document.getElementById('modal-submit-btn');

    // Default Credentials dataset
    const defaultCredentials = [
        { item: 'MAC Mini', type: 'Device', login: 'SEPL-Lab', pass: 'sepl@2025' },
        { item: 'Email login in MAC Mini', type: 'Email', login: 'conference-one@sparkl.me', pass: 'sepl@2025' },
        { item: 'SSID 1', type: 'Wi-Fi Network', login: 'Sparkl', pass: 'Sp@rkl%943' },
        { item: 'SSID 2', type: 'Wi-Fi Network', login: 'Sparkl guest', pass: 'a35ad4369148' },
        { item: 'SSID 3', type: 'Wi-Fi Network', login: 'Sparkl FAC', pass: 'Sp@rkl$321' },
        { item: 'SSID 4', type: 'Wi-Fi Network', login: 'SEPL-Lab', pass: 'Sp@rkl#2025' }
    ];

    let credentials = [];

    // Save credentials to both LocalStorage and server if running locally
    const saveCredentials = async (newCredentials) => {
        credentials = newCredentials;
        localStorage.setItem('vault_credentials', JSON.stringify(credentials));

        try {
            const response = await fetch('/api/credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            if (!response.ok) {
                console.warn('Failed to save credentials to server.');
            }
        } catch (err) {
            console.warn('Server storage not reachable (e.g. running on static hosting like Netlify). Changes saved locally in your browser.', err);
        }
    };

    // Load credentials from server (first choice) or fallback to localstorage
    const loadCredentials = async () => {
        try {
            // First try reading from the local server or deployed credentials.json directly
            const response = await fetch('/api/credentials');
            if (response.ok) {
                credentials = await response.json();
                localStorage.setItem('vault_credentials', JSON.stringify(credentials));
                return;
            }
        } catch (err) {
            console.log('Server API not reachable, falling back to local files or localStorage.', err);
        }

        try {
            // Fallback for static Netlify deploys: fetch the static credentials.json file
            const response = await fetch('/credentials.json');
            if (response.ok) {
                credentials = await response.json();
                localStorage.setItem('vault_credentials', JSON.stringify(credentials));
                return;
            }
        } catch (err) {
            console.log('Static credentials.json not found, loading from localStorage.', err);
        }

        // Final fallback: LocalStorage or hardcoded defaults
        let local = JSON.parse(localStorage.getItem('vault_credentials'));
        if (!local) {
            local = defaultCredentials;
            localStorage.setItem('vault_credentials', JSON.stringify(local));
        }
        credentials = local;
    };

    // Mobile / Scanner state detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    const isScannedUrl = window.location.search.includes('source=scan');
    
    // Login role configuration
    let loginMode = 'user'; // 'user' or 'admin'
    let editingIndex = -1;  // index of element being edited, -1 for adding new

    const lockVault = () => {
        sessionStorage.removeItem('vault_authenticated');
        sessionStorage.removeItem('vault_role');
        if (isScannedUrl || isMobile) {
            showLogin();
        } else {
            showLandingQR();
        }
    };

    // Navigation and Auth Handlers
    const checkNavigationState = async () => {
        await loadCredentials();
        if (sessionStorage.getItem('vault_authenticated') === 'true') {
            showDashboard();
        } else if (isScannedUrl || isMobile) {
            showLogin();
        } else {
            showLandingQR();
        }
    };

    const showLandingQR = () => {
        qrLandingContainer.classList.remove('hidden');
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.add('hidden');
        addCredModal.classList.add('hidden');
        setupLandingQR();
    };

    const showLogin = () => {
        qrLandingContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
        addCredModal.classList.add('hidden');
        setLoginMode('user');
        passkeyInput.value = '';
        passkeyInput.focus();
    };

    const showDashboard = () => {
        qrLandingContainer.classList.add('hidden');
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        
        const role = sessionStorage.getItem('vault_role') || 'user';
        updateRoleView(role);
        
        renderCredentials();
    };

    const setLoginMode = (mode) => {
        loginMode = mode;
        if (loginMode === 'admin') {
            loginTitle.textContent = "Admin Vault Login";
            loginSubtitle.textContent = "Enter your admin passcode to configure vault";
            toggleAdminModeBtn.textContent = "Login as User";
        } else {
            loginTitle.textContent = "Enter Vault Passkey";
            loginSubtitle.textContent = "Enter your 4-digit passcode to reveal credentials";
            toggleAdminModeBtn.textContent = "Login as Admin";
        }
    };

    const updateRoleView = (role) => {
        if (role === 'admin') {
            roleBadge.textContent = "Admin";
            roleBadge.className = "role-badge admin-role";
            addCredTrigger.classList.remove('hidden');
        } else {
            roleBadge.textContent = "User";
            roleBadge.className = "role-badge user-role";
            addCredTrigger.classList.add('hidden');
        }
    };

    // Button / Navigation events
    bypassQrBtn.addEventListener('click', showLogin);
    backToQrBtn.addEventListener('click', showLandingQR);
    closeLoginBtn.addEventListener('click', showLandingQR);

    toggleAdminModeBtn.addEventListener('click', () => {
        setLoginMode(loginMode === 'user' ? 'admin' : 'user');
        passkeyInput.value = '';
        passkeyInput.focus();
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
    });

    passkeyInput.addEventListener('input', () => {
        const enteredVal = passkeyInput.value.trim();
        if (enteredVal.length === 4) {
            // Auto detect login override or evaluate by active mode
            if (enteredVal === '1234') {
                errorMsg.textContent = '';
                sessionStorage.setItem('vault_authenticated', 'true');
                sessionStorage.setItem('vault_role', 'user');
                showDashboard();
            } else if (enteredVal === '2026') {
                errorMsg.textContent = '';
                sessionStorage.setItem('vault_authenticated', 'true');
                sessionStorage.setItem('vault_role', 'admin');
                showDashboard();
            } else {
                alert("Wrong password!");
                passkeyInput.value = '';
                passkeyInput.focus();
            }
        }
    });

    lockBtn.addEventListener('click', () => {
        lockVault();
    });

    // Add Credential Form Logic
    addCredTrigger.addEventListener('click', () => {
        editingIndex = -1;
        modalTitle.textContent = "Add New Credential";
        modalSubmitBtn.textContent = "Save Credential";
        addCredForm.reset();
        addCredModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        addCredModal.classList.add('hidden');
    });

    // Close modal if user clicks outside of it
    addCredModal.addEventListener('click', (e) => {
        if (e.target === addCredModal) {
            addCredModal.classList.add('hidden');
        }
    });

    addCredForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedCred = {
            item: credItemInput.value.trim(),
            type: credTypeInput.value.trim(),
            login: credLoginInput.value.trim(),
            pass: credPassInput.value.trim()
        };

        if (editingIndex === -1) {
            credentials.push(updatedCred);
            showToast("Credential added successfully!");
        } else {
            credentials[editingIndex] = updatedCred;
            showToast("Credential updated successfully!");
        }

        await saveCredentials(credentials);
        
        // Reset and hide
        addCredForm.reset();
        addCredModal.classList.add('hidden');
        
        renderCredentials();
    });

    // Render Credentials
    const renderCredentials = () => {
        credentialsList.innerHTML = '';
        credCount.textContent = credentials.length;
        const role = sessionStorage.getItem('vault_role') || 'user';

        credentials.forEach((cred, index) => {
            const card = document.createElement('div');
            card.className = 'cred-card';
            
            // Build actions header HTML if user is an admin
            let actionHeaderHTML = '';
            if (role === 'admin') {
                actionHeaderHTML = `
                    <div class="card-header-actions">
                        <button class="edit-btn" data-index="${index}" title="Edit Credential">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="delete-btn" data-index="${index}" title="Delete Credential">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-top">
                    <span class="cred-item-title">${escapeHtml(cred.item)}</span>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="cred-tag">${escapeHtml(cred.type)}</span>
                        ${actionHeaderHTML}
                    </div>
                </div>
                <div class="card-content">
                    <div class="field-row">
                        <span class="field-label">User / Login ID</span>
                        <div class="field-actions">
                            <span class="field-value">${escapeHtml(cred.login)}</span>
                            <button class="copy-btn" data-copy="${escapeHtml(cred.login)}" title="Copy Login ID">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="field-row">
                        <span class="field-label">Password</span>
                        <div class="field-actions">
                            <span class="field-value password-masked" id="pwd-${index}">••••••••</span>
                            <button class="toggle-pwd-btn" data-index="${index}" title="Show/Hide Password">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="copy-btn" data-copy="${escapeHtml(cred.pass)}" title="Copy Password">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Wire up password toggling
            const toggleBtn = card.querySelector('.toggle-pwd-btn');
            const pwdValSpan = card.querySelector(`#pwd-${index}`);
            let masked = true;

            toggleBtn.addEventListener('click', () => {
                masked = !masked;
                if (masked) {
                    pwdValSpan.textContent = '••••••••';
                    pwdValSpan.classList.add('password-masked');
                    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                } else {
                    pwdValSpan.textContent = cred.pass;
                    pwdValSpan.classList.remove('password-masked');
                    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-off-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
                }
            });

            // Wire up edit / delete if admin
            if (role === 'admin') {
                card.querySelector('.edit-btn').addEventListener('click', () => {
                    editingIndex = index;
                    modalTitle.textContent = "Edit Credential";
                    modalSubmitBtn.textContent = "Save Changes";
                    
                    // Pre-fill inputs
                    credItemInput.value = cred.item;
                    credTypeInput.value = cred.type;
                    credLoginInput.value = cred.login;
                    credPassInput.value = cred.pass;
                    
                    addCredModal.classList.remove('hidden');
                });

                card.querySelector('.delete-btn').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete ${cred.item}?`)) {
                        credentials.splice(index, 1);
                        await saveCredentials(credentials);
                        renderCredentials();
                        showToast("Credential deleted successfully!");
                    }
                });
            }

            credentialsList.appendChild(card);
        });

        // Wire up copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const textToCopy = btn.getAttribute('data-copy');
                copyToClipboard(textToCopy);
            });
        });
    };

    // Clipboard Copy Helper
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 400);
        }, 2000);
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    };

    // QR Code generation & IP resolution
    const setupLandingQR = async () => {
        landingQrDiv.innerHTML = '';
        qrLoading.classList.remove('hidden');
        
        let localURL = window.location.origin + window.location.pathname;

        try {
            // Ask server for local IP (if served via node server)
            const response = await fetch('/api/ip');
            if (response.ok) {
                const data = await response.json();
                if (data.ip) {
                    localURL = `http://${data.ip}:${window.location.port || '3000'}/`;
                }
            }
        } catch (e) {
            console.log("Could not auto-fetch local IP from server endpoint.", e);
        }

        // Add scanned source parameter so when scanned on phone it opens the password screen directly
        const targetURL = `${localURL}?source=scan`;
        landingUrlSpan.textContent = localURL;
        qrLoading.classList.add('hidden');

        // Generate landing QR code pointing to targetURL
        new QRCode(landingQrDiv, {
            text: targetURL,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    };

    // Initialize check
    checkNavigationState();
});
