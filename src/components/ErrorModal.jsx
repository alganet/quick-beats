// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useDialog } from '../hooks/useDialog';
import { Icon } from './Icons';

export default function ErrorModal({ isOpen, onGoHome }) {
    // No onClose: recovering via Go Home is the only way out, so there is
    // nothing for Escape to do. The hook still autofocuses the button.
    const dialogRef = useDialog(isOpen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-overlay/90 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="error-modal-title"
                aria-describedby="error-modal-desc"
                className="w-full max-w-md bg-surface-2 border border-danger/50 p-8 shadow-2xl"
            >
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 mb-6 rounded-full bg-danger/20 flex items-center justify-center">
                        <Icon id="logo" className="w-10 h-10 text-danger" />
                    </div>
                    <h2 id="error-modal-title" className="text-2xl font-black tracking-tighter text-fg uppercase mb-2">
                        Oops...
                    </h2>
                    <p id="error-modal-desc" className="text-fg-secondary text-sm leading-relaxed">
                        Something unexpected happened. Click below to refresh the app and start fresh.
                    </p>
                </div>

                {/* Fixed fill + fixed white text on purpose: the theme-aware
                    danger token is too light to carry 12px text in dark mode,
                    while red-700 holds 6.5:1 with white in both themes. */}
                <button
                    onClick={onGoHome}
                    className="w-full py-4 bg-red-700 hover:bg-red-600 text-fg-on-primary text-xs font-black uppercase tracking-widest transition-all"
                >
                    Go Home & Refresh
                </button>
            </div>
        </div>
    );
}
