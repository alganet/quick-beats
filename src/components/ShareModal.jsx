// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import { Icon } from './Icons';

export default function ShareModal({ isOpen, onClose, shareUrl }) {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const dialogRef = useDialog(isOpen, onClose);

    if (!isOpen) return null;

    const handleCopy = async () => {
        // writeText rejects in non-secure contexts and when permission is
        // denied; without this the click looked like it did nothing.
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopyError(false);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
            setCopyError(true);
            setTimeout(() => setCopyError(false), 4000);
        }
    };

    return (
        // Backdrop click-to-close duplicates the Escape/Close paths for pointer
        // users; it is not the only dismiss affordance. The target check keeps
        // clicks inside the panel from closing without a stopPropagation guard.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-overlay/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-modal-title"
                className="w-full max-w-md bg-surface-2 border border-border-default p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id="share-modal-title" className="text-xl font-black tracking-tighter text-fg uppercase">Share Beat</h2>
                    <button onClick={onClose} aria-label="Close" className="text-fg-muted hover:text-fg transition-colors">
                        <span className="text-2xl" aria-hidden="true">&times;</span>
                    </button>
                </div>

                <p className="text-fg-secondary text-[11px] font-mono uppercase tracking-widest mb-4">
                    Instantly share with one click:
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6">
                    {/* The brand hovers are fixed colours, so their text must be
                        too: the 800-weight fills hold ≥7:1 with white in either
                        theme, where text-fg went invisible in one of them. */}
                    {[
                        { id: 'x', label: 'X', color: 'hover:bg-surface-3', hoverText: 'group-hover:text-fg', url: `https://twitter.com/intent/tweet?text=Check out this beat I made on Quick Beats!&url=${encodeURIComponent(shareUrl)}` },
                        { id: 'whatsapp', label: 'WhatsApp', color: 'hover:bg-green-800', hoverText: 'group-hover:text-fg-on-primary', url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this beat I made on Quick Beats! ${shareUrl}`)}` },
                        { id: 'telegram', label: 'Telegram', color: 'hover:bg-sky-800', hoverText: 'group-hover:text-fg-on-primary', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out this beat I made on Quick Beats!')}` }
                    ].map((platform) => (
                        <a
                            key={platform.id}
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex flex-col items-center justify-center gap-2 p-3 border border-border-default ${platform.color} transition-all group`}
                        >
                            <Icon id={platform.id} className={`w-5 h-5 text-fg-secondary ${platform.hoverText}`} />
                            <span className={`text-[11px] font-mono uppercase tracking-wide text-fg-muted ${platform.hoverText}`}>{platform.label}</span>
                        </a>
                    ))}
                </div>

                <div className="pt-6 border-t border-border-dim">
                    <p className="text-fg-muted text-[11px] font-mono uppercase tracking-wide mb-3">Or copy the direct link:</p>
                    <div className="flex gap-1">
                        <div className="flex-1 bg-surface-0 border border-border-default px-3 py-1.5 text-[11px] font-mono text-fg-secondary truncate flex items-center">
                            {shareUrl}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-green-800 text-fg-on-primary' : 'bg-surface-4 text-fg-secondary hover:text-fg hover:bg-border-default'
                                }`}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    {copyError && (
                        <p className="text-danger text-[11px] font-mono mt-2">
                            Couldn't copy automatically — select the link above and copy it.
                        </p>
                    )}
                    {/* Announce the transient copy outcome; the visual "Copied"
                        label is aria-hidden noise to a screen reader on its own. */}
                    <div className="sr-only" role="status" aria-live="polite">
                        {copied ? 'Link copied to clipboard' : copyError ? 'Could not copy the link' : ''}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-8 py-3 border border-border-default text-[11px] font-black uppercase tracking-widest text-fg-secondary hover:text-fg hover:border-fg transition-all"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
