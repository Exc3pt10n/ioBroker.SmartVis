import { useState } from 'react';
import type { SvRoom } from '../../../src/shared/protocol';
import { EditBanner, EditButton, MoveButtons } from '../components/EditButton';
import { connection, useConnection } from '../connection';
import { isActive } from '../device';
import { moved, useEditing, visibleDevices, visibleRooms } from '../editing';
import { CreateRoomSheet, EditRoomSheet } from './EditSheets';

export function RoomsView({ onNavigate }: { onNavigate: (path: string) => void }): React.JSX.Element {
    const { model, states } = useConnection();
    const { editing } = useEditing();
    const [editRoom, setEditRoom] = useState<SvRoom | null>(null);
    const [creating, setCreating] = useState(false);
    if (!model) {
        return <p className="empty">Lade Räume …</p>;
    }
    const devices = visibleDevices(model, editing);
    const withoutRoom = devices.filter(d => !d.roomId);
    // Im Bearbeiten-Modus auch leere (z. B. neu angelegte) und ausgeblendete Räume zeigen
    const rooms = visibleRooms(model, editing)
        .map(r => ({ room: r, devices: devices.filter(d => d.roomId === r.id) }))
        .filter(r => editing || r.devices.length > 0);
    const roomIds = model.rooms.map(r => r.id);

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Räume</h1>
                <EditButton />
            </div>
            <EditBanner text="Raum antippen zum Umbenennen oder Ausblenden, ← → zum Sortieren" />
            <div className="grid grid--rooms">
                {rooms.map(({ room, devices: list }) => {
                    const active = list.filter(d => !d.hidden && isActive(d, states)).length;
                    const i = roomIds.indexOf(room.id);
                    return (
                        <div
                            key={room.id}
                            className={`room-wrap${room.hidden ? ' is-hidden' : ''}${editing ? ' is-editing' : ''}`}
                        >
                            <button
                                type="button"
                                className="room"
                                onClick={() =>
                                    editing ? setEditRoom(room) : onNavigate(`rooms/${encodeURIComponent(room.id)}`)
                                }
                            >
                                <span className="room__name">
                                    {room.name}
                                    {room.hidden && <span className="badge">ausgeblendet</span>}
                                </span>
                                <span className="room__meta">
                                    {list.length} {list.length === 1 ? 'Gerät' : 'Geräte'}
                                    {active ? ` · ${active} aktiv` : ''}
                                    {editing && room.source === 'name' ? ' · aus Gerätenamen erkannt' : ''}
                                    {editing && room.source === 'custom' ? ' · selbst angelegt' : ''}
                                </span>
                            </button>
                            {editing && (
                                <MoveButtons
                                    label={room.name}
                                    canBack={i > 0}
                                    canForward={i < roomIds.length - 1}
                                    onMove={delta => {
                                        const ids = moved(roomIds, room.id, delta);
                                        if (ids) {
                                            connection.edit({ kind: 'roomOrder', ids });
                                        }
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
                {withoutRoom.length > 0 && (
                    <div className="room-wrap">
                        <button
                            type="button"
                            className="room"
                            onClick={() => onNavigate('rooms/_none')}
                        >
                            <span className="room__name">Ohne Raum</span>
                            <span className="room__meta">
                                {withoutRoom.length} {withoutRoom.length === 1 ? 'Gerät' : 'Geräte'}
                            </span>
                        </button>
                    </div>
                )}
                {editing && (
                    <button
                        type="button"
                        className="room room--add"
                        onClick={() => setCreating(true)}
                    >
                        ＋ Raum anlegen
                    </button>
                )}
            </div>
            {editRoom && (
                <EditRoomSheet
                    room={editRoom}
                    onClose={() => setEditRoom(null)}
                />
            )}
            {creating && <CreateRoomSheet onClose={() => setCreating(false)} />}
        </>
    );
}
