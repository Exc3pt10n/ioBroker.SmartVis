import type { SvDevice } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { groupByRoom, isActive, isCoveredGroup, isPlaying, warnings } from '../device';
import { formatPower, kwh, num, snapshot, wallboxSnapshot } from '../energy';
import { autoStateInfo } from '../shutters';
import { DeviceTile } from '../components/DeviceTile';
import { SortableGrid } from '../components/SortableGrid';
import { CustomSections, type SectionDef } from '../components/CustomSections';
import { EditBanner, EditButton } from '../components/EditButton';
import { favorites, useEditing, visibleDevices } from '../editing';
import { WeatherCard } from '../components/WeatherCard';
import { EnergyFlow, FlowStatus } from '../components/EnergyFlow';
import { ForecastCard } from '../components/ForecastCard';
import { switchLights } from '../lightActions';
import { DASHBOARD_QUERY, useMediaQuery } from '../media';
import { motionAllowed } from '../motion';

const LIGHT_TYPES = ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'];
const OPENING_TYPES = ['window', 'windowTilt', 'door'];

export function HomeView({ onNavigate }: { onNavigate: (path: string) => void }): React.JSX.Element {
    const { model, states } = useConnection();
    const { editing } = useEditing();
    const dashboard = useMediaQuery(DASHBOARD_QUERY);
    const wide = useMediaQuery('(min-width: 1800px)');
    const phone = useMediaQuery('(max-width: 899px)');
    if (!model) {
        return <p className="empty">Lade Geräte …</p>;
    }
    const roomName = (id: string | null): string | undefined => model.rooms.find(r => r.id === id)?.name;
    // Statuslisten zeigen nie ausgeblendete Geräte
    const devices = visibleDevices(model, false);
    const favs = favorites(model, editing);

    // Medien, die gerade abspielen (z. B. Echos)
    const playing = devices.filter(
        d =>
            (d.type === 'media' || d.type === 'mediaPlayer') &&
            isPlaying(
                states,
                d.states.find(s => s.name === 'STATE'),
            ),
    );
    // Gruppen ("Alle Lichter") nicht zusätzlich zu ihren Lampen zählen
    const visibleIds = new Set(devices.map(d => d.id));
    const lightsOn = devices.filter(
        d => LIGHT_TYPES.includes(d.type) && !isCoveredGroup(d, visibleIds) && isActive(d, states),
    );
    // Eingeschaltete Klimageräte (Ein/Aus = POWER)
    const climateOn = devices.filter(d => d.type === 'airCondition' && isActive(d, states));
    // Symbol nach Betriebsart: alle heizen 🔥, alle kühlen ❄️, sonst neutral 🌡️
    const climateModes = new Set(
        climateOn.map(d => {
            const mode = d.states.find(st => st.name === 'MODE');
            return mode ? String(states[mode.id]?.val ?? '') : '';
        }),
    );
    const climateIcon =
        climateModes.size === 1 && climateModes.has('HEAT')
            ? '🔥'
            : climateModes.size === 1 && climateModes.has('COOL')
              ? '❄️'
              : '🌡️';
    const open = devices.filter(d => OPENING_TYPES.includes(d.type) && isActive(d, states));
    const problems = devices.filter(d => warnings(d, states).length > 0);
    const withoutRoom = devices.filter(d => !d.roomId).length;
    const hintHidden = !!model.ui?.hideNoRoomHint;
    const energy = model.energy[0] ? snapshot(model.energy[0], states, model.wallboxes) : undefined;
    const pv = model.pvForecast[0];
    const forecastToday = pv ? kwh(pv.summary.energyToday, states) : undefined;
    const forecastTomorrow = pv ? kwh(pv.summary.energyTomorrow, states) : undefined;
    const autoShutters = model.shutterControl.flatMap(sc => sc.shutters);
    const sunProtected = autoShutters.filter(
        s => s.autoState && ['sunProtect', 'manu_sunProtect'].includes(String(states[s.autoState.id]?.val)),
    ).length;
    const shutterAlarm = autoShutters
        .map(s => (s.autoState ? String(states[s.autoState.id]?.val) : ''))
        .find(v => ['wind1', 'wind2', 'rain', 'frost', 'fire'].includes(v));
    const holiday = model.shutterControl.some(sc => sc.holiday && states[sc.holiday.value.id]?.val === true);
    const charging = model.wallboxes.map(w => wallboxSnapshot(w, states)).filter(w => w.status === 'charging');

    // Kennzahlen: auf dem Handy als wischbare Reihe, auf dem Desktop als Kacheln
    const fmtKwh = (v: number | undefined): string =>
        v === undefined ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh`;
    const toEnergy = (): void => onNavigate('energy');
    const toShutters = (): void => onNavigate('shutters');
    // Statuskennzahlen springen zur passenden Liste weiter unten
    const jump =
        (section: string): (() => void) =>
        () =>
            document
                .getElementById(`home-${section}`)
                ?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
    const kpiCandidates: (Kpi | false)[] = [
        energy?.pv !== undefined && {
            key: 'pv',
            icon: '☀️',
            value: formatPower(energy.pv),
            label: 'PV jetzt',
            onClick: toEnergy,
        },
        energy?.soc !== undefined && {
            key: 'soc',
            icon: '🔋',
            value: `${Math.round(energy.soc)} %`,
            label: 'Batterie',
            onClick: toEnergy,
        },
        energy?.home !== undefined && {
            key: 'home',
            icon: '🏠',
            value: formatPower(energy.home),
            label: 'Verbrauch',
            onClick: toEnergy,
        },
        ...charging.map((w, i) => ({
            key: `car${i}`,
            icon: '🚗',
            value: formatPower(w.power),
            label: 'Wallbox lädt',
            onClick: toEnergy,
        })),
        forecastToday !== undefined && {
            key: 'forecast',
            icon: '🔮',
            value: fmtKwh(forecastToday),
            label: 'PV heute',
            onClick: toEnergy,
        },
        forecastTomorrow !== undefined && {
            key: 'forecast2',
            icon: '🔮',
            value: fmtKwh(forecastTomorrow),
            label: 'PV morgen',
            onClick: toEnergy,
        },
        {
            key: 'lights',
            icon: '💡',
            value: String(lightsOn.length),
            label: lightsOn.length === 1 ? 'Licht an' : 'Lichter an',
            onClick: lightsOn.length ? jump('lights') : undefined,
        },
        climateOn.length > 0 && {
            key: 'climate',
            icon: climateIcon,
            value: String(climateOn.length),
            label: 'Klima an',
            onClick: jump('climate'),
        },
        {
            key: 'open',
            icon: '🪟',
            value: String(open.length),
            label: 'offen',
            onClick: open.length ? jump('open') : undefined,
        },
        playing.length > 0 && {
            key: 'playing',
            icon: '🎵',
            value: String(playing.length),
            label: 'spielt',
            onClick: jump('playing'),
        },
        sunProtected > 0 && {
            key: 'sun',
            icon: '🕶️',
            value: String(sunProtected),
            label: 'Sonnenschutz',
            onClick: toShutters,
        },
        !!shutterAlarm && {
            key: 'alarm',
            icon: autoStateInfo(shutterAlarm)?.icon || '⚠️',
            value: autoStateInfo(shutterAlarm)?.label || shutterAlarm,
            label: 'Rollläden',
            onClick: toShutters,
            warn: true,
        },
        holiday && { key: 'holiday', icon: '🏖️', value: 'aktiv', label: 'Urlaubszeiten', onClick: toShutters },
        problems.length > 0 && {
            key: 'problems',
            icon: '⚠️',
            value: String(problems.length),
            label: problems.length === 1 ? 'Störung' : 'Störungen',
            onClick: jump('problems'),
            warn: true,
        },
    ];
    const kpis = kpiCandidates.filter((k): k is Kpi => !!k);
    const main = model.energy[0];
    // Bereiche ohne aktuellen Inhalt: im Bearbeiten-Modus mit Hinweis zeigen (zum Anordnen/Ausblenden)
    const placeholder = (text: string): React.ReactNode =>
        editing ? <p className="csec__placeholder">{text}</p> : null;

    // Kennzahlen, Wetter usw. – auf dem Handy eine gemeinsam sortierbare Liste,
    // auf dem Desktop Kennzahlen als Leiste oben und die Karten in der linken Spalte
    const kpiSections: SectionDef[] = [
        {
            key: 'kpis',
            label: 'Kennzahlen',
            node: (
                <div
                    className="kpis"
                    role="list"
                    aria-label="Kennzahlen"
                >
                    {kpis.map(k => (
                        <KpiTile
                            key={k.key}
                            kpi={k}
                        />
                    ))}
                </div>
            ),
        },
    ];
    const overviewSections: SectionDef[] = [
        {
            key: 'weather',
            label: 'Wetter',
            node: model.weather[0] ? (
                <WeatherCard
                    weather={model.weather[0]}
                    extra={model.weather.slice(1)}
                    compact={phone}
                />
            ) : null,
        },
        {
            key: 'energy',
            label: 'Energiefluss',
            note: 'nur Desktop',
            node:
                dashboard && energy ? (
                    <section className="card home__energy">
                        <div className="card__head">
                            <h2 className="subtitle">⚡ Energie</h2>
                            <button
                                type="button"
                                className="linkbtn"
                                onClick={toEnergy}
                            >
                                Details ›
                            </button>
                        </div>
                        <FlowStatus
                            flow={energy}
                            remainingMin={num(model.energy[0]?.battery?.remaining, states)}
                        />
                        <EnergyFlow flow={energy} />
                    </section>
                ) : null,
        },
        ...model.pvForecast.map(p => ({
            key: `forecast-${p.id}`,
            label: 'PV-Prognose',
            note: 'nur Desktop',
            node: dashboard ? (
                <ForecastCard
                    pv={p}
                    actualPvW={energy?.pv}
                    producedTodayKwh={main?.today?.pv ? kwh(main.today.pv, states) : undefined}
                    actualRef={main?.flows.pv}
                />
            ) : null,
        })),
    ];

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Zuhause</h1>
                <EditButton />
            </div>
            <EditBanner text="Bereiche und Favoriten am Griff ⠿ ziehen, Bereiche aus- oder einblenden, Kachel antippen zum Anpassen" />
            <div className={`home${dashboard ? ' home--dashboard' : ''}`}>
                <div className="home__overview">
                    <CustomSections
                        view="home.overview"
                        className="csecs csecs--stack"
                        sections={dashboard ? overviewSections : [...kpiSections, ...overviewSections]}
                    />
                </div>
                <div className="home__kpis">
                    {dashboard && (
                        <CustomSections
                            view="home.top"
                            sections={kpiSections}
                        />
                    )}
                    {withoutRoom > 0 && !hintHidden && (
                        <div className="hint-row">
                            <button
                                type="button"
                                className="hint"
                                onClick={() => onNavigate('rooms/_none')}
                            >
                                {withoutRoom} {withoutRoom === 1 ? 'Gerät' : 'Geräte'} ohne Raum – antippen zum Ansehen
                            </button>
                            {model.editable && (
                                <button
                                    type="button"
                                    className="iconbtn hint-row__close"
                                    aria-label="Hinweis ausblenden"
                                    title="Hinweis ausblenden"
                                    onClick={() => connection.edit({ kind: 'ui', patch: { hideNoRoomHint: true } })}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                    {withoutRoom > 0 && hintHidden && editing && (
                        <button
                            type="button"
                            className="linkbtn"
                            onClick={() => connection.edit({ kind: 'ui', patch: { hideNoRoomHint: null } })}
                        >
                            Hinweis „{withoutRoom} {withoutRoom === 1 ? 'Gerät' : 'Geräte'} ohne Raum“ wieder anzeigen
                        </button>
                    )}
                </div>
                <div className="home__main">
                    <CustomSections
                        view="home.main"
                        columns={dashboard && wide ? 2 : 1}
                        className="csecs home__sections"
                        sections={[
                            {
                                key: 'favorites',
                                label: 'Favoriten',
                                // Ohne Favoriten nur im Bearbeiten-Modus (mit Hinweis, wie man welche anlegt)
                                node:
                                    favs.length || editing ? (
                                        <section>
                                            <h2 className="subtitle">⭐ Favoriten</h2>
                                            {favs.length ? (
                                                <SortableGrid
                                                    items={favs}
                                                    getId={d => d.id}
                                                    kind="favoriteOrder"
                                                    render={(d, ids) => (
                                                        <DeviceTile
                                                            key={d.id}
                                                            device={d}
                                                            showRoom={roomName(d.roomId)}
                                                            reorder={{ ids, kind: 'favoriteOrder' }}
                                                        />
                                                    )}
                                                />
                                            ) : (
                                                <p className="hint hint--static">
                                                    Noch keine Favoriten – öffne ein Gerät und markiere es mit ☆.
                                                </p>
                                            )}
                                        </section>
                                    ) : null,
                            },
                            {
                                key: 'playing',
                                label: 'Läuft gerade',
                                node: playing.length ? (
                                    <Section
                                        id="home-playing"
                                        title="🎵 Läuft gerade"
                                        devices={playing}
                                        roomName={roomName}
                                    />
                                ) : (
                                    placeholder('Erscheint, sobald ein Player abspielt.')
                                ),
                            },
                            {
                                key: 'lights',
                                label: 'Eingeschaltete Lichter',
                                node: lightsOn.length ? (
                                    <section id="home-lights">
                                        <h2 className="subtitle">💡 Eingeschaltete Lichter</h2>
                                        {groupByRoom(lightsOn, model.rooms).map(g => (
                                            <div
                                                key={g.roomId ?? '_none'}
                                                className="roomgroup"
                                            >
                                                <div className="roomgroup__head">
                                                    <button
                                                        type="button"
                                                        className="roomgroup__title"
                                                        onClick={() =>
                                                            onNavigate(
                                                                `rooms/${g.roomId ? encodeURIComponent(g.roomId) : '_none'}`,
                                                            )
                                                        }
                                                    >
                                                        {g.name}
                                                        <span className="group__count">{g.devices.length}</span>
                                                        <span aria-hidden="true">›</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="roomgroup__off"
                                                        aria-label={`${g.name}: alle Lichter ausschalten`}
                                                        title="Alle Lichter ausschalten"
                                                        onClick={() => switchLights(g.devices, false, states, g.name)}
                                                    >
                                                        💡 Alle aus
                                                    </button>
                                                </div>
                                                <div className="grid">
                                                    {g.devices.map(d => (
                                                        <DeviceTile
                                                            key={d.id}
                                                            device={d}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                ) : (
                                    placeholder('Erscheint, sobald ein Licht an ist.')
                                ),
                            },
                            {
                                key: 'climate',
                                label: 'Klima aktiv',
                                node: climateOn.length ? (
                                    <Section
                                        id="home-climate"
                                        title={`${climateIcon} Klima aktiv`}
                                        devices={climateOn}
                                        roomName={roomName}
                                    />
                                ) : (
                                    placeholder('Erscheint, sobald ein Klimagerät eingeschaltet ist.')
                                ),
                            },
                            {
                                key: 'open',
                                label: 'Offene Fenster & Türen',
                                node: open.length ? (
                                    <Section
                                        id="home-open"
                                        title="🪟 Offene Fenster & Türen"
                                        devices={open}
                                        roomName={roomName}
                                    />
                                ) : (
                                    placeholder('Erscheint, sobald ein Fenster oder eine Tür offen ist.')
                                ),
                            },
                            {
                                key: 'problems',
                                label: 'Störungen',
                                node: problems.length ? (
                                    <Section
                                        id="home-problems"
                                        title="⚠️ Störungen"
                                        devices={problems}
                                        roomName={roomName}
                                    />
                                ) : (
                                    placeholder('Erscheint bei nicht erreichbaren Geräten oder leerer Batterie.')
                                ),
                            },
                        ]}
                    />
                    {!editing && lightsOn.length + climateOn.length + open.length + problems.length === 0 && (
                        <p className="empty">Alles ruhig – keine Lichter an, alles geschlossen.</p>
                    )}
                </div>
            </div>
        </>
    );
}

function Section({
    id,
    title,
    devices,
    roomName,
}: {
    id: string;
    title: string;
    devices: SvDevice[];
    roomName: (id: string | null) => string | undefined;
}): React.JSX.Element {
    return (
        <section id={id}>
            <h2 className="subtitle">{title}</h2>
            <div className="grid">
                {devices.map(d => (
                    <DeviceTile
                        key={d.id}
                        device={d}
                        showRoom={roomName(d.roomId)}
                    />
                ))}
            </div>
        </section>
    );
}

interface Kpi {
    key: string;
    icon: string;
    value: string;
    label: string;
    onClick?: (() => void) | undefined;
    warn?: boolean;
}

function KpiTile({ kpi }: { kpi: Kpi }): React.JSX.Element {
    const content = (
        <>
            <span
                className="kpi__icon"
                aria-hidden="true"
            >
                {kpi.icon}
            </span>
            <span className="kpi__value">{kpi.value}</span>
            <span className="kpi__label">{kpi.label}</span>
        </>
    );
    const className = `kpi${kpi.warn ? ' kpi--warn' : ''}`;
    return (
        <div role="listitem">
            {kpi.onClick ? (
                <button
                    type="button"
                    className={className}
                    onClick={kpi.onClick}
                >
                    {content}
                </button>
            ) : (
                <div className={className}>{content}</div>
            )}
        </div>
    );
}
