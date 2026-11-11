import { useSyncExternalStore } from 'react';

/** Reagiert auf eine CSS-Media-Query (z. B. Desktop-Layout) */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        onChange => {
            const mql = window.matchMedia(query);
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
    );
}

/** Ab dieser Breite zeigt die Startseite ein Dashboard mit Spalten */
export const DASHBOARD_QUERY = '(min-width: 1200px)';
