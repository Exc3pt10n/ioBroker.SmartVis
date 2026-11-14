import type { SvBattery, SvStateValue } from '../../src/shared/protocol';

type States = Record<string, SvStateValue | null>;

/** Ab hier gilt ein Ladestand als schwach (wie im Adapter) */
export const LOW_BATTERY_PERCENT = 20;

/** Ladestand in % oder undefined */
export function batteryLevel(b: SvBattery, states: States): number | undefined {
    const v = b.level ? states[b.level.id]?.val : undefined;
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
}

/** Batterie schwach: eigene Anzeige des Geräts oder Ladestand ≤ 20 % */
export function isBatteryLow(b: SvBattery, states: States): boolean {
    if (b.low && states[b.low.id]?.val === true) {
        return true;
    }
    const level = batteryLevel(b, states);
    return level !== undefined && level <= LOW_BATTERY_PERCENT;
}

/** Schwache Batterien, schwächste zuerst */
export function lowBatteries(batteries: SvBattery[] | undefined, states: States): SvBattery[] {
    return (batteries || [])
        .filter(b => isBatteryLow(b, states))
        .sort((a, b) => (batteryLevel(a, states) ?? -1) - (batteryLevel(b, states) ?? -1));
}

/** Ist die einzige Warnung eines Geräts die Batterie? (zählt dann nicht als Störung) */
export function onlyBatteryWarning(warnings: string[]): boolean {
    return warnings.length > 0 && warnings.every(w => w === 'Batterie schwach');
}
