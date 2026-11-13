import { getName } from '../names';
import { guessRoom } from '../rooms';
import type { ObjectMap } from './types';

/** Objekte der Hue-Adapter: ioBroker.hue (Bridge-API v1) und hue-v2 (Bridge-API v2) */
/** native.type eines Hue-Objekts (hue-v2: "room", "zone", "light", "scene", "smart_scene" …) */
export function hueNativeType(obj: ioBroker.Object): string {
    const type = (obj.native as { type?: unknown } | undefined)?.type;
    return typeof type === 'string' ? type : '';
}

export function isHueId(id: string): boolean {
    return id.startsWith('hue.') || id.startsWith('hue-v2.');
}

/**
 * Rolle eines Hue-Kanals. ioBroker.hue setzt common.role ("Room", "Zone", "light.color" …);
 * hue-v2 lässt die Kanal-Rolle leer und nennt die Art in native.type ("room", "zone", "light").
 */
export function hueChannelRole(obj: ioBroker.Object): string {
    const role = String(obj.common?.role || '');
    if (role) {
        return role;
    }
    const type = hueNativeType(obj);
    return ({ room: 'Room', zone: 'Zone', light: 'light' } as Record<string, string>)[type] || '';
}

/**
 * Lampen-IDs einer Hue-Gruppe (native.lights). hue-v2-Gruppen ohne diese Liste gelten als Gruppe
 * ohne bekannte Lampen: Raum und Szenen funktionieren, nur die Zuordnung der Lampen fehlt.
 */
export function hueGroupLights(obj: ioBroker.Object): string[] | undefined {
    const lights = (obj.native as { lights?: unknown } | undefined)?.lights;
    if (Array.isArray(lights)) {
        return lights.map(String);
    }
    return !obj.common?.role && ['room', 'zone'].includes(hueNativeType(obj)) ? [] : undefined;
}

/** Gruppen-Rollen des Hue-Adapters (common.role = group.type) */
const HUE_ROOM_ROLES = new Set(['Room']);
/** Gruppen, die keine echten Bediengeräte sind */
export const HUE_IGNORED_GROUP_ROLES = new Set(['Entertainment']);

interface HueGroup {
    id: string;
    name: string;
    lights: string[];
}

/**
 * Liest die in der Hue-App gepflegten Räume aus dem Hue-Adapter (ioBroker.hue).
 *
 * - Gruppen sind Kanäle mit common.role "Room" | "Zone" | "LightGroup" | "Entertainment"
 *   und native.lights = [Licht-IDs]; Lampen sind Kanäle mit native.id = Licht-ID.
 * - Der Raumname kommt aus native.name (der Kanalname kann Zusätze wie " Room" tragen).
 * - Raumnamen werden auf bekannte Räume abgebildet ("Licht Küche" → "Küche").
 * - Zonen werden nicht als Raum verwendet (eine Lampe kann in mehreren Zonen sein).
 * - Liegen Objekte in alter (hue.0.<Bridge>.<Name>) und neuer Struktur vor, gilt die
 *   Ebene mit den meisten Lampen; die anderen sind Altlasten mit veralteten Licht-IDs.
 *
 * @param knownRooms bekannte Raumnamen (Enums + Standardnamen) für die Abbildung
 * @returns Kanal-ID → Raumname (für Lampen und die Raum-Gruppen selbst)
 */
export interface HueRoomResult {
    /** Kanal-ID → Raumname */
    hints: Map<string, string>;
    /** Raumgruppen-Kanäle (werden als "Alle Lichter" angezeigt) */
    roomGroups: Set<string>;
    /** Kanäle einer veralteten Objektstruktur */
    stale: Set<string>;
    /** Hue-Gruppe (Raum/Zone) → Kanäle ihrer Lampen */
    members: Map<string, string[]>;
}

export function hueRoomHints(objects: ObjectMap, lang: string, knownRooms: string[]): HueRoomResult {
    const hints = new Map<string, string>();
    const roomGroups = new Set<string>();
    const stale = new Set<string>();
    const members = new Map<string, string[]>();
    // Alle Gruppen mit Lampenliste (auch Zonen) – für die Zuordnung Gruppe → Lampen
    const allGroups = new Map<string, { id: string; lights: string[] }[]>();
    const channelsByLevel = new Map<string, string[]>();
    // Instanz → Ebene → { Lampen nach Hue-ID, Raumgruppen }
    const instances = new Map<string, Map<number, { lights: Map<string, string>; groups: HueGroup[] }>>();

    for (const [id, obj] of Object.entries(objects)) {
        if (!isHueId(id) || obj.type !== 'channel') {
            continue;
        }
        const parts = id.split('.');
        const instance = `${parts[0]}.${parts[1]}`;
        const depth = parts.length;
        if (!instances.has(instance)) {
            instances.set(instance, new Map());
        }
        const levels = instances.get(instance)!;
        if (!levels.has(depth)) {
            levels.set(depth, { lights: new Map(), groups: [] });
        }
        const level = levels.get(depth)!;
        const levelKey = `${instance}|${depth}`;
        channelsByLevel.set(levelKey, [...(channelsByLevel.get(levelKey) || []), id]);

        const role = hueChannelRole(obj);
        const native = (obj.native || {}) as { id?: string | number; name?: string };
        const lights = hueGroupLights(obj);
        if (lights && !HUE_IGNORED_GROUP_ROLES.has(role)) {
            allGroups.set(`${instance}|${depth}`, [...(allGroups.get(`${instance}|${depth}`) || []), { id, lights }]);
        }
        if (HUE_ROOM_ROLES.has(role) && lights) {
            const name = native.name || getName(obj, lang) || parts[parts.length - 1];
            level.groups.push({ id, name, lights });
        } else if ((role.startsWith('light') || role === 'switch') && native.id !== undefined) {
            level.lights.set(String(native.id), id);
        }
    }

    for (const [instance, levels] of instances) {
        const [depth, level] = [...levels.entries()].sort((a, b) => b[1].lights.size - a[1].lights.size)[0] || [];
        if (!level) {
            continue;
        }
        for (const otherDepth of levels.keys()) {
            if (otherDepth !== depth) {
                for (const id of channelsByLevel.get(`${instance}|${otherDepth}`) || []) {
                    stale.add(id);
                }
            }
        }
        // Raumname auf bekannten Raum abbilden, sonst Hue-Namen verwenden
        const resolve = (name: string): { name: string; known: boolean } => {
            const guess = guessRoom([name], knownRooms);
            return guess ? { name: guess.name, known: true } : { name, known: false };
        };
        // Eine Lampe kann in mehreren Hue-"Räumen" sein: bekannter Raum gewinnt
        const candidates = new Map<string, { name: string; known: boolean }[]>();
        for (const group of level.groups.sort((a, b) => a.id.localeCompare(b.id))) {
            const room = resolve(group.name);
            hints.set(group.id, room.name);
            roomGroups.add(group.id);
            for (const lightId of group.lights) {
                const channel = level.lights.get(lightId);
                if (channel) {
                    candidates.set(channel, [...(candidates.get(channel) || []), room]);
                }
            }
        }
        for (const [channel, rooms] of candidates) {
            hints.set(channel, (rooms.find(r => r.known) || rooms[0]).name);
        }
        for (const group of allGroups.get(`${instance}|${depth}`) || []) {
            const channels = group.lights.map(l => level.lights.get(l)).filter((c): c is string => !!c);
            if (channels.length) {
                members.set(group.id, channels);
            }
        }
    }
    return { hints, roomGroups, stale, members };
}
