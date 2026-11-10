import type { SvDevice } from '../../../src/shared/protocol';
import { useConnection } from '../connection';
import { isActive, warnings } from '../device';
import { formatPower, snapshot } from '../energy';
import { DeviceTile } from '../components/DeviceTile';

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
    const energy = model.energy[0] ? snapshot(model.energy[0], states) : undefined;

    return (
        <>
            <h1 className="title">Zuhause</h1>
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
