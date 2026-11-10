import { DeviceTile } from '../components/DeviceTile';
import { Icon } from '../components/Icon';
import { useConnection } from '../connection';

export function RoomView({ roomId, onBack }: { roomId: string; onBack: () => void }): React.JSX.Element {
    const { model } = useConnection();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    const isNone = roomId === '_none';
    const room = model.rooms.find(r => r.id === roomId);
    const devices = model.devices.filter(d => (isNone ? !d.roomId : d.roomId === roomId));

    return (
        <>
            <div className="titlebar">
                <button
                    type="button"
                    className="iconbtn"
                    onClick={onBack}
                    aria-label="Zurück"
                >
                    <Icon name="back" />
                </button>
                <h1 className="title">{isNone ? 'Ohne Raum' : room?.name || 'Unbekannter Raum'}</h1>
            </div>
            {devices.length === 0 ? (
                <p className="empty">Keine Geräte in diesem Raum.</p>
            ) : (
                <div className="grid">
                    {devices.map(d => (
                        <DeviceTile
                            key={d.id}
                            device={d}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
