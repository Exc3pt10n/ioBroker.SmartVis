import { Tree } from './build';

/**
 * ioBroker.shelly, nach src/lib/protocol/base.ts und src/lib/devices/gen2-helper.ts:
 * Gerät `shelly.0.<Typ>#<MAC>#1` (Name "Device <ID>", bis in der Shelly-App ein Name vergeben ist),
 * darunter Kanäle "Channel Relay0" usw. (ebenfalls erst mit Namen aus der App umbenannt).
 */
export function shellyTree(): Tree {
    const t = new Tree().instance('shelly.0');
    const dev = (id: string, name?: string): string => {
        const full = `shelly.0.${id}`;
        t.device(full, name ?? `Device ${id}`, {}, { statusStates: { onlineId: `${full}.online` } });
        t.state(`${full}.online`, { name: 'Device online', type: 'boolean', role: 'indicator.reachable' })
            .state(`${full}.rssi`, { name: 'Device RSSI status', type: 'number', role: 'value', unit: 'dBm' })
            .channel(`${full}.Sys`, 'Channel Sys')
            .state(`${full}.Sys.deviceMode`, { name: 'Mode / Profile', type: 'string', role: 'state', write: true });
        return full;
    };
    const ch = (dev: string, ch: string, name?: string): string => {
        t.channel(`${dev}.${ch}`, name ?? `Channel ${ch}`);
        t.state(`${dev}.${ch}.ChannelName`, { name: 'Channel name', type: 'string', role: 'text', write: true });
        return `${dev}.${ch}`;
    };
    const input = (dev: string, n: number): void => {
        const c = ch(dev, `Input${n}`);
        t.state(`${c}.Status`, { name: 'Input Status', type: 'boolean', role: 'indicator' })
            .state(`${c}.Event`, { name: 'Input Event', type: 'string', role: 'state' })
            .state(`${c}.InputType`, { name: 'Input Type', type: 'string', role: 'state', write: true })
            .state(`${c}.InputEnable`, { name: 'Input enable', type: 'boolean', role: 'switch.enable', write: true })
            .state(`${c}.InputInverted`, { name: 'Input Inverted', type: 'boolean', role: 'switch', write: true });
    };
    const relay = (dev: string, n: number, name?: string): void => {
        const c = ch(dev, `Relay${n}`, name);
        t.state(`${c}.Switch`, { name: 'Switch', type: 'boolean', role: 'switch', write: true })
            .state(`${c}.InitialState`, { name: 'Initial State', type: 'string', role: 'state', write: true })
            .state(`${c}.AutoTimerOn`, { name: 'Auto Timer On', type: 'boolean', role: 'switch.enable', write: true })
            .state(`${c}.AutoTimerOnDelay`, {
                name: 'Auto Timer On Delay',
                type: 'number',
                role: 'level.timer',
                write: true,
                unit: 's',
            })
            .state(`${c}.source`, { name: 'Source of last command', type: 'string', role: 'text' })
            .state(`${c}.temperatureC`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' })
            .state(`${c}.Power`, { name: 'Power', type: 'number', role: 'value.power', unit: 'W' })
            .state(`${c}.Voltage`, { name: 'Voltage', type: 'number', role: 'value.voltage', unit: 'V' })
            .state(`${c}.Current`, { name: 'Current', type: 'number', role: 'value.current', unit: 'A' })
            .state(`${c}.Energy`, { name: 'Energy', type: 'number', role: 'value.energy', unit: 'Wh' })
            .state(`${c}.ResetCounters`, {
                name: 'Reset counters',
                type: 'boolean',
                role: 'button',
                write: true,
                read: false,
            });
    };

    // Plus 1PM ohne Namen in der Shelly-App
    const p1 = dev('shellyplus1pm#a8032ab11111#1');
    relay(p1, 0);
    input(p1, 0);

    // Plus 1PM mit Gerätenamen ("Licht Flur") – Kanal ohne Namen
    const p1b = dev('shellyplus1pm#a8032ab22222#1', 'Licht Flur');
    relay(p1b, 0);
    input(p1b, 0);

    // Plus 2PM im Rollladen-Modus, Kanal in der App benannt
    const p2 = dev('shellyplus2pm#a8032ab33333#1', 'Rollladen Wohnzimmer');
    const cover = ch(p2, 'Cover0', 'Wohnzimmer Terrassentür');
    t.state(`${cover}.Position`, {
        name: 'Current Position',
        type: 'number',
        role: 'level.blind',
        write: true,
        unit: '%',
    })
        .state(`${cover}.TargetPosition`, {
            name: 'Target Position',
            type: 'number',
            role: 'level.blind',
            write: true,
            unit: '%',
        })
        .state(`${cover}.Open`, { name: 'Open', type: 'boolean', role: 'button', write: true, read: false })
        .state(`${cover}.Close`, { name: 'Close', type: 'boolean', role: 'button', write: true, read: false })
        .state(`${cover}.Stop`, { name: 'Stop', type: 'boolean', role: 'button', write: true, read: false })
        .state(`${cover}.Status`, { name: 'Cover Status', type: 'string', role: 'state' })
        .state(`${cover}.Power`, { name: 'Power', type: 'number', role: 'value.power', unit: 'W' })
        .state(`${cover}.temperatureC`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${cover}.InputSwap`, { name: 'Input Swap', type: 'boolean', role: 'switch.enable', write: true })
        .state(`${cover}.FavoritePos1.Pos`, { name: 'Position', type: 'number', role: 'level.blind', unit: '%' });
    input(p2, 0);
    input(p2, 1);

    // Plus Dimmer 0-10V / Dimmer: Light0
    const dim = dev('shellyplus010v#a8032ab44444#1', 'Esstisch');
    const light = ch(dim, 'Light0');
    t.state(`${light}.Switch`, { name: 'Switch', type: 'boolean', role: 'switch', write: true })
        .state(`${light}.Brightness`, {
            name: 'Illuminance',
            type: 'number',
            role: 'level.brightness',
            write: true,
            unit: '%',
        })
        .state(`${light}.Transition_Output`, { name: 'target state', type: 'boolean', role: 'sensor.switch' })
        .state(`${light}.Transition_Brightness`, {
            name: 'target illuminance',
            type: 'number',
            role: 'level.brightness',
            unit: '%',
        })
        .state(`${light}.temperatureC`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${light}.Power`, { name: 'Power', type: 'number', role: 'value.power', unit: 'W' });

    // Pro 3EM am Hausanschluss
    const em = dev('shellypro3em#a8032ab55555#1', 'Hausanschluss');
    const em0 = ch(em, 'EM0');
    t.state(`${em0}.TotalActivePower`, {
        name: 'Total Active Power',
        type: 'number',
        role: 'value.power.active',
        unit: 'W',
    }).state(`${em0}.TotalCurrent`, { name: 'Total Current', type: 'number', role: 'value.current', unit: 'A' });
    for (const p of ['A', 'B', 'C']) {
        t.state(`${em0}.ActivePower${p}`, {
            name: 'Active Power',
            type: 'number',
            role: 'value.power.active',
            unit: 'W',
        })
            .state(`${em0}.Voltage${p}`, { name: 'Voltage', type: 'number', role: 'value.voltage', unit: 'V' })
            .state(`${em0}.Current${p}`, { name: 'Current', type: 'number', role: 'value.current', unit: 'A' });
    }
    const emd = ch(em, 'EMData0');
    t.state(`${emd}.TotalActiveEnergy`, {
        name: 'Total Energy',
        type: 'number',
        role: 'value.energy.consumed',
        unit: 'Wh',
    }).state(`${emd}.TotalActiveReturnEnergy`, {
        name: 'Total Returned Energy',
        type: 'number',
        role: 'value.energy.produced',
        unit: 'Wh',
    });

    // Plus H&T (Batterie)
    const ht = dev('shellyplusht#a8032ab66666#1', 'Klima Bad');
    const temp = ch(ht, 'Temperature0');
    t.state(`${temp}.Celsius`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' }).state(
        `${temp}.ReportThreshold`,
        { name: 'Report threshold', type: 'number', role: 'level.temperature', write: true, unit: '°C' },
    );
    const hum = ch(ht, 'Humidity0');
    t.state(`${hum}.Relative`, { name: 'Humidity', type: 'number', role: 'value.humidity', unit: '%' }).state(
        `${hum}.ReportThreshold`,
        { name: 'Report threshold', type: 'number', role: 'level.humidity', write: true, unit: '%' },
    );
    const pow = ch(ht, 'DevicePower0');
    t.state(`${pow}.BatteryPercent`, {
        name: 'Battery charge level',
        type: 'number',
        role: 'value.battery',
        unit: '%',
    }).state(`${pow}.ExternalPower`, { name: 'External power supply', type: 'boolean', role: 'state' });

    // Gen1: Door/Window 2 (Kanal "sensor")
    const dw = dev('SHDW-2#AABBCC#1', 'Haustür');
    const s = ch(dw, 'sensor', 'Channel sensor');
    t.state(`${s}.door`, { name: 'Door Sensor', type: 'boolean', role: 'sensor.door' })
        .state(`${s}.battery`, { name: 'Battery capacity', type: 'number', role: 'value.battery', unit: '%' })
        .state(`${s}.lux`, { name: 'Illuminance', type: 'number', role: 'value.brightness', unit: 'Lux' })
        .state(`${s}.temperatureC`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${s}.vibration`, { name: 'Vibration', type: 'boolean', role: 'sensor' });
    return t;
}
