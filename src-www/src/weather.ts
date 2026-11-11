import type { SvStateRef, SvStateValue, SvWeather } from '../../src/shared/protocol';

type States = Record<string, SvStateValue | null>;

function num(ref: SvStateRef | undefined, states: States): number | undefined {
    if (!ref) {
        return undefined;
    }
    const v = Number(states[ref.id]?.val);
    return states[ref.id]?.val === null || states[ref.id]?.val === undefined || !Number.isFinite(v) ? undefined : v;
}

function bool(ref: SvStateRef | undefined, states: States): boolean | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    return typeof v === 'boolean' ? v : v === undefined || v === null ? undefined : !!v;
}

export interface WeatherSnapshot {
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    windDirection?: number;
    windAlarm?: boolean;
    raining?: boolean;
    rainToday?: number;
    illumination?: number;
    sunshine?: boolean;
    sunshineToday?: number;
    /** Helligkeit je Lichtsensor (Lux) */
    light: { name: string; lux?: number; average?: number; online: boolean }[];
    online: boolean;
    /** Zeitpunkt der letzten Temperaturmessung */
    updated?: number;
}

export function weatherSnapshot(w: SvWeather, states: States): WeatherSnapshot {
    return {
        temperature: num(w.temperature, states),
        humidity: num(w.humidity, states),
        windSpeed: num(w.windSpeed, states),
        windDirection: num(w.windDirection, states),
        windAlarm: bool(w.windAlarm, states),
        raining: bool(w.raining, states),
        rainToday: num(w.rainToday, states),
        illumination: num(w.illumination, states),
        sunshine: bool(w.sunshine, states),
        sunshineToday: num(w.sunshineToday, states),
        light: (w.lightSensors || []).map(l => ({
            name: l.name,
            lux: num(l.current, states),
            average: num(l.average, states),
            online: bool(l.unreach, states) !== true,
        })),
        online: bool(w.unreach, states) !== true,
        updated: w.temperature ? states[w.temperature.id]?.ts : undefined,
    };
}

export interface Condition {
    icon: string;
    label: string;
}

/**
 * Wetterlage aus Messwerten einer lokalen Station abgeleitet (keine Vorhersage):
 * Regen/Schnee → Sonne (Schwellwert der Station) → Dunkelheit → sonst bewölkt.
 */
export function condition(s: WeatherSnapshot): Condition {
    if (s.raining) {
        return s.temperature !== undefined && s.temperature <= 1
            ? { icon: '🌨️', label: 'Schneefall' }
            : { icon: '🌧️', label: 'Regen' };
    }
    if (s.windAlarm) {
        return { icon: '💨', label: 'Stürmisch' };
    }
    if (s.sunshine) {
        return { icon: '☀️', label: 'Sonnig' };
    }
    // Hellster Lichtsensor (Lux) ist aussagekräftiger als der Helligkeitswert der Station
    const lux = s.light.map(l => l.lux).filter((v): v is number => v !== undefined);
    const brightness = lux.length ? Math.max(...lux) : s.illumination;
    if (brightness !== undefined && brightness < 10) {
        return { icon: '🌙', label: 'Dunkel' };
    }
    if (brightness !== undefined) {
        return { icon: '⛅', label: 'Bewölkt' };
    }
    return { icon: '🌡️', label: 'Außen' };
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

export function compass(deg: number): string {
    return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Windstärke in Worten (Beaufort, vereinfacht) */
export function windLabel(kmh: number): string {
    if (kmh < 2) {
        return 'windstill';
    }
    if (kmh < 12) {
        return 'leicht';
    }
    if (kmh < 29) {
        return 'mäßig';
    }
    if (kmh < 50) {
        return 'frisch';
    }
    if (kmh < 75) {
        return 'stürmisch';
    }
    return 'Sturm';
}

export function formatMinutes(min: number): string {
    const m = Math.round(min);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/** Helligkeit: 12.400 lx bzw. 85 lx */
export function formatLux(lux: number | undefined): string {
    return lux === undefined ? '–' : `${Math.round(lux).toLocaleString('de-DE')} lx`;
}

export function fmt(v: number | undefined, digits = 1): string {
    return v === undefined ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: digits });
}
