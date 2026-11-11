import { expect } from 'chai';
import { discover } from '../discovery';

type Obj = ioBroker.Object;

function channel(id: string, name: string, role: string, native: Record<string, unknown>): [string, Obj] {
    return [id, { _id: id, type: 'channel', common: { name, role }, native } as unknown as Obj];
}
function state(id: string, role: string, type: ioBroker.CommonType): [string, Obj] {
    return [
        id,
        {
            _id: id,
            type: 'state',
            common: { name: id, role, type, read: true, write: true },
            native: {},
        } as unknown as Obj,
    ];
}
function light(id: string, name: string, hueId: string): [string, Obj][] {
    return [
        channel(id, name, 'light.dimmer', { id: hueId }),
        state(`${id}.on`, 'switch.light', 'boolean'),
        state(`${id}.level`, 'level.dimmer', 'number'),
    ];
}

const objects = Object.fromEntries([
    ...light('hue.0.Spot_1', 'Spot 1', '1'),
    ...light('hue.0.Spot_2', 'Spot 2', '2'),
    ...light('hue.0.Leselampe', 'Leselampe', '3'),
    // Hue-Raum mit Lampe 1 + 2, Zone mit Lampe 2 + 3
    channel('hue.0.Küche', 'Küche', 'Room', { id: '5', type: 'Room', lights: ['1', '2'] }),
    state('hue.0.Küche.on', 'switch.light', 'boolean'),
    state('hue.0.Küche.level', 'level.dimmer', 'number'),
    channel('hue.0.Abends', 'Abends', 'Zone', { id: '6', type: 'Zone', lights: ['2', '3'] }),
    channel('hue.0.TV', 'TV', 'Entertainment', { id: '7', type: 'Entertainment', lights: ['3'] }),
    state('hue.0.TV.on', 'switch.light', 'boolean'),
    // Raum aus der CCU (hm-rega) mit gleichem Namen
    [
        'enum.rooms.kitchen',
        {
            _id: 'enum.rooms.kitchen',
            type: 'enum',
            common: { name: 'Küche', members: [] },
            native: {},
        } as unknown as Obj,
    ],
]);

describe('hue rooms', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const byId = Object.fromEntries(result.model.devices.map(d => [d.id, d]));

    it('assigns lights of a Hue room and merges with an enum room of the same name', () => {
        expect(byId['hue.0.Spot_1'].roomId).to.equal('enum.rooms.kitchen');
        expect(byId['hue.0.Spot_1'].roomSource).to.equal('adapter');
        expect(byId['hue.0.Spot_2'].roomId).to.equal('enum.rooms.kitchen');
        expect(result.model.rooms.filter(r => r.name === 'Küche')).to.have.length(1);
    });

    it('does not use zones as rooms', () => {
        expect(byId['hue.0.Leselampe'].roomId).to.equal(null);
    });

    it('shows the room group as "Alle Lichter"', () => {
        expect(byId['hue.0.Küche'].name).to.equal('Alle Lichter');
        expect(byId['hue.0.Küche'].roomId).to.equal('enum.rooms.kitchen');
    });

    it('skips entertainment areas', () => {
        expect(byId['hue.0.TV']).to.equal(undefined);
    });
});
