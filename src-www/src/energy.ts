import type { SvEnergySystem, SvStateRef, SvStateValue, SvWallbox, SvWallboxStatus } from '../../src/shared/protocol';

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
    // Achtung: "mW" (Milliwatt, z. B. Keba) ≠ "MW" (Megawatt) – daher Groß-/Kleinschreibung prüfen
    const rawUnit = (ref.unit || 'W').trim();
    const factor = rawUnit === 'mW' ? 0.001 : rawUnit === 'MW' ? 1_000_000 : unit === 'kw' ? 1000 : 1;
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

/** Energie in kWh (Wh/kWh-State) */
export function kwh(ref: SvStateRef | undefined, states: States): number | undefined {
    const v = num(ref, states);
    if (v === undefined || !ref) {
        return undefined;
    }
    return (ref.unit || '').trim().toLowerCase() === 'wh' ? v / 1000 : v;
}

/** Netzspannung für Schätzungen (wie der kecontact-Adapter) */
const VOLTAGE = 230;

export interface WallboxSnapshot {
    /** Ladeleistung in W (gemessen oder geschätzt) */
    power?: number;
    /** true, wenn die Leistung aus Strom × Spannung × Phasen geschätzt wurde */
    estimated: boolean;
    status?: SvWallboxStatus;
    plugged: boolean;
    /** Eingestellter Ladestrom (Limit) in A */
    limitA?: number;
    /** Hardware-Maximum in A */
    maxA?: number;
    phases: number;
    /** Leistung, die das Limit erlaubt, in W */
    limitW?: number;
    /** PV-Überschuss in W (negativ = kein Überschuss) */
    surplusW?: number;
    pvAutomatic?: boolean;
    paused?: boolean;
    online: boolean;
}

/** Strom in A, unabhängig davon, ob der State mA oder A liefert */
function amps(ref: SvStateRef | undefined, states: States): number | undefined {
    const v = num(ref, states);
    if (v === undefined || !ref) {
        return undefined;
    }
    return (ref.unit || '').trim() === 'mA' ? v / 1000 : v;
}

export function wallboxSnapshot(wb: SvWallbox, states: States): WallboxSnapshot {
    const statusVal = wb.status ? states[wb.status.id]?.val : undefined;
    const plugVal = num(wb.plug, states);
    const status = statusVal !== undefined && statusVal !== null ? wb.statusMap?.[String(statusVal)] : undefined;
    const limitA = amps(wb.current, states);
    // Gemessene Phasen, sonst eingestellte (Wallbox ohne Zähler), sonst 1
    const measuredPhases = num(wb.phases, states);
    const phases = measuredPhases && measuredPhases > 0 ? measuredPhases : num(wb.configuredPhases, states) || 1;
    const measured = watts(wb.power, states);
    // Ohne Energiezähler (z. B. KEBA Deutschland-Edition) meldet die Box 0 W – dann wie der kecontact-Adapter schätzen
    const estimate = status === 'charging' && !measured && limitA ? limitA * VOLTAGE * phases : undefined;
    return {
        power: estimate ?? measured,
        estimated: estimate !== undefined,
        status,
        plugged: plugVal !== undefined && (wb.vehiclePluggedValues || []).includes(plugVal),
        limitA,
        maxA: amps(wb.currentMax, states),
        phases,
        limitW: limitA !== undefined ? limitA * VOLTAGE * phases : undefined,
        surplusW: num(wb.surplus, states),
        pvAutomatic: wb.pvAutomatic ? states[wb.pvAutomatic.id]?.val === true : undefined,
        paused: wb.pause ? states[wb.pause.id]?.val === true : undefined,
        online: !wb.connected || states[wb.connected.id]?.val !== false,
    };
}

export function wallboxLabel(s: WallboxSnapshot): string {
    if (!s.online) {
        return 'Keine Verbindung';
    }
    switch (s.status) {
        case 'charging':
            return 'Lädt';
        case 'error':
            return 'Störung';
        case 'interrupted':
            return 'Unterbrochen';
        case 'starting':
            return 'Startet';
        default:
            if (s.paused) {
                return 'Pausiert';
            }
            return s.plugged ? 'Fahrzeug verbunden' : 'Kein Fahrzeug';
    }
}

export interface FlowSnapshot {
    /** Ladeleistung Auto (Wallbox) */
    car?: number;
    /** Ladeleistung ist geschätzt (Wallbox ohne Energiezähler) */
    carEstimated?: boolean;
    pv?: number;
    home?: number;
    gridImport?: number;
    gridExport?: number;
    batteryCharge?: number;
    batteryDischarge?: number;
    soc?: number;
}

/**
 * Momentaufnahme der Flüsse. Ist eine Wallbox vorhanden, wird ihre Leistung aus dem
 * Hausverbrauch herausgerechnet: Der Speicher misst am Netzanschluss, sein Verbrauchswert
 * enthält also auch das Laden des Autos.
 */
export function snapshot(system: SvEnergySystem, states: States, wallboxes: SvWallbox[] = []): FlowSnapshot {
    const f = system.flows;
    const carValues = wallboxes.map(w => wallboxSnapshot(w, states).power).filter((v): v is number => v !== undefined);
    const car = carValues.length ? carValues.reduce((a, b) => a + b, 0) : undefined;
    const home = watts(f.home, states);
    return {
        car,
        carEstimated: wallboxes.some(w => wallboxSnapshot(w, states).estimated),
        pv: watts(f.pv, states),
        home: home !== undefined && car !== undefined ? Math.max(0, home - car) : home,
        gridImport: watts(f.gridImport, states),
        gridExport: watts(f.gridExport, states),
        batteryCharge: watts(f.batteryCharge, states),
        batteryDischarge: watts(f.batteryDischarge, states),
        soc: num(system.battery?.soc, states),
    };
}
