import { useEffect, useState } from 'react';
import type { SvStateRef } from '../../../src/shared/protocol';
import { connection } from '../connection';
import { formatNumber } from './HistoryChart';

const W = 240;
const H = 56;
const REFRESH_MS = 15 * 60_000;

/**
 * Kleiner 24-Stunden-Verlauf (eine Serie) mit Min./Max.; ein Klick öffnet den ausführlichen Verlauf.
 * Lädt alle 15 Minuten neu und versucht es nach Fehlern (z. B. Verbindung noch nicht offen) erneut.
 */
export function Sparkline({
    state,
    label,
    onOpen,
}: {
    state: SvStateRef;
    label: string;
    onOpen?: () => void;
}): React.JSX.Element | null {
    const historyId = state.history?.id;
    const unit = state.history?.unit || state.unit;
    const [points, setPoints] = useState<[number, number][]>([]);

    useEffect(() => {
        if (!historyId) {
            return;
        }
        let cancelled = false;
        let timer: number | undefined;
        const load = (): void => {
            connection.history(historyId, '24h').then(
                p => {
                    if (!cancelled) {
                        setPoints(p);
                        timer = window.setTimeout(load, REFRESH_MS);
                    }
                },
                () => {
                    if (!cancelled) {
                        timer = window.setTimeout(load, 5000);
                    }
                },
            );
        };
        load();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [historyId]);

    if (!historyId || points.length < 2) {
        return null;
    }
    const values = points.map(p => p[1]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const t0 = points[0][0];
    const t1 = points[points.length - 1][0];
    const span = max - min || 1;
    const x = (t: number): number => ((t - t0) / (t1 - t0 || 1)) * W;
    const y = (v: number): number => 4 + (1 - (v - min) / span) * (H - 8);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const area = `${line}L${W},${H}L0,${H}Z`;
    const minAt = points[values.indexOf(min)];
    const maxAt = points[values.indexOf(max)];
    const summary = `${label}, letzte 24 Stunden: Min. ${formatNumber(min, unit)}, Max. ${formatNumber(max, unit)}`;

    return (
        <button
            type="button"
            className="spark"
            onClick={onOpen}
            aria-label={`${summary}. Verlauf öffnen`}
            title={summary}
        >
            <span className="spark__head">
                <span className="spark__label">{label} · 24 Std.</span>
                <span className="spark__range">
                    {formatNumber(min, unit)} – {formatNumber(max, unit)}
                </span>
            </span>
            <svg
                className="spark__svg"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path
                    className="spark__area"
                    d={area}
                />
                <path
                    className="spark__line"
                    d={line}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            <span
                className="spark__marks"
                aria-hidden="true"
            >
                <span>
                    Max. {new Date(maxAt[0]).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>
                    Min. {new Date(minAt[0]).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </span>
        </button>
    );
}
