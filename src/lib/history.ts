import type { SvHistoryRange, SvHistoryRef, SvModel, SvStateRef } from '../shared/protocol';

type ObjectMap = Record<string, ioBroker.Object>;

/** Adapter, die Verläufe speichern und "getHistory" beantworten */
export const HISTORY_ADAPTERS = ['sql', 'history', 'influxdb'];

/**
 * Aufgezeichnete Alternativen, wenn der angezeigte State selbst nicht geloggt wird.
 * Q.HOME: Anzeige nutzt PvPw bzw. die W-Varianten, geloggt werden oft PvPwTotal bzw. die kW-Varianten.
 */
const ALTERNATIVES: [RegExp, string][] = [
    [/^(qhome-ess-hyb-g2\.\d+)\.PvPw$/, '$1.PvPwTotal'],
    [/^(qhome-ess-hyb-g2\.\d+)\.GridPwPurchaseWb$/, '$1.GridPwPurchase'],
    [/^(qhome-ess-hyb-g2\.\d+)\.GridPwFeedInWb$/, '$1.GridPwFeedIn'],
];

/** Instanzen von History-Adaptern (aus system.adapter.*) */
export function historyInstances(objects: ObjectMap): Set<string> {
    const result = new Set<string>();
    for (const [id, obj] of Object.entries(objects)) {
        const m = /^system\.adapter\.([^.]+)\.(\d+)$/.exec(id);
        if (m && obj.type === 'instance' && HISTORY_ADAPTERS.includes(m[1])) {
            result.add(`${m[1]}.${m[2]}`);
        }
    }
    return result;
}

/** Verlauf eines States: erste History-Instanz mit custom.<instanz>.enabled */
function ownHistory(objects: ObjectMap, id: string, instances: Set<string>): SvHistoryRef | undefined {
    const obj = objects[id];
    const custom = (obj?.common as { custom?: Record<string, { enabled?: boolean }> } | undefined)?.custom;
    if (!custom) {
        return undefined;
    }
    for (const [instance, cfg] of Object.entries(custom)) {
        // Andere Adapter (z. B. iQontrol) speichern ebenfalls Einstellungen unter "custom"
        if (cfg?.enabled && instances.has(instance)) {
            return { instance, id, unit: (obj.common as ioBroker.StateCommon).unit };
        }
    }
    return undefined;
}

export function findHistory(objects: ObjectMap, id: string, instances: Set<string>): SvHistoryRef | undefined {
    const own = ownHistory(objects, id, instances);
    if (own) {
        return own;
    }
    for (const [pattern, replacement] of ALTERNATIVES) {
        if (pattern.test(id)) {
            const alt = ownHistory(objects, id.replace(pattern, replacement), instances);
            if (alt) {
                return alt;
            }
        }
    }
    return undefined;
}

function isRef(v: unknown): v is SvStateRef {
    return !!v && typeof v === 'object' && 'id' in v && 'write' in v && typeof (v as SvStateRef).id === 'string';
}

/**
 * Ergänzt alle State-Referenzen im Model um ihren Verlauf (falls vorhanden).
 *
 * @returns aufgezeichnete State-ID → History-Instanz (Whitelist für Abfragen aus der App)
 */
export function attachHistory(model: SvModel, objects: ObjectMap): Map<string, string> {
    const instances = historyInstances(objects);
    const allowed = new Map<string, string>();
    if (!instances.size) {
        return allowed;
    }
    const seen = new Set<unknown>();
    const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object' || seen.has(value)) {
            return;
        }
        seen.add(value);
        if (isRef(value)) {
            const history = findHistory(objects, value.id, instances);
            if (history) {
                value.history = history;
                allowed.set(history.id, history.instance);
            }
            return;
        }
        for (const child of Array.isArray(value) ? value : Object.values(value)) {
            visit(child);
        }
    };
    visit(model);
    return allowed;
}

/** Abfrage-Parameter je Zeitraum: Mittelwerte in festen Schritten, damit der Verlauf handlich bleibt */
export function historyOptions(range: SvHistoryRange, now = Date.now()): Record<string, unknown> {
    const spans: Record<SvHistoryRange, { ms: number; step: number }> = {
        '6h': { ms: 6 * 3600_000, step: 5 * 60_000 },
        '24h': { ms: 24 * 3600_000, step: 15 * 60_000 },
        '7d': { ms: 7 * 86_400_000, step: 3600_000 },
    };
    const span = spans[range];
    if (!span) {
        throw new Error('Unbekannter Zeitraum');
    }
    return {
        start: now - span.ms,
        end: now,
        aggregate: 'average',
        step: span.step,
        // Leere Intervalle weglassen: bei "nur Änderungen loggen" gilt der letzte Wert weiter
        ignoreNull: true,
        // Keine künstlichen Randpunkte: ohne ältere Daten setzt @iobroker/aggregate sonst einen Punkt an den
        // Beginn des Zeitraums (mit dem ersten echten Wert) – der Verlauf schiene dann weiter zurückzureichen
        removeBorderValues: true,
        limit: 2000,
        ack: false,
        q: false,
        from: false,
    };
}

/** Antwort von getHistory in kompakte, sortierte Punkte [ts, wert] umwandeln */
export function toPoints(result: unknown): [number, number][] {
    if (!Array.isArray(result)) {
        return [];
    }
    const points: [number, number][] = [];
    for (const row of result as { ts?: unknown; val?: unknown }[]) {
        const ts = Number(row?.ts);
        const raw = row?.val;
        const val = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw);
        if (Number.isFinite(ts) && Number.isFinite(val) && raw !== null) {
            points.push([ts, val]);
        }
    }
    return points.sort((a, b) => a[0] - b[0]);
}
