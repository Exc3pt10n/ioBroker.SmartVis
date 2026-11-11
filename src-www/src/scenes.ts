import type { SvDevice, SvModel, SvSceneGroup } from '../../src/shared/protocol';

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
