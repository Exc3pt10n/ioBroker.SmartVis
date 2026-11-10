/**
 * Demo-Server ohne ioBroker: startet die Visualisierung mit Beispielgeräten.
 *   npm run demo   →  http://localhost:8099
 * Nützlich für Frontend-Entwicklung (zusammen mit "npm run dev:www").
 */
import { readFileSync } from 'node:fs';
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

// Philips Hue: Räume kommen aus den Hue-Raumgruppen, nicht aus den Lampennamen
const hueLights: [string, string, string, boolean][] = [
    ['1', 'Stehlampe', 'Stehlampe', true],
    ['2', 'Spots', 'Spots', false],
    ['3', 'Pendelleuchte', 'Pendelleuchte', false],
    ['4', 'Deckenlampe', 'Deckenlampe_Flur', false],
];
for (const [hueId, name, key, on] of hueLights) {
    folder(`hue.0.${key}`, 'channel', name, 'light.dimmer');
    objects[`hue.0.${key}`].native = { id: hueId };
    state(`hue.0.${key}.on`, 'switch.light', 'boolean', true, on);
    state(`hue.0.${key}.level`, 'level.dimmer', 'number', true, on ? 80 : 0, { min: 0, max: 100, unit: '%' });
}
for (const [gid, name, lights] of [
    ['1', 'Wohnzimmer', ['1']],
    ['2', 'Küche', ['2', '3']],
    ['3', 'Flur', ['4']],
] as const) {
    folder(`hue.0.${name}`, 'channel', name, 'Room');
    objects[`hue.0.${name}`].native = { id: gid, type: 'Room', lights };
    state(`hue.0.${name}.on`, 'switch.light', 'boolean', true, false);
    state(`hue.0.${name}.level`, 'level.dimmer', 'number', true, 0, { min: 0, max: 100, unit: '%' });
}

// CCU-Raum, wie ihn hm-rega als Aufzählung anlegt
objects['enum.rooms.Buero'] = {
    _id: 'enum.rooms.Buero',
    type: 'enum',
    common: { name: 'Büro', members: ['hm-rpc.0.MEQ005.1'] },
    native: {},
} as unknown as Obj;

// HmIP-SWO-PL Wetterstation + CCU-Tagesvariablen (reduzierter echter Objektbaum)
const weatherObjs = JSON.parse(
    readFileSync(join(__dirname, '..', 'test', 'fixtures', 'hmip-weather.json'), 'utf8'),
) as Record<string, Obj>;
Object.assign(objects, weatherObjs);
const WS = 'hm-rpc.0.0000000000WS01';
for (const [id, val] of Object.entries({
    [`${WS}.1.ACTUAL_TEMPERATURE`]: 8.4,
    [`${WS}.1.HUMIDITY`]: 82,
    [`${WS}.1.WIND_SPEED`]: 14,
    [`${WS}.1.WIND_THRESHOLD_OVERRUN`]: false,
    [`${WS}.1.RAINING`]: false,
    [`${WS}.1.ILLUMINATION`]: 5400,
    [`${WS}.1.SUNSHINE_THRESHOLD_OVERRUN`]: true,
    [`${WS}.0.UNREACH`]: false,
    [`${WS}.0.LOW_BAT`]: false,
    'hm-rega.0.5755': 2.3,
    'hm-rega.0.5753': 6.1,
    'hm-rega.0.5738': 134,
})) {
    states[id] = { val, ack: true, ts: Date.now() };
}

// KEBA KeContact (reduzierter echter Objektbaum)
const keba = JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', 'kecontact.json'), 'utf8')) as Record<
    string,
    Obj
>;
Object.assign(objects, keba);
for (const [key, val] of Object.entries({
    p: 0,
    state: 2,
    plug: 7,
    ePres: 0,
    'statistics.lastChargeAmount': 18.4,
    'automatic.photovoltaics': true,
    'automatic.pauseWallbox': false,
    'info.connection': true,
})) {
    states[`kecontact.0.${key}`] = { val, ack: true, ts: Date.now() };
}

// QCells Q.HOME+ ESS HYB-G2 (Struktur wie ioBroker.qhome-ess-hyb-g2)
const Q = 'qhome-ess-hyb-g2.0';
for (const [key, unit, val] of [
    ['PvPw', 'kW', 4.2],
    ['ConsPw', 'kW', 1.1],
    ['GridPwPurchaseWb', 'W', 0],
    ['GridPwFeedInWb', 'W', 1300],
    ['BtPwCharge', 'W', 1800],
    ['BtPwDisCharge', 'W', 0],
    ['BtSoc', '%', 64],
    ['BtLast', 'Min', 48],
    ['counters.day.PvGen', 'kWh', 12.4],
    ['counters.day.Cons', 'kWh', 7.9],
    ['counters.day.GridPurchase', 'kWh', 1.2],
    ['counters.day.GridFeedIn', 'kWh', 4.6],
    ['counters.day.BtCharged', 'kWh', 3.1],
    ['counters.day.BtDischarged', 'kWh', 1.4],
    ['counters.day.Autarky', '%', 85],
    ['counters.day.SelfConsRate', '%', 63],
] as const) {
    state(`${Q}.${key}`, key === 'BtSoc' ? 'value.battery' : 'value', 'number', false, val, { unit });
}
state(`${Q}.info.connection`, 'indicator.connected', 'boolean', false, true);

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

/** Simuliert schwankende PV-Leistung und leitet die übrigen Flüsse daraus ab */
function simulateEnergy(): void {
    const set = (key: string, val: number): void => {
        const id = `${Q}.${key}`;
        states[id] = { val: Math.round(val * 100) / 100, ack: true, ts: Date.now() };
        server.queueState(id, states[id]);
    };
    const pv = Math.max(0, 4.2 + Math.sin(Date.now() / 20000) * 2.5 + (Math.random() - 0.5) * 0.3);
    // Wallbox lädt mit PV-Überschuss, sobald genug Sonne da ist
    const carW =
        pv > 3.5 && states['kecontact.0.automatic.pauseWallbox']?.val !== true ? Math.round((pv - 1.8) * 1000) : 0;
    const setKeba = (key: string, val: number): void => {
        const kid = `kecontact.0.${key}`;
        states[kid] = { val, ack: true, ts: Date.now() };
        server.queueState(kid, states[kid]);
    };
    setKeba('p', carW * 1000); // mW
    setKeba('state', carW > 0 ? 3 : 2);
    setKeba('ePres', Number(states['kecontact.0.ePres']?.val || 0) + (carW * 2) / 3600);
    const cons = 0.8 + Math.random() * 0.8 + carW / 1000;
    const surplus = (pv - cons) * 1000;
    const charge = Math.min(Math.max(surplus, 0), 2500);
    const discharge = surplus < 0 ? Math.min(-surplus, 2500) : 0;
    const rest = surplus - charge + discharge;
    set('PvPw', pv);
    set('ConsPw', cons);
    set('BtPwCharge', charge);
    set('BtPwDisCharge', discharge);
    set('GridPwFeedInWb', Math.max(rest, 0));
    set('GridPwPurchaseWb', Math.max(-rest, 0));
}

setInterval(simulateEnergy, 2000);

void server.start().then(() => {
    console.log(
        `Demo: ${result.model.devices.length} Geräte, ${result.model.rooms.length} Räume → http://localhost:${Number(process.env.PORT) || 8099}`,
    );
});
