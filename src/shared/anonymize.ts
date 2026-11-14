import type { SvDiagnosis } from './protocol';

/** Anonymer Diagnosebericht zum Teilen (z. B. in einem GitHub-Issue) */
export interface SvAnonymousReport {
    format: 'smartvis-diagnosis';
    version: 1;
    smartvis: string;
    adapters: { adapter: string; supported: boolean; devices: number; unmatched: number }[];
    unmatched: {
        adapter: string;
        kind: string;
        /** Letzter ID-Teil nur, wenn er nach einer Struktur aussieht (Relay0, Lights …), sonst "…" */
        key: string;
        reason: string;
        states: SvDiagnosis['unmatched'][number]['states'];
    }[];
}

/** Bezeichner ohne Bezug zur Anlage: kurze Wörter mit höchstens zwei Ziffern (Relay0, sensor, Cover1) */
const STRUCTURAL = /^[A-Za-z][A-Za-z_]{1,15}\d{0,2}$/;

/** Datenpunkt-Schlüssel mit Personenbezug (z. B. Gerätenamen in Tasmota-Topics) unkenntlich machen */
function stateKey(key: string): string {
    return key
        .split('.')
        .map(part =>
            STRUCTURAL.test(part) || /^\d{1,3}$/.test(part) || /^[A-Za-z0-9]+(_[A-Za-z0-9]+){0,4}$/.test(part)
                ? part
                : '…',
        )
        .join('.');
}

/**
 * Entfernt alles, was auf die Anlage schließen lässt: IDs, Namen, Werte und Räume.
 * Übrig bleiben Adapter, Struktur (Objekttyp, Datenpunkt-Schlüssel) und Rollen.
 */
export function anonymizeDiagnosis(report: SvDiagnosis, smartvisVersion: string): SvAnonymousReport {
    return {
        format: 'smartvis-diagnosis',
        version: 1,
        smartvis: smartvisVersion,
        adapters: report.adapters.map(({ adapter, supported, devices, unmatched }) => ({
            adapter,
            supported,
            devices,
            unmatched,
        })),
        unmatched: report.unmatched.map(e => {
            const last = e.id.split('.').pop() || '';
            return {
                adapter: e.adapter,
                kind: e.kind,
                key: STRUCTURAL.test(last) ? last : '…',
                reason: e.reason,
                states: e.states.map(s => ({ ...s, key: stateKey(s.key) })),
            };
        }),
    };
}
