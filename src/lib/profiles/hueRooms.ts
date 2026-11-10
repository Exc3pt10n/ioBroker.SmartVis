import { getName } from '../names';
import type { ObjectMap } from './types';

/** Gruppen-Rollen des Hue-Adapters (common.role = group.type) */
const HUE_ROOM_ROLES = new Set(['Room']);
/** Gruppen, die keine echten Bediengeräte sind */
export const HUE_IGNORED_GROUP_ROLES = new Set(['Entertainment']);

/**
 * Liest die in der Hue-App gepflegten Räume aus dem Hue-Adapter (ioBroker.hue).
 *
 * Gruppen sind Kanäle mit common.role "Room" | "Zone" | "LightGroup" | "Entertainment"
 * und native.lights = [Licht-IDs]; Lampen sind Kanäle mit native.id = Licht-ID.
 * Zonen werden bewusst nicht als Raum verwendet (eine Lampe kann in mehreren Zonen sein).
 *
 * @returns Kanal-ID → Raumname (für Lampen und die Raum-Gruppen selbst)
 */
export function hueRoomHints(objects: ObjectMap, lang: string): Map<string, string> {
    const hints = new Map<string, string>();
    // Lampen je Instanz nach Hue-ID
    const lightsByInstance = new Map<string, Map<string, string>>();
    const groups: { id: string; instance: string; name: string; lights: string[] }[] = [];

    for (const [id, obj] of Object.entries(objects)) {
        if (!id.startsWith('hue.') || obj.type !== 'channel') {
            continue;
        }
        const instance = id.split('.', 2).join('.');
        const role = String(obj.common?.role || '');
        const native = (obj.native || {}) as { id?: string | number; lights?: (string | number)[] };

        if (HUE_ROOM_ROLES.has(role) && Array.isArray(native.lights)) {
            groups.push({
                id,
                instance,
                name: getName(obj, lang) || id.split('.').pop()!,
                lights: native.lights.map(String),
            });
        } else if ((role.startsWith('light') || role === 'switch') && native.id !== undefined) {
            if (!lightsByInstance.has(instance)) {
                lightsByInstance.set(instance, new Map());
            }
            lightsByInstance.get(instance)!.set(String(native.id), id);
        }
    }

    for (const group of groups) {
        hints.set(group.id, group.name);
        const lights = lightsByInstance.get(group.instance);
        for (const lightId of group.lights) {
            const channel = lights?.get(lightId);
            if (channel) {
                hints.set(channel, group.name);
            }
        }
    }
    return hints;
}
