import type { SvStateRef, SvWallbox } from '../../shared/protocol';
import { ref, type AdapterProfile } from './types';

/**
 * KEBA KeContact P20/P30 (Adapter: ioBroker.kecontact)
 *
 * - p: Ladeleistung in mW
 * - state: 0 Start, 1 nicht bereit, 2 bereit, 3 lädt, 4 Fehler, 5 unterbrochen
 * - plug: 0 kein Kabel, 1/3 Kabel an Wallbox, 5/7 Fahrzeug verbunden
 * - currentUser: Ladestrom, den die Automatik des Adapters vorgibt (mA) = aktuelles Limit
 * - statistics.surplus: PV-Überschuss, mit dem die Automatik zuletzt gerechnet hat (W)
 * - automatic.photovoltaics / automatic.pauseWallbox: Schalter der Lade-Automatik des Adapters
 *
 * Die "Deutschland-Edition" (Produkt …-DE) hat keinen Energiezähler: p, ePres und die Statistik bleiben 0.
 * Der Adapter schätzt die Leistung selbst aus currentUser × 230 V × Phasen (chargingPhases bzw.
 * automatic.calcPhases) – die App macht es ebenso. Sitzungsenergie wird deshalb nicht angezeigt.
 */
function readOnly(r: SvStateRef | undefined): SvStateRef | undefined {
    return r ? { ...r, write: false } : undefined;
}

export const kecontactProfile: AdapterProfile = {
    adapter: 'kecontact',
    claimsInstance: true,
    detect(instance, objects) {
        const id = (s: string): string => `${instance}.${s}`;
        const power = ref(objects, id('p'), 'Ladeleistung');
        const status = ref(objects, id('state'), 'Status');
        if (!power || !status) {
            return null;
        }

        const wallbox: SvWallbox = {
            id: instance,
            name: 'Wallbox',
            adapter: 'kecontact',
            power,
            status,
            statusMap: {
                0: 'starting',
                1: 'notReady',
                2: 'ready',
                3: 'charging',
                4: 'error',
                5: 'interrupted',
            },
            plug: ref(objects, id('plug'), 'Stecker'),
            vehiclePluggedValues: [5, 7],
            // nur lesen: der Ladestrom wird von der PV-Automatik des Adapters geregelt
            current: readOnly(ref(objects, id('currentUser'), 'Ladestrom')),
            currentMax: ref(objects, id('currentHardware'), 'Maximaler Ladestrom'),
            phases: ref(objects, id('statistics.chargingPhases'), 'Phasen'),
            configuredPhases: readOnly(ref(objects, id('automatic.calcPhases'), 'Phasen (Einstellung)')),
            surplus: ref(objects, id('statistics.surplus'), 'PV-Überschuss'),
            pvAutomatic: ref(objects, id('automatic.photovoltaics'), 'PV-Überschussladen'),
            pause: ref(objects, id('automatic.pauseWallbox'), 'Pausieren'),
            connected: ref(objects, id('info.connection'), 'Verbunden'),
        };
        return { wallbox };
    },
};
