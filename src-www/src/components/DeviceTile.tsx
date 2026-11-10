import type { SvDevice } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { TYPE_LABELS, formatValue, isActive, tapAction, valueState, warnings } from '../device';
import { useOpenDetail } from '../detail';
import { useRef } from 'react';
import { autoStateInfo, shutterForDevice } from '../shutters';
import { Icon, iconForType } from './Icon';

export function DeviceTile({ device, showRoom }: { device: SvDevice; showRoom?: string }): React.JSX.Element {
    const { states, model } = useConnection();
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
    // Langes Drücken öffnet die Details; ohne Tap-Aktion öffnet schon ein normaler Tap
    const pressTimer = useRef<number | undefined>(undefined);
    const longPressed = useRef(false);
    const startPress = (): void => {
        longPressed.current = false;
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
        if (action) {
            connection.setState(action.state.id, action.next(states[action.state.id]));
        } else {
            openDetail(device.id);
        }
    };

    return (
        <div className="tile-wrap">
            <button
                type="button"
                className={`tile${active ? ' tile--active' : ''}${pending ? ' tile--pending' : ''}`}
                onClick={onClick}
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                onContextMenu={e => {
                    e.preventDefault();
                    openDetail(device.id);
                }}
                aria-pressed={action ? active : undefined}
            >
                <span className="tile__icon">
                    <Icon name={iconForType(device.type)} />
                </span>
                {warn.length > 0 && (
                    <span
                        className="tile__warn"
                        title={warn.join(', ')}
                    >
                        <Icon
                            name="warning"
                            size={16}
                        />
                    </span>
                )}
                <span className="tile__name">{device.name}</span>
                <span className="tile__value">
                    {formatValue(value, value ? states[value.id] : undefined)}
                    {showRoom ? ` · ${showRoom}` : ` · ${TYPE_LABELS[device.type] || device.type}`}
                </span>
                {autoInfo && (
                    <span className="tile__auto">
                        {autoInfo.icon} {autoInfo.label}
                    </span>
                )}
            </button>
            {action && (
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
