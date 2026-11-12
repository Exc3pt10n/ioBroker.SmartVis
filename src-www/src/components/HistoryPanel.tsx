import { useEffect, useRef, useState } from 'react';
import type { SvHistoryRange, SvStateRef } from '../../../src/shared/protocol';
import { connection } from '../connection';
import { motionAllowed } from '../motion';
import { HistoryChart, formatNumber, type ChartLine } from './HistoryChart';
import { RANGE_MS, clipToRange, timeWeightedAverage } from '../../../src/shared/series';

export interface HistorySeries {
    key: string;
    label: string;
    ref: SvStateRef;
    color?: string;
    /** y-Achse bei 0 beginnen (Leistungen, Mengen) – Temperaturen nicht */
    zeroBased?: boolean;
    /** Name der Hauptlinie, wenn weitere Linien dazukommen (z. B. "PV") */
    lineLabel?: string;
    /** Weitere Linien im selben Diagramm (gleiche Einheit), z. B. Verbrauch zu PV */
    extra?: { label: string; ref: SvStateRef; color: string }[];
}

const RANGES: { key: SvHistoryRange; label: string }[] = [
    { key: '6h', label: '6 Std.' },
    { key: '24h', label: '24 Std.' },
    { key: '7d', label: '7 Tage' },
];

type Load =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    /** end: Zeitpunkt der Abfrage – die Zeitachse zeigt immer den vollen Zeitraum bis dahin */
    | { status: 'ok'; points: [number, number][]; others: [number, number][][]; end: number };

/** Verlauf mit Auswahl der Größe (eine Serie je Diagramm) und des Zeitraums */
export function HistoryPanel({
    series,
    title = 'Verlauf',
    focus,
}: {
    series: HistorySeries[];
    title?: string;
    /** Von außen eine Ansicht wählen und hierher scrollen (n wechselt bei jedem Wunsch) */
    focus?: { key: string; n: number };
}): React.JSX.Element | null {
    const [key, setKey] = useState(series[0]?.key);
    const box = useRef<HTMLElement>(null);
    const [range, setRange] = useState<SvHistoryRange>('24h');
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const current = series.find(s => s.key === key) || series[0];
    const historyId = current?.ref.history?.id;
    const extra = (current?.extra || []).filter(e => e.ref.history);
    const extraIds = extra.map(e => e.ref.history!.id).join('|');

    useEffect(() => {
        if (!historyId) {
            return;
        }
        let cancelled = false;
        Promise.all([
            connection.history(historyId, range),
            ...(extraIds ? extraIds.split('|') : []).map(id => connection.history(id, range)),
        ]).then(
            ([points, ...others]) => !cancelled && setLoad({ status: 'ok', points, others, end: Date.now() }),
            (e: Error) => !cancelled && setLoad({ status: 'error', message: e.message }),
        );
        return () => {
            cancelled = true;
        };
    }, [historyId, extraIds, range]);

    // Wunsch von außen (z. B. Kreis im Energiefluss angetippt): Ansicht wechseln …
    const [seenFocus, setSeenFocus] = useState(focus?.n);
    if (focus && focus.n !== seenFocus) {
        setSeenFocus(focus.n);
        if (series.some(s => s.key === focus.key) && focus.key !== key) {
            setLoad({ status: 'loading' });
            setKey(focus.key);
        }
    }
    // … und den Verlauf in den Blick holen
    useEffect(() => {
        if (focus) {
            box.current?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus?.n]);

    if (!current?.ref.history) {
        return null;
    }
    const unit = current.ref.history.unit || current.ref.unit;
    const start = load.status === 'ok' ? load.end - RANGE_MS[range] : 0;
    const points = load.status === 'ok' ? clipToRange(load.points, start, load.end) : [];
    const values = points.map(p => p[1]);
    // Ø zeitgewichtet: ein Wert zählt so lange, bis der nächste kommt (nicht je Messpunkt)
    const stats = values.length
        ? {
              min: Math.min(...values),
              max: Math.max(...values),
              avg: timeWeightedAverage(points, load.status === 'ok' ? load.end : undefined) ?? 0,
          }
        : undefined;
    const others: ChartLine[] =
        load.status === 'ok'
            ? extra.map((e, i) => ({
                  label: e.label,
                  color: e.color,
                  points: clipToRange(load.others[i] || [], start, load.end),
              }))
            : [];
    const statsOf = (pts: [number, number][]): string => {
        if (!pts.length) {
            return '–';
        }
        const avg = timeWeightedAverage(pts, load.status === 'ok' ? load.end : undefined) ?? 0;
        return `Ø ${formatNumber(avg, unit)} · Max. ${formatNumber(Math.max(...pts.map(p => p[1])), unit)}`;
    };
    const select = (next: Partial<{ key: string; range: SvHistoryRange }>): void => {
        setLoad({ status: 'loading' });
        if (next.key) {
            setKey(next.key);
        }
        if (next.range) {
            setRange(next.range);
        }
    };

    return (
        <section
            ref={box}
            className="card history"
        >
            <h2 className="subtitle">📈 {title}</h2>
            {series.length > 1 &&
                (series.length <= 4 ? (
                    // Wenige Ansichten: als Umschaltleiste (eine Zeile)
                    <div
                        className="segmented segmented--full history__series"
                        role="tablist"
                        aria-label="Ansicht"
                    >
                        {series.map(s => (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={s.key === current.key}
                                className={s.key === current.key ? 'segmented--active' : ''}
                                onClick={() => select({ key: s.key })}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div
                        className="chips chips--small history__series"
                        role="tablist"
                        aria-label="Größe"
                    >
                        {series.map(s => (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={s.key === current.key}
                                className={`flag${s.key === current.key ? ' flag--on' : ''}`}
                                onClick={() => select({ key: s.key })}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                ))}
            <div
                className="segmented"
                role="tablist"
                aria-label="Zeitraum"
            >
                {RANGES.map(r => (
                    <button
                        key={r.key}
                        type="button"
                        role="tab"
                        aria-selected={range === r.key}
                        className={range === r.key ? 'segmented--active' : ''}
                        onClick={() => select({ range: r.key })}
                    >
                        {r.label}
                    </button>
                ))}
            </div>
            {load.status === 'loading' && (
                <div
                    className="history__loading"
                    aria-busy="true"
                >
                    Lade Verlauf …
                </div>
            )}
            {load.status === 'error' && (
                <p className="history__error">Verlauf konnte nicht geladen werden: {load.message}</p>
            )}
            {load.status === 'ok' && (
                <>
                    {stats && others.length === 0 && (
                        <p className="history__stats">
                            Min. {formatNumber(stats.min, unit)} · Ø {formatNumber(stats.avg, unit)} · Max.{' '}
                            {formatNumber(stats.max, unit)}
                        </p>
                    )}
                    {others.length > 0 && (
                        <p className="history__stats">
                            {[
                                `${current.lineLabel ?? current.label}: ${statsOf(points)}`,
                                ...others.map(o => `${o.label}: ${statsOf(o.points)}`),
                            ].map(line => (
                                <span
                                    key={line}
                                    className="history__stats-line"
                                >
                                    {line}
                                </span>
                            ))}
                        </p>
                    )}
                    <HistoryChart
                        points={points}
                        start={start}
                        end={load.end}
                        unit={unit}
                        range={range}
                        label={`${current.label}, Verlauf ${RANGES.find(r => r.key === range)?.label}`}
                        color={current.color}
                        zeroBased={current.zeroBased}
                        lineLabel={current.lineLabel ?? current.label}
                        others={others}
                    />
                </>
            )}
        </section>
    );
}
