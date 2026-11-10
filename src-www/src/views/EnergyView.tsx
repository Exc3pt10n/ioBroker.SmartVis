import type { SvStateRef } from '../../../src/shared/protocol';
import { EnergyFlow } from '../components/EnergyFlow';
import { WallboxCard } from '../components/WallboxCard';
import { useConnection } from '../connection';
import { num, snapshot } from '../energy';

function fmt(value: number | undefined, unit: string, digits = 1): string {
    return value === undefined ? '–' : `${value.toLocaleString('de-DE', { maximumFractionDigits: digits })} ${unit}`;
}

export function EnergyView(): React.JSX.Element {
    const { model, states } = useConnection();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    if (!model.energy.length && !model.wallboxes.length) {
        return (
            <>
                <h1 className="title">Energie</h1>
                <p className="empty">Kein unterstütztes Energiesystem gefunden.</p>
            </>
        );
    }

    return (
        <>
            <h1 className="title">Energie</h1>
            {model.energy.map(system => {
                // Wallboxen fließen in das erste Energiesystem ein
                const flow = snapshot(system, states, system === model.energy[0] ? model.wallboxes : []);
                const today = system.today || {};
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
                                <div className="card">
                                    <h2 className="subtitle">Heute</h2>
                                    <div className="stats">
                                        <Stat
                                            label="PV-Erzeugung"
                                            value={fmt(value(today.pv), 'kWh')}
                                        />
                                        <Stat
                                            label="Verbrauch"
                                            value={fmt(value(today.home), 'kWh')}
                                        />
                                        <Stat
                                            label="Netzbezug"
                                            value={fmt(value(today.gridImport), 'kWh')}
                                        />
                                        <Stat
                                            label="Einspeisung"
                                            value={fmt(value(today.gridExport), 'kWh')}
                                        />
                                        <Stat
                                            label="Autarkie"
                                            value={fmt(value(today.autarky), '%', 0)}
                                        />
                                        <Stat
                                            label="Eigenverbrauch"
                                            value={fmt(value(today.selfConsumption), '%', 0)}
                                        />
                                    </div>
                                </div>
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
        </>
    );
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
    return (
        <div className="stat">
            <span className="stat__value">{value}</span>
            <span className="stat__label">{label}</span>
        </div>
    );
}
