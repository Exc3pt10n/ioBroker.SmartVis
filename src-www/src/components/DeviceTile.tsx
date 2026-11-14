import type { SvDevice, SvStateRef, SvStateValue } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { formatValue, isActive, isPlaying, tapAction, valueState, warnings } from '../device';
import { useOpenDetail } from '../detail';
import { moved, useEditing } from '../editing';
import { useRef } from 'react';
import { MoveButtons } from './EditButton';
import { DragHandle, useSortable } from './SortableGrid';
import { autoStateInfo, shutterForDevice } from '../shutters';
import { isLight } from '../rooms';
import { onlyBatteryWarning } from '../battery';
import { Icon, iconForType } from './Icon';

/** Medien: Titel beim Abspielen, sonst "pausiert" */
function mediaSummary(device: SvDevice, states: Record<string, SvStateValue | null>): string {
    const stateRef = device.states.find(s => s.name === 'STATE');
    const titleRef = device.states.find(s => s.name === 'TITLE');
    const title = titleRef ? states[titleRef.id]?.val : undefined;
    if (isPlaying(states, stateRef)) {
        return title ? `▶ ${String(title)}` : '▶ spielt';
    }
    return 'pausiert';
}

/** Klimagerät: "Kühlen auf 22 °C" bzw. "aus · 24 °C" (Raumtemperatur) */
function acSummary(device: SvDevice, states: Record<string, SvStateValue | null>): string {
    const ref = (name: string): SvStateRef | undefined => device.states.find(s => s.name === name);
    const power = ref('POWER');
    const actual = ref('ACTUAL');
    const room = actual ? formatValue(actual, states[actual.id]) : undefined;
    if (power && states[power.id]?.val !== true) {
        return room && room !== '–' ? `aus · ${room}` : 'aus';
    }
    const mode = ref('MODE');
    const set = ref('SET');
    const modeText = mode ? formatValue(mode, states[mode.id]) : 'an';
    return set ? `${modeText} auf ${formatValue(set, states[set.id])}` : modeText;
}

export function DeviceTile({
    device,
    showRoom,
    reorder,
}: {
    device: SvDevice;
    showRoom?: string;
    /** Reihenfolge, in der die Kachel im Bearbeiten-Modus verschoben werden kann */
    reorder?: { ids: string[]; kind: 'deviceOrder' | 'favoriteOrder' };
}): React.JSX.Element {
    const { states, model } = useConnection();
    const { editing } = useEditing();
    const action = tapAction(device);
    const value = valueState(device);
    const active = isActive(device, states);
    const warn = warnings(device, states);
    // Rollladen-Automatik (shuttercontrol): Status an der Kachel anzeigen
    const auto =
        device.type === 'blind'
            ? shutterForDevice(
                  model,
                  device.states.map(st => st.id),
              )
            : undefined;
    const autoInfo = auto?.autoState ? autoStateInfo(states[auto.autoState.id]?.val) : undefined;
    const pending = action ? states[action.state.id]?.ack === false : false;

    const openDetail = useOpenDetail();
    const sort = useSortable();
    const dragging = sort?.dragId === device.id;
    // Langes Drücken öffnet die Details; ohne Tap-Aktion öffnet schon ein normaler Tap
    const pressTimer = useRef<number | undefined>(undefined);
    const longPressed = useRef(false);
    const startPress = (): void => {
        longPressed.current = false;
        if (editing) {
            return;
        }
        pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            openDetail(device.id);
        }, 500);
    };
    const endPress = (): void => window.clearTimeout(pressTimer.current);

    const onClick = (): void => {
        if (longPressed.current) {
            longPressed.current = false;
            return;
        }
        // Im Bearbeiten-Modus öffnet ein Tap die Anpassungen (App zeigt dann das Bearbeiten-Fenster)
        if (editing) {
            openDetail(device.id);
        } else if (action) {
            connection.setState(action.state.id, action.next(states[action.state.id]));
        } else {
            openDetail(device.id);
        }
    };

    return (
        <div
            className={`tile-wrap${device.hidden ? ' is-hidden' : ''}${editing ? ' is-editing' : ''}${dragging ? ' is-dragging' : ''}`}
            data-sort-id={reorder ? device.id : undefined}
        >
            <button
                type="button"
                className={`tile${active && !editing ? ' tile--active' : ''}${pending ? ' tile--pending' : ''}`}
                onClick={onClick}
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                onContextMenu={e => {
                    e.preventDefault();
                    openDetail(device.id);
                }}
                aria-pressed={action && !editing ? active : undefined}
            >
                <span className="tile__icon">
                    <Icon name={iconForType(device.type)} />
                </span>
                {warn.length > 0 && (
                    <span
                        className="tile__warn"
                        title={warn.join(', ')}
                        role="img"
                        aria-label={warn.join(', ')}
                    >
                        {/* Nur schwache Batterie: Batterie-Symbol statt Warndreieck */}
                        {onlyBatteryWarning(warn) ? (
                            <span className="tile__battery">🪫</span>
                        ) : (
                            <Icon
                                name="warning"
                                size={16}
                            />
                        )}
                    </span>
                )}
                <span className="tile__name">
                    {device.favorite && !reorder?.kind.startsWith('favorite') ? '⭐ ' : ''}
                    {device.name}
                </span>
                {editing && device.hidden && <span className="badge">ausgeblendet</span>}
                <span className="tile__value">
                    {device.type === 'media' || device.type === 'mediaPlayer'
                        ? mediaSummary(device, states)
                        : device.type === 'airCondition'
                          ? acSummary(device, states)
                          : isLight(device) && !active && states[value?.id ?? '']?.val !== undefined
                            ? 'aus'
                            : formatValue(value, value ? states[value.id] : undefined)}
                    {/* Gerätetyp zeigt schon das Symbol; nur außerhalb des Raums den Raum nennen */}
                    {showRoom ? ` · ${showRoom}` : ''}
                </span>
                {autoInfo && (
                    <span className="tile__auto">
                        {autoInfo.icon} {autoInfo.label}
                    </span>
                )}
            </button>
            {editing && reorder && (
                <DragHandle
                    id={device.id}
                    label={device.name}
                />
            )}
            {editing && reorder && (
                <MoveButtons
                    label={device.name}
                    canBack={reorder.ids.indexOf(device.id) > 0}
                    canForward={reorder.ids.indexOf(device.id) < reorder.ids.length - 1}
                    onMove={delta => {
                        const ids = moved(reorder.ids, device.id, delta);
                        if (ids) {
                            connection.edit({ kind: reorder.kind, ids });
                        }
                    }}
                />
            )}
            {action && !editing && (
                <button
                    type="button"
                    className="tile__more"
                    aria-label={`${device.name}: Details`}
                    onClick={() => openDetail(device.id)}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <circle
                            cx="5"
                            cy="12"
                            r="2"
                        />
                        <circle
                            cx="12"
                            cy="12"
                            r="2"
                        />
                        <circle
                            cx="19"
                            cy="12"
                            r="2"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
