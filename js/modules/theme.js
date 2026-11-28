/**
 * theme.js - Theme initialization and light/dark theme switching
 */
import { STATE, DOM } from './state.js';

export function applyTheme() {
    if (STATE.theme === 'dark') {
        DOM.body.classList.remove('light-theme');
        DOM.body.classList.add('dark-theme');
    } else {
        DOM.body.classList.remove('dark-theme');
        DOM.body.classList.add('light-theme');
    }
}

export function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    STATE.theme = prefersDark ? 'dark' : 'light';
    applyTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        STATE.theme = e.matches ? 'dark' : 'light';
        applyTheme();
    });
}

export function toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
}
