import ChannelDetector, { Types, type PatternControl } from '@iobroker/type-detector';
import type { RoomSource, SvDevice, SvModel, SvRoom, SvStateRef } from '../shared/protocol';
import { getName } from './names';
import { profileStateRefs, runProfiles } from './profiles';
import { HUE_IGNORED_GROUP_ROLES, hueRoomHints } from './profiles/hueRooms';
import { DEFAULT_ROOM_NAMES, guessRoom, normalize, slug, stripRoomFromName } from './rooms';

export { getName };

export interface DiscoveryOptions {
    /** Sprache für mehrsprachige Namen */
    language: string;
    /** Adapter-Namespaces, die ignoriert werden (z. B. "system", "admin") */
    ignoreAdapters: string[];
}

export interface DiscoveryResult {
    model: SvModel;
    /** Alle State-IDs, die abonniert werden müssen */
    stateIds: string[];
    /** Schreibbare State-IDs (Whitelist für Schreibbefehle aus der App) */
    writableIds: Set<string>;
}

type ObjectMap = Record<string, ioBroker.Object>;

const LIGHT_TYPES = new Set<string>([
    Types.light,
    Types.dimmer,
    Types.ct,
    Types.hue,
    Types.rgb,
    Types.rgbSingle,
    Types.rgbwSingle,
    Types.cie,
]);

function parentId(id: string): string {
    return id.substring(0, id.lastIndexOf('.'));
}

/** Raumverwaltung: führt Räume aus Enums, Adaptern und Namen anhand des Namens zusammen */
class RoomRegistry {
    readonly rooms = new Map<string, SvRoom>();
    private byName = new Map<string, string>();

    add(id: string, name: string, source: RoomSource): string {
        const key = normalize(name);
        const existing = this.byName.get(key);
        if (existing) {
            return existing;
        }
        this.rooms.set(id, { id, name, source });
        this.byName.set(key, id);
        return id;
    }

    /** Raum anhand des Namens finden oder neu anlegen */
    ensure(name: string, source: RoomSource): string {
        return this.add(`auto.${slug(name)}`, name, source);
    }

    names(): string[] {
        return [...this.rooms.values()].map(r => r.name);
    }
}

/**
 * Erzeugt aus allen ioBroker-Objekten das Device-Model der Visualisierung.
 * Reine Funktion – erleichtert Tests mit exportierten Objekt-Dumps.
 *
 * Reihenfolge der Raumquellen: enum.rooms → Adapter (Hue-Räume) → Gerätename.
 */
export function discover(objects: ObjectMap, options: DiscoveryOptions): DiscoveryResult {
    const lang = options.language;
    const ignore = new Set(options.ignoreAdapters.map(a => a.trim()).filter(Boolean));
    const isIgnored = (id: string): boolean => ignore.has(id.split('.')[0]);

    const filtered: ObjectMap = {};
    for (const [id, obj] of Object.entries(objects)) {
        if (obj && (id.startsWith('enum.') || !isIgnored(id))) {
            filtered[id] = obj;
        }
    }

    // 1. Räume aus Enums (z. B. von hm-rega aus der CCU synchronisiert)
    const rooms = new RoomRegistry();
    const memberToRoom = new Map<string, string>();
    for (const [id, obj] of Object.entries(filtered)) {
        if (!id.startsWith('enum.rooms.') || obj.type !== 'enum') {
            continue;
        }
        const roomId = rooms.add(id, getName(obj, lang) || id.split('.').pop()!, 'enum');
        for (const member of (obj.common as ioBroker.EnumCommon).members || []) {
            memberToRoom.set(member, roomId);
        }
    }

    // 2. Räume aus Adaptern
    const adapterHints = hueRoomHints(filtered, lang);

    const keys = Object.keys(filtered).sort();
    const usedIds: string[] = [];
    const devices: SvDevice[] = [];
    const stateIds = new Set<string>();
    const writableIds = new Set<string>();

    // 3. Adapter-Profile (PV, Speicher, Wallbox …) – vor dem type-detector,
    //    damit deren States nicht zusätzlich als generische Kacheln auftauchen
    const profiles = runProfiles(filtered, lang, isIgnored);
    for (const item of [...profiles.energy, ...profiles.wallboxes]) {
        for (const s of profileStateRefs(item)) {
            stateIds.add(s.id);
            usedIds.push(s.id);
            if (s.write) {
                writableIds.add(s.id);
            }
        }
    }
    const claimed = profiles.claimedInstances.map(i => `${i}.`);
    const isClaimed = (id: string): boolean => claimed.some(prefix => id.startsWith(prefix));

    // 4. Gerätetypen erkennen
    // Kandidaten: alle Kanäle sowie Geräte, die States direkt (ohne Kanal-Ebene) enthalten.
    // Geräte mit Kanälen (z. B. Homematic) würden sonst doppelt erkannt.
    const hasChannels = new Set<string>();
    for (const id of keys) {
        if (filtered[id].type === 'channel') {
            hasChannels.add(parentId(id));
        }
    }
    const candidates = keys.filter(id => {
        const obj = filtered[id];
        if (isClaimed(id)) {
            return false;
        }
        if (id.startsWith('hue.') && HUE_IGNORED_GROUP_ROLES.has(String(obj.common?.role))) {
            return false;
        }
        return obj.type === 'channel' || (obj.type === 'device' && !hasChannels.has(id));
    });

    const detector = new ChannelDetector();
    for (const id of candidates) {
        let controls: PatternControl[] | null = null;
        try {
            controls = detector.detect({
                objects: filtered,
                id,
                _keysOptional: keys,
                _keysOptionalSorted: true,
                _usedIdsOptional: usedIds,
                ignoreIndicators: ['UNREACH_STICKY'],
                // "info" fasst beliebige Werte zusammen – zu unspezifisch für automatische Kacheln
                excludedTypes: [Types.info],
            });
        } catch {
            controls = null;
        }
        if (!controls) {
            continue;
        }
        for (const [index, control] of controls.entries()) {
            const deviceId = controls.length > 1 ? `${id}#${index}` : id;
            const device = toDevice(id, deviceId, control, filtered, lang, memberToRoom, adapterHints, rooms);
            if (!device) {
                continue;
            }
            devices.push(device);
            for (const s of device.states) {
                stateIds.add(s.id);
                if (s.write) {
                    writableIds.add(s.id);
                }
            }
        }
    }

    devices.sort((a, b) => a.name.localeCompare(b.name, lang));
    const roomList = [...rooms.rooms.values()].sort((a, b) => a.name.localeCompare(b.name, lang));

    return {
        model: {
            rooms: roomList,
            devices,
            energy: profiles.energy,
            wallboxes: profiles.wallboxes,
            generatedAt: Date.now(),
        },
        stateIds: [...stateIds],
        writableIds,
    };
}

function toDevice(
    id: string,
    deviceId: string,
    control: PatternControl,
    objects: ObjectMap,
    lang: string,
    memberToRoom: Map<string, string>,
    adapterHints: Map<string, string>,
    rooms: RoomRegistry,
): SvDevice | null {
    const states: SvStateRef[] = [];
    for (const s of control.states) {
        if (!s.id || objects[s.id]?.type !== 'state') {
            continue;
        }
        const common = (objects[s.id]?.common || {}) as ioBroker.StateCommon;
        states.push({
            name: s.name,
            id: s.id,
            type: common.type,
            role: common.role,
            unit: common.unit,
            min: common.min,
            max: common.max,
            write: common.write === true,
            indicator: s.indicator || undefined,
        });
    }
    if (!states.length) {
        return null;
    }

    const obj = objects[id];
    const parent = objects[parentId(id)];
    let name = getName(obj, lang) || id.split('.').pop()!;
    const parentName =
        parent && (parent.type === 'device' || parent.type === 'channel') ? getName(parent, lang) : undefined;

    // Homematic: Kanalnamen sind oft "Gerät:1" → Gerätenamen verwenden
    if (/:\d+$/.test(name) && parentName) {
        name = parentName;
    }

    // Raum: Enum (Kanal, Gerät, States) → Adapter → Name
    let roomId: string | null = null;
    let roomSource: RoomSource | null = null;
    for (const candidate of [id, parentId(id), ...states.map(s => s.id)]) {
        const enumRoom = memberToRoom.get(candidate);
        if (enumRoom) {
            roomId = enumRoom;
            roomSource = 'enum';
            break;
        }
    }
    if (!roomId) {
        const hint = adapterHints.get(id) || adapterHints.get(parentId(id));
        if (hint) {
            roomId = rooms.ensure(hint, 'adapter');
            roomSource = 'adapter';
        }
    }
    if (!roomId) {
        const guess = guessRoom([name, parentName, id], [...new Set([...rooms.names(), ...DEFAULT_ROOM_NAMES])]);
        if (guess) {
            roomId = rooms.ensure(guess.name, 'name');
            roomSource = 'name';
        }
    }
    if (roomId) {
        const roomName = rooms.rooms.get(roomId)!.name;
        if (normalize(name) !== normalize(roomName)) {
            name = stripRoomFromName(name, roomName);
        } else if (LIGHT_TYPES.has(control.type)) {
            // Raumgruppe (z. B. Hue-Raum "Küche") → "Alle Lichter"
            name = 'Alle Lichter';
        }
    }

    return {
        id: deviceId,
        name,
        type: control.type,
        roomId,
        roomSource,
        adapter: id.split('.')[0],
        states,
    };
}
