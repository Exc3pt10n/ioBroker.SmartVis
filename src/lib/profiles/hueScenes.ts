import type { SvScene, SvSceneGroup, SvStateRef } from '../../shared/protocol';
import { getName } from '../names';
import { HUE_IGNORED_GROUP_ROLES, hueChannelRole, hueGroupLights, hueNativeType, isHueId } from './hueRooms';
import type { ObjectMap } from './types';

/** Gruppen-Rollen des Hue-Adapters, die Szenen tragen können */
const GROUP_KINDS: Record<string, SvSceneGroup['kind']> = { Room: 'room', Zone: 'zone', LightGroup: 'zone' };

/** Interne Szenen der Bridge (z. B. nach Stromausfall), nicht zum Schalten gedacht */
const INTERNAL_SCENE = /recovery?\s*scene|storage\s*scene|^previous$/i;

export interface HueSceneGroupRaw extends Omit<SvSceneGroup, 'devices'> {
    /** Kanal-IDs der Lampen dieser Gruppe */
    lightChannels: string[];
}

/** "Scene Sonnenuntergang Savanne" → "Sonnenuntergang Savanne" */
export function sceneName(raw: string): string {
    return raw
        .replace(/^(scene[\s_]+)+/i, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Szenen der Hue-Adapter:
 * - ioBroker.hue: Knopf-States "scene_*" direkt unterhalb der Raum-/Zonen-Kanäle
 * - hue-v2: States in den Ordnern "scenes" (Knopf) und "smartScenes" (Schalter) unterhalb der Gruppe,
 *   erkennbar an native.type "scene" bzw. "smart_scene"; ausgelöst wird beides mit true.
 * Die Lampen der Gruppe kommen aus native.lights (Hue-IDs) → Lampen-Kanäle mit gleichem native.id
 * auf derselben Ebene derselben Instanz. Gruppen mit gleicher Lampenauswahl werden nur einmal geliefert.
 *
 * @param objects alle Objekte
 * @param lang Sprache für Namen
 * @param stale Kanäle einer veralteten Objektstruktur (aus hueRoomHints)
 */
export function hueSceneGroups(objects: ObjectMap, lang: string, stale: Set<string>): HueSceneGroupRaw[] {
    const lightChannels = new Map<string, string>();
    const groups: { id: string; obj: ioBroker.Object; kind: SvSceneGroup['kind']; lights: string[] }[] = [];
    const scenes = new Map<string, SvScene[]>();
    // hue-v2: Name der aktiven Szene je Gruppe (<Gruppe>.activeScene, leer = keine)
    const activeRefs = new Map<string, SvStateRef>();
    const addScene = (channel: string, scene: SvScene): void => {
        scenes.set(channel, [...(scenes.get(channel) || []), scene]);
    };

    for (const [id, obj] of Object.entries(objects)) {
        if (!isHueId(id) || stale.has(id)) {
            continue;
        }
        const parts = id.split('.');
        const nativeType = hueNativeType(obj);
        if (obj.type === 'channel') {
            const role = hueChannelRole(obj);
            const native = (obj.native || {}) as { id?: string | number };
            const prefix = `${parts[0]}.${parts[1]}|${parts.length}`;
            const lights = hueGroupLights(obj);
            if (GROUP_KINDS[role] && !HUE_IGNORED_GROUP_ROLES.has(role) && lights) {
                groups.push({ id, obj, kind: GROUP_KINDS[role], lights: lights.map(l => `${prefix}|${l}`) });
            } else if ((role.startsWith('light') || role === 'switch') && native.id !== undefined) {
                lightChannels.set(`${prefix}|${native.id}`, id);
            }
        } else if (obj.type === 'state' && /^scene_/i.test(parts[parts.length - 1])) {
            const name = sceneName(getName(obj, lang) || parts[parts.length - 1]);
            if (!name || INTERNAL_SCENE.test(name)) {
                continue;
            }
            const common = obj.common as ioBroker.StateCommon;
            addScene(parts.slice(0, -1).join('.'), {
                name,
                // Der Hue-Adapter legt Szenen als Knopf ohne type/write an – auslösen per true
                state: { name: 'SCENE', id, type: 'boolean', role: common.role || 'button', write: true },
            });
        } else if (obj.type === 'state' && parts[parts.length - 1] === 'activeScene') {
            activeRefs.set(parts.slice(0, -1).join('.'), {
                name: 'ACTIVE_SCENE',
                id,
                type: 'string',
                role: 'text',
                write: false,
            });
        } else if (obj.type === 'state' && (nativeType === 'scene' || nativeType === 'smart_scene')) {
            // hue-v2: <Gruppe>.scenes.<Name> bzw. <Gruppe>.smartScenes.<Name>
            const name = getName(obj, lang) || parts[parts.length - 1].replace(/_/g, ' ');
            const smart = nativeType === 'smart_scene';
            addScene(parts.slice(0, -2).join('.'), {
                name,
                state: { name: 'SCENE', id, type: 'boolean', role: smart ? 'switch' : 'button', write: true },
                ...(smart && { smart }),
            });
        }
    }

    const result: HueSceneGroupRaw[] = [];
    const seen = new Set<string>();
    const withLights = groups
        .map(group => ({
            ...group,
            channels: group.lights.map(l => lightChannels.get(l)).filter((l): l is string => !!l),
            list: scenes.get(group.id) || [],
        }))
        .filter(g => g.list.length);
    // Gleiche Lampenauswahl (z. B. alte und neue Gruppe derselben Bridge): die Gruppe mit den meisten Szenen
    // gewinnt, bei Gleichstand Raum vor Zone
    withLights.sort(
        (a, b) =>
            b.list.length - a.list.length ||
            (a.kind === b.kind ? 0 : a.kind === 'room' ? -1 : 1) ||
            a.id.localeCompare(b.id),
    );
    for (const group of withLights) {
        const key = `${group.id.split('.', 2).join('.')}|${[...group.channels].sort().join(',')}`;
        if (group.channels.length && seen.has(key)) {
            continue;
        }
        seen.add(key);
        const native = group.obj.native as { name?: string };
        result.push({
            id: group.id,
            name: native.name || getName(group.obj, lang) || group.id.split('.').pop()!,
            kind: group.kind,
            lightChannels: group.channels,
            scenes: group.list.sort((a, b) => a.name.localeCompare(b.name, lang)),
            ...(activeRefs.has(group.id) && { active: activeRefs.get(group.id) }),
        });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}
