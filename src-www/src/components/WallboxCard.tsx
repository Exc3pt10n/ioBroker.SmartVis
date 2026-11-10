import type { SvStateRef, SvWallbox } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
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
                        on={s.pvAutomatic === true}
                        label="PV-Überschussladen"
                        hint={s.pvAutomatic ? 'Lädt nur mit Solarüberschuss' : 'Lädt mit voller Leistung'}
                    />
                )}
                {wallbox.pause && (
                    <Toggle
                        state={wallbox.pause}
                        on={s.paused === true}
                        label="Laden pausieren"
                    />
                )}
            </div>
        </section>
    );
}

function Toggle({
    state,
    on,
    label,
    hint,
}: {
    state: SvStateRef;
    on: boolean;
    label: string;
    hint?: string;
}): React.JSX.Element {
    const { states } = useConnection();
    const pending = states[state.id]?.ack === false;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            className={`toggle${pending ? ' toggle--pending' : ''}`}
            onClick={() => connection.setState(state.id, !on)}
        >
            <span className="toggle__text">
                <span>{label}</span>
                {hint && <span className="toggle__hint">{hint}</span>}
            </span>
            <span className={`switch${on ? ' switch--on' : ''}`} />
        </button>
    );
}
