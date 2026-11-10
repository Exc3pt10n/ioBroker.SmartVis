import type { SvDevice } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { isActive, warnings } from '../device';
import { formatPower, snapshot, wallboxSnapshot } from '../energy';
import { autoStateInfo } from '../shutters';
import { DeviceTile } from '../components/DeviceTile';
import { WeatherCard } from '../components/WeatherCard';

const LIGHT_TYPES = ['light', 'dimmer', 'ct', 'hue', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie'];
const OPENING_TYPES = ['window', 'windowTilt', 'door'];

export function HomeView({ onNavigate }: { onNavigate: (path: string) => void }): React.JSX.Element {
    const { model, states } = useConnection();
    if (!model) {
        return <p className="empty">Lade Geräte …</p>;
    }
    const roomName = (id: string | null): string | undefined => model.rooms.find(r => r.id === id)?.name;

    const lightsOn = model.devices.filter(d => LIGHT_TYPES.includes(d.type) && isActive(d, states));
    const open = model.devices.filter(d => OPENING_TYPES.includes(d.type) && isActive(d, states));
    const problems = model.devices.filter(d => warnings(d, states).length > 0);
    const withoutRoom = model.devices.filter(d => !d.roomId).length;
    const energy = model.energy[0] ? snapshot(model.energy[0], states, model.wallboxes) : undefined;
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
            <h1 className="title">Zuhause</h1>
            {model.weather[0] && (
                <WeatherCard
                    weather={model.weather[0]}
                    extra={model.weather.slice(1)}
                />
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

            {withoutRoom > 0 && (
                <button
                    type="button"
                    className="hint"
                    onClick={() => onNavigate('rooms/_none')}
                >
                    {withoutRoom} {withoutRoom === 1 ? 'Gerät' : 'Geräte'} ohne Raum – antippen zum Ansehen
                </button>
            )}

            {lightsOn.length > 0 && (
                <Section
                    title="Eingeschaltete Lichter"
                    devices={lightsOn}
                    roomName={roomName}
                />
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
