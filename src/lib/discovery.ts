import ChannelDetector, { Types, type PatternControl } from '@iobroker/type-detector';
import type { RoomSource, SvDevice, SvModel, SvRoom, SvStateRef } from '../shared/protocol';
import { attachHistory } from './history';
import { getName } from './names';
import { profileStateRefs, pvForecastRefs, runProfiles, shutterControlRefs } from './profiles';
import { ADAPTER_ALLOWED_TYPES, isCandidate } from './profiles/candidates';
import { hueRoomHints } from './profiles/hueRooms';
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
    /** Aufgezeichnete State-IDs → History-Instanz (Whitelist für Verlaufsabfragen) */
    historyIds: Map<string, string>;
}

type ObjectMap = Record<string, ioBroker.Object>;

/** Interne Markierung für Geräte mit generischem Kanalnamen (Wert: Eltern-Geräte-ID) */
const GENERIC = '__genericParent';

const TYPE_NAMES: Record<string, string> = {
    blind: 'Rollladen',
    light: 'Licht',
    dimmer: 'Licht',
    socket: 'Schalter',
    thermostat: 'Thermostat',
    window: 'Fenster',
    windowTilt: 'Fenster',
    door: 'Tür',
    percentage: 'Ausgang',
};

/** Typen, die neben einem "echten" Gerät im selben Kanal nur Hilfswerte sind */
const SECONDARY_TYPES = new Set<string>([
    Types.slider,
    Types.percentage,
    Types.volume,
    Types.button,
    Types.illuminance,
]);

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
        // Instanz-Objekte (system.adapter.*) werden für die Konfiguration einiger Profile benötigt
        if (obj && (id.startsWith('enum.') || id.startsWith('system.adapter.') || !isIgnored(id))) {
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
    const hue = hueRoomHints(filtered, lang, [...new Set([...rooms.names(), ...DEFAULT_ROOM_NAMES])]);

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
    for (const sc of profiles.shutterControl) {
        const refs = shutterControlRefs(sc);
        refs.read.forEach(r => stateIds.add(r.id));
        refs.write.forEach(r => {
            stateIds.add(r.id);
            writableIds.add(r.id);
        });
    }
    // PV-Prognose: nur lesend
    for (const pv of profiles.pvForecast) {
        pvForecastRefs(pv).forEach(r => stateIds.add(r.id));
    }
    // Wetter: nur lesend abonnieren, die Station darf trotzdem als normale Kachel erscheinen
    for (const item of profiles.weather) {
        for (const s of profileStateRefs(item)) {
            stateIds.add(s.id);
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
        const structural = obj.type === 'channel' || (obj.type === 'device' && !hasChannels.has(id));
        return structural && isCandidate(id, obj, filtered, hue.stale);
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
                // "info" fasst beliebige Werte zusammen – zu unspezifisch für automatische Kacheln.
                // "buttonSensor"/"button" sind Tasten von Fernbedienungen/Wandtastern bzw. Befehlstrigger:
                // automatisch erkannt fast nur Rauschen (später manuell hinzufügbar).
                excludedTypes: [Types.info, Types.buttonSensor, Types.button],
                // Eine Lampe nur einmal erkennen (nicht zusätzlich als rgb, hue, ct …)
                limitTypesToOneOf: [['light', 'dimmer', 'ct', 'rgb', 'rgbSingle', 'rgbwSingle', 'hue', 'cie']],
            });
        } catch {
            controls = null;
        }
        if (!controls) {
            continue;
        }
        const allowed = ADAPTER_ALLOWED_TYPES[id.split('.')[0]];
        controls = controls.filter(c => !allowed || allowed.includes(c.type));
        // Mehrere Treffer in einem Kanal: Hilfs-Slider/Prozentwerte neben einem Hauptgerät verwerfen
        if (controls.length > 1) {
            const primary = controls.filter(c => !SECONDARY_TYPES.has(c.type));
            if (primary.length) {
                controls = primary;
            }
            // Thermostate (z. B. HmIP-WTH) melden den Fensterstatus mit – keine eigene Fenster-Kachel
            if (controls.some(c => c.type === Types.thermostat)) {
                controls = controls.filter(c => c.type !== Types.window && c.type !== Types.windowTilt);
            }
        }
        for (const [index, control] of controls.entries()) {
            const deviceId = controls.length > 1 ? `${id}#${index}` : id;
            const device = toDevice(id, deviceId, control, filtered, lang, memberToRoom, hue, rooms);
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

    devices.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    // Namen aus der Rollladen-Automatik für nicht umbenannte Kanäle ("Küche Eckfenster Seite" statt "Rollladen 2")
    for (const sc of profiles.shutterControl) {
        for (const shutter of sc.shutters) {
            const device = shutter.level && devices.find(d => d.states.some(st => st.id === shutter.level!.id));
            const record = device as unknown as Record<string, string> | undefined;
            if (device && !device.roomId) {
                // Raum aus dem Rollladennamen der Automatik ableiten ("Küche Seite" → Küche)
                const guess = guessRoom([shutter.name], [...new Set([...rooms.names(), ...DEFAULT_ROOM_NAMES])]);
                if (guess) {
                    device.roomId = rooms.ensure(guess.name, 'name');
                    device.roomSource = 'name';
                }
            }
            if (device && record?.[GENERIC]) {
                delete record[GENERIC];
                const roomName = device.roomId ? rooms.rooms.get(device.roomId)?.name : undefined;
                device.name = roomName ? stripRoomFromName(shutter.name, roomName) : shutter.name;
            }
        }
    }
    renameGenericChannels(devices);
    devices.sort((a, b) => a.name.localeCompare(b.name, lang));
    const roomList = [...rooms.rooms.values()].sort((a, b) => a.name.localeCompare(b.name, lang));

    const model: SvModel = {
        rooms: roomList,
        devices,
        energy: profiles.energy,
        wallboxes: profiles.wallboxes,
        pvForecast: profiles.pvForecast,
        weather: profiles.weather,
        shutterControl: profiles.shutterControl,
        generatedAt: Date.now(),
        editable: false,
    };
    const historyIds = attachHistory(model, filtered);

    return { model, stateIds: [...stateIds], writableIds, historyIds };
}

function toDevice(
    id: string,
    deviceId: string,
    control: PatternControl,
    objects: ObjectMap,
    lang: string,
    memberToRoom: Map<string, string>,
    hue: { hints: Map<string, string>; roomGroups: Set<string> },
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

    // Homematic: Kanalnamen sind oft "Gerät:1" (in der CCU nicht umbenannt) → Gerätenamen verwenden.
    // Hat das Gerät mehrere Ausgänge, wird der Name später durch den Gerätetyp ersetzt.
    let genericName = false;
    if (/:\d+$/.test(name) && parentName) {
        name = parentName;
        genericName = true;
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
        const hint = hue.hints.get(id) || hue.hints.get(parentId(id));
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
        if (hue.roomGroups.has(id) && LIGHT_TYPES.has(control.type)) {
            // Hue-Raumgruppe → "Alle Lichter"
            name = 'Alle Lichter';
        } else if (normalize(name) !== normalize(roomName)) {
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
        ...(genericName ? { [GENERIC]: parentId(id) } : {}),
    };
}

/**
 * Geräte mit mehreren Ausgängen (z. B. 4-fach-Rollladenaktor) und nicht umbenannten Kanälen
 * erhalten statt "Rollladenaktor" den Gerätetyp als Namen, bei Bedarf je Raum durchnummeriert.
 */
function renameGenericChannels(devices: SvDevice[]): void {
    // Anzahl unterschiedlicher Kanäle je Gerät (mehrere Treffer in einem Kanal zählen einmal)
    const channelsPerParent = new Map<string, Set<string>>();
    for (const d of devices) {
        const parent = (d as unknown as Record<string, string>)[GENERIC];
        if (parent) {
            const set = channelsPerParent.get(parent) || new Set<string>();
            set.add(d.id.split('#')[0]);
            channelsPerParent.set(parent, set);
        }
    }
    const used = new Map<string, number>();
    for (const d of devices) {
        const record = d as unknown as Record<string, string>;
        const parent = record[GENERIC];
        delete record[GENERIC];
        const base = TYPE_NAMES[d.type];
        if (!parent || !base || (channelsPerParent.get(parent)?.size || 0) < 2) {
            continue;
        }
        const key = `${d.roomId}|${base}`;
        const n = (used.get(key) || 0) + 1;
        used.set(key, n);
        d.name = n === 1 ? base : `${base} ${n}`;
    }
}
