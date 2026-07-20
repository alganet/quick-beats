// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useCallback } from 'react';

// Must match --color-surface-2 per theme (index.css): the browser chrome and
// installed-PWA status bar take their colour from this meta, and a mismatched
// one leaves a dark toolbar on a white app.
const THEME_COLOR = { dark: '#141414', light: '#f1f5f9' };

// Seed order: the user's saved choice, else the OS preference, else dark.
// Defensive like useMediaQuery — jsdom/SSR provide no matchMedia, and a
// blocked localStorage must not throw.
function initialTheme() {
    try {
        const saved = localStorage.getItem('qb-theme');
        if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* ignore */ }
    try {
        if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    } catch { /* ignore */ }
    return 'dark';
}

export function useTheme() {
    const [theme, setThemeState] = useState(initialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        // Without this, UA widgets and scrollbars keep following the OS scheme
        // instead of the app's.
        document.documentElement.style.colorScheme = theme;
        document.querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', THEME_COLOR[theme]);
    }, [theme]);

    // Persisted here, not in the effect: only a deliberate choice is worth
    // remembering. Writing the seeded default back would freeze it, and a user
    // who never touched the toggle should keep following their OS setting.
    const setTheme = useCallback((value) => {
        setThemeState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            try { localStorage.setItem('qb-theme', next); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const toggleTheme = useCallback(
        () => setTheme((t) => t === 'dark' ? 'light' : 'dark'),
        [setTheme]
    );

    return [theme, setTheme, toggleTheme];
}
