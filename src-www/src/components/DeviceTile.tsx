import type { SvDevice } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';
import { TYPE_LABELS, formatValue, isActive, tapAction, valueState, warnings } from '../device';
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

    const onClick = (): void => {
        if (action) {
            connection.setState(action.state.id, action.next(states[action.state.id]));
        }
    };

    return (
        <button
            type="button"
            className={`tile${active ? ' tile--active' : ''}${action ? '' : ' tile--readonly'}${pending ? ' tile--pending' : ''}`}
            onClick={onClick}
            disabled={!action}
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
    );
}
