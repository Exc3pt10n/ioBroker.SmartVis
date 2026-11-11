import type { SvWallbox } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { Toggle } from './Toggle';
import { WallboxSettings } from './WallboxSettings';
import { formatPower, wallboxLabel, wallboxSnapshot } from '../energy';

function fmtA(v: number): string {
    return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} A`;
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
                {charging && (
                    <div
                        className="wallbox__power"
                        title={
                            s.estimated
                                ? 'Geschätzt aus Ladestrom × 230 V × Phasen (Wallbox ohne Energiezähler)'
                                : undefined
                        }
                    >
                        {s.estimated ? '≈ ' : ''}
                        {formatPower(s.power)}
                    </div>
                )}
            </div>
            <div className="stats">
                {wallbox.surplus && (
                    <div className="stat">
                        <span className="stat__value">
                            {s.surplusW === undefined
                                ? '–'
                                : s.surplusW > 0
                                  ? formatPower(s.surplusW)
                                  : `−${formatPower(-s.surplusW)}`}
                        </span>
                        <span className="stat__label">
                            PV-Überschuss{s.surplusW !== undefined && s.surplusW <= 0 ? ' · keiner' : ''}
                        </span>
                    </div>
                )}
                {wallbox.current && (
                    <div className="stat">
                        <span className="stat__value">{s.limitA !== undefined ? fmtA(s.limitA) : '–'}</span>
                        <span className="stat__label">
                            Ladelimit
                            {s.limitW !== undefined ? ` · ≈ ${formatPower(s.limitW)} (${s.phases}-phasig)` : ''}
                            {s.maxA !== undefined ? ` · max. ${fmtA(s.maxA)}` : ''}
                        </span>
                    </div>
                )}
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
            <WallboxSettings wallbox={wallbox} />
        </section>
    );
}
