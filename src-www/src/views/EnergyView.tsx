import type { SvStateRef } from '../../../src/shared/protocol';
import { EnergyFlow } from '../components/EnergyFlow';
import { EnergyTotals } from '../components/EnergyTotals';
import { ForecastCard } from '../components/ForecastCard';
import { HistoryPanel, type HistorySeries } from '../components/HistoryPanel';
import { WallboxCard } from '../components/WallboxCard';
import { useConnection } from '../connection';
import { kwh, num, snapshot } from '../energy';

export function EnergyView(): React.JSX.Element {
    const { model, states } = useConnection();
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
    const energyHistory = (
        [
            main?.flows.pv && { key: 'pv', label: 'PV', ref: main.flows.pv, color: pvColor, zeroBased: true },
            main?.flows.home && { key: 'home', label: 'Verbrauch', ref: main.flows.home, zeroBased: true },
            main?.flows.gridImport && { key: 'gi', label: 'Netzbezug', ref: main.flows.gridImport, zeroBased: true },
            main?.flows.gridExport && { key: 'ge', label: 'Einspeisung', ref: main.flows.gridExport, zeroBased: true },
            main?.flows.batteryCharge && {
                key: 'bc',
                label: 'Batterie laden',
                ref: main.flows.batteryCharge,
                zeroBased: true,
            },
            main?.flows.batteryDischarge && {
                key: 'bd',
                label: 'Batterie entladen',
                ref: main.flows.batteryDischarge,
                zeroBased: true,
            },
            main?.battery?.soc && { key: 'soc', label: 'Ladezustand', ref: main.battery.soc, zeroBased: true },
            ...model.wallboxes.map(w =>
                w.surplus ? { key: `s-${w.id}`, label: 'PV-Überschuss', ref: w.surplus, color: pvColor } : undefined,
            ),
        ] as (HistorySeries | undefined | false)[]
    ).filter((x): x is HistorySeries => !!x && !!x.ref.history);

    return (
        <>
            <h1 className="title">Energie</h1>
            {model.energy.map(system => {
                // Wallboxen fließen in das erste Energiesystem ein
                const flow = snapshot(system, states, system === model.energy[0] ? model.wallboxes : []);
                const value = (ref: SvStateRef | undefined): number | undefined => num(ref, states);
                const remaining = value(system.battery?.remaining);
                const offline = system.connected && states[system.connected.id]?.val === false;

                return (
                    <section
                        key={system.id}
                        className="energy"
                    >
                        {model.energy.length > 1 && <h2 className="subtitle">{system.name}</h2>}
                        {offline && (
                            <div className="banner banner--offline">{system.name}: keine Verbindung zum Gerät</div>
                        )}
                        <div className="energy__layout">
                            <div className="card energy__flow">
                                <EnergyFlow flow={flow} />
                                {remaining ? (
                                    <p className="energy__note">
                                        Batterie{' '}
                                        {(flow.batteryCharge ?? 0) > (flow.batteryDischarge ?? 0) ? 'voll' : 'leer'} in
                                        ca.{' '}
                                        {remaining >= 60
                                            ? `${Math.floor(remaining / 60)} h ${remaining % 60} min`
                                            : `${remaining} min`}
                                    </p>
                                ) : null}
                            </div>
                            <div className="energy__side">
                                {system === model.energy[0] &&
                                    model.wallboxes.map(wb => (
                                        <WallboxCard
                                            key={wb.id}
                                            wallbox={wb}
                                        />
                                    ))}
                                <EnergyTotals
                                    system={system}
                                    states={states}
                                />
                            </div>
                        </div>
                    </section>
                );
            })}
            {!model.energy.length &&
                model.wallboxes.map(wb => (
                    <WallboxCard
                        key={wb.id}
                        wallbox={wb}
                    />
                ))}
            {energyHistory.length > 0 && <HistoryPanel series={energyHistory} />}
            {model.pvForecast.map(pv => {
                const main = model.energy[0];
                return (
                    <ForecastCard
                        key={pv.id}
                        pv={pv}
                        actualPvW={main ? snapshot(main, states).pv : undefined}
                        producedTodayKwh={main?.today?.pv ? kwh(main.today.pv, states) : undefined}
                    />
                );
            })}
        </>
    );
}
