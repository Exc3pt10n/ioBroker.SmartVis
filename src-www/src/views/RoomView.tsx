import { DeviceTile } from '../components/DeviceTile';
import { EditBanner, EditButton } from '../components/EditButton';
import { Icon } from '../components/Icon';
import { useConnection } from '../connection';
import { groupByType } from '../device';
import { useEditing, visibleDevices } from '../editing';

export function RoomView({ roomId, onBack }: { roomId: string; onBack: () => void }): React.JSX.Element {
    const { model } = useConnection();
    const { editing } = useEditing();
    if (!model) {
        return <p className="empty">Lade …</p>;
    }
    const isNone = roomId === '_none';
    const room = model.rooms.find(r => r.id === roomId);
    const devices = visibleDevices(model, editing).filter(d => (isNone ? !d.roomId : d.roomId === roomId));
    const groups = groupByType(devices);

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
                <span className="titlebar__spacer" />
                <EditButton />
            </div>
            <EditBanner text="Kachel antippen zum Umbenennen, Verschieben oder Ausblenden · ← → sortiert innerhalb der Gruppe" />
            {devices.length === 0 ? (
                <p className="empty">Keine Geräte in diesem Raum.</p>
            ) : (
                groups.map(({ group, devices: list }) => {
                    // Sortieren innerhalb der Gruppe (die Reihenfolge der Gruppen ist fest)
                    const ids = list.map(d => d.id);
                    return (
                        <section
                            key={group.key}
                            className="group"
                            aria-labelledby={`group-${group.key}`}
                        >
                            <h2
                                id={`group-${group.key}`}
                                className="subtitle"
                            >
                                <span aria-hidden="true">{group.icon}</span> {group.label}
                                <span className="group__count">{list.length}</span>
                            </h2>
                            <div className="grid">
                                {list.map(d => (
                                    <DeviceTile
                                        key={d.id}
                                        device={d}
                                        reorder={{ ids, kind: 'deviceOrder' }}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}
        </>
    );
}
