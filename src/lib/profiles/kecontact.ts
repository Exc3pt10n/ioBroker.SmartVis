import type { SvStateRef, SvWallbox, SvWallboxSetting } from '../../shared/protocol';
import { ref, type AdapterProfile, type ObjectMap } from './types';

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
/**
 * Einstellungen der Ladeautomatik (automatic.*) mit deutschen Bezeichnungen.
 * Bewusst nicht enthalten: Rohbefehle (start/stop/display/output/unlock/report/setenergy/currentTimer …),
 * der von der Automatik geregelte Ladestrom und automatic.stateVehicleSoC (Konfiguration, Datenpunkt-Name).
 */
function settings(objects: ObjectMap, instance: string): SvWallboxSetting[] {
    const defs: Omit<SvWallboxSetting, 'state'>[] = [
        {
            key: 'automatic.1p3pCharging',
            group: 'Ladeautomatik',
            label: 'Phasen beim Laden',
            hint: 'Nur mit Phasenumschaltung (z. B. X2-Ausgang)',
            kind: 'select',
            options: [
                { value: 0, label: 'Automatisch nach Überschuss' },
                { value: 1, label: 'Nur 1-phasig' },
                { value: 3, label: 'Nur 3-phasig' },
            ],
        },
        {
            key: 'automatic.addPower',
            group: 'Ladeautomatik',
            label: 'Zusätzlicher Netzbezug',
            hint: 'Erlaubter Netzbezug, damit das Laden schon früher startet',
            kind: 'number',
            unit: 'W',
            min: 0,
            max: 22000,
            step: 100,
        },
        {
            key: 'automatic.maxGridPower',
            group: 'Ladeautomatik',
            label: 'Maximaler Netzbezug',
            kind: 'number',
            unit: 'W',
            min: 0,
            max: 50000,
            step: 100,
            zeroLabel: 'Einstellung des Adapters',
        },
        {
            key: 'automatic.limitCurrent',
            group: 'Ladeautomatik',
            label: 'Ladestrom begrenzen',
            kind: 'number',
            unit: 'A',
            scale: 0.001,
            min: 0,
            max: 32,
            step: 1,
            zeroLabel: 'keine Begrenzung',
        },
        {
            key: 'automatic.limitCurrent1p',
            group: 'Ladeautomatik',
            label: 'Ladestrom begrenzen (1-phasig)',
            kind: 'number',
            unit: 'A',
            scale: 0.001,
            min: 0,
            max: 32,
            step: 1,
            zeroLabel: 'wie oben',
        },
        {
            key: 'automatic.calcPhases',
            group: 'Ladeautomatik',
            label: 'Phasen für Leistungsschätzung',
            hint: 'Deutschland-Edition ohne Energiezähler',
            kind: 'number',
            min: 1,
            max: 3,
            step: 1,
        },
        {
            key: 'automatic.batteryStorageStrategy',
            group: 'Batteriespeicher',
            label: 'Strategie',
            kind: 'select',
            options: [
                { value: 0, label: 'Einstellung des Adapters' },
                { value: 1, label: 'Speicher nicht nutzen (Vorrang Auto)' },
                { value: 2, label: 'Speicher nicht nutzen (Vorrang Speicher)' },
                { value: 3, label: 'Speicher für Mindest-Ladestrom nutzen' },
                { value: 4, label: 'Speicher voll für das Auto nutzen' },
            ],
        },
        {
            key: 'automatic.batterySoCForCharging',
            group: 'Batteriespeicher',
            label: 'Speicher fürs Auto ab Ladezustand',
            kind: 'number',
            unit: '%',
            min: 0,
            max: 100,
            step: 5,
        },
        {
            key: 'automatic.targetSoC',
            group: 'Ziel-Ladung',
            label: 'Ohne PV-Automatik laden bis',
            hint: 'Lädt mit voller Leistung bis zu diesem Fahrzeug-Ladezustand',
            kind: 'number',
            unit: '%',
            min: 0,
            max: 100,
            step: 5,
            zeroLabel: 'aus',
            needsVehicleSoC: true,
        },
        {
            key: 'automatic.maxSoC',
            group: 'Ziel-Ladung',
            label: 'Laden beenden bei',
            kind: 'number',
            unit: '%',
            min: 0,
            max: 100,
            step: 5,
            zeroLabel: 'aus',
            needsVehicleSoC: true,
        },
        {
            key: 'automatic.resetTargetSoC',
            group: 'Ziel-Ladung',
            label: 'Ziel nach Erreichen zurücksetzen',
            kind: 'switch',
            needsVehicleSoC: true,
        },
    ];
    const result: SvWallboxSetting[] = [];
    for (const def of defs) {
        const state = ref(objects, `${instance}.${def.key}`, def.label);
        if (state?.write) {
            result.push({ ...def, state });
        }
    }
    return result;
}

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
            settings: settings(objects, instance),
            vehicleSoCSource: readOnly(ref(objects, id('automatic.stateVehicleSoC'), 'SoC-Datenpunkt')),
            pvAutomatic: ref(objects, id('automatic.photovoltaics'), 'PV-Überschussladen'),
            pause: ref(objects, id('automatic.pauseWallbox'), 'Pausieren'),
            connected: ref(objects, id('info.connection'), 'Verbunden'),
        };
        return { wallbox };
    },
};
