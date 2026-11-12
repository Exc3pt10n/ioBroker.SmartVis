import { ROOM_ICON_CHOICES, autoRoomIcon } from '../rooms';
import { useState } from 'react';
import type { SvDevice, SvEdit, SvRoom } from '../../../src/shared/protocol';

type DevicePatch = Extract<SvEdit, { kind: 'device' }>['patch'];
import { Sheet } from '../components/Sheet';
import { SwitchRow } from '../components/Switch';
import { connection, useConnection } from '../connection';
import { TYPE_LABELS } from '../device';

const NEW_ROOM = '__new__';
const NO_ROOM = '__none__';

/** Namensfeld: speichert beim Verlassen oder mit Enter, leer = zurück zur Erkennung */
function NameField({
    value,
    original,
    onSave,
}: {
    value: string;
    original?: string;
    onSave: (name: string | null) => void;
}): React.JSX.Element {
    const [draft, setDraft] = useState(value);
    const commit = (): void => {
        const name = draft.trim();
        if (!name || name === original) {
            onSave(null);
            setDraft(original || value);
        } else if (name !== value) {
            onSave(name);
        }
    };
    return (
        <div className="field">
            <label
                className="field__label"
                htmlFor="edit-name"
            >
                Name
            </label>
            <input
                id="edit-name"
                className="field__input"
                value={draft}
                maxLength={60}
                autoComplete="off"
                enterKeyHint="done"
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {original && (
                <button
                    type="button"
                    className="field__reset"
                    onClick={() => {
                        setDraft(original);
                        onSave(null);
                    }}
                >
                    Zurücksetzen auf „{original}“
                </button>
            )}
        </div>
    );
}

export function EditDeviceSheet({
    deviceId,
    onClose,
}: {
    deviceId: string;
    onClose: () => void;
}): React.JSX.Element | null {
    const { model } = useConnection();
    const [newRoom, setNewRoom] = useState<string | null>(null);
    const device: SvDevice | undefined = model?.devices.find(d => d.id === deviceId);
    if (!model || !device) {
        return null;
    }
    const patch = (p: DevicePatch): void => connection.edit({ kind: 'device', id: device.id, patch: p });
    const detectedRoom = device.originalRoomId !== undefined ? device.originalRoomId : device.roomId;
    const roomName = (id: string | null | undefined): string =>
        id ? (model.rooms.find(r => r.id === id)?.name ?? id) : 'Ohne Raum';
    const customized = device.originalName || device.originalRoomId !== undefined || device.hidden || device.favorite;

    return (
        <Sheet
            title={device.name}
            subtitle={`${TYPE_LABELS[device.type] || device.type} · ${device.adapter}`}
            onClose={onClose}
        >
            <div className="detail__controls">
                <NameField
                    key={device.name}
                    value={device.name}
                    original={device.originalName}
                    onSave={name => patch({ name })}
                />
                <div className="field">
                    <label
                        className="field__label"
                        htmlFor="edit-room"
                    >
                        Raum
                    </label>
                    <select
                        id="edit-room"
                        className="field__input"
                        value={newRoom !== null ? NEW_ROOM : (device.roomId ?? NO_ROOM)}
                        onChange={e => {
                            const v = e.target.value;
                            if (v === NEW_ROOM) {
                                setNewRoom('');
                                return;
                            }
                            setNewRoom(null);
                            const roomId = v === NO_ROOM ? null : v;
                            // Zurück in den erkannten Raum = Override entfernen
                            patch({ roomId: roomId === detectedRoom ? '' : roomId });
                        }}
                    >
                        {model.rooms.map(r => (
                            <option
                                key={r.id}
                                value={r.id}
                            >
                                {r.name}
                                {r.hidden ? ' (ausgeblendet)' : ''}
                            </option>
                        ))}
                        <option value={NO_ROOM}>Ohne Raum</option>
                        <option value={NEW_ROOM}>＋ Neuer Raum …</option>
                    </select>
                    {device.originalRoomId !== undefined && (
                        <span className="field__hint">Erkannt: {roomName(device.originalRoomId)}</span>
                    )}
                </div>
                {newRoom !== null && (
                    <form
                        className="field field--inline"
                        onSubmit={e => {
                            e.preventDefault();
                            if (newRoom.trim()) {
                                connection.edit({ kind: 'createRoom', name: newRoom, deviceId: device.id });
                                setNewRoom(null);
                            }
                        }}
                    >
                        <input
                            className="field__input"
                            placeholder="Name des neuen Raums"
                            aria-label="Name des neuen Raums"
                            value={newRoom}
                            maxLength={60}
                            autoFocus
                            onChange={e => setNewRoom(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="action action--primary"
                        >
                            Anlegen
                        </button>
                    </form>
                )}
                <SwitchRow
                    label="Favorit"
                    hint="Auf der Startseite anzeigen"
                    checked={!!device.favorite}
                    onChange={v => patch({ favorite: v })}
                />
                <SwitchRow
                    label="Ausblenden"
                    hint="Nur noch im Bearbeiten-Modus sichtbar"
                    checked={!!device.hidden}
                    onChange={v => patch({ hidden: v })}
                />
            </div>
            {customized && (
                <button
                    type="button"
                    className="action action--danger"
                    onClick={() => connection.edit({ kind: 'resetDevice', id: device.id })}
                >
                    Alle Anpassungen zurücksetzen
                </button>
            )}
        </Sheet>
    );
}

export function EditRoomSheet({ room, onClose }: { room: SvRoom; onClose: () => void }): React.JSX.Element {
    const { model } = useConnection();
    const current = model?.rooms.find(r => r.id === room.id) || room;
    const count = model?.devices.filter(d => d.roomId === room.id).length ?? 0;
    const source = { enum: 'aus ioBroker', adapter: 'aus Hue', name: 'aus Gerätenamen', custom: 'selbst angelegt' }[
        current.source
    ];

    return (
        <Sheet
            title={current.name}
            subtitle={`Raum ${source} · ${count} ${count === 1 ? 'Gerät' : 'Geräte'}`}
            onClose={onClose}
        >
            <div className="detail__controls">
                <NameField
                    key={current.name}
                    value={current.name}
                    original={current.originalName}
                    onSave={name => connection.edit({ kind: 'room', id: current.id, patch: { name } })}
                />
                <SwitchRow
                    label="Ausblenden"
                    hint="Raum in der Raumliste verbergen"
                    checked={!!current.hidden}
                    onChange={v => connection.edit({ kind: 'room', id: current.id, patch: { hidden: v } })}
                />
            </div>
            <div className="detail__controls icon-picker">
                <span className="setting__text">Symbol</span>
                <div
                    className="icon-picker__grid"
                    role="radiogroup"
                    aria-label="Symbol des Raums"
                >
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!current.icon}
                        className={`icon-picker__auto${!current.icon ? ' is-selected' : ''}`}
                        onClick={() => connection.edit({ kind: 'room', id: current.id, patch: { icon: null } })}
                    >
                        {autoRoomIcon(current.name)} Automatisch
                    </button>
                    {ROOM_ICON_CHOICES.map(icon => (
                        <button
                            key={icon}
                            type="button"
                            role="radio"
                            aria-checked={current.icon === icon}
                            aria-label={`Symbol ${icon}`}
                            className={current.icon === icon ? 'is-selected' : ''}
                            onClick={() => connection.edit({ kind: 'room', id: current.id, patch: { icon } })}
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>
            {current.source === 'custom' && (
                <button
                    type="button"
                    className="action action--danger"
                    onClick={() => {
                        connection.edit({ kind: 'deleteRoom', id: current.id });
                        onClose();
                    }}
                >
                    Raum löschen
                    {count
                        ? ` (${count} ${count === 1 ? 'Gerät kehrt' : 'Geräte kehren'} in den erkannten Raum zurück)`
                        : ''}
                </button>
            )}
        </Sheet>
    );
}

export function CreateRoomSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
    const [name, setName] = useState('');
    return (
        <Sheet
            title="Neuer Raum"
            onClose={onClose}
        >
            <form
                className="detail__controls"
                onSubmit={e => {
                    e.preventDefault();
                    if (name.trim()) {
                        connection.edit({ kind: 'createRoom', name });
                        onClose();
                    }
                }}
            >
                <div className="field">
                    <label
                        className="field__label"
                        htmlFor="new-room"
                    >
                        Name
                    </label>
                    <input
                        id="new-room"
                        className="field__input"
                        value={name}
                        maxLength={60}
                        autoFocus
                        onChange={e => setName(e.target.value)}
                    />
                </div>
                <button
                    type="submit"
                    className="action action--primary"
                    disabled={!name.trim()}
                >
                    Anlegen
                </button>
            </form>
        </Sheet>
    );
}
