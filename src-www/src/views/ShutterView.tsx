import { useState } from 'react';
import { useCardColumns } from '../media';
import type { SvAutoShutter, SvShutterControl } from '../../../src/shared/protocol';
import { ActionButton, Toggle } from '../components/Toggle';
import { CustomSections, type SectionDef } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { connection, useConnection } from '../connection';
import { autoStateInfo, text, timeText } from '../shutters';

/** Eingeklappte Bereiche (für diese Sitzung) */
const collapsedAreas = new Set<string>();

export function ShutterView(): React.JSX.Element {
    const { model } = useConnection();
    const columns = useCardColumns();
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
            <div className="titlebar titlebar--split">
                <h1 className="title">Beschattung</h1>
                <EditButton />
            </div>
            <EditBanner text="Bereiche am Griff ⠿ ziehen oder mit ↑ ↓ sortieren und aus- oder einblenden" />
            <CustomSections
                view="shutters"
                columns={columns}
                className="csecs csecs--cols"
                sections={model.shutterControl.flatMap(sc => shutterSections(sc, model.shutterControl.length > 1))}
            />
        </>
    );
}

/** Bereiche einer Rollladen-Automatik: Steuerung, Sonne, je Bereich eine Karte, weitere Rollläden */
function shutterSections(sc: SvShutterControl, multi: boolean): SectionDef[] {
    const p = multi ? `${sc.id}:` : '';
    const sections: SectionDef[] = [
        { key: `${p}controls`, label: 'Alle Rollläden', node: <ControlsCard sc={sc} /> },
        { key: `${p}sun`, label: 'Sonne', node: <SunCard sc={sc} /> },
        ...sc.areas.map(area => ({
            key: `${p}area-${area.key}`,
            label: area.label,
            node: (
                <AreaCard
                    sc={sc}
                    area={area}
                />
            ),
        })),
    ];
    if (sc.shutters.some(s => !s.area)) {
        sections.push({ key: `${p}other`, label: 'Weitere', node: <OtherCard sc={sc} /> });
    }
    return sections;
}

function ControlsCard({ sc }: { sc: SvShutterControl }): React.JSX.Element {
    return (
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
    );
}

function SunCard({ sc }: { sc: SvShutterControl }): React.JSX.Element {
    const { states } = useConnection();
    const elevation = Number(text(states, sc.sun.elevation?.id));
    const azimuth = Number(text(states, sc.sun.azimuth?.id));
    return (
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
    );
}

function AreaCard({ sc, area }: { sc: SvShutterControl; area: SvShutterControl['areas'][number] }): React.JSX.Element {
    const { states } = useConnection();
    const shutters = sc.shutters.filter(s => s.area === area.key);
    const memoryKey = `${sc.id}:${area.key}`;
    const [open, setOpen] = useState(!collapsedAreas.has(memoryKey));
    const toggle = (): void => {
        if (open) {
            collapsedAreas.add(memoryKey);
        } else {
            collapsedAreas.delete(memoryKey);
        }
        setOpen(!open);
    };
    const closed = shutters.filter(s => {
        const level = s.level ? Number(states[s.level.id]?.val) : NaN;
        return Number.isFinite(level) && level < 95;
    }).length;
    return (
        <section className="card">
            <h2 className="area__heading">
                <button
                    type="button"
                    className="area__head"
                    aria-expanded={open}
                    onClick={toggle}
                >
                    <span className="area__title">
                        <span className="subtitle">{area.label}</span>
                        <span className="area__summary">
                            {shutters.length} {shutters.length === 1 ? 'Rollladen' : 'Rollläden'}
                            {closed ? ` · ${closed} zu` : ''}
                        </span>
                    </span>
                    <span className="area__times">
                        ⬆️ {timeText(states, area.upTime?.id) ?? '–'} · ⬇️ {timeText(states, area.downTime?.id) ?? '–'}
                    </span>
                    <span
                        className="chevron"
                        aria-hidden="true"
                    />
                </button>
            </h2>
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
            {open && <ShutterList shutters={shutters} />}
        </section>
    );
}

/**
 * Rollläden mit Fahrtasten. Die Automatik-Schalter je Rollladen (Auf/Ab/Sonne) sind selten
 * nötig und deshalb eingeklappt; ausgeschaltete Automatiken stehen als Hinweis am Rollladen.
 */
function ShutterList({ shutters }: { shutters: SvAutoShutter[] }): React.JSX.Element {
    const [flags, setFlags] = useState(false);
    const hasFlags = shutters.some(s => s.autoUp || s.autoDown || s.autoSun);
    return (
        <>
            <ul className="shutter-list">
                {shutters.map(s => (
                    <ShutterRow
                        key={s.name}
                        shutter={s}
                        showFlags={flags}
                    />
                ))}
            </ul>
            {hasFlags && (
                <button
                    type="button"
                    className="linkbtn shutter-list__flags"
                    aria-expanded={flags}
                    onClick={() => setFlags(!flags)}
                >
                    {flags ? 'Fertig' : '🤖 Automatik je Rollladen anpassen'}
                </button>
            )}
        </>
    );
}

function OtherCard({ sc }: { sc: SvShutterControl }): React.JSX.Element {
    return (
        <section className="card">
            <h2 className="subtitle">Weitere</h2>
            <ShutterList shutters={sc.shutters.filter(s => !s.area)} />
        </section>
    );
}

function ShutterRow({ shutter, showFlags }: { shutter: SvAutoShutter; showFlags: boolean }): React.JSX.Element {
    const { states } = useConnection();
    const level = shutter.level ? Number(states[shutter.level.id]?.val) : NaN;
    const info = autoStateInfo(shutter.autoState ? states[shutter.autoState.id]?.val : undefined);
    const flags: { ref: typeof shutter.autoUp; label: string }[] = [
        { ref: shutter.autoUp, label: 'Auf' },
        { ref: shutter.autoDown, label: 'Ab' },
        { ref: shutter.autoSun, label: 'Sonne' },
    ];
    // Ausgeschaltete Automatiken als Hinweis (Abweichung vom Normalfall)
    const off = flags.filter(f => f.ref && states[f.ref.id]?.val === false).map(f => f.label);

    return (
        <li className={`shutter${shutter.enabled ? '' : ' shutter--disabled'}`}>
            <div className="shutter__main">
                <div className="shutter__name">{shutter.name}</div>
                <div className="shutter__meta">
                    {Number.isFinite(level) ? `${Math.round(level)} %` : '–'}
                    {info ? ` · ${info.icon} ${info.label}` : ''}
                    {!showFlags && off.length > 0 && (
                        <span className="shutter__off"> · ohne Automatik {off.join('/')}</span>
                    )}
                </div>
                {showFlags && (
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
                                        onClick={() =>
                                            connection.setState(f.ref!.id, !(states[f.ref!.id]?.val === true))
                                        }
                                    >
                                        {f.label}
                                    </button>
                                ),
                        )}
                    </div>
                )}
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
