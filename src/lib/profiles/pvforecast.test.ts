import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../discovery';

// Echter Objektbaum von pvforecast mit zwei Anlagen (Osten, Westen)
const objects = JSON.parse(readFileSync(join(__dirname, '../../../test/fixtures/pvforecast.json'), 'utf8')) as Record<
    string,
    ioBroker.Object
>;

describe('profile: pvforecast', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const pv = result.model.pvForecast[0];

    it('detects the forecast with summary values', () => {
        expect(result.model.pvForecast).to.have.length(1);
        expect(pv.summary.energyToday?.id).to.equal('pvforecast.0.summary.energy.today');
        expect(pv.summary.energyTomorrow?.unit).to.equal('kWh');
        expect(pv.summary.powerNow?.unit).to.equal('kW');
        expect(pv.curve?.id).to.equal('pvforecast.0.summary.JSONData');
    });

    it('lists both plants by name', () => {
        expect(pv.plants.map(p => p.name)).to.deep.equal(['Osten', 'Westen']);
        expect(pv.plants[0].energyToday?.id).to.equal('pvforecast.0.plants.osten.energy.today');
    });

    it('is read-only and creates no tiles', () => {
        expect(result.stateIds).to.include('pvforecast.0.summary.JSONData');
        expect([...result.writableIds].filter(id => id.startsWith('pvforecast'))).to.have.length(0);
        expect(result.model.devices.filter(d => d.adapter === 'pvforecast')).to.have.length(0);
    });
});
