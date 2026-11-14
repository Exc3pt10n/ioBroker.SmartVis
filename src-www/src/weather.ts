import type { SvForecastDay, SvStateRef, SvStateValue, SvWeather, SvWeatherWarning } from '../../src/shared/protocol';

type States = Record<string, SvStateValue | null>;

function num(ref: SvStateRef | undefined, states: States): number | undefined {
    if (!ref) {
        return undefined;
    }
    const v = Number(states[ref.id]?.val);
    return states[ref.id]?.val === null || states[ref.id]?.val === undefined || !Number.isFinite(v) ? undefined : v;
}

/** Temperatur in °C (Wetterdienste liefern je nach Einstellung °F) */
function celsius(ref: SvStateRef | undefined, states: States): number | undefined {
    const v = num(ref, states);
    return v !== undefined && /F$/.test(ref?.unit || '') ? ((v - 32) * 5) / 9 : v;
}

/** Windgeschwindigkeit in km/h (OpenWeatherMap: m/s, Weather Underground imperial: mph bzw. "m/h") */
function kmh(ref: SvStateRef | undefined, states: States): number | undefined {
    const v = num(ref, states);
    const unit = (ref?.unit || '').trim().toLowerCase();
    if (v === undefined) {
        return undefined;
    }
    return unit === 'm/s' ? v * 3.6 : unit === 'mph' || unit === 'm/h' ? v * 1.609 : v;
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
        temperature: celsius(w.temperature, states),
        humidity: num(w.humidity, states),
        windSpeed: kmh(w.windSpeed, states),
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

function text(ref: SvStateRef | undefined, states: States): string | undefined {
    const v = ref ? states[ref.id]?.val : undefined;
    return v === null || v === undefined || v === '' ? undefined : String(v);
}

/** OpenWeatherMap-Symbol ("10d" bzw. URL ".../10d.png") → Emoji */
function owmIcon(code: string): string | undefined {
    const m = /(\d{2})([dn])(?:\.\w+)?$/.exec(code);
    if (!m) {
        return undefined;
    }
    const night = m[2] === 'n';
    const icons: Record<string, string> = {
        '01': night ? '🌙' : '☀️',
        '02': night ? '☁️' : '🌤️',
        '03': '⛅',
        '04': '☁️',
        '09': '🌧️',
        10: night ? '🌧️' : '🌦️',
        11: '⛈️',
        13: '🌨️',
        50: '🌫️',
    };
    return icons[m[1]];
}

/** The Weather Company (Weather Underground): Code 0–47 bzw. URL ".../32.svg" → Emoji */
function twcIcon(code: string): string | undefined {
    const m = /(\d{1,2})(?:\.\w+)?$/.exec(code);
    if (!m) {
        return undefined;
    }
    const n = Number(m[1]);
    if (n <= 4 || n === 37 || n === 38 || n === 47) {
        return '⛈️';
    }
    if ((n >= 5 && n <= 8) || n === 10 || n === 17 || n === 18 || n === 35) {
        return '🌨️';
    }
    if (n === 9 || n === 11 || n === 12 || n === 40) {
        return '🌧️';
    }
    if ((n >= 13 && n <= 16) || (n >= 41 && n <= 43) || n === 46) {
        return '❄️';
    }
    if (n >= 19 && n <= 22) {
        return '🌫️';
    }
    if (n === 23 || n === 24) {
        return '💨';
    }
    if (n === 26) {
        return '☁️';
    }
    if (n === 27 || n === 29 || n === 31 || n === 33) {
        return '🌙';
    }
    if (n === 28) {
        return '🌥️';
    }
    if (n === 30) {
        return '⛅';
    }
    if (n === 34) {
        return '🌤️';
    }
    if (n === 39 || n === 45) {
        return '🌦️';
    }
    if (n === 32 || n === 36) {
        return '☀️';
    }
    return undefined;
}

/** Emoji aus einer Wetterbeschreibung (deutsch oder englisch), z. B. "leichter Regen" → 🌧️ */
export function iconFromText(t: string): string {
    const s = t.toLowerCase();
    if (/gewitter|thunder/.test(s)) {
        return '⛈️';
    }
    if (/schnee|snow|graupel|sleet|hagel|hail/.test(s)) {
        return '🌨️';
    }
    if (/schauer|shower/.test(s)) {
        return '🌦️';
    }
    if (/regen|niesel|rain|drizzle/.test(s)) {
        return '🌧️';
    }
    if (/nebel|dunst|fog|mist|haze/.test(s)) {
        return '🌫️';
    }
    if (/bedeckt|overcast|stark bewölkt|wolkenverhangen/.test(s)) {
        return '☁️';
    }
    if (/heiter|leicht bewölkt|teilweise|vereinzelt|partly|few clouds|mostly sunny|überwiegend sonnig/.test(s)) {
        return '🌤️';
    }
    if (/bewölkt|wolkig|cloud/.test(s)) {
        return '⛅';
    }
    if (/sonnig|klar|sunny|clear|wolkenlos/.test(s)) {
        return '☀️';
    }
    if (/wind|sturm|storm/.test(s)) {
        return '💨';
    }
    return '🌡️';
}

/** Erster Buchstabe groß ("leichter Regen" → "Leichter Regen") */
function capitalize(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Wetterlage eines Wetterdienstes (Symbol-Code, sonst Text); undefined, wenn der Dienst nichts meldet */
export function serviceCondition(
    item: { conditionText?: SvStateRef; conditionCode?: SvStateRef },
    scheme: SvWeather['codeScheme'],
    states: States,
): Condition | undefined {
    const label = text(item.conditionText, states);
    const code = text(item.conditionCode, states);
    const icon = code ? (scheme === 'owm' ? owmIcon(code) : scheme === 'twc' ? twcIcon(code) : undefined) : undefined;
    if (!label && !icon) {
        return undefined;
    }
    return { icon: icon || iconFromText(label || ''), label: label ? capitalize(label) : '' };
}

export interface ForecastSnapshot {
    offset: number;
    /** "Heute", "Morgen", sonst Wochentag kurz */
    label: string;
    min?: number;
    max?: number;
    condition?: Condition;
    rain?: number;
    rainChance?: number;
}

export function forecastSnapshot(w: SvWeather, states: States, now = new Date()): ForecastSnapshot[] {
    return (w.forecast || []).map((d: SvForecastDay) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d.offset);
        return {
            offset: d.offset,
            label:
                d.offset === 0
                    ? 'Heute'
                    : d.offset === 1
                      ? 'Morgen'
                      : date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
            min: celsius(d.tempMin, states),
            max: celsius(d.tempMax, states),
            condition: serviceCondition(d, w.codeScheme, states),
            rain: num(d.rain, states),
            rainChance: num(d.rainChance, states),
        };
    });
}

export interface WarningSnapshot {
    id: string;
    headline: string;
    /** gelb, orange, rot, violett (DWD-Stufen) */
    tone: 'minor' | 'moderate' | 'severe' | 'extreme';
    begin?: number;
    end?: number;
    description?: string;
    instruction?: string;
}

/** Aktive Warnungen (Überschrift gesetzt, nicht abgelaufen), doppelte Plätze zusammengefasst, schwerste zuerst */
export function activeWarnings(warnings: SvWeatherWarning[], states: States, now = Date.now()): WarningSnapshot[] {
    const seen = new Set<string>();
    const result: (WarningSnapshot & { level: number })[] = [];
    for (const w of warnings) {
        const headline = text(w.headline, states);
        const end = num(w.end, states);
        if (!headline || (end && end < now)) {
            continue;
        }
        const begin = num(w.begin, states);
        const key = `${headline}|${begin ?? ''}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const level = num(w.level, states) ?? 2;
        result.push({
            id: w.id,
            headline,
            level,
            tone: level >= 5 ? 'extreme' : level === 4 ? 'severe' : level === 3 ? 'moderate' : 'minor',
            begin,
            end,
            description: text(w.description, states),
            instruction: text(w.instruction, states),
        });
    }
    return result.sort((a, b) => b.level - a.level).map(({ level: _level, ...w }) => w);
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
