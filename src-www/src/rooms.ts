import type { SvDevice, SvRoom, SvStateValue } from '../../src/shared/protocol';
import { isActive, isCoveredGroup, isPlaying, tapAction, valueState, warnings } from './device';

type States = Record<string, SvStateValue | null>;

const LIGHT_TYPES = ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'];
const OPENING_TYPES = ['window', 'windowTilt', 'door'];

/** Symbol aus dem Raumnamen (Reihenfolge zählt: "Gäste WC" → WC, nicht Gäste) */
const ROOM_ICONS: [RegExp, string][] = [
    [/\bwc\b|toilette|klo/i, '🚽'],
    [/bad|dusch|bath/i, '🛁'],
    [/küche|kueche|kitchen|theke/i, '🍳'],
    [/ess(zimmer|tisch|bereich)?\b|dining/i, '🍽️'],
    [/schlaf|bett|nacht|bed/i, '🛏️'],
    [/wohn|living|lounge/i, '🛋️'],
    [/fernseh|\btv\b|kino/i, '📺'],
    [/büro|buero|arbeit|office|\bpc\b|studio/i, '💻'],
    [/kind|baby|wickel|spiel/i, '🧸'],
    [/ankleide|wardrobe|garderobe/i, '👔'],
    [/flur|diele|treppe|stair|eingang|entrance|hall/i, '🚪'],
    [/garten|terrasse|balkon|vorgarten|garden|terrace|patio/i, '🌿'],
    [/garage|einfahrt|carport|driveway/i, '🚗'],
    [/wasch|laundry|hauswirtschaft|\bhwr\b/i, '🧺'],
    [/technik|heizung|equipment|server/i, '⚙️'],
    [/keller|abstell|lager|storage|speicher/i, '📦'],
    [/gäste|gast|guest/i, '🛎️'],
    [/weihnacht|christmas/i, '🎄'],
    [/ambiente|deko/i, '✨'],
];

/** Auswahl im Bearbeiten-Modus */
export const ROOM_ICON_CHOICES = [
    '🛋️',
    '🍳',
    '🍽️',
    '🛏️',
    '🛁',
    '🚽',
    '💻',
    '🧸',
    '👔',
    '🚪',
    '🌿',
    '🚗',
    '🧺',
    '⚙️',
    '📦',
    '📺',
    '🎮',
    '🏋️',
    '🛎️',
    '✨',
    '🎄',
    '🐾',
    '🏠',
    '🏡',
];

export function autoRoomIcon(name: string): string {
    return ROOM_ICONS.find(([re]) => re.test(name))?.[1] ?? '🏠';
}

export function roomIcon(room: Pick<SvRoom, 'name' | 'icon'>): string {
    return room.icon || autoRoomIcon(room.name);
}

export interface RoomStatus {
    temperature?: number;
    humidity?: number;
    /** Eingeschaltete Lampen (ohne Gruppen, deren Lampen selbst angezeigt werden) */
    lights: SvDevice[];
    open: number;
    /** Laufende Klimageräte: 🔥 alle heizen, ❄️ alle kühlen, sonst 🌡️ */
    climate?: string;
    playing: number;
    problems: number;
    /** Niedrigste Rollladen-Position in %, wenn nicht alle offen sind */
    blindMin?: number;
}

function numberOf(states: States, id: string | undefined): number | undefined {
    const v = id ? states[id]?.val : undefined;
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
}

/** Bevorzugte Quelle für die Raumtemperatur: Thermostat, dann Sensor, dann Klimagerät */
const TEMP_PRIORITY = ['thermostat', 'temperature', 'humidity', 'airCondition'];

/** Was ist in diesem Raum los? (nur sichtbare Geräte) */
export function roomStatus(devices: SvDevice[], states: States): RoomStatus {
    const visible = devices.filter(d => !d.hidden);
    const visibleIds = new Set(visible.map(d => d.id));
    const status: RoomStatus = { lights: [], open: 0, playing: 0, problems: 0 };

    const sorted = [...visible].sort(
        (a, b) => (TEMP_PRIORITY.indexOf(a.type) + 1 || 99) - (TEMP_PRIORITY.indexOf(b.type) + 1 || 99),
    );
    for (const d of sorted) {
        for (const s of d.states) {
            // Außentemperatur von Klimageräten gehört nicht zum Raum
            if (s.name === 'OUTDOOR' || s.write) {
                continue;
            }
            if (status.temperature === undefined && /temperature/.test(s.role || '')) {
                status.temperature = numberOf(states, s.id);
            }
            if (status.humidity === undefined && /humidity/.test(s.role || '')) {
                status.humidity = numberOf(states, s.id);
            }
        }
    }

    const climateModes = new Set<string>();
    let blindMin: number | undefined;
    for (const d of visible) {
        if (LIGHT_TYPES.includes(d.type)) {
            if (!isCoveredGroup(d, visibleIds) && isActive(d, states)) {
                status.lights.push(d);
            }
        } else if (OPENING_TYPES.includes(d.type)) {
            if (isActive(d, states)) {
                status.open++;
            }
        } else if (d.type === 'airCondition') {
            if (isActive(d, states)) {
                const mode = d.states.find(s => s.name === 'MODE');
                climateModes.add(mode ? String(states[mode.id]?.val ?? '') : '');
            }
        } else if (d.type === 'media' || d.type === 'mediaPlayer') {
            if (
                isPlaying(
                    states,
                    d.states.find(s => s.name === 'STATE'),
                )
            ) {
                status.playing++;
            }
        } else if (d.type === 'blind') {
            const level = numberOf(states, valueState(d)?.id);
            if (level !== undefined) {
                blindMin = blindMin === undefined ? level : Math.min(blindMin, level);
            }
        }
        if (warnings(d, states).length) {
            status.problems++;
        }
    }
    if (climateModes.size) {
        status.climate =
            climateModes.size === 1 && climateModes.has('HEAT')
                ? '🔥'
                : climateModes.size === 1 && climateModes.has('COOL')
                  ? '❄️'
                  : '🌡️';
    }
    // Rollläden: 100 % = offen (Homematic/shuttercontrol); nur zeigen, wenn einer (teilweise) zu ist
    if (blindMin !== undefined && blindMin < 95) {
        status.blindMin = blindMin;
    }
    return status;
}

/** Alle eingeschalteten Lampen eines Raums ausschalten (Schalter aus, Dimmer auf Minimum) */
export function lightsOff(lights: SvDevice[], set: (id: string, val: boolean | number) => void): void {
    for (const d of lights) {
        const action = tapAction(d);
        if (!action) {
            continue;
        }
        if (action.state.type === 'boolean') {
            set(action.state.id, false);
        } else {
            set(action.state.id, action.state.min ?? 0);
        }
    }
}
