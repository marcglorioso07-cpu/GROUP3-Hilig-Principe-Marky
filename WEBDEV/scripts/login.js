/* scripts/login.js */

const TOKEN_KEY = 'slsu_token';
const PROFILE_KEY = 'slsu_profile';

function completeLogin(provider, email) {
    let profile = null;
    try {
        profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch (e) {
        profile = null;
    }

    if (!profile) {
        const baseName =
            email && email.includes('@')
                ? email.split('@')[0]
                : (provider === 'google'
                    ? 'Google Student'
                    : provider === 'facebook'
                        ? 'Facebook Student'
                        : 'SLSU Student');

        profile = {
            username: baseName,
            email: email || '',
            provider,
            avatar: ''
        };
    } else {
        if (email && !profile.email) profile.email = email;
        profile.provider = provider;
    }

    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(TOKEN_KEY, 'active');
    window.location.href = 'index.html';
}

// Email/password login (fake)
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const btn = document.querySelector('.btn-login');
        const emailInput = this.querySelector('input[type="email"]');
        const email = emailInput ? emailInput.value.trim() : '';

        if (btn) {
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Entering...';
            btn.style.opacity = '0.8';
            btn.disabled = true;
        }

        setTimeout(() => {
            completeLogin('local', email);
        }, 900);
    });
}

// Google login (simulated)
const googleBtn = document.getElementById('googleLogin');
if (googleBtn) {
    googleBtn.addEventListener('click', () => {
        googleBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Connecting to Google...';
        googleBtn.disabled = true;
        setTimeout(() => {
            completeLogin('google', '');
        }, 900);
    });
}

// Facebook login (simulated)
const facebookBtn = document.getElementById('facebookLogin');
if (facebookBtn) {
    facebookBtn.addEventListener('click', () => {
        facebookBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Connecting to Facebook...';
        facebookBtn.disabled = true;
        setTimeout(() => {
            completeLogin('facebook', '');
        }, 900);
    });
}

// Already logged in? Skip login screen
if (localStorage.getItem(TOKEN_KEY) === 'active') {
    window.location.href = 'index.html';
}
