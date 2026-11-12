import { useEffect, useMemo, useRef, useState } from 'react';
import type { SvHistoryRange } from '../../../src/shared/protocol';

const H = 170;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

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
}: {
    points: [number, number][];
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
        const values = points.map(p => p[1]);
        const { lo, hi, step } = niceScale(Math.min(...values), Math.max(...values), zeroBased);
        const iw = width - PAD.left - PAD.right;
        const ih = H - PAD.top - PAD.bottom;
        const x = (t: number): number => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
        const y = (v: number): number => PAD.top + ih - ((v - lo) / (hi - lo)) * ih;
        const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
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
        return { x, y, line, area, yTicks, xTicks, t0, t1 };
    }, [points, width, range, zeroBased, start, end]);

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
    const { x, y, line, area, yTicks, xTicks, t0, t1 } = geometry;
    const hovered = hover !== null ? points[hover] : undefined;

    const pick = (clientX: number): void => {
        const rect = wrap.current!.getBoundingClientRect();
        const t = t0 + ((clientX - rect.left - PAD.left) / (width - PAD.left - PAD.right)) * (t1 - t0);
        let best = 0;
        points.forEach((p, i) => {
            if (Math.abs(p[0] - t) < Math.abs(points[best][0] - t)) {
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
                onPointerLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                onKeyDown={e => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const d = e.key === 'ArrowRight' ? 1 : -1;
                        setHover(h => Math.min(points.length - 1, Math.max(0, (h ?? points.length - 1) + d)));
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
                    {formatNumber(hovered[1], unit)}
                </div>
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
