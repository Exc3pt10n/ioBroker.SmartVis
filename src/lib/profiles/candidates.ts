import type { ObjectMap } from './types';

/**
 * Adapterspezifische Regeln, welche Kanäle/Geräte überhaupt Kachel-Kandidaten sind.
 * Ziel: Nur bedienbare bzw. aussagekräftige Kanäle – keine Wartungs-, Tasten-,
 * Wochenprofil- oder Schwellwert-Kanäle.
 */

/** Homematic(-IP) Kanaltypen ohne Nutzen für eine Bedienoberfläche */
const HM_SKIP_TYPES = [
    /^MAINTENANCE$/,
    /^KEY_TRANSCEIVER$/,
    /^VIRTUAL_KEY$/,
    /^MULTI_MODE_INPUT_TRANSMITTER$/,
    /_WEEK_PROFILE$/,
    /^COND_SWITCH_TRANSMITTER/,
    /^ALARM_COND_SWITCH_TRANSMITTER$/,
    /^HEATING_CLIMATECONTROL_(RECEIVER|CL_TRANSMITTER|SWITCH_TRANSMITTER)$/,
    /^HEATING_SHUTTER_CONTACT_RECEIVER$/,
    /^HEATING_KEY_RECEIVER$/,
    /^CLIMATECONTROL_/,
    /^ACCESSPOINT_GENERIC_RECEIVER$/,
];

/** Homematic-Gerätetypen, deren Kanäle nie Kacheln sind (CCU selbst, virtuelle Fernbedienung) */
const HM_SKIP_DEVICES = [/^HmIP-CCU/i, /^HmIP-RCV-/i, /^HM-RCV-/i];

/**
 * Homematic IP Aktoren: Je Ausgang ein *_TRANSMITTER (Status, nur lesend) gefolgt von
 * drei *_VIRTUAL_RECEIVER. Bedient wird der erste virtuelle Kanal – genau den ordnet
 * auch die CCU Räumen und Gewerken zu.
 */
function hmCandidate(id: string, obj: ioBroker.Object, objects: ObjectMap): boolean {
    if (obj.type === 'device') {
        return true;
    }
    const type = String((obj.native as { TYPE?: string })?.TYPE || '');
    const parent = id.substring(0, id.lastIndexOf('.'));
    const deviceType = String((objects[parent]?.native as { TYPE?: string })?.TYPE || '');
    if (HM_SKIP_DEVICES.some(r => r.test(deviceType)) || HM_SKIP_TYPES.some(r => r.test(type))) {
        return false;
    }
    const channel = Number(id.substring(id.lastIndexOf('.') + 1));
    const prevType = String((objects[`${parent}.${channel - 1}`]?.native as { TYPE?: string })?.TYPE || '');

    if (type.endsWith('_VIRTUAL_RECEIVER')) {
        return prevType.endsWith('_TRANSMITTER');
    }
    if (type.endsWith('_TRANSMITTER')) {
        // Status-Kanal überspringen, wenn ihm virtuelle Kanäle folgen
        const nextType = String((objects[`${parent}.${channel + 1}`]?.native as { TYPE?: string })?.TYPE || '');
        return !nextType.endsWith('_VIRTUAL_RECEIVER');
    }
    return true;
}

/** Hue: nur Lampen, Steckdosen und Raum/Zonen-Gruppen mit mehreren Lampen */
function hueCandidate(id: string, obj: ioBroker.Object, staleHue: Set<string>): boolean {
    if (staleHue.has(id)) {
        return false;
    }
    const role = String(obj.common?.role || '');
    if (role.startsWith('light') || role === 'switch') {
        return true;
    }
    if (role === 'Room' || role === 'Zone') {
        const lights = (obj.native as { lights?: unknown[] })?.lights;
        return Array.isArray(lights) && lights.length > 1;
    }
    // LightGroup "All", Entertainment, Sensoren, Smart Scenes
    return false;
}

/** Erlaubte Gerätetypen je Adapter (Rest ist Rauschen) */
export const ADAPTER_ALLOWED_TYPES: Record<string, string[]> = {
    // Echo-Geräte: nur die Player sind sinnvoll, nicht Wecker/Erinnerungen/Lautstärke-Kanäle
    alexa2: ['media'],
};

/** Prüft, ob ein Kanal/Gerät als Kachel-Kandidat infrage kommt */
export function isCandidate(id: string, obj: ioBroker.Object, objects: ObjectMap, staleHue: Set<string>): boolean {
    const adapter = id.split('.')[0];
    if (adapter === 'hm-rpc') {
        return hmCandidate(id, obj, objects);
    }
    if (adapter === 'hue') {
        return hueCandidate(id, obj, staleHue);
    }
    return true;
}
