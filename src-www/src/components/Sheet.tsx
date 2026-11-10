import { useEffect, useRef } from 'react';

/**
 * Detailfenster: auf dem Handy als Bottom-Sheet, ab Tablet als Dialog.
 * Schließen per Hintergrund, Escape, Schließen-Knopf oder Zurück-Taste des Geräts.
 */
export function Sheet({
    title,
    subtitle,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
}): React.JSX.Element {
    const panel = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        // Zurück-Taste (Android/Browser) schließt das Fenster statt die Seite zu verlassen
        window.history.pushState({ sheet: true }, '');
        let closedByHistory = false;
        const onPop = (): void => {
            closedByHistory = true;
            closeRef.current();
        };
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                closeRef.current();
            }
        };
        window.addEventListener('popstate', onPop);
        window.addEventListener('keydown', onKey);
        const previous = document.activeElement as HTMLElement | null;
        panel.current?.focus();
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('popstate', onPop);
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            if (!closedByHistory && window.history.state?.sheet) {
                window.history.back();
            }
            previous?.focus();
        };
    }, []);

    return (
        <div
            className="sheet"
            role="presentation"
            onClick={onClose}
        >
            <div
                ref={panel}
                className="sheet__panel"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onClick={e => e.stopPropagation()}
            >
                <div
                    className="sheet__handle"
                    aria-hidden="true"
                />
                <header className="sheet__head">
                    <div>
                        <h2 className="sheet__title">{title}</h2>
                        {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        className="iconbtn"
                        onClick={onClose}
                        aria-label="Schließen"
                    >
                        ✕
                    </button>
                </header>
                <div className="sheet__body">{children}</div>
            </div>
        </div>
    );
}
