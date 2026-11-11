import { expect } from 'chai';
import { discover } from './discovery';

type Obj = ioBroker.Object;

function state(
    id: string,
    role: string,
    type: ioBroker.CommonType,
    write: boolean,
    extra: Record<string, unknown> = {},
): [string, Obj] {
    return [
        id,
        {
            _id: id,
            type: 'state',
            common: { name: id.split('.').pop()!, role, type, read: true, write, ...extra },
            native: {},
        } as unknown as Obj,
    ];
}

function folder(id: string, type: 'device' | 'channel', name: string, role?: string): [string, Obj] {
    return [id, { _id: id, type, common: { name, role }, native: {} }];
}

const objects: Record<string, Obj> = Object.fromEntries([
    // Homematic Dimmer, Raum nur über den Namen
    folder('hm-rpc.0.ABC123', 'device', 'Wohnzimmer Dimmer'),
    folder('hm-rpc.0.ABC123.1', 'channel', 'Wohnzimmer Dimmer:1', 'light.dimmer'),
    state('hm-rpc.0.ABC123.1.LEVEL', 'level.dimmer', 'number', true, { min: 0, max: 100, unit: '%' }),
    // Hue-Licht, Raum über Enum
    folder('hue.0.Spots', 'channel', 'Spots', 'light.color'),
    state('hue.0.Spots.on', 'switch.light', 'boolean', true),
    state('hue.0.Spots.level', 'level.dimmer', 'number', true, { min: 0, max: 100 }),
    [
        'enum.rooms.kitchen',
        {
            _id: 'enum.rooms.kitchen',
            type: 'enum',
            common: { name: { en: 'Kitchen', de: 'Küche' }, members: ['hue.0.Spots'] },
            native: {},
        } as unknown as Obj,
    ],
    // Ignorierter Adapter
    folder('system.host.x', 'device', 'Host'),
]);

describe('discovery', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: ['system'] });
    const byId = Object.fromEntries(result.model.devices.map(d => [d.id, d]));

    it('detects devices with type-detector', () => {
        expect(byId['hm-rpc.0.ABC123.1']?.type).to.equal('dimmer');
        expect(byId['hue.0.Spots']).to.exist;
    });

    it('assigns rooms from enums', () => {
        expect(byId['hue.0.Spots'].roomId).to.equal('enum.rooms.kitchen');
        expect(byId['hue.0.Spots'].roomSource).to.equal('enum');
    });

    it('assigns rooms from names and cleans the device name', () => {
        const dimmer = byId['hm-rpc.0.ABC123.1'];
        expect(dimmer.roomId).to.equal('auto.wohnzimmer');
        expect(dimmer.roomSource).to.equal('name');
        expect(dimmer.name).to.equal('Dimmer');
        expect(result.model.rooms.map(r => r.name)).to.include.members(['Küche', 'Wohnzimmer']);
    });

    it('collects state ids and a write whitelist', () => {
        expect(result.stateIds).to.include('hm-rpc.0.ABC123.1.LEVEL');
        expect(result.writableIds.has('hue.0.Spots.on')).to.equal(true);
    });

    it('ignores configured adapters', () => {
        expect(result.model.devices.some(d => d.adapter === 'system')).to.equal(false);
    });
});
