/**
 * Demo-Server ohne ioBroker: startet die Visualisierung mit Beispielgeräten.
 *   npm run demo   →  http://localhost:8099
 * Nützlich für Frontend-Entwicklung (zusammen mit "npm run dev:www").
 */
import { join } from 'node:path';
import { discover } from '../src/lib/discovery';
import { SmartVisServer } from '../src/lib/server';
import type { SvStateValue } from '../src/shared/protocol';

type Obj = ioBroker.Object;
const objects: Record<string, Obj> = {};
const states: Record<string, SvStateValue | null> = {};

function folder(id: string, type: 'device' | 'channel', name: string, role?: string): void {
    objects[id] = { _id: id, type, common: { name, role }, native: {} };
}
function state(
    id: string,
    role: string,
    type: ioBroker.CommonType,
    write: boolean,
    val: SvStateValue['val'],
    extra = {},
): void {
    objects[id] = {
        _id: id,
        type: 'state',
        common: { name: id.split('.').pop()!, role, type, read: true, write, ...extra },
        native: {},
    } as unknown as Obj;
    states[id] = { val, ack: true, ts: Date.now() };
}

// Homematic
folder('hm-rpc.0.MEQ001', 'device', 'Wohnzimmer Deckenlicht');
folder('hm-rpc.0.MEQ001.0', 'channel', 'Wohnzimmer Deckenlicht:0');
state('hm-rpc.0.MEQ001.0.UNREACH', 'indicator.unreach', 'boolean', false, false);
folder('hm-rpc.0.MEQ001.1', 'channel', 'Wohnzimmer Deckenlicht:1', 'light.dimmer');
state('hm-rpc.0.MEQ001.1.LEVEL', 'level.dimmer', 'number', true, 60, { min: 0, max: 100, unit: '%' });
folder('hm-rpc.0.MEQ002', 'device', 'Küche Fenster');
folder('hm-rpc.0.MEQ002.1', 'channel', 'Küche Fenster:1', 'sensor.window');
state('hm-rpc.0.MEQ002.1.STATE', 'sensor.window', 'boolean', false, true);
folder('hm-rpc.0.MEQ003', 'device', 'Schlafzimmer Thermostat');
folder('hm-rpc.0.MEQ003.1', 'channel', 'Schlafzimmer Thermostat:1', 'thermostat');
state('hm-rpc.0.MEQ003.1.SET_POINT_TEMPERATURE', 'level.temperature', 'number', true, 20.5, {
    unit: '°C',
    min: 5,
    max: 30,
});
state('hm-rpc.0.MEQ003.1.ACTUAL_TEMPERATURE', 'value.temperature', 'number', false, 19.8, { unit: '°C' });
folder('hm-rpc.0.MEQ004', 'device', 'Rollladen Büro');
folder('hm-rpc.0.MEQ004.1', 'channel', 'Rollladen Büro:1', 'blind');
state('hm-rpc.0.MEQ004.1.LEVEL', 'level.blind', 'number', true, 100, { min: 0, max: 100, unit: '%' });
folder('hm-rpc.0.MEQ005', 'device', 'Steckdose Kaffeemaschine');
folder('hm-rpc.0.MEQ005.1', 'channel', 'Steckdose Kaffeemaschine:1', 'switch');
state('hm-rpc.0.MEQ005.1.STATE', 'switch', 'boolean', true, false);

// Philips Hue
for (const [key, name, on] of [
    ['Wohnzimmer_Stehlampe', 'Wohnzimmer Stehlampe', true],
    ['Kueche_Spots', 'Küche Spots', false],
    ['Flur_Decke', 'Flur Decke', false],
] as const) {
    folder(`hue.0.${key}`, 'channel', name, 'light.color');
    state(`hue.0.${key}.on`, 'switch.light', 'boolean', true, on);
    state(`hue.0.${key}.level`, 'level.dimmer', 'number', true, on ? 80 : 0, { min: 0, max: 100, unit: '%' });
}

const result = discover(objects, { language: 'de', ignoreAdapters: [] });
const server = new SmartVisServer(
    { port: Number(process.env.PORT) || 8099, bind: '0.0.0.0', wwwDir: join(__dirname, '..', 'www'), version: 'demo' },
    {
        getModel: () => result.model,
        getStates: () => states,
        setState: (id, val) => {
            if (!result.writableIds.has(id)) {
                throw new Error(`State ${id} ist nicht freigegeben`);
            }
            // Gerät "bestätigt" nach kurzer Verzögerung
            setTimeout(() => {
                states[id] = { val, ack: true, ts: Date.now() };
                server.queueState(id, states[id]);
            }, 300);
            return Promise.resolve();
        },
        log: console as unknown as ioBroker.Logger,
    },
);

void server.start().then(() => {
    console.log(
        `Demo: ${result.model.devices.length} Geräte, ${result.model.rooms.length} Räume → http://localhost:${Number(process.env.PORT) || 8099}`,
    );
});
