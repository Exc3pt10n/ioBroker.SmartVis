import { expect } from 'chai';
import { discover } from '../discovery';

type Obj = ioBroker.Object;
const o = (
    id: string,
    type: string,
    common: Record<string, unknown>,
    native: Record<string, unknown> = {},
): [string, Obj] => [id, { _id: id, type, common, native } as unknown as Obj];
const st = (
    id: string,
    role: string,
    type: string,
    write: boolean,
    extra: Record<string, unknown> = {},
): [string, Obj] => o(id, 'state', { name: id.split('.').pop(), role, type, read: true, write, ...extra });

// HmIPW-DRBL4: je Ausgang BLIND_TRANSMITTER + 3× BLIND_VIRTUAL_RECEIVER, Kanäle nicht umbenannt
const blindActor: [string, Obj][] = [
    o('hm-rpc.0.DRBL', 'device', { name: 'Rollladenaktor Küche' }, { TYPE: 'HmIPW-DRBL4' }),
];
blindActor.push(o('hm-rpc.0.DRBL.0', 'channel', { name: 'Rollladenaktor Küche:0' }, { TYPE: 'MAINTENANCE' }));
blindActor.push(st('hm-rpc.0.DRBL.0.UNREACH', 'indicator.unreach', 'boolean', false));
blindActor.push(st('hm-rpc.0.DRBL.0.OPERATING_VOLTAGE', 'value.voltage', 'number', false, { unit: 'V' }));
for (const out of [0, 1]) {
    const base = out * 4 + 1;
    blindActor.push(
        o(`hm-rpc.0.DRBL.${base}`, 'channel', { name: `Rollladenaktor Küche:${base}` }, { TYPE: 'BLIND_TRANSMITTER' }),
    );
    blindActor.push(st(`hm-rpc.0.DRBL.${base}.LEVEL`, 'level.blind', 'number', false, { unit: '%' }));
    for (let v = 1; v <= 3; v++) {
        const ch = base + v;
        blindActor.push(
            o(
                `hm-rpc.0.DRBL.${ch}`,
                'channel',
                { name: `Rollladenaktor Küche:${ch}` },
                { TYPE: 'BLIND_VIRTUAL_RECEIVER' },
            ),
        );
        blindActor.push(
            st(`hm-rpc.0.DRBL.${ch}.LEVEL`, 'level.blind', 'number', true, { unit: '%', min: 0, max: 100 }),
        );
    }
}

// HmIP-WTH-2: Thermostat-Kanal mit Fensterstatus, dazu Tasten
const thermostat: [string, Obj][] = [
    o('hm-rpc.0.WTH', 'device', { name: 'Wandthermostat' }, { TYPE: 'HmIP-WTH-2' }),
    o('hm-rpc.0.WTH.1', 'channel', { name: 'Wandthermostat:1' }, { TYPE: 'HEATING_CLIMATECONTROL_TRANSCEIVER' }),
    st('hm-rpc.0.WTH.1.SET_POINT_TEMPERATURE', 'level.temperature', 'number', true, { unit: '°C' }),
    st('hm-rpc.0.WTH.1.ACTUAL_TEMPERATURE', 'value.temperature', 'number', false, { unit: '°C' }),
    st('hm-rpc.0.WTH.1.WINDOW_STATE', 'sensor.window', 'number', false),
    o('hm-rpc.0.WTH.2', 'channel', { name: 'Wandthermostat:2' }, { TYPE: 'KEY_TRANSCEIVER' }),
    st('hm-rpc.0.WTH.2.PRESS_SHORT', 'button', 'boolean', true),
];

// Hue: Lampe in aktueller Struktur, veraltete Kopie in alter Struktur, Raum mit einer Lampe
const hue: [string, Obj][] = [
    o('hue.0.Spot', 'channel', { name: 'Spot', role: 'light.dimmer' }, { id: '1' }),
    st('hue.0.Spot.on', 'switch.light', 'boolean', true),
    st('hue.0.Spot.level', 'level.dimmer', 'number', true),
    o('hue.0.Lampe2', 'channel', { name: 'Lampe 2', role: 'light.dimmer' }, { id: '2' }),
    st('hue.0.Lampe2.on', 'switch.light', 'boolean', true),
    o('hue.0.Licht_Flur', 'channel', { name: 'Licht Flur', role: 'Room' }, { name: 'Licht Flur', lights: ['1'] }),
    st('hue.0.Licht_Flur.on', 'switch.light', 'boolean', true),
    o('hue.0.Bridge.Alt', 'channel', { name: 'Alt', role: 'light.dimmer' }, { id: '1' }),
    st('hue.0.Bridge.Alt.on', 'switch.light', 'boolean', true),
    o('hue.0.Bewegungsmelder', 'channel', { name: 'Bewegungsmelder', role: 'ZLLPresence' }, { id: '7' }),
    st('hue.0.Bewegungsmelder.on', 'switch', 'boolean', true),
];

const objects = Object.fromEntries([...blindActor, ...thermostat, ...hue]);

describe('candidate rules', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const ids = result.model.devices.map(d => d.id).sort();
    const byId = Object.fromEntries(result.model.devices.map(d => [d.id, d]));

    it('HmIP actors: only the first virtual receiver per output', () => {
        expect(ids.filter(i => i.startsWith('hm-rpc.0.DRBL'))).to.deep.equal(['hm-rpc.0.DRBL.2', 'hm-rpc.0.DRBL.6']);
    });

    it('HmIP actors: unrenamed channels get numbered type names', () => {
        expect([byId['hm-rpc.0.DRBL.2'].name, byId['hm-rpc.0.DRBL.6'].name].sort()).to.deep.equal([
            'Rollladen',
            'Rollladen 2',
        ]);
    });

    it('thermostats do not create an extra window tile and keys are skipped', () => {
        expect(ids.filter(i => i.startsWith('hm-rpc.0.WTH'))).to.deep.equal(['hm-rpc.0.WTH.1']);
        expect(byId['hm-rpc.0.WTH.1'].type).to.equal('thermostat');
        expect(byId['hm-rpc.0.WTH.1'].name).to.equal('Wandthermostat');
    });

    it('Hue: maps "Licht Flur" to room Flur, skips single-light rooms, stale objects and sensors', () => {
        expect(byId['hue.0.Spot'].roomId).to.equal('auto.flur');
        expect(ids).to.not.include('hue.0.Licht_Flur');
        expect(ids).to.not.include('hue.0.Bridge.Alt');
        expect(ids).to.not.include('hue.0.Bewegungsmelder');
    });
});
