import type { SvWallbox } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { Toggle } from './Toggle';
import { formatPower, wallboxLabel, wallboxSnapshot } from '../energy';

function fmtKwh(v: number | undefined): string {
    return v === undefined ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kWh`;
}

export function WallboxCard({ wallbox }: { wallbox: SvWallbox }): React.JSX.Element {
    const { states } = useConnection();
    const s = wallboxSnapshot(wallbox, states);
    const charging = s.status === 'charging';

    return (
        <section className="card">
            <div className="wallbox__head">
                <div>
                    <div
                        className="subtitle"
                        style={{ margin: 0 }}
                    >
                        🚗 {wallbox.name}
                    </div>
                    <div className={`wallbox__status wallbox__status--${s.status ?? 'unknown'}`}>{wallboxLabel(s)}</div>
                </div>
                {charging && <div className="wallbox__power">{formatPower(s.power)}</div>}
            </div>
            <div className="stats">
                <div className="stat">
                    <span className="stat__value">{fmtKwh(s.sessionKwh)}</span>
                    <span className="stat__label">Aktuelle Ladung</span>
                </div>
                <div className="stat">
                    <span className="stat__value">{fmtKwh(s.lastKwh)}</span>
                    <span className="stat__label">Letzte Ladung</span>
                </div>
            </div>
            <div style={{ marginTop: 12 }}>
                {wallbox.pvAutomatic && (
                    <Toggle
                        state={wallbox.pvAutomatic}
                        label="PV-Überschussladen"
                        hint={s.pvAutomatic ? 'Lädt nur mit Solarüberschuss' : 'Lädt mit voller Leistung'}
                    />
                )}
                {wallbox.pause && (
                    <Toggle
                        state={wallbox.pause}
                        label="Laden pausieren"
                    />
                )}
            </div>
        </section>
    );
}
