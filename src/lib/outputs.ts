import type { PatternControl } from '@iobroker/type-detector';

type ObjectMap = Record<string, ioBroker.Object>;

/** Kanal/Gerät ohne Kachel – Grund für die Diagnose */
export interface Unmatched {
    id: string;
    /** no-match: keine passenden Rollen; filtered: Typ für diesen Adapter ausgeschlossen */
    reason: 'no-match' | 'filtered';
}

/** Schaltausgang: schreibbarer boolean-State mit Schalter-Rolle */
const OUTPUT_ROLE = /^switch(\.light|\.power)?$/;

/** Bezeichnung eines Ausgangs aus dem State-Namen: POWER2 → "2", state_l1 → "L1", switch_usb1 → "USB1" */
export function outputLabel(key: string): string {
    const rest = key.replace(/^(POWER|power|switch|state|relay|Relay|output)[_-]?/i, '').replace(/[_-]+/g, ' ');
    return rest ? rest.toUpperCase() : key;
}

/**
 * Mehrfach-Schalter: Der type-detector findet je Kanal nur einen Schalter (z. B. Tasmota POWER1–4,
 * Tuya switch_1–3, Zigbee state_l1/state_l2). Liegen mehrere nummerierte Schaltausgänge im selben
 * Kanal/Gerät, wird der Treffer zu einem Gerät je Ausgang aufgeteilt. Messwerte (Leistung …) gelten für
 * das ganze Gerät und entfallen dann, Indikatoren (erreichbar, Funk) bleiben.
 */
export function splitOutputs(
    id: string,
    controls: PatternControl[],
    objects: ObjectMap,
    keys: string[],
): { control: PatternControl; suffix?: string }[] {
    const plain = controls.map(control => ({ control }));
    const index = controls.findIndex(c => c.type === 'socket' || c.type === 'light');
    if (index < 0) {
        return plain;
    }
    const main = controls[index].states.find(s => s.id && (s.name === 'SET' || s.name === 'ON'));
    if (!main?.id) {
        return plain;
    }
    const prefix = `${id}.`;
    const outputs = keys.filter(k => {
        if (!k.startsWith(prefix) || k.indexOf('.', prefix.length) !== -1) {
            return false;
        }
        const common = objects[k]?.common as ioBroker.StateCommon | undefined;
        return (
            objects[k]?.type === 'state' &&
            common?.type === 'boolean' &&
            common.write === true &&
            OUTPUT_ROLE.test(String(common.role || '')) &&
            /\d$/.test(labelKey(k, common))
        );
    });
    if (outputs.length < 2 || !outputs.includes(main.id)) {
        return plain;
    }
    const base = controls[index];
    const split = outputs.map(outputId => {
        const common = objects[outputId].common as ioBroker.StateCommon;
        const states = base.states
            .filter(s => s.indicator || s === main)
            .map(s => (s === main ? { ...s, id: outputId } : s));
        const type = common.role === 'switch.light' ? 'light' : base.type;
        return {
            control: { ...base, type, states } as PatternControl,
            suffix: outputLabel(labelKey(outputId, common)),
        };
    });
    return [...plain.slice(0, index), ...split, ...plain.slice(index + 1)];
}

/** Bezeichner eines Ausgangs: Tuya nummeriert Datenpunkte (….1, ….2) – dort zählt der Code im Namen */
function labelKey(id: string, common: ioBroker.StateCommon): string {
    const key = id.split('.').pop() || '';
    if (/^\d+$/.test(key) && typeof common.name === 'string') {
        return common.name;
    }
    return key;
}
