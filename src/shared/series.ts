/**
 * Hilfen für Zeitreihen [ts, wert] (Verläufe). Gemeinsam für App und Tests.
 * Ein Wert gilt bis zum nächsten Punkt (Aufzeichnung "nur Änderungen").
 */
export type Point = [number, number];

/** Länge der Zeiträume in ms */
export const RANGE_MS: Record<string, number> = {
    '6h': 6 * 3600_000,
    '24h': 24 * 3600_000,
    '7d': 7 * 86_400_000,
};

/**
 * Auf den Zeitraum [start, end] zuschneiden: Punkte davor fallen weg, der letzte von ihnen
 * (gilt zu Beginn noch) wird auf den Anfang gesetzt.
 */
export function clipToRange(points: Point[], start: number, end: number): Point[] {
    const inside = points.filter(p => p[0] >= start && p[0] <= end);
    const before = points.filter(p => p[0] < start).pop();
    return before && (!inside.length || inside[0][0] > start) ? [[start, before[1]], ...inside] : inside;
}

/** Zeitgewichteter Mittelwert: jeder Wert zählt so lange, bis der nächste kommt (bis end) */
export function timeWeightedAverage(points: Point[], end?: number): number | undefined {
    if (!points.length) {
        return undefined;
    }
    const last = end ?? points[points.length - 1][0];
    const span = last - points[0][0];
    if (span <= 0) {
        return points.reduce((a, p) => a + p[1], 0) / points.length;
    }
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const until = i + 1 < points.length ? points[i + 1][0] : last;
        sum += points[i][1] * Math.max(0, until - points[i][0]);
    }
    return sum / span;
}
