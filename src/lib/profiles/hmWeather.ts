import type { SvWeather } from '../../shared/protocol';
import { getName } from '../names';
import { ref, type AdapterProfile, type ObjectMap } from './types';

/** Homematic(-IP) Wetterstationen und Außensensoren, beste Quelle zuerst */
const MODELS: { pattern: RegExp; rank: number }[] = [
    { pattern: /^HmIP-SWO-(PR|PL|B)$/i, rank: 0 },
    { pattern: /^HM-WDS100-C6-O(-2)?$/i, rank: 0 },
    { pattern: /^HmIP-STHO(-A)?$/i, rank: 1 },
    { pattern: /^HM-WDS10-TH-O$/i, rank: 1 },
];

/** Erster existierender State aus mehreren möglichen Namen (HmIP vs. klassisches Homematic) */
function first(objects: ObjectMap, channel: string, names: string[], label: string): ReturnType<typeof ref> {
    for (const n of names) {
        const r = ref(objects, `${channel}.${n}`, label);
        if (r) {
            return r;
        }
    }
    return undefined;
}

/**
 * Tageswerte, die die CCU für HmIP-Wetterstationen automatisch als Systemvariablen anlegt:
 *   svHmIPRainCounter_<iseId>_<Seriennummer>:1  → verknüpft iseId und Gerät
 *   svHmIPRainCounterToday_<iseId>, svHmIPRainCounterYesterday_<iseId>
 *   svHmIPSunshineCounterToday_<iseId>
 * Der Rohzähler RAIN_COUNTER/SUNSHINEDURATION läuft dagegen endlos hoch.
 */
function ccuDailyVars(objects: ObjectMap, serial: string): Record<string, string> {
    const byName = new Map<string, string>();
    let iseId: string | undefined;
    for (const [id, obj] of Object.entries(objects)) {
        if (!id.startsWith('hm-rega.') || obj.type !== 'state') {
            continue;
        }
        const name = String(getName(obj, 'de') || (obj.native as { Name?: string })?.Name || '');
        byName.set(name, id);
        const m = /^svHmIP(?:Rain|Sunshine)Counter_(\d+)_([^:]+):\d+$/.exec(name);
        if (m && m[2] === serial) {
            iseId = m[1];
        }
    }
    if (!iseId) {
        return {};
    }
    const result: Record<string, string> = {};
    for (const [key, varName] of [
        ['rainToday', `svHmIPRainCounterToday_${iseId}`],
        ['rainYesterday', `svHmIPRainCounterYesterday_${iseId}`],
        ['sunshineToday', `svHmIPSunshineCounterToday_${iseId}`],
    ]) {
        const id = byName.get(varName);
        if (id) {
            result[key] = id;
        }
    }
    return result;
}

/** Variablen-Ref mit fester Einheit (CCU-Variablen haben oft keine) */
function varRef(objects: ObjectMap, id: string | undefined, label: string, unit: string): ReturnType<typeof ref> {
    const r = id ? ref(objects, id, label) : undefined;
    return r ? { ...r, unit: r.unit || unit, write: false } : undefined;
}

export const hmWeatherProfile: AdapterProfile = {
    adapter: 'hm-rpc',
    // Die Station bleibt zusätzlich als normale Kachel (z. B. im Garten) erhalten
    claimsInstance: false,
    detect(instance, objects, lang) {
        const found: { weather: SvWeather; rank: number }[] = [];
        for (const [id, obj] of Object.entries(objects)) {
            if (obj.type !== 'device' || !id.startsWith(`${instance}.`) || id.split('.').length !== 3) {
                continue;
            }
            const model = String((obj.native as { TYPE?: string })?.TYPE || '');
            const match = MODELS.find(m => m.pattern.test(model));
            if (!match) {
                continue;
            }
            const ch = `${id}.1`;
            const serial = id.split('.')[2];
            const vars = ccuDailyVars(objects, serial);
            const weather: SvWeather = {
                id,
                name: getName(obj, lang) || model,
                adapter: 'hm-rpc',
                model,
                temperature: first(objects, ch, ['ACTUAL_TEMPERATURE', 'TEMPERATURE'], 'Temperatur'),
                humidity: first(objects, ch, ['HUMIDITY'], 'Luftfeuchte'),
                windSpeed: first(objects, ch, ['WIND_SPEED'], 'Wind'),
                windDirection: first(objects, ch, ['WIND_DIR', 'WIND_DIRECTION'], 'Windrichtung'),
                windAlarm: first(objects, ch, ['WIND_THRESHOLD_OVERRUN'], 'Sturm'),
                raining: first(objects, ch, ['RAINING'], 'Regen'),
                rainToday: varRef(objects, vars.rainToday, 'Regen heute', 'mm'),
                rainYesterday: varRef(objects, vars.rainYesterday, 'Regen gestern', 'mm'),
                illumination: first(objects, ch, ['ILLUMINATION', 'BRIGHTNESS'], 'Helligkeit'),
                sunshine: first(objects, ch, ['SUNSHINE_THRESHOLD_OVERRUN'], 'Sonne'),
                sunshineToday: varRef(objects, vars.sunshineToday, 'Sonne heute', 'min'),
                unreach: first(objects, `${id}.0`, ['UNREACH'], 'Nicht erreichbar'),
                lowBat: first(objects, `${id}.0`, ['LOW_BAT', 'LOWBAT'], 'Batterie'),
            };
            if (weather.temperature) {
                found.push({ weather, rank: match.rank });
            }
        }
        if (!found.length) {
            return null;
        }
        return { weather: found.sort((a, b) => a.rank - b.rank).map(f => f.weather) };
    },
};
