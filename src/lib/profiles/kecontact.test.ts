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

    it('offers the settings of the charging automatics (German labels, units)', () => {
        const keys = (wallbox.settings || []).map(x => x.key);
        expect(keys).to.deep.equal([
            'automatic.1p3pCharging',
            'automatic.addPower',
            'automatic.maxGridPower',
            'automatic.limitCurrent',
            'automatic.limitCurrent1p',
            'automatic.calcPhases',
            'automatic.batteryStorageStrategy',
            'automatic.batterySoCForCharging',
            'automatic.targetSoC',
            'automatic.maxSoC',
            'automatic.resetTargetSoC',
        ]);
        const limit = wallbox.settings!.find(x => x.key === 'automatic.limitCurrent')!;
        expect(limit.unit).to.equal('A');
        expect(limit.scale).to.equal(0.001);
        expect(limit.state.unit).to.equal('mA');
        expect(wallbox.vehicleSoCSource?.id).to.equal('kecontact.0.automatic.stateVehicleSoC');
    });

    it('whitelists switches and settings, but no raw commands or the regulated current', () => {
        const writable = [...result.writableIds];
        expect(writable).to.include.members([
            'kecontact.0.automatic.pauseWallbox',
            'kecontact.0.automatic.photovoltaics',
            'kecontact.0.automatic.limitCurrent',
            'kecontact.0.automatic.targetSoC',
        ]);
        for (const id of [
            'kecontact.0.currentUser',
            'kecontact.0.currentTimer',
            'kecontact.0.unlock',
            'kecontact.0.start',
            'kecontact.0.display',
            'kecontact.0.enableUser',
            'kecontact.0.automatic.stateVehicleSoC',
        ]) {
            expect(writable, id).to.not.include(id);
        }
    });

    it('claims the instance so no random tiles appear', () => {
        expect(result.model.devices).to.have.length(0);
    });
});
