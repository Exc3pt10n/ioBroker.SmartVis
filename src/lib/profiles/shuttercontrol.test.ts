import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../discovery';

// Echter Objektbaum von shuttercontrol 2.1.2 inkl. Instanz-Konfiguration (ohne Koordinaten)
const objects = JSON.parse(
    readFileSync(join(__dirname, '../../../test/fixtures/shuttercontrol.json'), 'utf8'),
) as Record<string, ioBroker.Object>;

// Level-State des Wohnzimmer-Rollladens (HmIP-Aktor), wie in der Konfiguration referenziert
const LEVEL = 'hm-rpc.0.001658A98F6092.2.LEVEL';
objects[LEVEL] = {
    _id: LEVEL,
    type: 'state',
    common: {
        name: 'LEVEL',
        role: 'level.blind',
        type: 'number',
        unit: '%',
        read: true,
        write: true,
        min: 0,
        max: 100,
    },
    native: {},
} as unknown as ioBroker.Object;

describe('profile: shuttercontrol', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: ['system'] });
    const sc = result.model.shutterControl[0];

    it('detects the instance and all configured shutters', () => {
        expect(result.model.shutterControl).to.have.length(1);
        expect(sc.shutters).to.have.length(13);
    });

    it('maps per-shutter automation states via the sanitized name', () => {
        const guest = sc.shutters.find(s => s.name === 'Gäste WC')!;
        expect(guest.autoSun?.id).to.equal('shuttercontrol.0.shutters.autoSun.Gäste_WC');
        expect(guest.autoState?.id).to.equal('shuttercontrol.0.shutters.autoState.Gäste_WC');
        expect(guest.area).to.equal('living');
    });

    it('links shutters to their level state from the instance config', () => {
        const living = sc.shutters.find(s => s.name === 'Wohnzimmer')!;
        expect(living.level?.id).to.equal(LEVEL);
        expect(living.heightUp).to.equal(100);
        expect(sc.shutters.find(s => s.name === 'Kinderzimmer Vorne')!.area).to.equal('children');
    });

    it('lists only the areas in use with their controls', () => {
        expect(sc.areas.map(a => a.key)).to.deep.equal(['living', 'sleep', 'children']);
        const living = sc.areas[0];
        expect(living.open?.id).to.equal('shuttercontrol.0.control.openLiving');
        expect(living.upTime?.id).to.equal('shuttercontrol.0.info.upTimeLiving');
    });

    it('writes mirrored switches to the configured trigger data points', () => {
        const living = sc.areas[0];
        expect(living.auto?.value.id).to.equal('shuttercontrol.0.control.autoLiving');
        expect(living.auto?.write.id).to.equal('0_userdata.0.Rollladen.autoLiving');
        expect(sc.holiday?.write.id).to.equal('0_userdata.0.Rollladen.Holiday');
        // ohne konfigurierten Trigger-Datenpunkt wird direkt geschrieben
        expect(sc.schoolfree?.write.id).to.equal('shuttercontrol.0.control.schoolfree');
    });

    it('whitelists exactly the controls the app offers', () => {
        expect(result.writableIds.has('shuttercontrol.0.control.closeAll')).to.equal(true);
        expect(result.writableIds.has('0_userdata.0.Rollladen.autoLiving')).to.equal(true);
        expect(result.writableIds.has('shuttercontrol.0.shutters.autoUp.Wohnzimmer')).to.equal(true);
        expect(result.writableIds.has(LEVEL)).to.equal(true);
        expect(result.writableIds.has('shuttercontrol.0.control.autoLiving')).to.equal(false);
        expect(result.writableIds.has('shuttercontrol.0.shutters.currentStates')).to.equal(false);
    });

    it('names unrenamed blind channels after the shuttercontrol shutter', () => {
        const objs: Record<string, ioBroker.Object> = { ...objects };
        const ch = 'hm-rpc.0.001658A98F6092.2';
        objs['hm-rpc.0.001658A98F6092'] = {
            _id: 'hm-rpc.0.001658A98F6092',
            type: 'device',
            common: { name: 'Rollladenaktor Wohn- Essbereich' },
            native: { TYPE: 'HmIPW-DRBL4' },
        } as unknown as ioBroker.Object;
        objs['hm-rpc.0.001658A98F6092.1'] = {
            _id: 'hm-rpc.0.001658A98F6092.1',
            type: 'channel',
            common: { name: 'Rollladenaktor Wohn- Essbereich:1' },
            native: { TYPE: 'BLIND_TRANSMITTER' },
        } as unknown as ioBroker.Object;
        objs[ch] = {
            _id: ch,
            type: 'channel',
            common: { name: 'Rollladenaktor Wohn- Essbereich:2' },
            native: { TYPE: 'BLIND_VIRTUAL_RECEIVER' },
        } as unknown as ioBroker.Object;
        const r = discover(objs, { language: 'de', ignoreAdapters: ['system'] });
        const tile = r.model.devices.find(d => d.id === ch)!;
        expect(tile.type).to.equal('blind');
        // "Wohnzimmer" ist Raum- und Rollladenname → Name bleibt erhalten statt "Rollladenaktor …"
        expect(tile.name).to.equal('Wohnzimmer');
        expect(tile.roomId).to.equal('auto.wohnzimmer');
    });

    it('claims the instance (no generic switch tiles)', () => {
        expect(result.model.devices.filter(d => d.adapter === 'shuttercontrol')).to.have.length(0);
    });
});
