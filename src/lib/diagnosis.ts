import type { SvDiagnosis, SvDiagnosisAdapter, SvDiagnosisEntry, SvDiagnosisState } from '../shared/protocol';
import type { DiscoveryResult } from './discovery';
import { getName } from './names';
import { ADAPTER_RULES } from './normalize';
import { DEVICE_PROFILES } from './profiles/toshibaAc';

/** Adapter mit eigener Behandlung in SmartVis (Regeln, Profile, Kandidaten-Filter) */
const SUPPORTED = new Set([
    ...Object.keys(ADAPTER_RULES),
    ...Object.keys(DEVICE_PROFILES),
    'hm-rpc',
    'hm-rega',
    'hue',
    'hue-v2',
    'alexa2',
    'qhome-ess-hyb-g2',
    'kecontact',
    'pvforecast',
    'shuttercontrol',
]);

/** Rollen, die eine Kachel tragen könnten (reine Texte, JSON oder Konfiguration zählen nicht) */
const USEFUL_ROLE = /^(switch|level|value|sensor|indicator\.alarm|media|button\.(open|close|stop))/;

const MAX_ENTRIES = 300;

/** Bewusst nicht als Kachel gezeigt (Wecker, Erinnerungen, Befehle der Echos …) – kein Hinweis auf eine Lücke */
const DELIBERATE = [/^alexa2\.\d+\.(?!Echo-Devices\.[^.]+$)/];

/**
 * Diagnose aus dem Ergebnis der letzten Erkennung: erkannte Geräte je Adapter und Kanäle/Geräte,
 * aus denen keine Kachel wurde. Info-Kanäle der Adapter und Kanäle ohne nutzbare Datenpunkte entfallen.
 */
export function buildDiagnosis(result: DiscoveryResult, lang: string): SvDiagnosis {
    const objects = result.objects;
    const keys = Object.keys(objects).sort();
    const entries: SvDiagnosisEntry[] = [];
    for (const { id, reason } of result.unmatched) {
        // "filtered": Typ für den Adapter bewusst ausgeschlossen (z. B. Alexa nur als Player)
        if (reason === 'filtered' || /\.info$|\.info\./.test(id) || DELIBERATE.some(r => r.test(id))) {
            continue;
        }
        const prefix = `${id}.`;
        const states: SvDiagnosisState[] = [];
        for (const key of keys) {
            if (!key.startsWith(prefix) || objects[key]?.type !== 'state') {
                continue;
            }
            const common = objects[key].common as ioBroker.StateCommon;
            const code = (objects[key].native as { code?: unknown } | undefined)?.code;
            states.push({
                key: key.slice(prefix.length),
                type: common.type,
                role: common.role,
                ...(common.unit && { unit: common.unit }),
                ...(common.write && { write: true }),
                ...(typeof code === 'string' && code && { code }),
            });
        }
        if (!states.some(s => USEFUL_ROLE.test(s.role || ''))) {
            continue;
        }
        entries.push({
            id,
            adapter: id.split('.')[0],
            name: getName(objects[id], lang) || id.split('.').pop() || id,
            kind: objects[id]?.type || 'channel',
            reason,
            states,
        });
    }

    const adapters = new Map<string, SvDiagnosisAdapter>();
    const entry = (adapter: string): SvDiagnosisAdapter => {
        let a = adapters.get(adapter);
        if (!a) {
            a = { adapter, supported: SUPPORTED.has(adapter), devices: 0, unmatched: 0 };
            adapters.set(adapter, a);
        }
        return a;
    };
    result.model.devices.forEach(d => entry(d.adapter).devices++);
    entries.forEach(e => entry(e.adapter).unmatched++);

    return {
        generatedAt: result.model.generatedAt,
        adapters: [...adapters.values()].sort(
            (a, b) => b.unmatched - a.unmatched || a.adapter.localeCompare(b.adapter),
        ),
        unmatched: entries.slice(0, MAX_ENTRIES),
    };
}
