import { useState } from 'react';
import type { SvSceneGroup } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { activeScene, activeSceneName, isSceneActive } from '../scenes';

/** Aufgeklappte Szenen-Bereiche (für diese Sitzung, damit sie beim Zurückkommen offen bleiben) */
const expanded = new Set<string>();

/**
 * Hue-Szenen auslösen; bei mehreren Gruppen (Raum, Zone …) zuerst die Gruppe wählen.
 * collapsible: als ausklappbarer Bereich, anfangs eingeklappt (Raumansicht).
 */
export function ScenePanel({
    groups,
    collapsible = false,
}: {
    groups: SvSceneGroup[];
    collapsible?: boolean;
}): React.JSX.Element | null {
    const { states } = useConnection();
    // Gruppe mit laufender Szene zuerst zeigen
    const [groupId, setGroupId] = useState(() => activeScene(groups, states)?.group.id ?? groups[0]?.id);
    const memoryKey = groups.map(g => g.id).join('|');
    const [open, setOpen] = useState(() => expanded.has(memoryKey));
    const [fired, setFired] = useState<string | undefined>();
    const group = groups.find(g => g.id === groupId) || groups[0];
    if (!group) {
        return null;
    }
    const fire = (id: string, val = true): void => {
        connection.setState(id, val);
        setFired(id);
        window.setTimeout(() => setFired(current => (current === id ? undefined : current)), 2000);
    };

    const title = `🎨 Szenen${groups.length === 1 ? ` · ${group.name}` : ''}`;
    const running = activeScene(groups, states);
    const runningLabel = running && (
        <span
            className="scenes__running"
            title="Gerade aktive Szene"
        >
            ▶ {running.name}
            {groups.length > 1 ? ` · ${running.group.name}` : ''}
        </span>
    );
    const sceneCount = groups.reduce((n, g) => n + g.scenes.length, 0);
    const content = (
        <>
            {groups.length > 1 && (
                <div
                    className="chips chips--small scenes__groups"
                    role="tablist"
                    aria-label="Gruppe"
                >
                    {groups.map(g => (
                        <button
                            key={g.id}
                            type="button"
                            role="tab"
                            aria-selected={g.id === group.id}
                            className={`flag${g.id === group.id ? ' flag--on' : ''}`}
                            onClick={() => setGroupId(g.id)}
                        >
                            {activeSceneName(g, states) ? '▶ ' : ''}
                            {g.name}
                        </button>
                    ))}
                </div>
            )}
            <div className="scenes__list">
                {group.scenes.map(s => {
                    const active = isSceneActive(group, s, states);
                    return (
                        <button
                            key={s.state.id}
                            type="button"
                            aria-pressed={active}
                            className={`scene${active ? ' scene--active' : ''}${fired === s.state.id ? ' scene--fired' : ''}`}
                            title={
                                s.smart
                                    ? active
                                        ? 'Smart Scene läuft – antippen beendet sie'
                                        : 'Smart Scene – passt sich selbst an (z. B. über den Tag)'
                                    : active
                                      ? 'Diese Szene ist gerade aktiv'
                                      : undefined
                            }
                            // Eine laufende Smart Scene (Schalter) lässt sich mit erneutem Antippen beenden
                            onClick={() => fire(s.state.id, !(s.smart && active))}
                        >
                            {fired === s.state.id ? '✓ ' : s.smart ? '✨ ' : ''}
                            {s.name}
                            {active && <span className="scene__state">aktiv</span>}
                        </button>
                    );
                })}
            </div>
        </>
    );

    if (collapsible) {
        return (
            <details
                className="scenes scenes--collapsible"
                open={open}
                onToggle={e => {
                    const isOpen = e.currentTarget.open;
                    setOpen(isOpen);
                    if (isOpen) {
                        expanded.add(memoryKey);
                    } else {
                        expanded.delete(memoryKey);
                    }
                }}
            >
                <summary className="scenes__summary">
                    <h2 className="subtitle">
                        <span className="scenes__title">
                            {title}
                            <span className="group__count">{sceneCount}</span>
                        </span>
                        {runningLabel}
                    </h2>
                </summary>
                {open && <div className="scenes__body">{content}</div>}
            </details>
        );
    }

    return (
        <section
            className="scenes"
            aria-label="Szenen"
        >
            <h2 className="subtitle">
                {title}
                {runningLabel}
            </h2>
            {content}
        </section>
    );
}
