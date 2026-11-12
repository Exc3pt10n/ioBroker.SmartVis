import type { SvViewLayout } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { useEditing } from '../editing';
import { DragHandle, SortableGrid, useSortable } from './SortableGrid';

/** Ein anpassbarer Bereich einer Ansicht */
export interface SectionDef {
    /** Stabiler Schlüssel (wird gespeichert) */
    key: string;
    /** Name im Bearbeiten-Modus */
    label: string;
    /** Inhalt; null = in dieser Situation nicht vorhanden (z. B. keine Wallbox) */
    node: React.ReactNode;
    /** Zusatz im Bearbeiten-Modus, z. B. "nur Desktop" */
    note?: string;
    /** Bei mehreren Spalten über die volle Breite (z. B. Diagramme); teilt die Spalten an dieser Stelle */
    wide?: boolean;
}

/** Reihenfolge anwenden: gespeicherte Schlüssel zuerst, neue Bereiche an ihrer Standardposition danach */
export function applyLayout<T extends { key: string }>(items: T[], layout?: SvViewLayout): T[] {
    const order = layout?.order;
    if (!order?.length) {
        return items;
    }
    const rank = new Map(order.map((k, i) => [k, i]));
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const ra = rank.get(a.item.key);
            const rb = rank.get(b.item.key);
            if (ra !== undefined && rb !== undefined) {
                return ra - rb;
            }
            return a.index - b.index;
        })
        .map(x => x.item);
}

/**
 * Bereiche einer Ansicht, die sich im Bearbeiten-Modus umsortieren (Ziehen oder Pfeile) und
 * aus-/einblenden lassen. Die Anordnung wird mit den Anpassungen gespeichert und gilt für alle Geräte.
 */
export function CustomSections({
    view,
    sections,
    className = 'csecs',
    columns = 1,
}: {
    /** Schlüssel der Ansicht, z. B. "energy" */
    view: string;
    sections: SectionDef[];
    className?: string;
    /**
     * Anzahl Spalten außerhalb des Bearbeiten-Modus. Die Bereiche werden zeilenweise verteilt
     * (1. links, 2. rechts …). Bewusst keine CSS-Mehrspalten (column-count): Darin zeichnen
     * manche Browser Animationen (z. B. den Energiefluss) nicht zuverlässig neu.
     */
    columns?: number;
}): React.JSX.Element | null {
    const { model } = useConnection();
    const { editing } = useEditing();
    const layout = model?.ui?.views?.[view];
    const hidden = new Set(layout?.hidden || []);
    const available = sections.filter(s => s.node !== null && s.node !== undefined && s.node !== false);
    const ordered = applyLayout(available, layout);
    const canEdit = editing && !!model?.editable;

    if (!canEdit) {
        const visible = ordered.filter(s => !hidden.has(s.key));
        if (!visible.length) {
            return null;
        }
        if (columns > 1) {
            // Abschnitte zwischen breiten Bereichen werden zeilenweise auf die Spalten verteilt
            const blocks: { wide?: SectionDef; items: SectionDef[] }[] = [];
            for (const sec of visible) {
                if (sec.wide) {
                    blocks.push({ wide: sec, items: [] });
                } else if (blocks.length && !blocks[blocks.length - 1].wide) {
                    blocks[blocks.length - 1].items.push(sec);
                } else {
                    blocks.push({ items: [sec] });
                }
            }
            return (
                <div className={`${className} csecs--blocks`}>
                    {blocks.map((block, b) =>
                        block.wide ? (
                            <div
                                key={block.wide.key}
                                className="csec csec--wide"
                            >
                                {block.wide.node}
                            </div>
                        ) : (
                            <div
                                key={`cols-${b}`}
                                className="csecs--split"
                                style={{
                                    gridTemplateColumns: `repeat(${Math.min(columns, block.items.length)}, minmax(0, 1fr))`,
                                }}
                            >
                                {Array.from({ length: Math.min(columns, block.items.length) }, (_, c) => (
                                    <div
                                        key={c}
                                        className="csecs__col"
                                    >
                                        {block.items
                                            .filter((_, i) => i % columns === c)
                                            .map(sec => (
                                                <div
                                                    key={sec.key}
                                                    className="csec"
                                                >
                                                    {sec.node}
                                                </div>
                                            ))}
                                    </div>
                                ))}
                            </div>
                        ),
                    )}
                </div>
            );
        }
        return (
            <div className={className}>
                {visible.map(s => (
                    <div
                        key={s.key}
                        className="csec"
                    >
                        {s.node}
                    </div>
                ))}
            </div>
        );
    }

    const keys = ordered.map(s => s.key);
    const saveOrder = (ids: string[]): void => {
        // Vollständige Reihenfolge inkl. gerade nicht vorhandener, früher gespeicherter Bereiche
        const rest = (layout?.order || []).filter(k => !ids.includes(k));
        connection.edit({ kind: 'view', view, order: [...ids, ...rest] });
    };
    const toggle = (key: string): void => {
        const next = hidden.has(key) ? [...hidden].filter(k => k !== key) : [...hidden, key];
        connection.edit({ kind: 'view', view, hidden: next.length ? next : null });
    };
    const customized = !!(layout?.order?.length || layout?.hidden?.length);

    return (
        <>
            <SortableGrid
                className={`${className} csecs--editing`}
                items={ordered}
                getId={s => s.key}
                onReorder={saveOrder}
                render={(s, order) => (
                    <EditableSection
                        key={s.key}
                        section={s}
                        hidden={hidden.has(s.key)}
                        index={order.indexOf(s.key)}
                        count={order.length}
                        onToggle={() => toggle(s.key)}
                        onMove={delta => {
                            const i = order.indexOf(s.key);
                            const next = [...order];
                            [next[i], next[i + delta]] = [next[i + delta], next[i]];
                            saveOrder(next);
                        }}
                    />
                )}
            />
            {customized && keys.length > 0 && (
                <button
                    type="button"
                    className="linkbtn csecs__reset"
                    onClick={() => connection.edit({ kind: 'view', view, order: null, hidden: null })}
                >
                    Anordnung dieser Ansicht zurücksetzen
                </button>
            )}
        </>
    );
}

function EditableSection({
    section,
    hidden,
    index,
    count,
    onToggle,
    onMove,
}: {
    section: SectionDef;
    hidden: boolean;
    index: number;
    count: number;
    onToggle: () => void;
    onMove: (delta: -1 | 1) => void;
}): React.JSX.Element {
    const sort = useSortable();
    const dragging = sort?.dragId === section.key;
    return (
        <div
            className={`csec csec--editing${hidden ? ' csec--hidden' : ''}${dragging ? ' is-dragging' : ''}`}
            data-sort-id={section.key}
        >
            <div className="csec__bar">
                <DragHandle
                    id={section.key}
                    label={section.label}
                />
                <span className="csec__label">
                    {section.label}
                    {section.note && <span className="csec__note"> · {section.note}</span>}
                    {hidden && <span className="badge">ausgeblendet</span>}
                </span>
                <button
                    type="button"
                    className="csec__btn"
                    aria-label={`${section.label} nach oben`}
                    disabled={index <= 0}
                    onClick={() => onMove(-1)}
                >
                    ↑
                </button>
                <button
                    type="button"
                    className="csec__btn"
                    aria-label={`${section.label} nach unten`}
                    disabled={index >= count - 1}
                    onClick={() => onMove(1)}
                >
                    ↓
                </button>
                <button
                    type="button"
                    className="csec__btn csec__toggle"
                    aria-pressed={!hidden}
                    onClick={onToggle}
                >
                    {hidden ? 'Einblenden' : 'Ausblenden'}
                </button>
            </div>
            {!hidden && <div className="csec__body">{section.node}</div>}
        </div>
    );
}
