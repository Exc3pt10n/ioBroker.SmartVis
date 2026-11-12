import { useState } from 'react';
import type { SvRoom } from '../../../src/shared/protocol';
import { EditBanner, EditButton, MoveButtons } from '../components/EditButton';
import { DragHandle, SortableGrid, useSortable } from '../components/SortableGrid';
import { connection, useConnection } from '../connection';
import { moved, useEditing, visibleDevices, visibleRooms } from '../editing';
import { CreateRoomSheet, EditRoomSheet } from './EditSheets';
import { lightsOff, roomIcon, roomStatus, type RoomStatus } from '../rooms';

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
                    const i = order.indexOf(room.id);
                    return (
                        <RoomCard
                            key={room.id}
                            room={room}
                            status={roomStatus(list, states)}
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
                                    className="room room--none"
                                    onClick={() => onNavigate('rooms/_none')}
                                >
                                    <span
                                        className="room__icon"
                                        aria-hidden="true"
                                    >
                                        ❔
                                    </span>
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

function fmt(v: number, digits: number): string {
    return v.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

function RoomCard({
    room,
    status,
    count,
    editing,
    canBack,
    canForward,
    onOpen,
    onMove,
}: {
    room: SvRoom;
    status: RoomStatus;
    count: number;
    editing: boolean;
    canBack: boolean;
    canForward: boolean;
    onOpen: () => void;
    onMove: (delta: -1 | 1) => void;
}): React.JSX.Element {
    const sort = useSortable();
    const lit = status.lights.length > 0;
    const warn = status.open > 0 || status.problems > 0;
    // Kurze Statusangaben – nur was gerade los ist
    const badges: { key: string; text: string; label: string; warn?: boolean }[] = [
        lit && {
            key: 'lights',
            text: `💡 ${status.lights.length}`,
            label: `${status.lights.length} ${status.lights.length === 1 ? 'Licht' : 'Lichter'} an`,
        },
        status.open > 0 && { key: 'open', text: `🪟 ${status.open}`, label: `${status.open} offen`, warn: true },
        status.climate && { key: 'climate', text: status.climate, label: 'Klima läuft' },
        status.playing > 0 && { key: 'media', text: '🎵', label: 'Musik läuft' },
        status.blindMin !== undefined && {
            key: 'blind',
            text: `▤ ${Math.round(status.blindMin)} %`,
            label: `Rollladen ${Math.round(status.blindMin)} % offen`,
        },
        status.problems > 0 && {
            key: 'problems',
            text: `⚠️ ${status.problems}`,
            label: `${status.problems} ${status.problems === 1 ? 'Störung' : 'Störungen'}`,
            warn: true,
        },
    ].filter((b): b is { key: string; text: string; label: string; warn?: boolean } => !!b);

    return (
        <div
            className={`room-wrap${room.hidden ? ' is-hidden' : ''}${editing ? ' is-editing' : ''}${sort?.dragId === room.id ? ' is-dragging' : ''}`}
            data-sort-id={room.id}
        >
            <button
                type="button"
                className={`room${lit && !editing ? ' room--lit' : ''}${warn && !editing ? ' room--warn' : ''}`}
                onClick={onOpen}
            >
                <span
                    className="room__icon"
                    aria-hidden="true"
                >
                    {roomIcon(room)}
                </span>
                <span className="room__name">
                    {room.name}
                    {room.hidden && <span className="badge">ausgeblendet</span>}
                </span>
                {status.temperature !== undefined || status.humidity !== undefined ? (
                    <span className="room__climate">
                        {status.temperature !== undefined && <span>🌡️ {fmt(status.temperature, 1)}°</span>}
                        {status.humidity !== undefined && <span>💧 {fmt(status.humidity, 0)} %</span>}
                    </span>
                ) : null}
                {badges.length > 0 && !editing ? (
                    <span className="room__badges">
                        {badges.map(b => (
                            <span
                                key={b.key}
                                className={`room__badge${b.warn ? ' room__badge--warn' : ''}`}
                                title={b.label}
                                aria-label={b.label}
                            >
                                {b.text}
                            </span>
                        ))}
                    </span>
                ) : (
                    <span className="room__meta">
                        {count} {count === 1 ? 'Gerät' : 'Geräte'}
                        {editing && room.source === 'name' ? ' · aus Gerätenamen erkannt' : ''}
                        {editing && room.source === 'custom' ? ' · selbst angelegt' : ''}
                    </span>
                )}
            </button>
            {lit && !editing && (
                <button
                    type="button"
                    className="room__off"
                    aria-label={`${room.name}: alle Lichter ausschalten`}
                    title="Alle Lichter ausschalten"
                    onClick={() => lightsOff(status.lights, (id, val) => connection.setState(id, val))}
                >
                    💡 aus
                </button>
            )}
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
