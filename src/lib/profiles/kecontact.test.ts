import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../discovery';

// Reduzierter Auszug aus einem echten kecontact-Objektbaum (KC-P30, ohne Werte)
const objects = JSON.parse(readFileSync(join(__dirname, '../../../test/fixtures/kecontact.json'), 'utf8')) as Record<
    string,
    ioBroker.Object
>;

describe('profile: kecontact', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const wallbox = result.model.wallboxes[0];

    it('detects the wallbox', () => {
        expect(result.model.wallboxes).to.have.length(1);
        expect(wallbox.id).to.equal('kecontact.0');
    });

    it('maps power, status and plug', () => {
        expect(wallbox.power?.id).to.equal('kecontact.0.p');
        expect(wallbox.power?.unit).to.equal('mW');
        expect(wallbox.statusMap?.['3']).to.equal('charging');
        expect(wallbox.vehiclePluggedValues).to.include(7);
        // Deutschland-Edition ohne Energiezähler: keine Sitzungs-/Statistikwerte
        expect(wallbox).to.not.have.property('sessionEnergy');
    });

    it('maps charging limit, phases and PV surplus (read-only)', () => {
        expect(wallbox.current?.id).to.equal('kecontact.0.currentUser');
        expect(wallbox.current?.unit).to.equal('mA');
        expect(wallbox.current?.write).to.equal(false);
        expect(wallbox.currentMax?.id).to.equal('kecontact.0.currentHardware');
        expect(wallbox.phases?.id).to.equal('kecontact.0.statistics.chargingPhases');
        expect(wallbox.configuredPhases?.id).to.equal('kecontact.0.automatic.calcPhases');
        expect(wallbox.surplus?.id).to.equal('kecontact.0.statistics.surplus');
        expect(wallbox.surplus?.unit).to.equal('W');
        expect(result.stateIds).to.include.members(['kecontact.0.currentUser', 'kecontact.0.statistics.surplus']);
    });

    it('only whitelists the switches the app offers', () => {
        expect([...result.writableIds].sort()).to.deep.equal([
            'kecontact.0.automatic.pauseWallbox',
            'kecontact.0.automatic.photovoltaics',
        ]);
    });

    it('claims the instance so no random tiles appear', () => {
        expect(result.model.devices).to.have.length(0);
    });
});
