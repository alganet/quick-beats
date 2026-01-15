// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React from 'react';

export const IconSprite = () => (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
        <symbol id="icon-play" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="currentColor" />
        </symbol>
        <symbol id="icon-stop" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />
        </symbol>
        <symbol id="icon-reset" viewBox="0 0 24 24">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
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
    </svg>
);

export const Icon = ({ id, className = "w-6 h-6", title }) => (
    <svg className={className} aria-hidden={!title} role={title ? "img" : "presentation"}>
        {title && <title>{title}</title>}
        <use href={`#icon-${id}`} />
    </svg>
);
