import { useState } from 'react';
import type { SvRoom } from '../../../src/shared/protocol';
import { EditBanner, EditButton, MoveButtons } from '../components/EditButton';
import { DragHandle, SortableGrid, useSortable } from '../components/SortableGrid';
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

    return (
        <>
            <div className="titlebar titlebar--split">
                <h1 className="title">Räume</h1>
                <EditButton />
            </div>
            <EditBanner text="Raum antippen zum Umbenennen oder Ausblenden · am Griff ⠿ ziehen oder mit ← → sortieren" />
            <SortableGrid
                className="grid grid--rooms"
                items={rooms}
                getId={r => r.room.id}
                kind="roomOrder"
                render={({ room, devices: list }, order) => {
                    const active = list.filter(d => !d.hidden && isActive(d, states)).length;
                    const i = order.indexOf(room.id);
                    return (
                        <RoomCard
                            key={room.id}
                            room={room}
                            active={active}
                            count={list.length}
                            editing={editing}
                            canBack={i > 0}
                            canForward={i < order.length - 1}
                            onOpen={() =>
                                editing ? setEditRoom(room) : onNavigate(`rooms/${encodeURIComponent(room.id)}`)
                            }
                            onMove={delta => {
                                const ids = moved(order, room.id, delta);
                                if (ids) {
                                    connection.edit({ kind: 'roomOrder', ids });
                                }
                            }}
                        />
                    );
                }}
                after={
                    <>
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
                    </>
                }
            />
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

function RoomCard({
    room,
    active,
    count,
    editing,
    canBack,
    canForward,
    onOpen,
    onMove,
}: {
    room: SvRoom;
    active: number;
    count: number;
    editing: boolean;
    canBack: boolean;
    canForward: boolean;
    onOpen: () => void;
    onMove: (delta: -1 | 1) => void;
}): React.JSX.Element {
    const sort = useSortable();
    return (
        <div
            className={`room-wrap${room.hidden ? ' is-hidden' : ''}${editing ? ' is-editing' : ''}${sort?.dragId === room.id ? ' is-dragging' : ''}`}
            data-sort-id={room.id}
        >
            <button
                type="button"
                className="room"
                onClick={onOpen}
            >
                <span className="room__name">
                    {room.name}
                    {room.hidden && <span className="badge">ausgeblendet</span>}
                </span>
                <span className="room__meta">
                    {count} {count === 1 ? 'Gerät' : 'Geräte'}
                    {active ? ` · ${active} aktiv` : ''}
                    {editing && room.source === 'name' ? ' · aus Gerätenamen erkannt' : ''}
                    {editing && room.source === 'custom' ? ' · selbst angelegt' : ''}
                </span>
            </button>
            {editing && (
                <DragHandle
                    id={room.id}
                    label={room.name}
                />
            )}
            {editing && (
                <MoveButtons
                    label={room.name}
                    canBack={canBack}
                    canForward={canForward}
                    onMove={onMove}
                />
            )}
        </div>
    );
}
