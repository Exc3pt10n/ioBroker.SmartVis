import type { SvWallbox } from '../../shared/protocol';
import { ref, type AdapterProfile } from './types';

/**
 * KEBA KeContact P20/P30 (Adapter: ioBroker.kecontact)
 *
 * - p: Ladeleistung in mW
 * - state: 0 Start, 1 nicht bereit, 2 bereit, 3 lädt, 4 Fehler, 5 unterbrochen
 * - plug: 0 kein Kabel, 1/3 Kabel an Wallbox, 5/7 Fahrzeug verbunden
 * - ePres: Energie der laufenden Sitzung (Wh)
 * - automatic.photovoltaics / automatic.pauseWallbox: Schalter der Lade-Automatik des Adapters
 */
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
            sessionEnergy: ref(objects, id('ePres'), 'Geladen (Sitzung)'),
            lastSessionEnergy: ref(objects, id('statistics.lastChargeAmount'), 'Letzte Ladung'),
            pvAutomatic: ref(objects, id('automatic.photovoltaics'), 'PV-Überschussladen'),
            pause: ref(objects, id('automatic.pauseWallbox'), 'Pausieren'),
            connected: ref(objects, id('info.connection'), 'Verbunden'),
        };
        return { wallbox };
    },
};
