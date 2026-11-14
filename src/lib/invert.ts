import type { SvStateValue, ioBrokerValue } from '../shared/protocol';

export type InvertMap = Map<string, { min: number; max: number }>;

/**
 * Umgekehrte Positionen (z. B. deCONZ/FRITZ!-Rollladen: 0 = offen) auf die SmartVis-Richtung
 * "Maximum = offen" spiegeln. Die Spiegelung ist ihre eigene Umkehrung (Lesen und Schreiben gleich).
 */
export function invertNumber(val: ioBrokerValue, range: { min: number; max: number } | undefined): ioBrokerValue {
    if (!range || typeof val !== 'number' || !Number.isFinite(val)) {
        return val;
    }
    return range.min + range.max - val;
}

/** Wert für die App: gespiegelt, falls der State umgekehrt läuft */
export function presentValue(id: string, value: SvStateValue | null, inverted: InvertMap): SvStateValue | null {
    const range = inverted.get(id);
    return range && value ? { ...value, val: invertNumber(value.val, range) } : value;
}

/** Alle Werte für die App (kopiert nur, wenn es umgekehrte States gibt) */
export function presentStates(
    states: Record<string, SvStateValue | null>,
    inverted: InvertMap,
): Record<string, SvStateValue | null> {
    if (!inverted.size) {
        return states;
    }
    const result = { ...states };
    for (const id of inverted.keys()) {
        if (id in result) {
            result[id] = presentValue(id, result[id], inverted);
        }
    }
    return result;
}
