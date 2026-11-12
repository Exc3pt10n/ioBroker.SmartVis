import { useEffect, useMemo, useRef, useState } from 'react';
import type { SvHistoryRange } from '../../../src/shared/protocol';
import { READ_STEP_MS, valueAt } from '../../../src/shared/series';

const H = 182;
/* oben Platz für die Einheit der y-Achse */
const PAD = { top: 24, right: 12, bottom: 24, left: 44 };

/** Weitere Linie im selben Diagramm (z. B. Verbrauch zu PV) */
export interface ChartLine {
    label: string;
    color: string;
    points: [number, number][];
}

export function formatNumber(v: number, unit?: string): string {
    const abs = Math.abs(v);
    const digits = unit === 'lx' || unit === 'Lux' || abs >= 1000 ? 0 : abs >= 100 ? 0 : 1;
    return `${v.toLocaleString('de-DE', { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

/** "Schöne" Achsenwerte (3–5 Schritte) */
function niceScale(min: number, max: number, zeroBased: boolean): { lo: number; hi: number; step: number } {
    let lo = zeroBased ? Math.min(0, min) : min;
    let hi = max;
    if (hi === lo) {
        hi += 1;
        lo -= zeroBased ? 0 : 1;
    }
    const raw = (hi - lo) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => raw <= s) ?? 10 * mag;
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}

function timeLabel(t: number, range: SvHistoryRange): string {
    const d = new Date(t);
    return range === '7d'
        ? d.toLocaleDateString('de-DE', { weekday: 'short' })
        : `${String(d.getHours()).padStart(2, '0')}:00`;
}

function tooltipTime(t: number, range: SvHistoryRange): string {
    const d = new Date(t);
    return range === '7d'
        ? d.toLocaleString('de-DE', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Verlauf einer einzelnen Größe: Linie 2px + 10%-Fläche, eine y-Achse,
 * Fadenkreuz mit Tooltip (Maus, Touch, Pfeiltasten) und Tabellenansicht.
 */
export function HistoryChart({
    points,
    unit,
    range,
    label,
    color = 'var(--chart-series)',
    zeroBased = false,
    start,
    end,
    lineLabel,
    others = [],
}: {
    points: [number, number][];
    /** Name der Hauptlinie in Legende/Tooltip (nur mit weiteren Linien) */
    lineLabel?: string;
    others?: ChartLine[];
    /** Zeitachse: voller Zeitraum (sonst vom ersten bis zum letzten Punkt) */
    start?: number;
    end?: number;
    unit?: string;
    range: SvHistoryRange;
    label: string;
    color?: string;
    zeroBased?: boolean;
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

    const geometry = useMemo(() => {
        if (points.length < (start !== undefined ? 1 : 2)) {
            return null;
        }
        const t0 = start ?? points[0][0];
        const t1 = Math.max(end ?? points[points.length - 1][0], points[points.length - 1][0]);
        const values = [...points, ...others.flatMap(o => o.points)].map(p => p[1]);
        const { lo, hi, step } = niceScale(Math.min(...values), Math.max(...values), zeroBased);
        const iw = width - PAD.left - PAD.right;
        const ih = H - PAD.top - PAD.bottom;
        const x = (t: number): number => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
        const y = (v: number): number => PAD.top + ih - ((v - lo) / (hi - lo)) * ih;
        const path = (pts: [number, number][]): string =>
            pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
        const line = path(points);
        const otherLines = others.map(o => (o.points.length ? path(o.points) : ''));
        const base = y(Math.max(lo, Math.min(0, hi)));
        // Fläche nur unter der Linie (vor dem ersten Messwert bleibt der Bereich leer)
        const first = x(points[0][0]).toFixed(1);
        const lastX = x(points[points.length - 1][0]).toFixed(1);
        const area = `${line}L${lastX},${base}L${first},${base}Z`;
        const yTicks: number[] = [];
        for (let v = lo; v <= hi + step / 2; v += step) {
            yTicks.push(Math.round(v * 1000) / 1000);
        }
        // x-Achse: volle Stunden (6 h: jede, 24 h: alle 4/6 h) bzw. Mitternacht (7 Tage)
        const xTicks: number[] = [];
        const tickStart = new Date(t0);
        tickStart.setMinutes(0, 0, 0);
        const every = range === '6h' ? 1 : range === '24h' ? (width < 480 ? 6 : 4) : 24;
        for (let t = tickStart.getTime() + 3600_000; t < t1; t += 3600_000) {
            const h = new Date(t).getHours();
            if (range === '7d' ? h === 12 : h % every === 0) {
                xTicks.push(t);
            }
        }
        return { x, y, line, area, yTicks, xTicks, t0, t1, otherLines };
    }, [points, others, width, range, zeroBased, start, end]);

    if (!geometry) {
        return (
            <div
                ref={wrap}
                className="fchart"
            >
                <p className="empty">Keine Daten in diesem Zeitraum.</p>
            </div>
        );
    }
    const { x, y, line, area, yTicks, xTicks, t0, t1, otherLines } = geometry;
    // Ablesen genau an der Stelle des Zeigers/Fingers: Uhrzeit dort und der Wert, der dann galt
    // (letzter Messwert davor) – auch mitten in Lücken der Aufzeichnung ("nur Änderungen")
    const step = READ_STEP_MS[range] ?? 15 * 60_000;
    const clampT = (t: number): number => Math.min(t1, Math.max(t0, t));
    const hoverValue = hover !== null ? valueAt(points, hover) : undefined;
    const hovered: [number, number] | undefined =
        hover !== null && hoverValue !== undefined ? [hover, hoverValue] : undefined;
    const hoverOthers = hover !== null ? others.map(o => valueAt(o.points, hover)) : [];

    const pick = (clientX: number): void => {
        const rect = wrap.current!.getBoundingClientRect();
        const t = t0 + ((clientX - rect.left - PAD.left) / (width - PAD.left - PAD.right)) * (t1 - t0);
        setHover(clampT(Math.round(t / step) * step));
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
                        const d = e.key === 'ArrowRight' ? step : -step;
                        setHover(h => clampT((h ?? t1) + d));
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
                            {v.toLocaleString('de-DE')}
                        </text>
                    </g>
                ))}
                {unit && (
                    <text
                        x={PAD.left - 6}
                        y={12}
                        className="fchart__axis fchart__unit"
                        textAnchor="end"
                    >
                        {unit}
                    </text>
                )}
                {xTicks.map(t => (
                    <text
                        key={t}
                        x={x(t)}
                        y={H - 6}
                        className="fchart__axis"
                        textAnchor="middle"
                    >
                        {timeLabel(t, range)}
                    </text>
                ))}
                <path
                    d={area}
                    className="hchart__area"
                    style={{ fill: color }}
                />
                <path
                    d={line}
                    className="hchart__line"
                    style={{ stroke: color }}
                />
                {others.map((o, i) => (
                    <path
                        key={o.label}
                        d={otherLines[i]}
                        className="hchart__line"
                        style={{ stroke: o.color }}
                    />
                ))}
                {hovered && (
                    <g pointerEvents="none">
                        <line
                            x1={x(hovered[0])}
                            x2={x(hovered[0])}
                            y1={PAD.top}
                            y2={H - PAD.bottom}
                            className="fchart__cross"
                        />
                        <circle
                            cx={x(hovered[0])}
                            cy={y(hovered[1])}
                            r={4.5}
                            className="hchart__dot"
                            style={{ fill: color }}
                        />
                        {others.map((o, i) =>
                            hoverOthers[i] !== undefined ? (
                                <circle
                                    key={o.label}
                                    cx={x(hovered[0])}
                                    cy={y(hoverOthers[i])}
                                    r={4.5}
                                    className="hchart__dot"
                                    style={{ fill: o.color }}
                                />
                            ) : null,
                        )}
                    </g>
                )}
            </svg>
            {hovered && (
                <div
                    className="fchart__tip"
                    style={{ left: Math.min(Math.max(x(hovered[0]), 70), width - 70) }}
                    role="status"
                >
                    <span className="fchart__tip-time">{tooltipTime(hovered[0], range)}</span>{' '}
                    {others.length ? (
                        <>
                            <span className="fchart__tip-row">
                                <i style={{ background: color }} /> {lineLabel} {formatNumber(hovered[1], unit)}
                            </span>
                            {others.map((o, i) => (
                                <span
                                    key={o.label}
                                    className="fchart__tip-row"
                                >
                                    <i style={{ background: o.color }} /> {o.label}{' '}
                                    {hoverOthers[i] !== undefined ? formatNumber(hoverOthers[i], unit) : '–'}
                                </span>
                            ))}
                        </>
                    ) : (
                        formatNumber(hovered[1], unit)
                    )}
                </div>
            )}
            {others.length > 0 && (
                <p className="fchart__legend">
                    <span>
                        <i
                            className="fchart__key fchart__key--line"
                            style={{ background: color }}
                        />{' '}
                        {lineLabel}
                    </span>
                    {others.map(o => (
                        <span key={o.label}>
                            <i
                                className="fchart__key fchart__key--line"
                                style={{ background: o.color }}
                            />{' '}
                            {o.label}
                        </span>
                    ))}
                </p>
            )}
            <details className="fchart__table">
                <summary>Als Tabelle</summary>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Zeit</th>
                            <th scope="col">Wert</th>
                        </tr>
                    </thead>
                    <tbody>
                        {points.map(p => (
                            <tr key={p[0]}>
                                <td>{tooltipTime(p[0], range)}</td>
                                <td>{formatNumber(p[1], unit)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
