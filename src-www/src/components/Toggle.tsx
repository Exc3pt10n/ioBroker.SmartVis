import type { SvStateRef, SvSwitch } from '../../../src/shared/protocol';
import { connection, useConnection } from '../connection';

/** Schalter-Zeile; akzeptiert einen State oder einen Switch mit getrenntem Schreib-State */
export function Toggle({
    state,
    label,
    hint,
    compact,
}: {
    state: SvStateRef | SvSwitch;
    label: string;
    hint?: string;
    compact?: boolean;
}): React.JSX.Element {
    const { states } = useConnection();
    const value = 'value' in state ? state.value : state;
    const target = 'value' in state ? state.write : state;
    const on = states[value.id]?.val === true;
    const pending = states[target.id]?.ack === false || states[value.id]?.ack === false;

    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            className={`toggle${pending ? ' toggle--pending' : ''}${compact ? ' toggle--compact' : ''}`}
            onClick={() => {
                connection.setState(target.id, !on);
                if (target.id !== value.id) {
                    // Gespiegelten Wert sofort optimistisch anzeigen
                    connection.preview(value.id, !on);
                }
            }}
        >
            <span className="toggle__text">
                <span>{label}</span>
                {hint && <span className="toggle__hint">{hint}</span>}
            </span>
            <span className={`switch${on ? ' switch--on' : ''}`} />
        </button>
    );
}

/** Aktions-Button für Taster-States (Wert true auslösen) */
export function ActionButton({
    state,
    label,
    icon,
    variant,
}: {
    state: SvStateRef | undefined;
    label: string;
    icon?: string;
    variant?: 'primary';
}): React.JSX.Element | null {
    if (!state) {
        return null;
    }
    return (
        <button
            type="button"
            className={`action${variant ? ` action--${variant}` : ''}`}
            onClick={() => connection.setState(state.id, true)}
        >
            {icon && <span aria-hidden="true">{icon}</span>}
            <span>{label}</span>
        </button>
    );
}
