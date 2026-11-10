import type { SvEnergySystem, SvStateRef, SvWallbox, SvWeather } from '../../shared/protocol';
import { hmWeatherProfile } from './hmWeather';
import { kecontactProfile } from './kecontact';
import { qhomeProfile } from './qhome';
import { instancesOf, type AdapterProfile, type ObjectMap } from './types';

export const PROFILES: AdapterProfile[] = [qhomeProfile, kecontactProfile, hmWeatherProfile];

export interface ProfilesResult {
    energy: SvEnergySystem[];
    wallboxes: SvWallbox[];
    weather: SvWeather[];
    /** Instanzen, die vollständig von einem Profil abgebildet werden */
    claimedInstances: string[];
}

/** Führt alle Adapter-Profile aus */
export function runProfiles(objects: ObjectMap, lang: string, isIgnored: (id: string) => boolean): ProfilesResult {
    const result: ProfilesResult = { energy: [], wallboxes: [], weather: [], claimedInstances: [] };
    for (const profile of PROFILES) {
        if (isIgnored(profile.adapter)) {
            continue;
        }
        for (const instance of instancesOf(profile.adapter, objects)) {
            const found = profile.detect(instance, objects, lang);
            if (!found) {
                continue;
            }
            if (found.energy) {
                result.energy.push(found.energy);
            }
            if (found.wallbox) {
                result.wallboxes.push(found.wallbox);
            }
            if (found.weather) {
                result.weather.push(...found.weather);
            }
            if (profile.claimsInstance) {
                result.claimedInstances.push(instance);
            }
        }
    }
    return result;
}

/** Alle State-Referenzen eines Profil-Objekts (für Abos und Schreib-Whitelist) */
export function profileStateRefs(item: SvEnergySystem | SvWallbox | SvWeather): SvStateRef[] {
    const refs: unknown[] =
        'flows' in item
            ? [
                  ...Object.values(item.flows),
                  ...Object.values(item.battery || {}),
                  ...Object.values(item.today || {}),
                  item.connected,
              ]
            : Object.values(item);
    return refs.filter((r): r is SvStateRef => !!r && typeof r === 'object' && 'id' in r && 'write' in r);
}
