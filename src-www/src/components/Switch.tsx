/** Einfacher, kontrollierter Schalter (ohne ioBroker-State) */
export function SwitchRow({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}): React.JSX.Element {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className="toggle"
            onClick={() => onChange(!checked)}
        >
            <span className="toggle__text">
                <span>{label}</span>
                {hint && <span className="toggle__hint">{hint}</span>}
            </span>
            <span className={`switch${checked ? ' switch--on' : ''}`} />
        </button>
    );
}
