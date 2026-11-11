import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../discovery';

const objects = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'test', 'fixtures', 'toshiba-ac.json'), 'utf8'),
) as Record<string, ioBroker.Object>;

describe('profile: toshiba-ac', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const devices = result.model.devices;
    const living = devices.find(d => d.id === 'toshiba-ac.0.Wohnzimmer')!;
    const state = (name: string): ReturnType<typeof living.states.find> => living.states.find(s => s.name === name);

    it('erkennt jedes Klimagerät genau einmal (keine Info-Kanäle als Kacheln)', () => {
        expect(devices.map(d => `${d.id}:${d.type}`)).to.deep.equal([
            'toshiba-ac.0.Arbeitszimmer:airCondition',
            'toshiba-ac.0.Schlafzimmer:airCondition',
            'toshiba-ac.0.Wohnzimmer:airCondition',
        ]);
    });

    it('ordnet den Raum über den Gerätenamen zu und nennt das Gerät "Klimaanlage"', () => {
        expect(living.name).to.equal('Klimaanlage');
        expect(result.model.rooms.find(r => r.id === living.roomId)?.name).to.equal('Wohnzimmer');
    });

    it('bildet die States auf Rollen ab, mit Schrittweite und deutschen Wertelisten', () => {
        expect(state('SET')?.id).to.equal('toshiba-ac.0.Wohnzimmer.targetTemperature');
        expect(state('SET')?.step).to.equal(1);
        expect(state('ACTUAL')?.id).to.equal('toshiba-ac.0.Wohnzimmer.indoorTemperature');
        expect(state('POWER')?.write).to.equal(true);
        expect(state('MODE')?.states).to.deep.equal({
            AUTO: 'Automatik',
            COOL: 'Kühlen',
            HEAT: 'Heizen',
            DRY: 'Entfeuchten',
            FAN: 'Lüften',
        });
        // Nur die Lamellen-Stellungen, die das Gerät kennt
        expect(Object.keys(state('SWING')?.states || {})).to.have.length(9);
        const bedroom = devices.find(d => d.id === 'toshiba-ac.0.Schlafzimmer')!;
        expect(Object.keys(bedroom.states.find(s => s.name === 'SWING')?.states || {})).to.deep.equal([
            'OFF',
            'SWING_VERTICAL',
        ]);
        expect(state('ENERGY_YEAR')?.unit).to.equal('Wh');
        expect(state('CONNECTED')?.id).to.equal('toshiba-ac.0.info.connection');
    });

    it('gibt nur die bedienbaren States zum Schreiben frei', () => {
        expect(result.writableIds.has('toshiba-ac.0.Wohnzimmer.mode')).to.equal(true);
        expect(result.writableIds.has('toshiba-ac.0.Wohnzimmer.indoorTemperature')).to.equal(false);
        expect(result.writableIds.has('toshiba-ac.0.info.connection')).to.equal(false);
    });
});
