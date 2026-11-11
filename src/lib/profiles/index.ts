import type {
    SvEnergySystem,
    SvPvForecast,
    SvPvForecastValues,
    SvShutterControl,
    SvStateRef,
    SvSwitch,
    SvWallbox,
    SvWeather,
} from '../../shared/protocol';
import { pvforecastProfile } from './pvforecast';
import { shuttercontrolProfile } from './shuttercontrol';
import { hmWeatherProfile } from './hmWeather';
import { kecontactProfile } from './kecontact';
import { qhomeProfile } from './qhome';
import { instancesOf, type AdapterProfile, type ObjectMap } from './types';

export const PROFILES: AdapterProfile[] = [
    qhomeProfile,
    kecontactProfile,
    hmWeatherProfile,
    shuttercontrolProfile,
    pvforecastProfile,
];

export interface ProfilesResult {
    energy: SvEnergySystem[];
    wallboxes: SvWallbox[];
    weather: SvWeather[];
    shutterControl: SvShutterControl[];
    pvForecast: SvPvForecast[];
    /** Instanzen, die vollständig von einem Profil abgebildet werden */
    claimedInstances: string[];
}

/** Führt alle Adapter-Profile aus */
export function runProfiles(objects: ObjectMap, lang: string, isIgnored: (id: string) => boolean): ProfilesResult {
    const result: ProfilesResult = {
        energy: [],
        wallboxes: [],
        weather: [],
        shutterControl: [],
        pvForecast: [],
        claimedInstances: [],
    };
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
            if (found.pvForecast) {
                result.pvForecast.push(found.pvForecast);
            }
            if (found.shutterControl) {
                result.shutterControl.push(found.shutterControl);
            }
            if (profile.claimsInstance) {
                result.claimedInstances.push(instance);
            }
        }
    }
    return result;
}

function isRef(r: unknown): r is SvStateRef {
    return !!r && typeof r === 'object' && 'id' in r && 'write' in r;
}

function isSwitch(r: unknown): r is SvSwitch {
    return !!r && typeof r === 'object' && 'value' in r && 'write' in r && isRef((r as SvSwitch).value);
}

/**
 * State-Referenzen der Rollladen-Automatik.
 * read: alles Angezeigte; write: nur, was die App bedienen darf.
 */
export function shutterControlRefs(sc: SvShutterControl): { read: SvStateRef[]; write: SvStateRef[] } {
    const read: SvStateRef[] = [];
    const write: SvStateRef[] = [];
    const add = (r: unknown, writable: boolean): void => {
        if (isSwitch(r)) {
            read.push(r.value);
            if (writable) {
                write.push(r.write);
            }
        } else if (isRef(r)) {
            read.push(r);
            if (writable) {
                write.push(r);
            }
        }
    };
    [sc.openAll, sc.closeAll, sc.sunProtectAll, sc.autoAll, sc.holiday, sc.schoolfree].forEach(r => add(r, true));
    Object.values(sc.sun).forEach(r => add(r, false));
    for (const a of sc.areas) {
        [a.auto, a.open, a.close, a.sunProtect].forEach(r => add(r, true));
        [a.upTime, a.downTime].forEach(r => add(r, false));
    }
    for (const s of sc.shutters) {
        [s.autoUp, s.autoDown, s.autoSun].forEach(r => add(r, true));
        add(s.autoState, false);
        // Level nur, wenn er auch beschreibbar ist (Rollladen hoch/runter fahren)
        add(s.level, !!s.level?.write);
    }
    return { read, write };
}

/** Nur lesende State-Referenzen der PV-Prognose */
export function pvForecastRefs(pv: SvPvForecast): SvStateRef[] {
    const vals = (v: SvPvForecastValues): unknown[] => Object.values(v);
    return [...vals(pv.summary), ...pv.plants.flatMap(vals), pv.curve, pv.lastUpdated].filter(isRef);
}

/** Alle State-Referenzen eines Profil-Objekts (für Abos und Schreib-Whitelist) */
export function profileStateRefs(item: SvEnergySystem | SvWallbox | SvWeather): SvStateRef[] {
    const nested: unknown[] = [
        ...('lightSensors' in item && item.lightSensors ? item.lightSensors.flatMap(l => Object.values(l)) : []),
        // Wallbox-Einstellungen: schreibbare States (landen damit in der Whitelist)
        ...('settings' in item && item.settings ? item.settings.map(s => s.state) : []),
    ];
    const refs: unknown[] =
        'flows' in item
            ? [
                  ...Object.values(item.flows),
                  ...Object.values(item.battery || {}),
                  ...Object.values(item.today || {}),
                  ...(item.periods || []).flatMap(p => [p.periodKey, ...Object.values(p.totals)]),
                  item.connected,
              ]
            : [...Object.values(item), ...nested];
    return refs.filter((r): r is SvStateRef => !!r && typeof r === 'object' && 'id' in r && 'write' in r);
}
