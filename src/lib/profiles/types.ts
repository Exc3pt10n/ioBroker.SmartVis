import type { SvEnergySystem, SvStateRef } from '../../shared/protocol';

export type ObjectMap = Record<string, ioBroker.Object>;

/**
 * Adapter-Profil: erkennt Systeme, die der type-detector nicht abdeckt
 * (PV-Anlagen, Speicher, Wallboxen …), anhand bekannter State-IDs eines Adapters.
 */
export interface EnergyProfile {
    /** Adapter-Name, z. B. "qhome-ess-hyb-g2" */
    adapter: string;
    /** Wird je gefundener Instanz aufgerufen (z. B. "qhome-ess-hyb-g2.0") */
    detect(instance: string, objects: ObjectMap, lang: string): SvEnergySystem | null;
}

/** Baut eine State-Referenz, falls das Objekt existiert */
export function ref(objects: ObjectMap, id: string, name: string): SvStateRef | undefined {
    const obj = objects[id];
    if (obj?.type !== 'state') {
        return undefined;
    }
    const common = obj.common as ioBroker.StateCommon;
    return {
        name,
        id,
        type: common.type,
        role: common.role,
        unit: common.unit,
        min: common.min,
        max: common.max,
        write: common.write === true,
    };
}

/** Alle Instanzen eines Adapters, die Objekte haben */
export function instancesOf(adapter: string, objects: ObjectMap): string[] {
    const prefix = `${adapter}.`;
    const result = new Set<string>();
    for (const id of Object.keys(objects)) {
        if (id.startsWith(prefix)) {
            const instance = id.split('.', 2).join('.');
            if (/\.\d+$/.test(instance)) {
                result.add(instance);
            }
        }
    }
    return [...result].sort();
}
