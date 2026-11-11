import type { SvDevice } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { groupByRoom, isActive, isPlaying, warnings } from '../device';
import { formatPower, kwh, snapshot, wallboxSnapshot } from '../energy';
import { autoStateInfo } from '../shutters';
import { DeviceTile } from '../components/DeviceTile';
import { SortableGrid } from '../components/SortableGrid';
import { EditBanner, EditButton } from '../components/EditButton';
import { favorites, useEditing, visibleDevices } from '../editing';
import { WeatherCard } from '../components/WeatherCard';

const LIGHT_TYPES = ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'];
const OPENING_TYPES = ['window', 'windowTilt', 'door'];

export function HomeView({ onNavigate }: { onNavigate: (path: string) => void }): React.JSX.Element {
    const { model, states } = useConnection();
    const { editing } = useEditing();
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
    const lightsOn = devices.filter(d => LIGHT_TYPES.includes(d.type) && isActive(d, states));
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

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Zuhause</h1>
                <EditButton />
            </div>
            <EditBanner text="Favoriten mit ← → sortieren, Kachel antippen zum Anpassen" />
            {model.weather[0] && (
                <WeatherCard
                    weather={model.weather[0]}
                    extra={model.weather.slice(1)}
                />
            )}
            {(favs.length > 0 || editing) && (
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
            )}
            <div className="chips">
                <span className="chip">💡 {lightsOn.length} Lichter an</span>
                <span className="chip">🪟 {open.length} offen</span>
                {energy?.pv !== undefined && (
                    <button
                        type="button"
                        className="chip"
                        onClick={() => onNavigate('energy')}
                    >
                        ☀️ {formatPower(energy.pv)}
                        {energy.soc !== undefined ? ` · 🔋 ${Math.round(energy.soc)} %` : ''}
                    </button>
                )}
                {charging.map((w, i) => (
                    <button
                        key={i}
                        type="button"
                        className="chip"
                        onClick={() => onNavigate('energy')}
                    >
                        🚗 lädt {formatPower(w.power)}
                    </button>
                ))}
                {forecastTomorrow !== undefined && (
                    <button
                        type="button"
                        className="chip"
                        onClick={() => onNavigate('energy')}
                    >
                        🔮 PV heute{' '}
                        {forecastToday !== undefined
                            ? `${forecastToday.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh`
                            : '–'}{' '}
                        · morgen {forecastTomorrow.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh
                    </button>
                )}
                {sunProtected > 0 && (
                    <button
                        type="button"
                        className="chip"
                        onClick={() => onNavigate('shutters')}
                    >
                        🕶️ {sunProtected} im Sonnenschutz
                    </button>
                )}
                {shutterAlarm && (
                    <button
                        type="button"
                        className="chip chip--warn"
                        onClick={() => onNavigate('shutters')}
                    >
                        {autoStateInfo(shutterAlarm)?.icon} {autoStateInfo(shutterAlarm)?.label}
                    </button>
                )}
                {holiday && (
                    <button
                        type="button"
                        className="chip"
                        onClick={() => onNavigate('shutters')}
                    >
                        🏖️ Urlaubszeiten aktiv
                    </button>
                )}
                {problems.length > 0 && <span className="chip chip--warn">⚠️ {problems.length} Störungen</span>}
            </div>

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

            {playing.length > 0 && (
                <Section
                    title="🎵 Läuft gerade"
                    devices={playing}
                    roomName={roomName}
                />
            )}

            {lightsOn.length > 0 && (
                <section>
                    <h2 className="subtitle">Eingeschaltete Lichter</h2>
                    {groupByRoom(lightsOn, model.rooms).map(g => (
                        <div
                            key={g.roomId ?? '_none'}
                            className="roomgroup"
                        >
                            <button
                                type="button"
                                className="roomgroup__title"
                                onClick={() => onNavigate(`rooms/${g.roomId ? encodeURIComponent(g.roomId) : '_none'}`)}
                            >
                                {g.name}
                                <span className="group__count">{g.devices.length}</span>
                                <span aria-hidden="true">›</span>
                            </button>
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
            )}
            {open.length > 0 && (
                <Section
                    title="Offene Fenster & Türen"
                    devices={open}
                    roomName={roomName}
                />
            )}
            {problems.length > 0 && (
                <Section
                    title="Störungen"
                    devices={problems}
                    roomName={roomName}
                />
            )}
            {lightsOn.length + open.length + problems.length === 0 && (
                <p className="empty">Alles ruhig – keine Lichter an, alles geschlossen.</p>
            )}
        </>
    );
}

function Section({
    title,
    devices,
    roomName,
}: {
    title: string;
    devices: SvDevice[];
    roomName: (id: string | null) => string | undefined;
}): React.JSX.Element {
    return (
        <section>
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
