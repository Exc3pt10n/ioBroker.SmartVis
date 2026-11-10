import type { SvEnergySystem, SvStateRef } from '../../shared/protocol';
import { qhomeProfile } from './qhome';
import { instancesOf, type EnergyProfile, type ObjectMap } from './types';

export const ENERGY_PROFILES: EnergyProfile[] = [qhomeProfile];

/** Führt alle Energie-Profile aus */
export function detectEnergy(objects: ObjectMap, lang: string, isIgnored: (id: string) => boolean): SvEnergySystem[] {
    const systems: SvEnergySystem[] = [];
    for (const profile of ENERGY_PROFILES) {
        if (isIgnored(profile.adapter)) {
            continue;
        }
        for (const instance of instancesOf(profile.adapter, objects)) {
            const system = profile.detect(instance, objects, lang);
            if (system) {
                systems.push(system);
            }
        }
    }
    return systems;
}

/** Alle State-Referenzen eines Energiesystems (für Abos) */
export function energyStateRefs(system: SvEnergySystem): SvStateRef[] {
    return [
        ...Object.values(system.flows),
        ...Object.values(system.battery || {}),
        ...Object.values(system.today || {}),
        system.connected,
    ].filter((r): r is SvStateRef => !!r);
}
