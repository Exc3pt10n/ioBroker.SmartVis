import { useEffect, useSyncExternalStore } from 'react';

/** Kurze Rückmeldung unten am Bildschirm, optional mit "Rückgängig" */
interface ToastMessage {
    id: number;
    text: string;
    undo?: () => void;
}

let current: ToastMessage | undefined;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach(l => l());
}

export function showToast(text: string, undo?: () => void): void {
    current = { id: nextId++, text, ...(undo ? { undo } : {}) };
    emit();
}

function hide(id: number): void {
    if (current?.id === id) {
        current = undefined;
        emit();
    }
}

/** Anzeige (einmal in der App) */
export function Toast(): React.JSX.Element | null {
    const toast = useSyncExternalStore(
        onChange => {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        () => current,
    );
    useEffect(() => {
        if (!toast) {
            return;
        }
        // Mit Rückgängig etwas länger stehen lassen
        const timer = window.setTimeout(() => hide(toast.id), toast.undo ? 6000 : 3000);
        return () => window.clearTimeout(timer);
    }, [toast]);
    if (!toast) {
        return null;
    }
    return (
        <div
            className="toast"
            role="status"
        >
            <span className="toast__text">{toast.text}</span>
            {toast.undo && (
                <button
                    type="button"
                    className="toast__undo"
                    onClick={() => {
                        toast.undo?.();
                        hide(toast.id);
                    }}
                >
                    Rückgängig
                </button>
            )}
        </div>
    );
}
