import { useState } from 'react';
import { useCardColumns } from '../media';
import type { SvStateRef } from '../../../src/shared/protocol';
import { EnergyFlow, FlowStatus } from '../components/EnergyFlow';
import { EnergyTotals } from '../components/EnergyTotals';
import { ForecastCard } from '../components/ForecastCard';
import { HistoryPanel, type HistorySeries } from '../components/HistoryPanel';
import { WallboxCard } from '../components/WallboxCard';
import { CustomSections, type SectionDef } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { useConnection } from '../connection';
import { kwh, num, snapshot } from '../energy';

export function EnergyView(): React.JSX.Element {
    const { model, states } = useConnection();
    const columns = useCardColumns();
    const [focus, setFocus] = useState<{ key: string; n: number }>();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    if (!model.energy.length && !model.wallboxes.length && !model.pvForecast.length) {
        return (
            <>
                <h1 className="title">Energie</h1>
                <p className="empty">Kein unterstütztes Energiesystem gefunden.</p>
            </>
        );
    }

    // Verläufe: Leistungsflüsse, Ladezustand und PV-Überschuss der Wallbox (sofern aufgezeichnet)
    const main = model.energy[0];
    const pvColor = 'var(--chart-pv)';
    // Ansichten: Leistung (PV + Verbrauch zusammen), Netz (Bezug + Einspeisung), Batterie, PV-Überschuss
    const f = main?.flows;
    const has = (ref: SvStateRef | undefined): ref is SvStateRef => !!ref?.history;
    const homeColor = 'var(--chart-series)';
    const candidates: (HistorySeries | undefined | false)[] = [
        has(f?.pv)
            ? {
                  key: 'power',
                  label: 'Leistung',
                  lineLabel: 'PV',
                  ref: f.pv,
                  color: pvColor,
                  zeroBased: true,
                  extra: has(f?.home) ? [{ label: 'Verbrauch', ref: f.home, color: homeColor }] : [],
              }
            : has(f?.home) && { key: 'power', label: 'Verbrauch', ref: f.home, color: homeColor, zeroBased: true },
        has(f?.gridImport)
            ? {
                  key: 'grid',
                  label: 'Netz',
                  lineLabel: 'Bezug',
                  ref: f.gridImport,
                  color: 'var(--chart-grid-import)',
                  zeroBased: true,
                  extra: has(f?.gridExport)
                      ? [{ label: 'Einspeisung', ref: f.gridExport, color: 'var(--chart-grid-export)' }]
                      : [],
              }
            : has(f?.gridExport) && {
                  key: 'grid',
                  label: 'Netz',
                  ref: f.gridExport,
                  color: 'var(--chart-grid-export)',
                  zeroBased: true,
              },
        has(main?.battery?.soc)
            ? {
                  key: 'battery',
                  label: 'Batterie',
                  ref: main.battery.soc,
                  color: 'var(--chart-battery)',
                  zeroBased: true,
              }
            : has(f?.batteryCharge) && {
                  key: 'battery',
                  label: 'Batterie',
                  lineLabel: 'Laden',
                  ref: f.batteryCharge,
                  color: 'var(--chart-battery)',
                  zeroBased: true,
                  extra: has(f?.batteryDischarge)
                      ? [{ label: 'Entladen', ref: f.batteryDischarge, color: 'var(--chart-grid-import)' }]
                      : [],
              },
        ...model.wallboxes.map(w =>
            has(w.surplus)
                ? {
                      key: `s-${w.id}`,
                      label: model.wallboxes.length > 1 ? `Überschuss ${w.name}` : 'Überschuss',
                      ref: w.surplus,
                      color: pvColor,
                  }
                : undefined,
        ),
    ];
    const energyHistory = candidates.filter((x): x is HistorySeries => !!x);
    // Antippen im Energiefluss → passende Ansicht im Verlauf
    const surplusKey = energyHistory.find(h => h.key.startsWith('s-'))?.key;
    const showHistory = (node: 'pv' | 'grid' | 'home' | 'battery' | 'car'): void => {
        const key =
            node === 'grid'
                ? 'grid'
                : node === 'battery'
                  ? 'battery'
                  : node === 'car' && surplusKey
                    ? surplusKey
                    : 'power';
        setFocus({ key, n: Date.now() });
    };

    const multi = model.energy.length > 1;
    const sections: SectionDef[] = [
        ...model.energy.flatMap((system): SectionDef[] => {
            // Wallboxen fließen in das erste Energiesystem ein
            const flow = snapshot(system, states, system === model.energy[0] ? model.wallboxes : []);
            const value = (ref: SvStateRef | undefined): number | undefined => num(ref, states);
            const remaining = value(system.battery?.remaining);
            const offline = system.connected && states[system.connected.id]?.val === false;
            const suffix = multi ? ` (${system.name})` : '';
            return [
                {
                    key: `flow-${system.id}`,
                    label: `Energiefluss${suffix}`,
                    node: (
                        <section className="card energy__flow">
                            <h2 className="subtitle">⚡ {multi ? system.name : 'Energiefluss'}</h2>
                            {offline && (
                                <div className="banner banner--offline">{system.name}: keine Verbindung zum Gerät</div>
                            )}
                            <FlowStatus
                                flow={flow}
                                remainingMin={remaining}
                            />
                            <EnergyFlow
                                flow={flow}
                                onSelect={energyHistory.length ? showHistory : undefined}
                            />
                        </section>
                    ),
                },
                {
                    key: `totals-${system.id}`,
                    label: `Energiezähler${suffix}`,
                    node: (
                        <EnergyTotals
                            system={system}
                            states={states}
                        />
                    ),
                },
            ];
        }),
        ...model.wallboxes.map(wb => ({
            key: `wallbox-${wb.id}`,
            label: model.wallboxes.length > 1 ? `Wallbox ${wb.name}` : 'Wallbox',
            node: <WallboxCard wallbox={wb} />,
        })),
        {
            key: 'history',
            label: 'Verlauf',
            // Zeitreihen profitieren von Breite: auf dem Desktop über beide Spalten
            wide: true,
            node:
                energyHistory.length > 0 ? (
                    <HistoryPanel
                        series={energyHistory}
                        focus={focus}
                    />
                ) : null,
        },
        ...model.pvForecast.map(pv => ({
            key: `forecast-${pv.id}`,
            label: 'PV-Prognose',
            node: (
                <ForecastCard
                    pv={pv}
                    actualPvW={main ? snapshot(main, states).pv : undefined}
                    producedTodayKwh={main?.today?.pv ? kwh(main.today.pv, states) : undefined}
                    actualRef={main?.flows.pv}
                />
            ),
        })),
    ];
    // Standard: Fluss, Wallbox, Zähler, Prognose (zwei ausgeglichene Spalten), Verlauf über die volle Breite
    const rank = (k: string): number =>
        k.startsWith('flow-')
            ? 0
            : k.startsWith('wallbox-')
              ? 1
              : k.startsWith('totals-')
                ? 2
                : k === 'history'
                  ? 4
                  : 3;
    sections.sort((a, b) => rank(a.key) - rank(b.key));

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Energie</h1>
                <EditButton />
            </div>
            <EditBanner text="Bereiche am Griff ⠿ ziehen oder mit ↑ ↓ sortieren und aus- oder einblenden" />
            <CustomSections
                view="energy"
                columns={columns}
                sections={sections}
                className="csecs csecs--cols"
            />
        </>
    );
}
