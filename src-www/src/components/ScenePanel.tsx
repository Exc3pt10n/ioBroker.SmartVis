import { useState } from 'react';
import type { SvSceneGroup } from '../../../src/shared/protocol';
import { connection } from '../connection';

/** Hue-Szenen auslösen; bei mehreren Gruppen (Raum, Zone …) zuerst die Gruppe wählen */
export function ScenePanel({ groups }: { groups: SvSceneGroup[] }): React.JSX.Element | null {
    const [groupId, setGroupId] = useState(groups[0]?.id);
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

    return (
        <section
            className="scenes"
            aria-label="Szenen"
        >
            <h2 className="subtitle">🎨 Szenen{groups.length === 1 ? ` · ${group.name}` : ''}</h2>
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
                        onClick={() => fire(s.state.id)}
                    >
                        {fired === s.state.id ? '✓ ' : ''}
                        {s.name}
                    </button>
                ))}
            </div>
        </section>
    );
}
