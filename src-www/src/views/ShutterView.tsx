import type { SvAutoShutter, SvShutterControl } from '../../../src/shared/protocol';
import { ActionButton, Toggle } from '../components/Toggle';
import { connection, useConnection } from '../connection';
import { autoStateInfo, text, timeText } from '../shutters';

export function ShutterView(): React.JSX.Element {
    const { model } = useConnection();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    if (!model.shutterControl.length) {
        return (
            <>
                <h1 className="title">Beschattung</h1>
                <p className="empty">Keine Rollladen-Automatik (shuttercontrol) gefunden.</p>
            </>
        );
    }
    return (
        <>
            <h1 className="title">Beschattung</h1>
            {model.shutterControl.map(sc => (
                <ShutterControlPanel
                    key={sc.id}
                    sc={sc}
                />
            ))}
        </>
    );
}

function ShutterControlPanel({ sc }: { sc: SvShutterControl }): React.JSX.Element {
    const { states } = useConnection();
    const elevation = Number(text(states, sc.sun.elevation?.id));
    const azimuth = Number(text(states, sc.sun.azimuth?.id));

    return (
        <div className="shutters">
            <section className="card">
                <div className="actions">
                    <ActionButton
                        state={sc.openAll}
                        label="Alle öffnen"
                        icon="⬆️"
                    />
                    <ActionButton
                        state={sc.closeAll}
                        label="Alle schließen"
                        icon="⬇️"
                    />
                    <ActionButton
                        state={sc.sunProtectAll}
                        label="Sonnenschutz"
                        icon="🕶️"
                    />
                    <ActionButton
                        state={sc.autoAll}
                        label="Alle auf Automatik"
                        icon="🤖"
                        variant="primary"
                    />
                </div>
                {sc.holiday && (
                    <Toggle
                        state={sc.holiday}
                        label="Urlaub / Wochenendzeiten"
                        hint="Fährt zu den Wochenend-Zeiten"
                    />
                )}
                {sc.schoolfree && (
                    <Toggle
                        state={sc.schoolfree}
                        label="Schulfrei"
                        hint="Kinderbereich öffnet zu den Wochenend-Zeiten"
                    />
                )}
            </section>

            <section className="card">
                <h2 className="subtitle">Sonne</h2>
                <dl className="sun">
                    <div>
                        <dt>Aufgang</dt>
                        <dd>{timeText(states, sc.sun.sunrise?.id) ?? '–'}</dd>
                    </div>
                    <div>
                        <dt>Untergang</dt>
                        <dd>{timeText(states, sc.sun.sunset?.id) ?? '–'}</dd>
                    </div>
                    <div>
                        <dt>Höhe</dt>
                        <dd>{Number.isFinite(elevation) ? `${Math.round(elevation)}°` : '–'}</dd>
                    </div>
                    <div>
                        <dt>Richtung</dt>
                        <dd>{Number.isFinite(azimuth) ? `${Math.round(azimuth)}°` : '–'}</dd>
                    </div>
                </dl>
            </section>

            {sc.areas.map(area => {
                const shutters = sc.shutters.filter(s => s.area === area.key);
                return (
                    <section
                        key={area.key}
                        className="card"
                    >
                        <div className="area__head">
                            <h2 className="subtitle">{area.label}</h2>
                            <span className="area__times">
                                ⬆️ {timeText(states, area.upTime?.id) ?? '–'} · ⬇️{' '}
                                {timeText(states, area.downTime?.id) ?? '–'}
                            </span>
                        </div>
                        {area.auto && (
                            <Toggle
                                state={area.auto}
                                label="Automatik"
                            />
                        )}
                        <div className="actions actions--small">
                            <ActionButton
                                state={area.open}
                                label="Öffnen"
                                icon="⬆️"
                            />
                            <ActionButton
                                state={area.close}
                                label="Schließen"
                                icon="⬇️"
                            />
                            <ActionButton
                                state={area.sunProtect}
                                label="Sonnenschutz"
                                icon="🕶️"
                            />
                        </div>
                        <ul className="shutter-list">
                            {shutters.map(s => (
                                <ShutterRow
                                    key={s.name}
                                    shutter={s}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}

            {sc.shutters.some(s => !s.area) && (
                <section className="card">
                    <h2 className="subtitle">Weitere</h2>
                    <ul className="shutter-list">
                        {sc.shutters
                            .filter(s => !s.area)
                            .map(s => (
                                <ShutterRow
                                    key={s.name}
                                    shutter={s}
                                />
                            ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function ShutterRow({ shutter }: { shutter: SvAutoShutter }): React.JSX.Element {
    const { states } = useConnection();
    const level = shutter.level ? Number(states[shutter.level.id]?.val) : NaN;
    const info = autoStateInfo(shutter.autoState ? states[shutter.autoState.id]?.val : undefined);
    const flags: { ref: typeof shutter.autoUp; label: string }[] = [
        { ref: shutter.autoUp, label: 'Auf' },
        { ref: shutter.autoDown, label: 'Ab' },
        { ref: shutter.autoSun, label: 'Sonne' },
    ];

    return (
        <li className={`shutter${shutter.enabled ? '' : ' shutter--disabled'}`}>
            <div className="shutter__main">
                <div className="shutter__name">{shutter.name}</div>
                <div className="shutter__meta">
                    {Number.isFinite(level) ? `${Math.round(level)} %` : '–'}
                    {info ? ` · ${info.icon} ${info.label}` : ''}
                </div>
                <div className="chips chips--small">
                    {flags.map(
                        f =>
                            f.ref && (
                                <button
                                    key={f.label}
                                    type="button"
                                    role="switch"
                                    aria-checked={states[f.ref.id]?.val === true}
                                    className={`flag${states[f.ref.id]?.val === true ? ' flag--on' : ''}`}
                                    title={`Automatik ${f.label}`}
                                    onClick={() => connection.setState(f.ref!.id, !(states[f.ref!.id]?.val === true))}
                                >
                                    {f.label}
                                </button>
                            ),
                    )}
                </div>
            </div>
            {shutter.level?.write && (
                <div className="shutter__drive">
                    <button
                        type="button"
                        className="iconbtn"
                        aria-label={`${shutter.name} öffnen`}
                        onClick={() => connection.setState(shutter.level!.id, shutter.heightUp)}
                    >
                        ▲
                    </button>
                    <button
                        type="button"
                        className="iconbtn"
                        aria-label={`${shutter.name} schließen`}
                        onClick={() => connection.setState(shutter.level!.id, shutter.heightDown)}
                    >
                        ▼
                    </button>
                </div>
            )}
        </li>
    );
}
