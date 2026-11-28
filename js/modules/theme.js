/**
 * theme.js - Theme initialization and light/dark theme switching
 */
import { STATE, DOM } from './state.js';

const THEME_STORAGE_KEY = 'pictopdf_theme';

function getStoredTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) { }
    return null;
}

function saveStoredTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) { }
}

export function applyTheme() {
    const isDark = STATE.theme === 'dark';
    if (isDark) {
        DOM.body.classList.remove('light-theme');
        DOM.body.classList.add('dark-theme');
    } else {
        DOM.body.classList.remove('dark-theme');
        DOM.body.classList.add('light-theme');
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isDark ? '#0b0b0d' : '#f2f2f7');
    }

    const toggleBtn = DOM.btnThemeToggle || document.getElementById('btnThemeToggle');
    if (toggleBtn) {
        const nextMode = isDark ? 'Light' : 'Night';
        toggleBtn.setAttribute('title', `Switch to ${nextMode} Theme`);
        toggleBtn.setAttribute('aria-label', `Switch to ${nextMode} Theme`);
        const iconName = isDark ? 'sun' : 'moon';
        toggleBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ nodes: [toggleBtn] });
        }
    }
}

export function initTheme() {
    const paramTheme = new URLSearchParams(window.location.search).get('theme');
    if (paramTheme === 'dark' || paramTheme === 'light') {
        STATE.theme = paramTheme;
        applyTheme();
        return;
    }

    const stored = getStoredTheme();
    if (stored) {
        STATE.theme = stored;
        applyTheme();
        return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    STATE.theme = prefersDark ? 'dark' : 'light';
    applyTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (getStoredTheme()) return;
        STATE.theme = e.matches ? 'dark' : 'light';
        applyTheme();
    });
}

export function toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    saveStoredTheme(STATE.theme);
    applyTheme();
}