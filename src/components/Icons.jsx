// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC



export const IconSprite = () => (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
        <symbol id="icon-logo" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="#141414" />
            <circle cx="32" cy="32" r="30" stroke="#22d3ee" strokeWidth="2.5" />
            <rect x="17" y="17" width="12" height="12" rx="2.5" fill="#444" />
            <rect x="35" y="17" width="12" height="12" rx="2.5" fill="#22d3ee" />
            <rect x="17" y="35" width="12" height="12" rx="2.5" fill="#3b82f6" />
            <rect x="35" y="35" width="12" height="12" rx="2.5" fill="#444" />
        </symbol>
        <symbol id="icon-play" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="currentColor" />
        </symbol>
        <symbol id="icon-stop" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />
        </symbol>
        <symbol id="icon-share" viewBox="0 0 24 24">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor" />
        </symbol>

        {/* Drum Icons */}
        <symbol id="icon-kick" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
        </symbol>
        <symbol id="icon-snare" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M4 12h16M4 9h16M4 15h16" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <symbol id="icon-hihat-closed" viewBox="0 0 24 24">
            <path d="M4 10s4-2 8-2 8 2 8 2-4 2-8 2-8-2-8-2zM4 14s4-2 8-2 8 2 8 2-4 2-8 2-8-2-8-2z" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M12 4v16" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <symbol id="icon-hihat-open" viewBox="0 0 24 24">
            <path d="M4 8s4-2 8-2 8 2 8 2-4 2-8 2-8-2-8-2zM4 16s4-2 8-2 8 2 8 2-4 2-8 2-8-2-8-2z" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M12 4v16" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <symbol id="icon-tom" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <symbol id="icon-crash" viewBox="0 0 24 24">
            <path d="M3 12c0-5 9-7 9-7s9 2 9 7-9 2-9 2-9-2-9-7z" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M12 5l-1-3M12 5l1-3" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <symbol id="icon-ride" viewBox="0 0 24 24">
            <path d="M2 14c0-4 10-6 10-6s10 2 10 6-10 2-10 2-10-2-10-6z" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="12" cy="10" r="2" fill="currentColor" />
        </symbol>

        <symbol id="icon-follow" viewBox="0 0 24 24">
            <rect x="16" y="4" width="3" height="16" rx="1.5" fill="currentColor" />
            <path d="M4 8h8M2 12h10M5 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>
        <symbol id="icon-unfollow" viewBox="0 0 24 24">
            <path d="M7 8l-4 4 4 4M17 16l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>
        <symbol id="icon-arrow-left" viewBox="0 0 24 24">
            <path d="M7.99 11H20v2H7.99v3L4 12l3.99-4v3z" fill="currentColor" />
        </symbol>
        <symbol id="icon-arrow-right" viewBox="0 0 24 24">
            <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4v3z" fill="currentColor" />
        </symbol>

        {/* Zoom Icons: Nested squares aligned bottom-right with evenodd fill refinement */}
        <symbol id="icon-zoom-0" viewBox="0 0 24 24">
            {/* Outline of Large and Medium, Small is filled */}
            <path d="M4 4h16v16H4V4zm1.5 1.5v13h13v-13h-13z" fill="currentColor" fillRule="evenodd" opacity="0.3" />
            <path d="M10 10h10v10H10V10zm1.5 1.5v7h7v-7h-7z" fill="currentColor" fillRule="evenodd" opacity="0.6" />
            <rect x="16" y="16" width="4" height="4" fill="currentColor" />
        </symbol>
        <symbol id="icon-zoom-1" viewBox="0 0 24 24">
            {/* Outline of Large, Medium frame is filled */}
            <path d="M4 4h16v16H4V4zm1.5 1.5v13h13v-13h-13z" fill="currentColor" fillRule="evenodd" opacity="0.3" />
            <path d="M10 10h10v10H10V10zm6 6h4v4h-4v-4z" fill="currentColor" fillRule="evenodd" />
        </symbol>
        <symbol id="icon-zoom-2" viewBox="0 0 24 24">
            {/* Large frame and Small core filled */}
            <path d="M4 4h16v16H4V4zm6 6h10v10H10V10z" fill="currentColor" fillRule="evenodd" />
            <rect x="16" y="16" width="4" height="4" fill="currentColor" />
        </symbol>

        <symbol id="icon-help" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="12" cy="17" r="1" fill="currentColor" />
        </symbol>

        {/* Social Icons - Crafted for high quality & professional consistency */}
        <symbol id="icon-x" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
        </symbol>
        <symbol id="icon-whatsapp" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.12.67 4.09 1.81 5.71L2.13 22l4.5-1.18c1.55.85 3.32 1.33 5.31 1.33 5.4 0 9.87-4.45 9.87-9.91S17.44 2 12.04 2zm5.83 14.16c-.25.7-1.47 1.28-2.02 1.36-.51.07-1.18.1-3.23-.74-2.61-1.07-4.29-3.71-4.43-3.89-.13-.18-1.06-1.42-1.06-2.7 0-1.28.67-1.9 1.01-2.22.34-.32.74-.41.98-.41.24 0 .47.01.68.02.21.01.49-.08.77.59.28.68.96 2.34 1.04 2.51.08.17.14.36.03.58s-.17.38-.28.52c-.11.14-.24.31-.34.42-.1.11-.22.24-.1.44s.53.88 1.15 1.43c.79.71 1.46.93 1.67 1.02.21.09.33.08.45-.06.12-.14.52-.61.66-.82.14-.21.28-.17.47-.1.19.07 1.2.57 1.41.67.21.1.34.16.4.25s.05.5-.2.93z" fill="currentColor" />
        </symbol>
        <symbol id="icon-telegram" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.698.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.303.48-.429-.012-1.253-.245-1.867-.444-.754-.245-1.354-.375-1.303-.791.026-.217.325-.44.896-.669 3.51-1.53 5.85-2.54 7.02-3.03 3.34-1.393 4.034-1.635 4.488-1.643z" fill="currentColor" />
        </symbol>
    </svg>
);

export const Icon = ({ id, className = "w-6 h-6", title }) => (
    <svg className={className} aria-hidden={!title} role={title ? "img" : "presentation"}>
        {title && <title>{title}</title>}
        <use href={`#icon-${id}`} />
    </svg>
);
