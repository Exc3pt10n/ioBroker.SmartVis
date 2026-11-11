/**
 * Demo-Server ohne ioBroker: startet die Visualisierung mit Beispielgeräten.
 *   npm run demo   →  http://localhost:8099
 * Nützlich für Frontend-Entwicklung (zusammen mit "npm run dev:www").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discover } from '../src/lib/discovery';
import { applyEdit, applyOverrides, emptyOverrides } from '../src/lib/overrides';
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
    'hm-rpc.0.0000000000SLO1.1.CURRENT_ILLUMINATION': 18400,
    'hm-rpc.0.0000000000SLO1.1.AVERAGE_ILLUMINATION': 17900,
    'hm-rpc.0.0000000000SLO2.1.CURRENT_ILLUMINATION': 42300,
    'hm-rpc.0.0000000000SLO2.1.AVERAGE_ILLUMINATION': 40100,
    'hm-rpc.0.0000000000SLO3.1.CURRENT_ILLUMINATION': 9600,
    'hm-rpc.0.0000000000SLO3.1.AVERAGE_ILLUMINATION': 9200,
})) {
    states[id] = { val, ack: true, ts: Date.now() };
}

// shuttercontrol (echter Objektbaum + Instanz-Konfiguration) mit passenden HmIP-Rollladenaktoren
const sc = JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', 'shuttercontrol.json'), 'utf8')) as Record<
    string,
    Obj
>;
Object.assign(objects, sc);
const scEvents = (sc['system.adapter.shuttercontrol.0'].native as { events: { shutterName: string; name: string }[] })
    .events;
for (const [i, e] of scEvents.entries()) {
    const channel = e.name.replace(/\.LEVEL$/, '');
    const device = channel.replace(/\.\d+$/, '');
    folder(device, 'device', 'Rollladenaktor');
    objects[device].native = { TYPE: 'HmIPW-DRBL4' };
    folder(channel, 'channel', e.shutterName, 'blind');
    objects[channel].native = { TYPE: 'BLIND_VIRTUAL_RECEIVER' };
    // Vor jedem Ausgang liegt bei HmIP der Status-Kanal (BLIND_TRANSMITTER)
    const transmitter = `${device}.${Number(channel.split('.').pop()) - 1}`;
    folder(transmitter, 'channel', `Rollladenaktor:${transmitter.split('.').pop()}`);
    objects[transmitter].native = { TYPE: 'BLIND_TRANSMITTER' };
    state(e.name, 'level.blind', 'number', true, i % 3 === 0 ? 30 : 100, { unit: '%', min: 0, max: 100 });
    const key = e.shutterName.replace(/[.;, ]/g, '_');
    states[`shuttercontrol.0.shutters.autoState.${key}`] = {
        val: i % 3 === 0 ? 'sunProtect' : 'up',
        ack: true,
        ts: Date.now(),
    };
    for (const f of ['autoUp', 'autoDown', 'autoSun']) {
        states[`shuttercontrol.0.shutters.${f}.${key}`] = {
            val: !(f === 'autoSun' && i === 4),
            ack: true,
            ts: Date.now(),
        };
    }
}
for (const [key, val] of Object.entries({
    'control.autoLiving': true,
    'control.autoSleep': true,
    'control.autoChildren': false,
    'control.Holiday': false,
    'control.schoolfree': false,
    'info.Sunrise': '07:52',
    'info.Sunset': '16:58',
    'info.Elevation': 18.4,
    'info.Azimut': 203.7,
    'info.upTimeLiving': '07:30',
    'info.downTimeLiving': '21:45',
    'info.upTimeSleep': '07:45',
    'info.downTimeSleep': '21:45',
    'info.upTimeChildren': '09:00',
    'info.downTimeChildren': '21:45',
})) {
    states[`shuttercontrol.0.${key}`] = { val, ack: true, ts: Date.now() };
}
for (const k of ['autoLiving', 'autoSleep', 'autoChildren', 'Holiday']) {
    states[`0_userdata.0.Rollladen.${k}`] = { ...states[`shuttercontrol.0.control.${k}`]! };
}

/** Reaktion der Demo auf shuttercontrol-Tasten und gespiegelte Trigger-Datenpunkte */
function simulateShutterControl(id: string, val: SvStateValue['val']): void {
    const push = (sid: string, v: SvStateValue['val']): void => {
        states[sid] = { val: v, ack: true, ts: Date.now() };
        // Wird erst nach dem Serverstart aufgerufen
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        server.queueState(sid, states[sid]);
    };
    const mirror = /^0_userdata\.0\.Rollladen\.(.+)$/.exec(id);
    if (mirror) {
        push(`shuttercontrol.0.control.${mirror[1]}`, val);
        return;
    }
    const m = /^shuttercontrol\.0\.control\.(open|close|sunProtect)(All|Living|Sleep|Children)?$/.exec(id);
    if (!m || val !== true) {
        return;
    }
    const [, action, scope = 'All'] = m;
    const native = sc['system.adapter.shuttercontrol.0'].native as {
        events: { shutterName: string; name: string; typeUp: string }[];
    };
    for (const e of native.events) {
        if (scope !== 'All' && !e.typeUp.startsWith(scope.toLowerCase())) {
            continue;
        }
        const key = e.shutterName.replace(/[.;, ]/g, '_');
        push(e.name, action === 'open' ? 100 : action === 'close' ? 0 : 30);
        push(
            `shuttercontrol.0.shutters.autoState.${key}`,
            action === 'open' ? 'up' : action === 'close' ? 'down' : 'sunProtect',
        );
    }
    push(id, false);
}

// pvforecast (echter Objektbaum, zwei Anlagen) mit erzeugter Prognosekurve für heute und morgen
Object.assign(
    objects,
    JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', 'pvforecast.json'), 'utf8')) as Record<
        string,
        Obj
    >,
);
{
    const curve: { t: number; y: number }[] = [];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    for (let day = 0; day < 2; day++) {
        for (let h = 0; h < 24; h += 0.5) {
            // Glockenkurve 7–18 Uhr, morgen etwas sonniger
            const x = (h - 12.5) / 3.2;
            const y = h < 7 || h > 18 ? 0 : (day ? 7.4 : 6.1) * Math.exp(-x * x);
            curve.push({ t: midnight.getTime() + (day * 24 + h) * 3600_000, y: Math.round(y * 1000) / 1000 });
        }
    }
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const todayKwh = curve.slice(0, 48).reduce((a, p) => a + p.y * 0.5, 0);
    const sofar = curve.slice(0, Math.floor(hour * 2)).reduce((a, p) => a + p.y * 0.5, 0);
    const tomorrowKwh = curve.slice(48).reduce((a, p) => a + p.y * 0.5, 0);
    const nowKw = curve[Math.floor(hour * 2)]?.y ?? 0;
    const pvValues: Record<string, SvStateValue['val']> = {
        'summary.JSONData': JSON.stringify(curve),
        'summary.power.now': nowKw,
        'summary.power.installed': 9.6,
        'summary.energy.today': Math.round(todayKwh * 10) / 10,
        'summary.energy.now': Math.round(sofar * 10) / 10,
        'summary.energy.nowUntilEndOfDay': Math.round((todayKwh - sofar) * 10) / 10,
        'summary.energy.tomorrow': Math.round(tomorrowKwh * 10) / 10,
        'summary.lastUpdated': Date.now() - 25 * 60_000,
        'plants.osten.power.now': Math.round(nowKw * 0.55 * 100) / 100,
        'plants.osten.energy.today': Math.round(todayKwh * 0.52 * 10) / 10,
        'plants.osten.energy.tomorrow': Math.round(tomorrowKwh * 0.52 * 10) / 10,
        'plants.westen.power.now': Math.round(nowKw * 0.45 * 100) / 100,
        'plants.westen.energy.today': Math.round(todayKwh * 0.48 * 10) / 10,
        'plants.westen.energy.tomorrow': Math.round(tomorrowKwh * 0.48 * 10) / 10,
    };
    for (const [key, val] of Object.entries(pvValues)) {
        states[`pvforecast.0.${key}`] = { val, ack: true, ts: Date.now() };
    }
}

// Farbtemperatur für die Stehlampe (Hue: Mired 153–500)
state('hue.0.Stehlampe.ct', 'level.color.temperature', 'number', true, 370, { min: 153, max: 500 });

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
    // Deutschland-Edition: kein Energiezähler, Leistung bleibt 0
    'statistics.lastChargeAmount': 0,
    currentUser: 16000,
    currentHardware: 16000,
    'automatic.calcPhases': 1,
    'statistics.surplus': 0,
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
// Anpassungen aus dem Bearbeiten-Modus (in der Demo nur im Speicher)
let overrides = emptyOverrides();
let model = applyOverrides(result.model, overrides, true);

const server = new SmartVisServer(
    { port: Number(process.env.PORT) || 8099, bind: '0.0.0.0', wwwDir: join(__dirname, '..', 'www'), version: 'demo' },
    {
        getModel: () => model,
        edit: edit => {
            overrides = applyEdit(overrides, edit);
            model = applyOverrides(result.model, overrides, true);
            server.publishModel(model, false);
            return Promise.resolve();
        },
        getStates: () => states,
        setState: (id, val) => {
            if (!result.writableIds.has(id)) {
                throw new Error(`State ${id} ist nicht freigegeben`);
            }
            // Gerät "bestätigt" nach kurzer Verzögerung
            setTimeout(() => {
                states[id] = { val, ack: true, ts: Date.now() };
                server.queueState(id, states[id]);
                simulateShutterControl(id, val);
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
    // Wie der kecontact-Adapter: Ladestrom aus dem Überschuss (6–16 A, 1-phasig), p bleibt 0 (kein Zähler)
    const amps = carW > 0 ? Math.min(16, Math.max(6, Math.round(carW / 230))) : 6;
    setKeba('p', 0);
    setKeba('state', carW > 0 ? 3 : 2);
    setKeba('currentUser', amps * 1000);
    setKeba('statistics.surplus', Math.round((pv - 0.8) * 1000 - (carW > 0 ? amps * 230 : 0)));
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
