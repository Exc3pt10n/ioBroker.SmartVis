import type { SvDevice, SvModel, SvScene, SvSceneGroup, SvStateValue } from '../../src/shared/protocol';

/** Szenengruppen, zu denen ein Gerät gehört – größte Gruppe (meist der Raum) zuerst */
export function scenesForDevice(model: SvModel, deviceId: string): SvSceneGroup[] {
    return (model.scenes || [])
        .filter(g => g.devices.includes(deviceId))
        .sort((a, b) => b.devices.length - a.devices.length || a.name.localeCompare(b.name, 'de'));
}

/**
 * Szenengruppen eines Raums: alle Lampen der Gruppe stehen in diesem Raum.
 * Gruppen, deren Lampen vollständig in einer größeren Gruppe des Raums enthalten sind, entfallen.
 */
export function scenesForRoom(model: SvModel, devices: SvDevice[]): SvSceneGroup[] {
    const inRoom = new Set(devices.map(d => d.id));
    const known = new Set(model.devices.map(d => d.id));
    const candidates = (model.scenes || [])
        .map(g => ({ group: g, members: g.devices.filter(id => known.has(id)) }))
        .filter(c => c.members.length > 0 && c.members.every(id => inRoom.has(id)));
    return candidates
        .filter(
            c =>
                !candidates.some(
                    other =>
                        other !== c &&
                        other.members.length > c.members.length &&
                        c.members.every(id => other.members.includes(id)),
                ),
        )
        .map(c => c.group);
}

type States = Record<string, SvStateValue | null>;

/** Läuft diese Szene gerade? Smart Scenes über ihren Schalter, sonst über den Namen in "activeScene" */
export function isSceneActive(group: SvSceneGroup, scene: SvScene, states: States): boolean {
    if (scene.smart) {
        return states[scene.state.id]?.val === true;
    }
    const active = group.active ? states[group.active.id]?.val : undefined;
    return typeof active === 'string' && active.trim() !== '' && active.trim() === scene.name;
}

/** Name der gerade aktiven Szene einer Gruppe (Smart Scene vor normaler Szene), sonst undefined */
export function activeSceneName(group: SvSceneGroup, states: States): string | undefined {
    const smart = group.scenes.find(s => s.smart && isSceneActive(group, s, states));
    if (smart) {
        return smart.name;
    }
    const active = group.active ? states[group.active.id]?.val : undefined;
    return typeof active === 'string' && active.trim() ? active.trim() : undefined;
}

/** Erste aktive Szene mehrerer Gruppen (z. B. eines Raums), mit Gruppe */
export function activeScene(groups: SvSceneGroup[], states: States): { group: SvSceneGroup; name: string } | undefined {
    for (const group of groups) {
        const name = activeSceneName(group, states);
        if (name) {
            return { group, name };
        }
    }
    return undefined;
}
