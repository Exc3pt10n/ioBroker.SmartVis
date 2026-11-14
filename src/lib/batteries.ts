import type { SvBattery, SvDevice, SvStateRef } from '../shared/protocol';
import { getName } from './names';
import type { ObjectMap } from './profiles/types';

/** Ab hier gilt ein Ladestand als schwach (ohne eigenen "Batterie schwach"-Datenpunkt) */
export const LOW_BATTERY_PERCENT = 20;

const LOW_ROLE = /^indicator(\.maintenance)?\.(lowbat|battery)$/;
const LEVEL_ROLE = /^value\.battery$/;

/**
 * Adapter, deren "Batterie" kein auszutauschender Geräteakku ist (Hausspeicher, Autos, Telefone):
 * deren Ladestand gehört nicht in die Batterie-Übersicht
 */
const NOT_IOT = new Set([
    'qhome-ess-hyb-g2',
    'sungrow-local',
    'sungrow',
    'kecontact',
    'evcc',
    'bmw',
    'tesla-motors',
    'vw-connect',
    'renault',
    'smartcar',
    'life360',
    'icloud',
]);

/**
 * ioBroker.hue (API v1) zerlegt einen Hue-Bewegungsmelder (Modell SML…) in Bewegungs-, Helligkeits- und
 * Temperatursensor, die alle dieselbe Batterie melden – nur der Bewegungssensor zählt (hue-v2: ein Gerät)
 */
function isHueMotionPart(obj: ioBroker.Object | undefined): boolean {
    const native = (obj?.native || {}) as { type?: unknown; modelid?: unknown };
    return (
        (native.type === 'ZLLTemperature' || native.type === 'ZLLLightLevel') &&
        typeof native.modelid === 'string' &&
        native.modelid.startsWith('SML')
    );
}

/** Gerät, zu dem ein Batterie-Datenpunkt gehört: nächstes "device", sonst der übergeordnete Kanal */
function ownerOf(id: string, objects: ObjectMap): string {
    const parts = id.split('.');
    let channel: string | undefined;
    for (let n = parts.length - 1; n >= 3; n--) {
        const candidate = parts.slice(0, n).join('.');
        const type = objects[candidate]?.type;
        if (type === 'device') {
            return candidate;
        }
        if (type === 'channel' && !channel) {
            channel = candidate;
        }
    }
    return channel || parts.slice(0, -1).join('.');
}

/**
 * Batteriebetriebene Geräte aus allen Objekten: "Batterie schwach"-Anzeigen (indicator.lowbat) und Ladestände
 * (value.battery), je Gerät zusammengefasst. Raum und Name kommen von der erkannten Kachel, sonst aus den
 * Raum-Aufzählungen bzw. dem Gerätenamen.
 *
 * @param objects gefilterte Objekte (ohne ignorierte und deaktivierte Instanzen)
 * @param lang Sprache für Namen
 * @param devices erkannte Geräte (Kacheln)
 * @param memberToRoom Mitglieder von enum.rooms → Raum-ID
 * @param exclude States, die schon ein Profil nutzt (z. B. Ladestand des Hausspeichers)
 * @param roomFromName Raum aus dem Gerätenamen ("Bewegungsmelder Badezimmer") → Raum-ID und Name ohne Raum
 */
export function batteryDevices(
    objects: ObjectMap,
    lang: string,
    devices: SvDevice[],
    memberToRoom: Map<string, string>,
    exclude: Set<string>,
    roomFromName: (name: string) => { roomId: string; name: string } | undefined = () => undefined,
): SvBattery[] {
    const byOwner = new Map<string, SvBattery>();
    for (const [id, obj] of Object.entries(objects)) {
        if (obj.type !== 'state' || exclude.has(id) || NOT_IOT.has(id.split('.')[0])) {
            continue;
        }
        const common = obj.common as ioBroker.StateCommon;
        const role = String(common.role || '');
        const isLow = LOW_ROLE.test(role) && common.type === 'boolean';
        const isLevel = LEVEL_ROLE.test(role) && common.type === 'number';
        if (!isLow && !isLevel) {
            continue;
        }
        const owner = ownerOf(id, objects);
        if (isHueMotionPart(objects[owner])) {
            continue;
        }
        const entry = byOwner.get(owner) || {
            id: owner,
            name: '',
            roomId: null,
            adapter: id.split('.')[0],
        };
        const ref: SvStateRef = {
            name: isLow ? 'LOWBAT' : 'BATTERY',
            id,
            type: common.type,
            role,
            write: false,
            ...(isLevel && { unit: common.unit || '%' }),
            ...(isLow && { indicator: true }),
        };
        if (isLow && !entry.low) {
            entry.low = ref;
        } else if (isLevel && !entry.level) {
            entry.level = ref;
        }
        byOwner.set(owner, entry);
    }

    const result: SvBattery[] = [];
    for (const entry of byOwner.values()) {
        // Kachel desselben Geräts (Homematic: Kanal unter dem Gerät, Hue: der Kanal selbst)
        const device = devices.find(
            d => d.id === entry.id || d.id.startsWith(`${entry.id}.`) || d.id.startsWith(`${entry.id}#`),
        );
        const enumRoom =
            memberToRoom.get(entry.id) ||
            [...memberToRoom.entries()].find(([member]) => member.startsWith(`${entry.id}.`))?.[1];
        const name = device?.name || getName(objects[entry.id], lang) || entry.id.split('.').pop()!;
        const roomId = device?.roomId ?? enumRoom ?? null;
        // Ohne Kachel und Aufzählung: Raum aus dem Namen ("Rollladenschalter Küche" → Küche, "Rollladenschalter")
        const guessed = roomId ? undefined : roomFromName(name);
        result.push({
            ...entry,
            name: guessed?.name || name,
            roomId: roomId ?? guessed?.roomId ?? null,
            ...(device && { deviceId: device.id }),
        });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, lang));
}
