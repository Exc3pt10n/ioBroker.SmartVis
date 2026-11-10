import type { SvEnergySystem, SvStateRef, SvStateValue } from '../../src/shared/protocol';

type States = Record<string, SvStateValue | null>;

/** Leistung in Watt, unabhängig davon, ob der State W oder kW liefert. Negative Werte → 0. */
export function watts(ref: SvStateRef | undefined, states: States): number | undefined {
    if (!ref) {
        return undefined;
    }
    const raw = Number(states[ref.id]?.val);
    if (!Number.isFinite(raw)) {
        return undefined;
    }
    const unit = (ref.unit || 'W').trim().toLowerCase();
    const factor = unit === 'kw' ? 1000 : unit === 'mw' ? 1_000_000 : 1;
    return Math.max(0, raw * factor);
}

export function formatPower(w: number | undefined): string {
    if (w === undefined) {
        return '–';
    }
    if (w >= 1000) {
        return `${(w / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 1 })} kW`;
    }
    return `${Math.round(w)} W`;
}

export function num(ref: SvStateRef | undefined, states: States): number | undefined {
    if (!ref) {
        return undefined;
    }
    const v = Number(states[ref.id]?.val);
    return Number.isFinite(v) ? v : undefined;
}

export interface FlowSnapshot {
    pv?: number;
    home?: number;
    gridImport?: number;
    gridExport?: number;
    batteryCharge?: number;
    batteryDischarge?: number;
    soc?: number;
}

export function snapshot(system: SvEnergySystem, states: States): FlowSnapshot {
    const f = system.flows;
    return {
        pv: watts(f.pv, states),
        home: watts(f.home, states),
        gridImport: watts(f.gridImport, states),
        gridExport: watts(f.gridExport, states),
        batteryCharge: watts(f.batteryCharge, states),
        batteryDischarge: watts(f.batteryDischarge, states),
        soc: num(system.battery?.soc, states),
    };
}
