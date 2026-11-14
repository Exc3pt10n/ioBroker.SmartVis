import type { SvForecastDay, SvWeather, SvWeatherWarning } from '../../shared/protocol';
import { getName } from '../names';
import { ref, type AdapterProfile, type ObjectMap } from './types';

/** Höchstens so viele Vorhersagetage (heute + 4) */
const MAX_DAYS = 5;

/** Vorhersagetag nur, wenn mindestens Temperatur oder Wetterlage vorhanden ist */
function day(d: SvForecastDay): SvForecastDay | undefined {
    return d.tempMax || d.tempMin || d.conditionText || d.conditionCode ? d : undefined;
}

function days(list: (SvForecastDay | undefined)[]): SvForecastDay[] {
    return list.filter((d): d is SvForecastDay => !!d).slice(0, MAX_DAYS);
}

/**
 * OpenWeatherMap (ioBroker.openweathermap): `forecast.current.*` und `forecast.day0…` (day0 = heute).
 * Symbol als URL ".../img/w/10d.png" (Code steckt im Dateinamen), Text in der eingestellten Sprache.
 */
export const openweathermapProfile: AdapterProfile = {
    adapter: 'openweathermap',
    claimsInstance: true,
    detect(instance, objects) {
        const cur = `${instance}.forecast.current`;
        const temperature = ref(objects, `${cur}.temperature`, 'Temperatur');
        if (!temperature) {
            return null;
        }
        const forecast = days(
            Array.from({ length: MAX_DAYS }, (_, i) => {
                const d = `${instance}.forecast.day${i}`;
                return day({
                    offset: i,
                    tempMin: ref(objects, `${d}.temperatureMin`, 'Tiefstwert'),
                    tempMax: ref(objects, `${d}.temperatureMax`, 'Höchstwert'),
                    conditionText: ref(objects, `${d}.title`, 'Wetterlage'),
                    conditionCode: ref(objects, `${d}.icon`, 'Symbol'),
                    rain: ref(objects, `${d}.precipitation`, 'Niederschlag'),
                    windSpeed: ref(objects, `${d}.windSpeed`, 'Wind'),
                });
            }),
        );
        const weather: SvWeather = {
            id: instance,
            name: 'OpenWeatherMap',
            adapter: 'openweathermap',
            source: 'service',
            temperature,
            humidity: ref(objects, `${cur}.humidity`, 'Luftfeuchte'),
            windSpeed: ref(objects, `${cur}.windSpeed`, 'Wind'),
            windDirection: ref(objects, `${cur}.windDirection`, 'Windrichtung'),
            pressure: ref(objects, `${cur}.pressure`, 'Luftdruck'),
            rainToday: ref(objects, `${cur}.precipitation`, 'Niederschlag'),
            conditionText: ref(objects, `${cur}.title`, 'Wetterlage'),
            conditionCode: ref(objects, `${cur}.icon`, 'Symbol'),
            codeScheme: 'owm',
            forecast,
        };
        return { weather: [weather] };
    },
};

/**
 * Weather Underground (ioBroker.weatherunderground): `forecast.current.*` (Messwerte der gewählten Station)
 * und `forecast.<n>d.*` (0d = heute). Symbole sind Codes von The Weather Company (0–47).
 */
export const weatherundergroundProfile: AdapterProfile = {
    adapter: 'weatherunderground',
    claimsInstance: true,
    detect(instance, objects) {
        const cur = `${instance}.forecast.current`;
        const temperature = ref(objects, `${cur}.temp`, 'Temperatur');
        const forecast = days(
            Array.from({ length: MAX_DAYS }, (_, i) => {
                const d = `${instance}.forecast.${i}d`;
                return day({
                    offset: i,
                    tempMin: ref(objects, `${d}.tempMin`, 'Tiefstwert'),
                    tempMax: ref(objects, `${d}.tempMax`, 'Höchstwert'),
                    conditionText:
                        ref(objects, `${d}.stateShort`, 'Wetterlage') ?? ref(objects, `${d}.state`, 'Wetterlage'),
                    conditionCode: ref(objects, `${d}.icon`, 'Symbol'),
                    rain: ref(objects, `${d}.precipitationAllDay`, 'Niederschlag'),
                    rainChance: ref(objects, `${d}.precipitationChance`, 'Regenwahrscheinlichkeit'),
                    windSpeed: ref(objects, `${d}.windSpeed`, 'Wind'),
                });
            }),
        );
        if (!temperature && !forecast.length) {
            return null;
        }
        const weather: SvWeather = {
            id: instance,
            name: 'Weather Underground',
            adapter: 'weatherunderground',
            source: 'service',
            temperature,
            humidity: ref(objects, `${cur}.relativeHumidity`, 'Luftfeuchte'),
            windSpeed: ref(objects, `${cur}.wind`, 'Wind'),
            windDirection: ref(objects, `${cur}.windDegrees`, 'Windrichtung'),
            pressure: ref(objects, `${cur}.pressure`, 'Luftdruck'),
            rainToday: ref(objects, `${cur}.precipitationDay`, 'Regen heute'),
            conditionText: ref(objects, `${cur}.weather`, 'Wetterlage'),
            conditionCode: ref(objects, `${cur}.iconURL`, 'Symbol'),
            codeScheme: 'twc',
            forecast,
        };
        return { weather: [weather] };
    },
};

/**
 * DasWetter / Meteored (ioBroker.daswetter ab 4.x): je Ort `location_<id>` mit `ForecastDaily.Day_1…5`
 * (Day_1 = heute) und optional `ForecastHourly.Current` bzw. `Hour_1` für die aktuelle Stunde.
 * Symbole sind Meteored-Codes ohne öffentliche Liste – die Wetterlage kommt aus dem Beschreibungstext.
 */
export const daswetterProfile: AdapterProfile = {
    adapter: 'daswetter',
    claimsInstance: true,
    detect(instance, objects, lang) {
        const locations = Object.keys(objects).filter(
            id =>
                objects[id]?.type === 'channel' &&
                new RegExp(`^${instance.replace('.', '\\.')}\\.location_[^.]+$`).test(id),
        );
        const weather: SvWeather[] = [];
        for (const loc of locations) {
            const forecast = days(
                Array.from({ length: MAX_DAYS }, (_, i) => {
                    const d = `${loc}.ForecastDaily.Day_${i + 1}`;
                    return day({
                        offset: i,
                        tempMin: ref(objects, `${d}.Temperature_Min`, 'Tiefstwert'),
                        tempMax: ref(objects, `${d}.Temperature_Max`, 'Höchstwert'),
                        conditionText: ref(objects, `${d}.symbol_description`, 'Wetterlage'),
                        rain: ref(objects, `${d}.Rain`, 'Niederschlag'),
                        rainChance: ref(objects, `${d}.Rain_Probability`, 'Regenwahrscheinlichkeit'),
                        windSpeed: ref(objects, `${d}.Wind_Speed`, 'Wind'),
                    });
                }),
            );
            const hour = objects[`${loc}.ForecastHourly.Current.temperature`]
                ? `${loc}.ForecastHourly.Current`
                : `${loc}.ForecastHourly.Hour_1`;
            const temperature = ref(objects, `${hour}.temperature`, 'Temperatur');
            if (!temperature && !forecast.length) {
                continue;
            }
            weather.push({
                id: loc,
                name: getName(objects[loc], lang)?.replace(/^location_.*/, '') || 'DasWetter',
                adapter: 'daswetter',
                source: 'service',
                temperature,
                humidity: ref(objects, `${hour}.humidity`, 'Luftfeuchte'),
                windSpeed: ref(objects, `${hour}.wind_speed`, 'Wind'),
                pressure: ref(objects, `${hour}.pressure`, 'Luftdruck'),
                conditionText: ref(objects, `${hour}.symbol_description`, 'Wetterlage'),
                forecast,
            });
        }
        return weather.length ? { weather } : null;
    },
};

/**
 * Deutscher Wetterdienst (ioBroker.dwd): amtliche Warnungen, je Platz ein Kanal
 * `warning`, `warning1` … (Region) bzw. `warncell.warning…` (Warnzelle). Keine Vorhersage.
 */
export const dwdProfile: AdapterProfile = {
    adapter: 'dwd',
    claimsInstance: true,
    detect(instance, objects: ObjectMap) {
        const pattern = new RegExp(`^${instance.replace('.', '\\.')}\\.(warncell\\.)?warning\\d*$`);
        const warnings: SvWeatherWarning[] = [];
        for (const id of Object.keys(objects).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
            if (!pattern.test(id) || objects[id]?.type !== 'channel') {
                continue;
            }
            const headline = ref(objects, `${id}.headline`, 'Warnung');
            if (!headline) {
                continue;
            }
            warnings.push({
                id,
                adapter: 'dwd',
                headline,
                level: ref(objects, `${id}.level`, 'Stufe'),
                begin: ref(objects, `${id}.begin`, 'Beginn'),
                end: ref(objects, `${id}.end`, 'Ende'),
                description: ref(objects, `${id}.description`, 'Beschreibung'),
                instruction: ref(objects, `${id}.instruction`, 'Verhalten'),
            });
        }
        return warnings.length ? { warnings } : null;
    },
};
