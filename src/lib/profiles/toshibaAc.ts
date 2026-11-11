import type { ObjectMap } from './types';

/** Zustand einer Geräte-Erkennung (wie ein type-detector-Treffer, mit optionalen Beschriftungen) */
export interface DeviceControl {
    type: string;
    states: { name: string; id: string; indicator?: boolean; labels?: Record<string, string> }[];
}

/** Deutsche Beschriftungen der Wertelisten (Schlüssel wie im Adapter) */
const LABELS: Record<string, Record<string, string>> = {
    mode: { AUTO: 'Automatik', COOL: 'Kühlen', HEAT: 'Heizen', DRY: 'Entfeuchten', FAN: 'Lüften' },
    fanMode: {
        AUTO: 'Automatik',
        QUIET: 'Leise',
        LOW: 'Stufe 1',
        MEDIUM_LOW: 'Stufe 2',
        MEDIUM: 'Stufe 3',
        MEDIUM_HIGH: 'Stufe 4',
        HIGH: 'Stufe 5',
    },
    swingMode: {
        OFF: 'Aus',
        SWING_VERTICAL: 'Schwenken vertikal',
        SWING_HORIZONTAL: 'Schwenken horizontal',
        SWING_VERTICAL_AND_HORIZONTAL: 'Schwenken vertikal + horizontal',
        FIXED_1: 'Feste Position 1',
        FIXED_2: 'Feste Position 2',
        FIXED_3: 'Feste Position 3',
        FIXED_4: 'Feste Position 4',
        FIXED_5: 'Feste Position 5',
    },
    meritA: {
        OFF: 'Aus',
        SLEEP_CARE: 'Schlafmodus',
        COMFORT: 'Komfort',
        HIGH_POWER: 'Hi-Power',
        ECO: 'Eco',
        CDU_SILENT_1: 'Außengerät leise 1',
        CDU_SILENT_2: 'Außengerät leise 2',
        HEATING_8C: '8 °C Frostschutz',
    },
    meritB: { OFF: 'Aus', FIREPLACE_1: 'Kamin 1', FIREPLACE_2: 'Kamin 2' },
    powerSelection: { POWER_50: '50 %', POWER_75: '75 %', POWER_100: '100 %' },
};

/** State-Name im Adapter → Rollen-Name in SmartVis (wie type-detector, plus eigene) */
const STATES: [string, string, boolean?][] = [
    ['power', 'POWER'],
    ['targetTemperature', 'SET'],
    ['indoorTemperature', 'ACTUAL'],
    ['mode', 'MODE'],
    ['fanMode', 'SPEED'],
    ['swingMode', 'SWING'],
    ['meritA', 'SPECIAL'],
    ['meritB', 'FIREPLACE'],
    ['powerSelection', 'POWER_LIMIT'],
    ['outdoorTemperature', 'OUTDOOR'],
    ['energyConsumptionYear', 'ENERGY_YEAR'],
    ['selfCleaning', 'CLEANING', true],
];

/**
 * Toshiba-Klimageräte (Adapter toshiba-ac): je Gerät ein Objekt vom Typ "device" mit den States
 * direkt darunter (power, targetTemperature, mode …) – der type-detector erkennt das nicht.
 * Wertelisten (common.states) werden auf Deutsch beschriftet; nur Werte, die das Gerät kennt.
 */
export function toshibaAcControl(id: string, obj: ioBroker.Object, objects: ObjectMap): DeviceControl | null {
    if (obj.type !== 'device' || objects[`${id}.targetTemperature`]?.type !== 'state') {
        return null;
    }
    const states: DeviceControl['states'] = [];
    for (const [key, name, indicator] of STATES) {
        const sid = `${id}.${key}`;
        const common = objects[sid]?.common as ioBroker.StateCommon | undefined;
        if (!common) {
            continue;
        }
        const own =
            common.states && typeof common.states === 'object' && !Array.isArray(common.states)
                ? common.states
                : undefined;
        const labels = own
            ? Object.fromEntries(Object.entries(own).map(([k, v]) => [k, LABELS[key]?.[k] || String(v)]))
            : undefined;
        states.push({ name, id: sid, ...(indicator && { indicator }), ...(labels && { labels }) });
    }
    // Verbindung zur Toshiba-Cloud (gilt für alle Geräte der Instanz)
    const instance = id.split('.', 2).join('.');
    if (objects[`${instance}.info.connection`]?.type === 'state') {
        states.push({ name: 'CONNECTED', id: `${instance}.info.connection`, indicator: true });
    }
    return { type: 'airCondition', states };
}

/** Adapter mit eigener Geräte-Erkennung (statt type-detector) */
export const DEVICE_PROFILES: Partial<
    Record<string, (id: string, obj: ioBroker.Object, objects: ObjectMap) => DeviceControl | null>
> = {
    'toshiba-ac': toshibaAcControl,
};
