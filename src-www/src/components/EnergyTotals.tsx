import { useState } from 'react';
import type { SvEnergyPeriod, SvEnergySystem, SvStateRef, SvStateValue } from '../../../src/shared/protocol';
import { num } from '../energy';

const GROUP_LABELS: Record<string, string> = {
    day: 'Tag',
    week: 'Woche',
    month: 'Monat',
    quarter: 'Quartal',
    halfyear: 'Halbjahr',
    year: 'Jahr',
    total: 'Gesamt',
};
const STORAGE_KEY = 'smartvis.energyPeriod';
const MONTHS = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
];

function loadPeriod(): string | undefined {
    try {
        return window.localStorage.getItem(STORAGE_KEY) || undefined;
    } catch {
        return undefined;
    }
}

function savePeriod(key: string): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
        // Speicher nicht verfügbar (privates Fenster) – Auswahl gilt dann nur bis zum Neuladen
    }
}

/** Energiemenge in kWh; große Zähler ohne Nachkommastellen (einheitlich, damit Werte vergleichbar bleiben) */
export function fmtEnergy(kwh: number | undefined): string {
    if (kwh === undefined) {
        return '–';
    }
    return `${kwh.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(kwh) >= 100 ? 0 : 1 })} kWh`;
}

function fmtPercent(v: number | undefined): string {
    return v === undefined ? '–' : `${Math.round(v).toLocaleString('de-DE')} %`;
}

/** Zeitraum-Kennung des Adapters lesbar machen ("2026-11" → "November 2026") */
function periodText(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !raw) {
        return undefined;
    }
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) {
        return `${m[3]}.${m[2]}.${m[1]}`;
    }
    m = /^(\d{4})-(\d{2})$/.exec(raw);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
        return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
    }
    m = /^(\d{4})-W(\d{1,2})$/i.exec(raw);
    if (m) {
        return `KW ${Number(m[2])} ${m[1]}`;
    }
    m = /^(\d{4})-Q([1-4])$/i.exec(raw);
    if (m) {
        return `${m[2]}. Quartal ${m[1]}`;
    }
    m = /^(\d{4})-H([12])$/i.exec(raw);
    if (m) {
        return `${m[2]}. Halbjahr ${m[1]}`;
    }
    return raw;
}

/** Energiezähler mit Auswahl des Zeitraums (Tag, Monat … Gesamt, jeweils mit Vorperiode) */
export function EnergyTotals({
    system,
    states,
}: {
    system: SvEnergySystem;
    states: Record<string, SvStateValue | null>;
}): React.JSX.Element | null {
    const periods: SvEnergyPeriod[] = system.periods?.length
        ? system.periods
        : system.today
          ? [{ key: 'day', group: 'day', label: 'Heute', totals: system.today }]
          : [];
    const [selected, setSelected] = useState(loadPeriod);
    const period = periods.find(p => p.key === selected) || periods[0];
    if (!period) {
        return null;
    }
    const groups = [...new Set(periods.map(p => p.group))];
    const inGroup = periods.filter(p => p.group === period.group);
    const select = (key: string): void => {
        setSelected(key);
        savePeriod(key);
    };
    const value = (ref: SvStateRef | undefined): number | undefined => num(ref, states);
    const t = period.totals;
    const subtitle = period.periodKey ? periodText(states[period.periodKey.id]?.val) : undefined;
    const stats: [string, string, boolean][] = [
        ['PV-Erzeugung', fmtEnergy(value(t.pv)), !!t.pv],
        ['Verbrauch', fmtEnergy(value(t.home)), !!t.home],
        ['Netzbezug', fmtEnergy(value(t.gridImport)), !!t.gridImport],
        ['Einspeisung', fmtEnergy(value(t.gridExport)), !!t.gridExport],
        ['Batterie geladen', fmtEnergy(value(t.batteryCharge)), !!t.batteryCharge],
        ['Batterie entladen', fmtEnergy(value(t.batteryDischarge)), !!t.batteryDischarge],
        ['Autarkie', fmtPercent(value(t.autarky)), !!t.autarky],
        ['Eigenverbrauch', fmtPercent(value(t.selfConsumption)), !!t.selfConsumption],
    ];

    return (
        <div className="card totals">
            <h2 className="subtitle">
                {period.label}
                {subtitle && subtitle !== period.label && <span className="totals__period"> · {subtitle}</span>}
            </h2>
            {groups.length > 1 && (
                <div
                    className="chips chips--small"
                    role="tablist"
                    aria-label="Zeitraum"
                >
                    {groups.map(g => (
                        <button
                            key={g}
                            type="button"
                            role="tab"
                            aria-selected={g === period.group}
                            className={`flag${g === period.group ? ' flag--on' : ''}`}
                            onClick={() => select(periods.find(p => p.group === g)!.key)}
                        >
                            {periods.find(p => p.group === g)?.groupLabel || GROUP_LABELS[g] || g}
                        </button>
                    ))}
                </div>
            )}
            {inGroup.length > 1 && (
                <div
                    className="segmented totals__segmented"
                    role="tablist"
                    aria-label="Aktuell oder vorheriger Zeitraum"
                >
                    {inGroup.map(p => (
                        <button
                            key={p.key}
                            type="button"
                            role="tab"
                            aria-selected={p.key === period.key}
                            className={p.key === period.key ? 'segmented--active' : ''}
                            onClick={() => select(p.key)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="stats">
                {stats
                    .filter(([, , available]) => available)
                    .map(([label, text]) => (
                        <div
                            key={label}
                            className="stat"
                        >
                            <span className="stat__value">{text}</span>
                            <span className="stat__label">{label}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}
