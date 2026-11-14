import { expect } from 'chai';
import { discover } from './discovery';

type Obj = ioBroker.Object;

function obj(
    id: string,
    type: string,
    common: Record<string, unknown>,
    native: Record<string, unknown> = {},
): [string, Obj] {
    return [id, { _id: id, type, common, native } as unknown as Obj];
}

const objects: Record<string, Obj> = Object.fromEntries([
    // Raum aus enum.rooms mit einem Homematic-Dimmer (Kachel)
    obj('enum.rooms.kitchen', 'enum', { name: 'Küche', members: ['hm-rpc.0.DIM1.4'] }),
    obj('hm-rpc.0.DIM1', 'device', { name: 'Küche Deckenlicht' }, { TYPE: 'HmIP-BDT' }),
    obj('hm-rpc.0.DIM1.4', 'channel', { name: 'Küche Deckenlicht:4' }, { TYPE: 'DIMMER_VIRTUAL_RECEIVER' }),
    obj('hm-rpc.0.DIM1.4.LEVEL', 'state', {
        name: 'LEVEL',
        role: 'level.dimmer',
        type: 'number',
        read: true,
        write: true,
        min: 0,
        max: 100,
    }),
    // Fensterkontakt ohne Kachel: "Batterie schwach" im Wartungskanal, Raum aus dem Namen
    obj('hm-rpc.0.WIN1', 'device', { name: 'Fensterkontakt Küche' }, { TYPE: 'HmIP-SWDO' }),
    obj('hm-rpc.0.WIN1.0', 'channel', { name: 'Fensterkontakt Küche:0' }, { TYPE: 'MAINTENANCE' }),
    obj('hm-rpc.0.WIN1.0.LOW_BAT', 'state', {
        name: 'LOW_BAT',
        role: 'indicator.lowbat',
        type: 'boolean',
        read: true,
        write: false,
    }),
    // Hue-Bewegungsmelder (API v1): Bewegungs- und Temperaturteil melden dieselbe Batterie
    obj(
        'hue.0.Bewegungsmelder_Küche',
        'channel',
        { name: 'Bewegungsmelder Küche', role: 'ZLLPresence' },
        { type: 'ZLLPresence', modelid: 'SML001' },
    ),
    obj('hue.0.Bewegungsmelder_Küche.battery', 'state', {
        name: 'battery',
        role: 'value.battery',
        type: 'number',
        unit: '%',
        read: true,
        write: false,
    }),
    obj(
        'hue.0.Hue_temperature_sensor_1',
        'channel',
        { name: 'Hue temperature sensor 1', role: 'ZLLTemperature' },
        { type: 'ZLLTemperature', modelid: 'SML001' },
    ),
    obj('hue.0.Hue_temperature_sensor_1.battery', 'state', {
        name: 'battery',
        role: 'value.battery',
        type: 'number',
        unit: '%',
        read: true,
        write: false,
    }),
    // Hausspeicher und Auto: kein Gerätebatterie
    obj('qhome-ess-hyb-g2.0.Battery.SOC', 'state', {
        name: 'SOC',
        role: 'value.battery',
        type: 'number',
        unit: '%',
        read: true,
        write: false,
    }),
    obj('bmw.0.car.battery', 'state', {
        name: 'battery',
        role: 'value.battery',
        type: 'number',
        unit: '%',
        read: true,
        write: false,
    }),
]);

describe('batteries', () => {
    const { model, stateIds } = discover(objects, { language: 'de', ignoreAdapters: [] });
    const byId = Object.fromEntries((model.batteries || []).map(b => [b.id, b]));
    const kitchen = model.rooms.find(r => r.name === 'Küche')!;

    it('collects battery devices with level or low indicator, also without a tile', () => {
        expect(Object.keys(byId)).to.have.members(['hm-rpc.0.WIN1', 'hue.0.Bewegungsmelder_Küche']);
        expect(byId['hm-rpc.0.WIN1'].low?.id).to.equal('hm-rpc.0.WIN1.0.LOW_BAT');
        expect(byId['hue.0.Bewegungsmelder_Küche'].level?.id).to.equal('hue.0.Bewegungsmelder_Küche.battery');
        expect(stateIds).to.include.members(['hm-rpc.0.WIN1.0.LOW_BAT', 'hue.0.Bewegungsmelder_Küche.battery']);
    });

    it('takes the room from the name of known rooms and shortens the name', () => {
        expect(byId['hm-rpc.0.WIN1'].roomId).to.equal(kitchen.id);
        expect(byId['hm-rpc.0.WIN1'].name).to.equal('Fensterkontakt');
        expect(byId['hue.0.Bewegungsmelder_Küche'].roomId).to.equal(kitchen.id);
    });

    it('skips parts of Hue motion sensors, house batteries and cars', () => {
        expect(byId['hue.0.Hue_temperature_sensor_1']).to.equal(undefined);
        expect((model.batteries || []).some(b => b.adapter === 'qhome-ess-hyb-g2' || b.adapter === 'bmw')).to.equal(
            false,
        );
    });
});
