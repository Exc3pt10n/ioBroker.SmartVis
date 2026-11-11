import { useEffect, useRef, useState } from 'react';

/**
 * Slider, der erst beim Loslassen sendet (keine Befehlsflut beim Ziehen).
 * Während des Ziehens und bis zur Bestätigung wird der lokale Wert angezeigt.
 */
export function Slider({
    label,
    value,
    min = 0,
    max = 100,
    step = 1,
    format,
    pending,
    onCommit,
    variant,
}: {
    label: string;
    value: number | undefined;
    min?: number;
    max?: number;
    step?: number;
    format?: (v: number) => string;
    pending?: boolean;
    onCommit: (v: number) => void;
    variant?: 'ct' | 'hue' | 'warm';
}): React.JSX.Element {
    const [draft, setDraft] = useState<number | undefined>(undefined);
    const [dragging, setDragging] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    const commitRef = useRef(onCommit);
    useEffect(() => {
        commitRef.current = onCommit;
    }, [onCommit]);

    // Natives "change" feuert erst beim Loslassen (React-onChange feuert bei jeder Bewegung)
    useEffect(() => {
        const el = ref.current;
        if (!el) {
            return;
        }
        const onChange = (): void => {
            setDragging(false);
            commitRef.current(Number(el.value));
        };
        el.addEventListener('change', onChange);
        return () => el.removeEventListener('change', onChange);
    }, []);

    // Entwurf zeigen, solange gezogen wird oder die Bestätigung des Geräts aussteht
    const showDraft = draft !== undefined && (dragging || pending);
    const shown = (showDraft ? draft : value) ?? min;
    const fmt = format || ((v: number) => String(Math.round(v)));
    const percent = max > min ? ((shown - min) / (max - min)) * 100 : 0;

    return (
        <label className={`slider${pending ? ' slider--pending' : ''}${variant ? ` slider--${variant}` : ''}`}>
            <span className="slider__head">
                <span>{label}</span>
                <span className="slider__value">{value === undefined && !showDraft ? '–' : fmt(shown)}</span>
            </span>
            <input
                ref={ref}
                type="range"
                min={min}
                max={max}
                step={step}
                value={shown}
                style={{ '--percent': `${percent}%` } as React.CSSProperties}
                onChange={e => {
                    setDragging(true);
                    setDraft(Number(e.target.value));
                }}
                aria-valuetext={fmt(shown)}
            />
        </label>
    );
}
