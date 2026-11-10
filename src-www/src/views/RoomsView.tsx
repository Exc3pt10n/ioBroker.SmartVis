import { useConnection } from '../connection';
import { isActive } from '../device';

export function RoomsView({ onNavigate }: { onNavigate: (path: string) => void }): React.JSX.Element {
    const { model, states } = useConnection();
    if (!model) {
        return <p className="empty">Lade Räume …</p>;
    }
    const withoutRoom = model.devices.filter(d => !d.roomId);
    const rooms = [
        ...model.rooms.map(r => ({
            id: r.id,
            name: r.name,
            auto: r.source === 'name',
            devices: model.devices.filter(d => d.roomId === r.id),
        })),
        ...(withoutRoom.length ? [{ id: '_none', name: 'Ohne Raum', auto: false, devices: withoutRoom }] : []),
    ].filter(r => r.devices.length > 0);

    return (
        <>
            <h1 className="title">Räume</h1>
            <div className="grid grid--rooms">
                {rooms.map(r => {
                    const active = r.devices.filter(d => isActive(d, states)).length;
                    return (
                        <button
                            key={r.id}
                            type="button"
                            className="room"
                            onClick={() => onNavigate(`rooms/${r.id}`)}
                        >
                            <span className="room__name">{r.name}</span>
                            <span className="room__meta">
                                {r.devices.length} {r.devices.length === 1 ? 'Gerät' : 'Geräte'}
                                {active ? ` · ${active} aktiv` : ''}
                                {r.auto ? ' · automatisch erkannt' : ''}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}
