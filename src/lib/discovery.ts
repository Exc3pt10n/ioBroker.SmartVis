import ChannelDetector, { Types, type PatternControl } from '@iobroker/type-detector';
import type { SvDevice, SvModel, SvRoom, SvStateRef } from '../shared/protocol';
import { detectEnergy, energyStateRefs } from './profiles';
import { DEFAULT_ROOM_NAMES, guessRoom, slug, stripRoomFromName } from './rooms';

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

/** Liest den Namen eines Objekts in der gewünschten Sprache */
export function getName(obj: ioBroker.Object | undefined, lang: string): string | undefined {
    const name = obj?.common?.name;
    if (!name) {
        return undefined;
    }
    if (typeof name === 'string') {
        return name;
    }
    const translated = name as Record<string, string>;
    return translated[lang] || translated.en || Object.values(translated)[0];
}

function parentId(id: string): string {
    return id.substring(0, id.lastIndexOf('.'));
}

/**
 * Erzeugt aus allen ioBroker-Objekten das Device-Model der Visualisierung.
 * Reine Funktion – erleichtert Tests mit exportierten Objekt-Dumps.
 */
export function discover(objects: ObjectMap, options: DiscoveryOptions): DiscoveryResult {
    const ignore = new Set(options.ignoreAdapters.map(a => a.trim()).filter(Boolean));
    const isIgnored = (id: string): boolean => ignore.has(id.split('.')[0]);

    const filtered: ObjectMap = {};
    for (const [id, obj] of Object.entries(objects)) {
        if (obj && (id.startsWith('enum.') || !isIgnored(id))) {
            filtered[id] = obj;
        }
    }

    // 1. Räume aus Enums
    const rooms = new Map<string, SvRoom>();
    const memberToRoom = new Map<string, string>();
    for (const [id, obj] of Object.entries(filtered)) {
        if (!id.startsWith('enum.rooms.') || obj.type !== 'enum') {
            continue;
        }
        rooms.set(id, { id, name: getName(obj, options.language) || id.split('.').pop()!, source: 'enum' });
        for (const member of (obj.common as ioBroker.EnumCommon).members || []) {
            memberToRoom.set(member, id);
        }
    }
    const roomNames = [...new Set([...[...rooms.values()].map(r => r.name), ...DEFAULT_ROOM_NAMES])];

    const keys = Object.keys(filtered).sort();
    const usedIds: string[] = [];
    const devices: SvDevice[] = [];
    const stateIds = new Set<string>();
    const writableIds = new Set<string>();

    // 2. Adapter-Profile (PV, Speicher, Wallbox …) – vor dem type-detector,
    //    damit deren States nicht zusätzlich als generische Kacheln auftauchen
    const energy = detectEnergy(filtered, options.language, isIgnored);
    for (const system of energy) {
        for (const s of energyStateRefs(system)) {
            stateIds.add(s.id);
            usedIds.push(s.id);
            if (s.write) {
                writableIds.add(s.id);
            }
        }
    }

    // 3. Gerätetypen erkennen
    const detector = new ChannelDetector();

    // Kandidaten: alle Kanäle sowie Geräte, die States direkt (ohne Kanal-Ebene) enthalten.
    // Geräte mit Kanälen (z. B. Homematic) würden sonst doppelt erkannt.
    const hasChannels = new Set<string>();
    for (const id of keys) {
        if (filtered[id].type === 'channel') {
            hasChannels.add(parentId(id));
        }
    }
    const candidates = keys.filter(id => {
        const type = filtered[id].type;
        return type === 'channel' || (type === 'device' && !hasChannels.has(id));
    });

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
            const device = toDevice(id, deviceId, control, filtered, options, memberToRoom, rooms, roomNames);
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

    devices.sort((a, b) => a.name.localeCompare(b.name, options.language));
    const roomList = [...rooms.values()].sort((a, b) => a.name.localeCompare(b.name, options.language));

    return {
        model: { rooms: roomList, devices, energy, generatedAt: Date.now() },
        stateIds: [...stateIds],
        writableIds,
    };
}

function toDevice(
    id: string,
    deviceId: string,
    control: PatternControl,
    objects: ObjectMap,
    options: DiscoveryOptions,
    memberToRoom: Map<string, string>,
    rooms: Map<string, SvRoom>,
    roomNames: string[],
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
    let name = getName(obj, options.language) || id.split('.').pop()!;
    const parentName =
        parent && (parent.type === 'device' || parent.type === 'channel')
            ? getName(parent, options.language)
            : undefined;

    // Homematic: Kanalnamen sind oft "Gerät:1" → Gerätenamen verwenden
    if (/:\d+$/.test(name) && parentName) {
        name = parentName;
    }

    // Raum: erst Enum (State, Kanal, Gerät), dann Name
    let roomId: string | null = null;
    let roomSource: SvDevice['roomSource'] = null;
    for (const candidate of [id, parentId(id), ...states.map(s => s.id)]) {
        const enumRoom = memberToRoom.get(candidate);
        if (enumRoom) {
            roomId = enumRoom;
            roomSource = 'enum';
            break;
        }
    }
    if (!roomId) {
        const guess = guessRoom([name, parentName, id], roomNames);
        if (guess) {
            const existing = [...rooms.values()].find(r => r.name === guess.name);
            if (existing) {
                roomId = existing.id;
            } else {
                roomId = `auto.${slug(guess.name)}`;
                rooms.set(roomId, { id: roomId, name: guess.name, source: 'name' });
            }
            roomSource = 'name';
        }
    }
    if (roomId) {
        name = stripRoomFromName(name, rooms.get(roomId)!.name);
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
