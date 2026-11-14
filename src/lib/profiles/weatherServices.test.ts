import { expect } from 'chai';
import { discover } from '../discovery';
import { Tree } from '../fixtures/build';
import { daswetterTree, dwdTree, openweathermapTree, weatherundergroundTree } from '../fixtures/weather';

function run(...trees: Tree[]): ReturnType<typeof discover> {
    const objects = Object.assign({}, ...trees.map(t => t.objects)) as Record<string, ioBroker.Object>;
    return discover(objects, { language: 'de', ignoreAdapters: [] });
}

describe('Wetterdienste', () => {
    it('OpenWeatherMap: aktuelles Wetter, Symbol-Code und fünf Vorhersagetage, keine Kacheln', () => {
        const r = run(openweathermapTree());
        const w = r.model.weather[0];
        expect(w).to.include({ id: 'openweathermap.0', source: 'service', codeScheme: 'owm' });
        expect(w.temperature?.id).to.equal('openweathermap.0.forecast.current.temperature');
        expect(w.windSpeed?.unit).to.equal('m/s');
        expect(w.forecast?.map(d => d.offset)).to.deep.equal([0, 1, 2, 3, 4]);
        expect(w.forecast?.[1].tempMax?.id).to.equal('openweathermap.0.forecast.day1.temperatureMax');
        expect(r.model.devices).to.have.length(0);
        expect(r.stateIds).to.include('openweathermap.0.forecast.day4.icon');
    });

    it('Weather Underground: Weather-Company-Codes, Regenwahrscheinlichkeit', () => {
        const w = run(weatherundergroundTree()).model.weather[0];
        expect(w).to.include({ source: 'service', codeScheme: 'twc' });
        expect(w.forecast?.[0].rainChance?.id).to.equal('weatherunderground.0.forecast.0d.precipitationChance');
        expect(w.forecast?.[0].conditionText?.id).to.equal('weatherunderground.0.forecast.0d.stateShort');
    });

    it('DasWetter: je Ort ein Eintrag, aktuelle Stunde und Tagesvorhersage (Day_1 = heute)', () => {
        const w = run(daswetterTree()).model.weather[0];
        expect(w).to.include({ id: 'daswetter.0.location_1', name: 'DasWetter', source: 'service' });
        expect(w.temperature?.id).to.equal('daswetter.0.location_1.ForecastHourly.Current.temperature');
        expect(w.forecast?.[0].tempMin?.id).to.equal('daswetter.0.location_1.ForecastDaily.Day_1.Temperature_Min');
        expect(w.forecast).to.have.length(5);
    });

    it('DWD: Warnplätze als Wetterwarnungen, ohne Kacheln', () => {
        const r = run(dwdTree());
        expect(r.model.weatherWarnings?.map(w => w.id)).to.deep.equal([
            'dwd.0.warning',
            'dwd.0.warning1',
            'dwd.0.warning2',
        ]);
        expect(r.model.weatherWarnings?.[0].level?.id).to.equal('dwd.0.warning.level');
        expect(r.stateIds).to.include('dwd.0.warning2.headline');
        expect(r.model.devices).to.have.length(0);
    });

    it('stellt eigene Wetterstationen vor die Wetterdienste', () => {
        const station = new Tree().instance('hm-rpc.0');
        station
            .device('hm-rpc.0.0012345', 'Wetterstation', { TYPE: 'HmIP-SWO-PL' })
            .channel('hm-rpc.0.0012345.1', 'Wetterstation:1')
            .state('hm-rpc.0.0012345.1.ACTUAL_TEMPERATURE', { type: 'number', role: 'value.temperature', unit: '°C' });
        const weather = run(openweathermapTree(), station).model.weather;
        expect(weather.map(w => w.source)).to.deep.equal(['station', 'service']);
    });
});
