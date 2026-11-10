import type { SvDevice, SvStateRef, SvStateValue } from '../../src/shared/protocol';

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
    for (const name of SWITCH_NAMES) {
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
    if (typeof val === 'boolean') {
        if (['window', 'windowTilt', 'door'].some(t => ref.role?.includes(t)) || ref.role?.startsWith('sensor.')) {
            return val ? 'offen' : 'geschlossen';
        }
        return val ? 'an' : 'aus';
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
