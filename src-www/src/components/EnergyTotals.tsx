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
/** Direkt wählbare Zeiträume; seltenere (Quartal, Halbjahr) stehen unter "Mehr" */
const MAIN_GROUPS = ['day', 'week', 'month', 'year', 'total'];
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
    m = /^(\d{4})$/.exec(raw);
    if (m) {
        return m[1];
    }
    // Unbekannte Kennungen (z. B. "total") nicht anzeigen
    return undefined;
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
    const [showMore, setShowMore] = useState(false);
    const period = periods.find(p => p.key === selected) || periods[0];
    if (!period) {
        return null;
    }
    const groups = [...new Set(periods.map(p => p.group))];
    // Je Zeitraum: aktueller zuerst, dann die Vorperioden (z. B. Heute, Gestern)
    const inGroup = periods.filter(p => p.group === period.group);
    const index = inGroup.indexOf(period);
    const groupLabel = (g: string): string => periods.find(p => p.group === g)?.groupLabel || GROUP_LABELS[g] || g;
    const mainGroups = groups.filter(g => MAIN_GROUPS.includes(g) || !GROUP_LABELS[g]);
    const moreGroups = groups.filter(g => !mainGroups.includes(g));
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
            <div className="totals__head">
                <h2 className="subtitle">
                    {period.label}
                    {subtitle && subtitle !== period.label && <span className="totals__period"> · {subtitle}</span>}
                </h2>
                {inGroup.length > 1 && (
                    <span className="totals__nav">
                        <button
                            type="button"
                            className="iconbtn iconbtn--small"
                            aria-label="Vorheriger Zeitraum"
                            disabled={index >= inGroup.length - 1}
                            onClick={() => select(inGroup[index + 1].key)}
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            className="iconbtn iconbtn--small"
                            aria-label="Nächster Zeitraum"
                            disabled={index <= 0}
                            onClick={() => select(inGroup[index - 1].key)}
                        >
                            ›
                        </button>
                    </span>
                )}
            </div>
            {groups.length > 1 && (
                <div
                    className="segmented totals__groups"
                    role="tablist"
                    aria-label="Zeitraum"
                >
                    {mainGroups.map(g => (
                        <button
                            key={g}
                            type="button"
                            role="tab"
                            aria-selected={g === period.group}
                            className={g === period.group ? 'segmented--active' : ''}
                            onClick={() => {
                                setShowMore(false);
                                select(periods.find(p => p.group === g)!.key);
                            }}
                        >
                            {groupLabel(g)}
                        </button>
                    ))}
                    {moreGroups.length > 0 && (
                        <button
                            type="button"
                            aria-expanded={showMore}
                            className={moreGroups.includes(period.group) ? 'segmented--active' : ''}
                            onClick={() => setShowMore(!showMore)}
                        >
                            {moreGroups.includes(period.group) ? groupLabel(period.group) : 'Mehr'}
                        </button>
                    )}
                </div>
            )}
            {showMore && (
                <div
                    className="chips chips--small totals__more"
                    role="group"
                    aria-label="Weitere Zeiträume"
                >
                    {moreGroups.map(g => (
                        <button
                            key={g}
                            type="button"
                            aria-pressed={g === period.group}
                            className={`flag${g === period.group ? ' flag--on' : ''}`}
                            onClick={() => {
                                setShowMore(false);
                                select(periods.find(p => p.group === g)!.key);
                            }}
                        >
                            {groupLabel(g)}
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
