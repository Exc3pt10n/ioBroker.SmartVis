import { Tree } from './build';

/** ioBroker.openweathermap, nach io-package.json (instanceObjects) und src/main.ts */
export function openweathermapTree(): Tree {
    const t = new Tree().instance('openweathermap.0');
    t.device('openweathermap.0.forecast', 'Actual weather or forecast', {}, { role: 'weather' });
    const cur = 'openweathermap.0.forecast.current';
    t.channel(cur, 'Actual weather for today', {}, { role: 'weather.current' })
        .state(`${cur}.temperature`, { type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${cur}.humidity`, { type: 'number', role: 'value.humidity', unit: '%' })
        .state(`${cur}.windSpeed`, { type: 'number', role: 'value.speed.wind', unit: 'm/s' })
        .state(`${cur}.windDirection`, { type: 'number', role: 'value.direction.wind', unit: '°' })
        .state(`${cur}.pressure`, { type: 'number', role: 'value.pressure', unit: 'hPa' })
        .state(`${cur}.precipitation`, { type: 'number', role: 'weather.precipitation', unit: 'mm' })
        .state(`${cur}.icon`, { type: 'string', role: 'weather.icon' })
        .state(`${cur}.state`, { type: 'string', role: 'weather.state' })
        .state(`${cur}.title`, { type: 'string', role: 'weather.title' });
    for (let i = 0; i < 5; i++) {
        const d = `openweathermap.0.forecast.day${i}`;
        t.channel(d, 'Actual weather or forecast', {}, { role: 'weather.forecast' })
            .state(`${d}.temperatureMin`, { type: 'number', role: `value.temperature.min.forecast.${i}`, unit: '°C' })
            .state(`${d}.temperatureMax`, { type: 'number', role: `value.temperature.max.forecast.${i}`, unit: '°C' })
            .state(`${d}.icon`, { type: 'string', role: `weather.icon.forecast.${i}` })
            .state(`${d}.title`, { type: 'string', role: `weather.title.forecast.${i}` })
            .state(`${d}.precipitation`, { type: 'number', role: `weather.precipitation.forecast.${i}`, unit: 'mm' })
            .state(`${d}.windSpeed`, { type: 'number', role: `value.speed.wind.forecast.${i}`, unit: 'm/s' });
    }
    return t;
}

/** ioBroker.weatherunderground, nach main.js (createObjects …): Werte metrisch */
export function weatherundergroundTree(): Tree {
    const t = new Tree().instance('weatherunderground.0');
    t.device('weatherunderground.0.forecast', 'forecast', {}, { role: 'forecast' });
    const cur = 'weatherunderground.0.forecast.current';
    t.channel(cur, 'current', {}, { role: 'weather' })
        .state(`${cur}.temp`, { type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${cur}.relativeHumidity`, { type: 'number', role: 'value.humidity', unit: '%' })
        .state(`${cur}.wind`, { type: 'number', role: 'value.speed.wind', unit: 'km/h' })
        .state(`${cur}.windDegrees`, { type: 'number', role: 'value.direction.wind', unit: '°' })
        .state(`${cur}.pressure`, { type: 'number', role: 'value.pressure', unit: 'mbar' })
        .state(`${cur}.precipitationDay`, { type: 'number', role: 'value.precipitation.today', unit: 'mm' })
        .state(`${cur}.weather`, { type: 'string', role: 'weather.state' })
        .state(`${cur}.iconURL`, { type: 'string', role: 'weather.icon' });
    for (let i = 0; i < 5; i++) {
        const d = `weatherunderground.0.forecast.${i}d`;
        t.channel(d, `in ${i} days`, {}, { role: `weather.forecast.${i}` })
            .state(`${d}.tempMin`, { type: 'number', role: `value.temperature.min.forecast.${i}`, unit: '°C' })
            .state(`${d}.tempMax`, { type: 'number', role: `value.temperature.max.forecast.${i}`, unit: '°C' })
            .state(`${d}.icon`, { type: 'number', role: 'value' })
            .state(`${d}.state`, { type: 'string', role: `weather.state.forecast.${i}` })
            .state(`${d}.stateShort`, { type: 'string', role: `weather.state.forecast.${i}` })
            .state(`${d}.precipitationChance`, { type: 'number', role: `value.precipitation.forecast.${i}`, unit: '%' })
            .state(`${d}.precipitationAllDay`, {
                type: 'number',
                role: `value.precipitation.forecast.${i}`,
                unit: 'mm',
            })
            .state(`${d}.windSpeed`, { type: 'number', role: `value.speed.wind.forecast.${i}`, unit: 'km/h' });
    }
    return t;
}

/** ioBroker.daswetter 4.x (Meteored), nach src/lib/meteored.ts (CreateObjects) */
export function daswetterTree(): Tree {
    const t = new Tree().instance('daswetter.0');
    const loc = 'daswetter.0.location_1';
    t.channel(loc, 'location_1', { id: loc }, { role: 'location' })
        .state(`${loc}.Location`, { type: 'string', role: 'location' })
        .channel(`${loc}.ForecastDaily`, 'ForecastDaily');
    for (let d = 1; d <= 5; d++) {
        const f = d - 1;
        const k = `${loc}.ForecastDaily.Day_${d}`;
        t.channel(k, `Day_${d}`)
            .state(`${k}.symbol`, { type: 'number', role: 'value' })
            .state(`${k}.symbol_description`, { type: 'string', role: `weather.state.forecast.${f}` })
            .state(`${k}.Temperature_Min`, { type: 'number', role: `value.temperature.min.forecast.${f}`, unit: '°C' })
            .state(`${k}.Temperature_Max`, { type: 'number', role: `value.temperature.max.forecast.${f}`, unit: '°C' })
            .state(`${k}.Wind_Speed`, { type: 'number', role: `value.speed.wind.forecast.${f}`, unit: 'km/h' })
            .state(`${k}.Rain`, { type: 'number', role: `value.precipitation.forecast.${f}`, unit: 'mm' })
            .state(`${k}.Rain_Probability`, { type: 'number', role: `value.precipitation.forecast.${f}`, unit: '%' });
    }
    const cur = `${loc}.ForecastHourly.Current`;
    t.channel(`${loc}.ForecastHourly`, 'ForecastHourly')
        .channel(cur, 'Current')
        .state(`${cur}.temperature`, { type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${cur}.humidity`, { type: 'number', role: 'value.humidity', unit: '%' })
        .state(`${cur}.wind_speed`, { type: 'number', role: 'value.speed.wind', unit: 'km/h' })
        .state(`${cur}.pressure`, { type: 'number', role: 'value.pressure', unit: 'hPa' })
        .state(`${cur}.symbol_description`, { type: 'string', role: 'text' })
        .state(`${cur}.rain`, { type: 'number', role: 'value.precipitation', unit: 'mm' });
    return t;
}

/** ioBroker.dwd, nach io-package.json (instanceObjects) und src/main.ts: Plätze warning, warning1 … */
export function dwdTree(): Tree {
    const t = new Tree().instance('dwd.0');
    t.state('dwd.0.numberOfWarnings', { type: 'number', role: 'value' });
    for (const ch of ['dwd.0.warning', 'dwd.0.warning1', 'dwd.0.warning2']) {
        t.channel(ch, 'DWD Warnung', {}, { role: 'forecast' })
            .state(`${ch}.begin`, { type: 'number', role: 'value.time' })
            .state(`${ch}.end`, { type: 'number', role: 'value.time' })
            .state(`${ch}.severity`, { type: 'number', role: 'value.severity' })
            .state(`${ch}.level`, { type: 'number', role: 'value.warning' })
            .state(`${ch}.type`, { type: 'number', role: 'weather.type' })
            .state(`${ch}.text`, { type: 'string', role: 'weather.title.short' })
            .state(`${ch}.headline`, { type: 'string', role: 'weather.title' })
            .state(`${ch}.description`, { type: 'string', role: 'weather.state' })
            .state(`${ch}.instruction`, { type: 'string', role: 'weather.state' });
    }
    t.channel('dwd.0.info', 'Information').state('dwd.0.info.lastUpdate', { type: 'number', role: 'value.time' });
    return t;
}
