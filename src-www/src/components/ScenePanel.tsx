import { useState } from 'react';
import type { SvSceneGroup } from '../../../src/shared/protocol';
import { connection } from '../connection';

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
    const [groupId, setGroupId] = useState(groups[0]?.id);
    const memoryKey = groups.map(g => g.id).join('|');
    const [open, setOpen] = useState(() => expanded.has(memoryKey));
    const [fired, setFired] = useState<string | undefined>();
    const group = groups.find(g => g.id === groupId) || groups[0];
    if (!group) {
        return null;
    }
    const fire = (id: string): void => {
        connection.setState(id, true);
        setFired(id);
        window.setTimeout(() => setFired(current => (current === id ? undefined : current)), 2000);
    };

    const title = `🎨 Szenen${groups.length === 1 ? ` · ${group.name}` : ''}`;
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
                            {g.name}
                        </button>
                    ))}
                </div>
            )}
            <div className="scenes__list">
                {group.scenes.map(s => (
                    <button
                        key={s.state.id}
                        type="button"
                        className={`scene${fired === s.state.id ? ' scene--fired' : ''}`}
                        title={s.smart ? 'Smart Scene – passt sich selbst an (z. B. über den Tag)' : undefined}
                        onClick={() => fire(s.state.id)}
                    >
                        {fired === s.state.id ? '✓ ' : s.smart ? '✨ ' : ''}
                        {s.name}
                    </button>
                ))}
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
                        {title}
                        <span className="group__count">{sceneCount}</span>
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
            <h2 className="subtitle">{title}</h2>
            {content}
        </section>
    );
}
