import { useEffect, useMemo, useRef, useState } from 'react';

export interface Point {
    /** Zeitstempel in ms */
    t: number;
    /** Leistung in W */
    w: number;
}

const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

function formatKw(w: number): string {
    return `${(w / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} kW`;
}

function hhmm(t: number): string {
    return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** "Schöne" Achsenschritte in kW */
function niceMax(maxW: number): { max: number; step: number } {
    const kw = Math.max(maxW / 1000, 0.5);
    const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 50];
    const step = steps.find(s => kw / s <= 4) ?? 100;
    return { max: Math.ceil(kw / step) * step * 1000, step: step * 1000 };
}

/**
 * Prognose-Verlauf eines Tages: eine Serie (Linie 2px + 10%-Fläche), optional der aktuelle
 * Istwert als Punkt und eine "jetzt"-Linie. Hover/Tastatur: Fadenkreuz mit Tooltip.
 */
export function ForecastChart({
    points,
    now,
    actualW,
    label,
}: {
    points: Point[];
    now?: number;
    actualW?: number;
    label: string;
}): React.JSX.Element {
    const wrap = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(320);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        const el = wrap.current;
        if (!el) {
            return;
        }
        const ro = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Nachtstunden ohne Ertrag abschneiden (je 1 Stunde Rand)
    const data = useMemo(() => {
        const first = points.findIndex(p => p.w > 0);
        let last = -1;
        points.forEach((p, i) => {
            if (p.w > 0) {
                last = i;
            }
        });
        if (first < 0) {
            return points;
        }
        const from = points[first].t - 3600_000;
        const to = points[last].t + 3600_000;
        return points.filter(p => p.t >= from && p.t <= to);
    }, [points]);

    // Container immer rendern, damit die Breitenmessung auch greift, wenn Daten erst später eintreffen
    if (data.length < 2) {
        return (
            <div
                ref={wrap}
                className="fchart"
            >
                <p className="empty">Keine Prognosedaten für diesen Tag.</p>
            </div>
        );
    }

    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const { max, step } = niceMax(Math.max(...data.map(p => p.w), actualW ?? 0));
    const iw = width - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (t: number): number => PAD.left + ((t - t0) / (t1 - t0)) * iw;
    const y = (w: number): number => PAD.top + ih - (w / max) * ih;

    const line = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.w).toFixed(1)}`).join('');
    const area = `${line}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`;

    const yTicks: number[] = [];
    for (let v = 0; v <= max + 1; v += step) {
        yTicks.push(v);
    }
    // Stunden-Achse: alle 3 Stunden (auf dem Handy), alle 2 Stunden breiter
    const hourStep = width < 480 ? 3 : 2;
    const xTicks: number[] = [];
    const start = new Date(t0);
    start.setMinutes(0, 0, 0);
    for (let t = start.getTime() + 3600_000; t < t1; t += 3600_000) {
        if (new Date(t).getHours() % hourStep === 0) {
            xTicks.push(t);
        }
    }

    const showNow = now !== undefined && now >= t0 && now <= t1;
    const hovered = hover !== null ? data[hover] : undefined;

    const pick = (clientX: number): void => {
        const rect = wrap.current!.getBoundingClientRect();
        const t = t0 + ((clientX - rect.left - PAD.left) / iw) * (t1 - t0);
        let best = 0;
        data.forEach((p, i) => {
            if (Math.abs(p.t - t) < Math.abs(data[best].t - t)) {
                best = i;
            }
        });
        setHover(best);
    };

    return (
        <div
            ref={wrap}
            className="fchart"
        >
            <svg
                width={width}
                height={H}
                role="img"
                aria-label={label}
                tabIndex={0}
                onPointerMove={e => pick(e.clientX)}
                onPointerDown={e => pick(e.clientX)}
                // Touch: Wert nach dem Loslassen stehen lassen (zum Ablesen); Maus: beim Verlassen ausblenden
                onPointerLeave={e => e.pointerType !== 'touch' && setHover(null)}
                // Langes Drücken (iOS/Android): kein Kontextmenü/Kopieren statt Ablesen
                onContextMenu={e => e.preventDefault()}
                onBlur={() => setHover(null)}
                onKeyDown={e => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const d = e.key === 'ArrowRight' ? 1 : -1;
                        setHover(h => Math.min(data.length - 1, Math.max(0, (h ?? 0) + d)));
                    }
                }}
            >
                {yTicks.map(v => (
                    <g key={v}>
                        <line
                            x1={PAD.left}
                            x2={width - PAD.right}
                            y1={y(v)}
                            y2={y(v)}
                            className="fchart__grid"
                        />
                        <text
                            x={PAD.left - 6}
                            y={y(v) + 4}
                            className="fchart__axis"
                            textAnchor="end"
                        >
                            {(v / 1000).toLocaleString('de-DE')}
                        </text>
                    </g>
                ))}
                {xTicks.map(t => (
                    <text
                        key={t}
                        x={x(t)}
                        y={H - 6}
                        className="fchart__axis"
                        textAnchor="middle"
                    >
                        {new Date(t).getHours()} Uhr
                    </text>
                ))}
                <path
                    d={area}
                    className="fchart__area"
                />
                <path
                    d={line}
                    className="fchart__line"
                />
                {showNow && (
                    <g>
                        <line
                            x1={x(now)}
                            x2={x(now)}
                            y1={PAD.top}
                            y2={y(0)}
                            className="fchart__now"
                        />
                        <text
                            x={x(now) + 4}
                            y={PAD.top + 10}
                            className="fchart__axis"
                        >
                            jetzt
                        </text>
                        {actualW !== undefined && (
                            <circle
                                cx={x(now)}
                                cy={y(actualW)}
                                r={5}
                                className="fchart__actual"
                            />
                        )}
                    </g>
                )}
                {hovered && (
                    <g pointerEvents="none">
                        <line
                            x1={x(hovered.t)}
                            x2={x(hovered.t)}
                            y1={PAD.top}
                            y2={y(0)}
                            className="fchart__cross"
                        />
                        <circle
                            cx={x(hovered.t)}
                            cy={y(hovered.w)}
                            r={4.5}
                            className="fchart__dot"
                        />
                    </g>
                )}
            </svg>
            {hovered && (
                <div
                    className="fchart__tip"
                    style={{ left: Math.min(Math.max(x(hovered.t), 60), width - 60) }}
                    role="status"
                >
                    <span className="fchart__tip-time">{hhmm(hovered.t)}</span> {formatKw(hovered.w)}
                </div>
            )}
            {actualW !== undefined && showNow && (
                <div
                    className="fchart__legend"
                    aria-hidden="true"
                >
                    <span>
                        <i className="fchart__key fchart__key--line" /> Prognose
                    </span>
                    <span>
                        <i className="fchart__key fchart__key--dot" /> Ist jetzt: {formatKw(actualW)}
                    </span>
                </div>
            )}
            <details className="fchart__table">
                <summary>Als Tabelle</summary>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Uhrzeit</th>
                            <th scope="col">Prognose</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(p => (
                            <tr key={p.t}>
                                <td>{hhmm(p.t)}</td>
                                <td>{formatKw(p.w)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
