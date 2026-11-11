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

/** Spaltenzahl für Karten-Ansichten: 1 (Handy/Tablet), 2 ab 1100 px, 3 ab 1800 px */
export function useCardColumns(max = 3): number {
    const two = useMediaQuery('(min-width: 1100px)');
    const three = useMediaQuery('(min-width: 1800px)');
    return Math.min(max, three ? 3 : two ? 2 : 1);
}
