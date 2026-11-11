import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { SvEdit } from '../../../src/shared/protocol';
import { connection } from '../connection';

type OrderKind = Extract<SvEdit, { ids: string[] }>['kind'];

interface SortState {
    /** Gerade gezogenes Element */
    dragId?: string;
    /** Ziehen über den Griff starten */
    start: (id: string, event: React.PointerEvent) => void;
}

const SortContext = createContext<SortState | undefined>(undefined);

/** Griff und Status für ein Element innerhalb eines SortableGrid (undefined außerhalb) */
export function useSortable(): SortState | undefined {
    return useContext(SortContext);
}

/** Neue Reihenfolge: dragId an die Position von targetId */
export function reordered(ids: string[], dragId: string, targetId: string): string[] {
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) {
        return ids;
    }
    const next = ids.filter(id => id !== dragId);
    next.splice(to, 0, dragId);
    return next;
}

/**
 * Raster, dessen Elemente im Bearbeiten-Modus per Ziehen (Maus und Touch) umsortiert werden.
 * Während des Ziehens wird die Vorschau lokal angezeigt, beim Loslassen einmal gespeichert.
 * Elemente müssen data-sort-id tragen (macht DeviceTile/RoomCard selbst).
 */
export function SortableGrid<T>({
    items,
    getId,
    kind,
    className = 'grid',
    render,
    after,
}: {
    items: T[];
    getId: (item: T) => string;
    kind: OrderKind;
    className?: string;
    render: (item: T, ids: string[]) => React.ReactNode;
    /** Weitere, nicht sortierbare Elemente am Ende (z. B. "Raum anlegen") */
    after?: React.ReactNode;
}): React.JSX.Element {
    const ids = items.map(getId);
    const [drag, setDrag] = useState<{ id: string; order: string[] } | undefined>();
    const container = useRef<HTMLDivElement>(null);
    const cleanup = useRef<(() => void) | undefined>(undefined);
    useEffect(() => () => cleanup.current?.(), []);

    const start = (id: string, event: React.PointerEvent): void => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        let order = ids;
        setDrag({ id, order });
        // Fenster-Listener statt Pointer-Capture: das Element wandert während des Ziehens im DOM
        const move = (e: PointerEvent): void => {
            const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sort-id]');
            const target = el?.getAttribute('data-sort-id');
            // Nur innerhalb dieses Rasters (z. B. nicht in eine andere Gerätegruppe)
            if (target && target !== id && el && container.current?.contains(el)) {
                const next = reordered(order, id, target);
                if (next !== order) {
                    order = next;
                    setDrag({ id, order });
                }
            }
        };
        const end = (): void => {
            cleanup.current?.();
            setDrag(undefined);
            if (order.some((x, i) => x !== ids[i])) {
                connection.edit({ kind, ids: order });
            }
        };
        const escape = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                order = ids;
                end();
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        window.addEventListener('keydown', escape);
        cleanup.current = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            window.removeEventListener('keydown', escape);
            cleanup.current = undefined;
        };
    };

    const order = drag?.order || ids;
    const byId = new Map(items.map(item => [getId(item), item]));
    return (
        <SortContext.Provider value={{ dragId: drag?.id, start }}>
            <div
                ref={container}
                className={`${className}${drag ? ' is-sorting' : ''}`}
            >
                {order.map(id => {
                    const item = byId.get(id);
                    return item === undefined ? null : render(item, order);
                })}
                {after}
            </div>
        </SortContext.Provider>
    );
}

/** Ziehgriff (nur im Bearbeiten-Modus) */
export function DragHandle({ id, label }: { id: string; label: string }): React.JSX.Element | null {
    const sort = useSortable();
    if (!sort) {
        return null;
    }
    return (
        <span
            className="draghandle"
            role="img"
            aria-label={`${label} ziehen zum Verschieben`}
            title="Ziehen zum Verschieben"
            onPointerDown={e => sort.start(id, e)}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
            >
                {[6, 12, 18].flatMap(y => [
                    <circle
                        key={`a${y}`}
                        cx="9"
                        cy={y}
                        r="1.8"
                    />,
                    <circle
                        key={`b${y}`}
                        cx="15"
                        cy={y}
                        r="1.8"
                    />,
                ])}
            </svg>
        </span>
    );
}
