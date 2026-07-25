function applyTheme() {
    // Suppress transitions during theme change to eliminate repaint lag
    document.body.classList.add('theme-switching');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('theme-switching');
    }));

    const pref = localStorage.getItem('themePreference') || 'default';
    let isDark = false;

    if (pref === 'dark') {
        isDark = true;
    } else if (pref === 'light') {
        isDark = false;
    } else { // 'default' — follow OS
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    // Update theme select element if it exists in UI
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = pref;
    }

    // Update subpage theme toggle button (manual.html text-style btn)
    const subpageBtn = document.getElementById('theme-toggle-btn');
    if (subpageBtn) {
        if (subpageBtn.dataset.style === 'text') {
            subpageBtn.innerHTML = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
    }

    // Update .theme-btn icon buttons (login-screen, setup-screen, track.html etc.)
    // Skip pill/slider style buttons — their icon is driven by CSS ::after, not innerHTML.
    const appBtns = document.querySelectorAll('.theme-btn');
    appBtns.forEach(btn => {
        // Pill toggles use CSS ::after for the knob; setting innerHTML breaks them.
        // They are identified by having no data-style or data-style="pill".
        const style = btn.dataset.style;
        if (style === 'pill' || btn.classList.contains('navbar-theme-btn') || btn.classList.contains('navbar-theme-btn-mobile')) {
            return; // CSS handles the icon via ::after — skip innerHTML injection
        }
        btn.innerHTML = isDark ? '☀️' : '🌙';
    });
}

// Pending sync queue — stores the last theme pref that couldn't be synced yet
// because syncSettingToCloud wasn't available (auth not ready)
var _pendingThemeSync = null;

function syncThemePreference(value) {
    if (window.syncSettingToCloud) {
        window.syncSettingToCloud('themePreference', value);
        _pendingThemeSync = null;
    } else if (window.parent && window.parent.syncSettingToCloud && window.parent !== window) {
        window.parent.syncSettingToCloud('themePreference', value);
        _pendingThemeSync = null;
    } else {
        // Auth not ready yet — queue it for when syncSettingToCloud becomes available
        _pendingThemeSync = value;
    }
}

// Called by index.html once syncSettingToCloud is ready (post sign-in)
window.flushPendingThemeSync = function () {
    if (_pendingThemeSync !== null && window.syncSettingToCloud) {
        window.syncSettingToCloud('themePreference', _pendingThemeSync);
        _pendingThemeSync = null;
    }
};

function toggleDarkMode() {
    const currentPref = localStorage.getItem('themePreference') || 'default';
    let nextPref;
    if (currentPref === 'default') {
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Toggle away from current system appearance
        nextPref = systemDark ? 'light' : 'dark';
    } else {
        nextPref = currentPref === 'dark' ? 'light' : 'dark';
    }

    localStorage.setItem('themePreference', nextPref);
    localStorage.setItem('themePreference_updated', Date.now().toString());
    localStorage.setItem('darkMode', nextPref === 'dark' ? 'true' : 'false');

    applyTheme();
    syncThemePreference(nextPref);
}

function applyThemeSetting(value) {
    localStorage.setItem('themePreference', value);
    // Timestamp so handleUserSignedIn knows this was a recent local change
    localStorage.setItem('themePreference_updated', Date.now().toString());

    if (value === 'default') {
        localStorage.removeItem('darkMode');
    } else {
        localStorage.setItem('darkMode', value === 'dark' ? 'true' : 'false');
    }

    applyTheme();
    syncThemePreference(value);
}

// Listen to OS prefers-color-scheme changes (only matters when pref is 'default')
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const pref = localStorage.getItem('themePreference') || 'default';
        if (pref === 'default') {
            applyTheme();
        }
    });
}

// Expose functions globally
window.applyTheme = applyTheme;
window.toggleDarkMode = toggleDarkMode;
window.applyThemeSetting = applyThemeSetting;

// Run applyTheme on DOMContentLoaded to ensure elements (theme-select, etc.) are ready
document.addEventListener('DOMContentLoaded', applyTheme);
