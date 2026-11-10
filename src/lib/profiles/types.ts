import type { SvEnergySystem, SvStateRef, SvWallbox } from '../../shared/protocol';

export type ObjectMap = Record<string, ioBroker.Object>;

export interface ProfileResult {
    energy?: SvEnergySystem;
    wallbox?: SvWallbox;
}

/**
 * Adapter-Profil: erkennt Systeme, die der type-detector nicht abdeckt
 * (PV-Anlagen, Speicher, Wallboxen …), anhand bekannter State-IDs eines Adapters.
 */
export interface AdapterProfile {
    /** Adapter-Name, z. B. "qhome-ess-hyb-g2" */
    adapter: string;
    /**
     * true: Die Instanz wird vollständig vom Profil abgebildet – der type-detector
     * überspringt sie (verhindert zufällige Kacheln aus Konfigurations-States).
     */
    claimsInstance: boolean;
    /** Wird je gefundener Instanz aufgerufen (z. B. "qhome-ess-hyb-g2.0") */
    detect(instance: string, objects: ObjectMap, lang: string): ProfileResult | null;
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
