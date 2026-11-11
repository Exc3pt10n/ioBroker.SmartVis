import { useEffect, useState } from 'react';
import type { SvHistoryRange, SvStateRef } from '../../../src/shared/protocol';
import { connection } from '../connection';
import { HistoryChart, formatNumber } from './HistoryChart';

export interface HistorySeries {
    key: string;
    label: string;
    ref: SvStateRef;
    color?: string;
    /** y-Achse bei 0 beginnen (Leistungen, Mengen) – Temperaturen nicht */
    zeroBased?: boolean;
}

const RANGES: { key: SvHistoryRange; label: string }[] = [
    { key: '6h', label: '6 Std.' },
    { key: '24h', label: '24 Std.' },
    { key: '7d', label: '7 Tage' },
];

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; points: [number, number][] };

/** Verlauf mit Auswahl der Größe (eine Serie je Diagramm) und des Zeitraums */
export function HistoryPanel({
    series,
    title = 'Verlauf',
}: {
    series: HistorySeries[];
    title?: string;
}): React.JSX.Element | null {
    const [key, setKey] = useState(series[0]?.key);
    const [range, setRange] = useState<SvHistoryRange>('24h');
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const current = series.find(s => s.key === key) || series[0];
    const historyId = current?.ref.history?.id;

    useEffect(() => {
        if (!historyId) {
            return;
        }
        let cancelled = false;
        connection.history(historyId, range).then(
            points => !cancelled && setLoad({ status: 'ok', points }),
            (e: Error) => !cancelled && setLoad({ status: 'error', message: e.message }),
        );
        return () => {
            cancelled = true;
        };
    }, [historyId, range]);

    if (!current?.ref.history) {
        return null;
    }
    const unit = current.ref.history.unit || current.ref.unit;
    const values = load.status === 'ok' ? load.points.map(p => p[1]) : [];
    const stats = values.length
        ? {
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a, b) => a + b, 0) / values.length,
          }
        : undefined;
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
        <section className="card history">
            <h2 className="subtitle">📈 {title}</h2>
            {series.length > 1 && (
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
            )}
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
                    {stats && (
                        <p className="history__stats">
                            Min. {formatNumber(stats.min, unit)} · Ø {formatNumber(stats.avg, unit)} · Max.{' '}
                            {formatNumber(stats.max, unit)}
                        </p>
                    )}
                    <HistoryChart
                        points={load.points}
                        unit={unit}
                        range={range}
                        label={`${current.label}, Verlauf ${RANGES.find(r => r.key === range)?.label}`}
                        color={current.color}
                        zeroBased={current.zeroBased}
                    />
                </>
            )}
            <p className="detail__note">Quelle: {current.ref.history.instance}</p>
        </section>
    );
}
