import type { SvDevice, SvRoom, SvStateRef, SvStateValue } from '../../src/shared/protocol';

/** Rollen-Namen der Schalt-States je nach Gerätetyp (type-detector) */
const SWITCH_NAMES = ['ON', 'SET', 'ON_SET', 'SWITCH', 'STATE'];
/** Rollen-Namen für den angezeigten Wert */
const VALUE_NAMES = ['ACTUAL', 'ON_ACTUAL', 'SET', 'ON', 'BRIGHTNESS', 'DIMMER', 'LEVEL'];

export const TYPE_LABELS: Record<string, string> = {
    light: 'Licht',
    dimmer: 'Dimmer',
    ct: 'Licht',
    hue: 'Farblicht',
    rgb: 'Farblicht',
    rgbSingle: 'Farblicht',
    rgbwSingle: 'Farblicht',
    cie: 'Farblicht',
    socket: 'Steckdose',
    blind: 'Rollladen',
    thermostat: 'Thermostat',
    airCondition: 'Klima',
    temperature: 'Temperatur',
    humidity: 'Feuchte',
    window: 'Fenster',
    windowTilt: 'Fenster',
    door: 'Tür',
    motion: 'Bewegung',
    lock: 'Schloss',
    media: 'Media',
    electricity: 'Energie',
    info: 'Info',
};

/** Schaltbarer boolean-State (Hauptaktion bei Tap) */
export function switchState(device: SvDevice): SvStateRef | undefined {
    // Klimageräte: Ein/Aus heißt POWER (bei Thermostaten wäre POWER nicht die Hauptaktion)
    const names = device.type === 'airCondition' ? ['POWER', ...SWITCH_NAMES] : SWITCH_NAMES;
    for (const name of names) {
        const s = device.states.find(st => st.name === name && st.write && st.type === 'boolean');
        if (s) {
            return s;
        }
    }
    return undefined;
}

export interface TapAction {
    state: SvStateRef;
    next: (current: SvStateValue | null | undefined) => boolean | number;
}

/**
 * Hauptaktion bei Tap: boolean-Schalter umschalten, reine Dimmer zwischen 0 und Max.
 * Rollläden/Thermostate bekommen bewusst keine Tap-Aktion (später: Detail-Sheet).
 */
export function tapAction(device: SvDevice): TapAction | undefined {
    const sw = switchState(device);
    if (sw) {
        return { state: sw, next: cur => !(cur?.val === true) };
    }
    if (device.type === 'dimmer') {
        const level = device.states.find(s => s.name === 'SET' && s.write && s.type === 'number');
        if (level) {
            return { state: level, next: cur => (Number(cur?.val) > 0 ? (level.min ?? 0) : (level.max ?? 100)) };
        }
    }
    return undefined;
}

export function valueState(device: SvDevice): SvStateRef | undefined {
    for (const name of VALUE_NAMES) {
        const s = device.states.find(st => st.name === name);
        if (s) {
            return s;
        }
    }
    return device.states.find(s => !s.indicator);
}

/**
 * Gruppe (z. B. Hue-Raum "Alle Lichter"), deren Lampen selbst angezeigt werden:
 * zählt nicht zusätzlich als Licht – sonst würde jede eingeschaltete Lampe doppelt gezählt.
 */
export function isCoveredGroup(device: SvDevice, visibleIds: Set<string>): boolean {
    return !!device.groupOf?.some(id => visibleIds.has(id));
}

/** Ist das Gerät "aktiv" (Licht an, Fenster offen …)? */
export function isActive(device: SvDevice, states: Record<string, SvStateValue | null>): boolean {
    const ref = switchState(device) || valueState(device);
    const val = ref ? states[ref.id]?.val : undefined;
    if (typeof val === 'boolean') {
        return val;
    }
    if (typeof val === 'number' && ['dimmer', 'blind', 'window', 'windowTilt', 'door'].includes(device.type)) {
        return val > 0;
    }
    return false;
}

export function formatValue(ref: SvStateRef | undefined, value: SvStateValue | null | undefined): string {
    if (!ref || !value || value.val === null || value.val === undefined) {
        return '–';
    }
    const { val } = value;
    // Werteliste (z. B. Betriebsart "COOL" → "Kühlen")
    if (ref.states && (typeof val === 'string' || typeof val === 'number') && ref.states[String(val)] !== undefined) {
        return ref.states[String(val)];
    }
    if (typeof val === 'boolean') {
        if (['window', 'windowTilt', 'door'].some(t => ref.role?.includes(t)) || ref.role?.startsWith('sensor.')) {
            return val ? 'offen' : 'geschlossen';
        }
        return val ? 'an' : 'aus';
    }
    if (typeof val === 'number' && ref.unit === 'Wh' && Math.abs(val) >= 1000) {
        return `${(Math.round(val / 100) / 10).toLocaleString('de-DE')} kWh`;
    }
    if (typeof val === 'number') {
        const rounded = Math.round(val * 10) / 10;
        return `${rounded.toLocaleString('de-DE')}${ref.unit ? ` ${ref.unit}` : ''}`;
    }
    return String(val);
}

/** Warn-Indikatoren (nicht erreichbar, Batterie leer) */
export function warnings(device: SvDevice, states: Record<string, SvStateValue | null>): string[] {
    const result: string[] = [];
    for (const s of device.states) {
        // Verbindungs-Indikator: false = nicht erreichbar
        if (s.name === 'CONNECTED') {
            if (states[s.id]?.val === false) {
                result.push('nicht erreichbar');
            }
            continue;
        }
        if (!s.indicator || states[s.id]?.val !== true) {
            continue;
        }
        if (/UNREACH/i.test(s.name)) {
            result.push('nicht erreichbar');
        } else if (/LOWBAT|BATTERY/i.test(s.name)) {
            result.push('Batterie schwach');
        } else if (/ERROR|MAINTAIN/i.test(s.name)) {
            result.push('Störung');
        }
    }
    return result;
}

/** Gerätegruppen für die Raumansicht (Reihenfolge = Anzeige) */
export const DEVICE_GROUPS: { key: string; label: string; icon: string; types: string[] }[] = [
    {
        key: 'light',
        label: 'Licht',
        icon: '💡',
        types: ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'],
    },
    { key: 'shading', label: 'Beschattung', icon: '🪟', types: ['blind', 'blindButtons'] },
    {
        key: 'climate',
        label: 'Heizung & Klima',
        icon: '🌡️',
        types: ['thermostat', 'airCondition', 'fan', 'airPurifier'],
    },
    { key: 'openings', label: 'Fenster & Türen', icon: '🚪', types: ['window', 'windowTilt', 'door', 'lock', 'gate'] },
    { key: 'power', label: 'Steckdosen & Schalter', icon: '🔌', types: ['socket', 'button', 'electricity'] },
    { key: 'media', label: 'Medien', icon: '🎵', types: ['media', 'mediaPlayer', 'tv', 'volume', 'volumeGroup'] },
    {
        key: 'sensors',
        label: 'Sensoren',
        icon: '📟',
        types: [
            'temperature',
            'humidity',
            'motion',
            'illuminance',
            'pressure',
            'percentage',
            'slider',
            'warning',
            'fireAlarm',
            'floodAlarm',
            'coAlarm',
            'airQuality',
        ],
    },
];

const OTHER_GROUP = { key: 'other', label: 'Sonstiges', icon: '•', types: [] as string[] };

/** Geräte nach Gruppe aufteilen; Reihenfolge innerhalb der Gruppe bleibt erhalten, leere Gruppen entfallen */
export function groupByType(devices: SvDevice[]): { group: (typeof DEVICE_GROUPS)[number]; devices: SvDevice[] }[] {
    const groups = [...DEVICE_GROUPS, OTHER_GROUP].map(group => ({ group, devices: [] as SvDevice[] }));
    for (const d of devices) {
        const target = groups.find(g => g.group.types.includes(d.type)) || groups[groups.length - 1];
        target.devices.push(d);
    }
    return groups.filter(g => g.devices.length > 0);
}

export interface RoomGroup {
    /** null = "Ohne Raum" */
    roomId: string | null;
    name: string;
    devices: SvDevice[];
}

/** Geräte nach Raum aufteilen (Raumreihenfolge wie in der Raumliste, "Ohne Raum" zuletzt) */
export function groupByRoom(devices: SvDevice[], rooms: SvRoom[]): RoomGroup[] {
    const result: RoomGroup[] = rooms
        .map(r => ({ roomId: r.id, name: r.name, devices: devices.filter(d => d.roomId === r.id) }))
        .filter(g => g.devices.length > 0);
    const known = new Set(rooms.map(r => r.id));
    const without = devices.filter(d => !d.roomId || !known.has(d.roomId));
    if (without.length) {
        result.push({ roomId: null, name: 'Ohne Raum', devices: without });
    }
    return result;
}

/** Läuft gerade etwas? media.state ist je nach Adapter boolean, Zahl (1 = play) oder Text */
export function isPlaying(states: Record<string, SvStateValue | null>, ref: SvStateRef | undefined): boolean {
    const v = ref ? states[ref.id]?.val : undefined;
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v === 1;
    }
    return typeof v === 'string' && /^(play|playing|1)$/i.test(v);
}
