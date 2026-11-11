import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../discovery';

// Auszug aus einem echten Objektbaum: HmIP-SWO-PL + CCU-Systemvariablen (Seriennummer anonymisiert)
const objects = JSON.parse(readFileSync(join(__dirname, '../../../test/fixtures/hmip-weather.json'), 'utf8')) as Record<
    string,
    ioBroker.Object
>;
const DEV = 'hm-rpc.0.0000000000WS01';

describe('profile: Homematic weather station', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const weather = result.model.weather[0];

    it('detects the weather station', () => {
        expect(result.model.weather).to.have.length(1);
        expect(weather.id).to.equal(DEV);
        expect(weather.model).to.equal('HmIP-SWO-PL');
    });

    it('maps the live values of channel 1', () => {
        expect(weather.temperature?.id).to.equal(`${DEV}.1.ACTUAL_TEMPERATURE`);
        expect(weather.humidity?.id).to.equal(`${DEV}.1.HUMIDITY`);
        expect(weather.windSpeed?.unit).to.equal('km/h');
        expect(weather.raining?.id).to.equal(`${DEV}.1.RAINING`);
        expect(weather.sunshine?.id).to.equal(`${DEV}.1.SUNSHINE_THRESHOLD_OVERRUN`);
        expect(weather.windDirection).to.equal(undefined); // PL hat keine Windfahne
    });

    it('links the daily CCU system variables via iseId and serial', () => {
        expect(weather.rainToday?.id).to.equal('hm-rega.0.5755');
        expect(weather.rainToday?.unit).to.equal('mm');
        expect(weather.rainYesterday?.id).to.equal('hm-rega.0.5753');
        expect(weather.sunshineToday?.id).to.equal('hm-rega.0.5738');
    });

    it('subscribes read-only', () => {
        expect(result.stateIds).to.include('hm-rega.0.5755');
        expect(result.writableIds.has('hm-rega.0.5755')).to.equal(false);
    });

    it('attaches the HmIP-SLO light sensors in compass order', () => {
        const sensors = weather.lightSensors || [];
        expect(sensors.map(l => l.name)).to.deep.equal(['Osten', 'Süden', 'Westen']);
        expect(sensors[0].current?.id).to.equal('hm-rpc.0.0000000000SLO1.1.CURRENT_ILLUMINATION');
        expect(sensors[0].current?.unit).to.equal('Lux');
        expect(sensors[0].average?.id).to.equal('hm-rpc.0.0000000000SLO1.1.AVERAGE_ILLUMINATION');
        expect(result.stateIds).to.include('hm-rpc.0.0000000000SLO3.1.CURRENT_ILLUMINATION');
    });

    it('maps maintenance indicators', () => {
        expect(weather.unreach?.id).to.equal(`${DEV}.0.UNREACH`);
    });
});
