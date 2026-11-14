import { Tree } from './build';

/**
 * ioBroker.zigbee, nach lib/exposes.js und lib/legacy/states.js:
 * je Gerät ein Objekt vom Typ "device" `zigbee.0.<IEEE>` (Name aus der Geräteliste), die States direkt darunter.
 * Gruppen: `zigbee.0.group_<n>`.
 */
export function zigbeeTree(): Tree {
    const t = new Tree().instance('zigbee.0');
    const dev = (ieee: string, name: string, model: string): string => {
        const id = `zigbee.0.${ieee}`;
        t.device(id, name, { id: `0x${ieee}`, model });
        t.state(`${id}.available`, { name: 'Available', type: 'boolean', role: 'state' })
            .state(`${id}.link_quality`, { name: 'Link quality', type: 'number', role: 'state' })
            .state(`${id}.send_payload`, { name: 'Send to Device', type: 'string', role: 'state', write: true });
        return id;
    };
    const battery = (id: string): void => {
        t.state(`${id}.battery`, { name: 'Battery percent', type: 'number', role: 'value.battery', unit: '%' }).state(
            `${id}.voltage`,
            { name: 'Battery voltage', type: 'number', role: 'battery.voltage', unit: 'V' },
        );
    };

    const bulb = dev('001788010a1b2c3d', 'Deckenlampe Küche', 'LCT015');
    t.state(`${bulb}.state`, { name: 'Switch state', type: 'boolean', role: 'switch.light', write: true })
        .state(`${bulb}.brightness`, {
            name: 'Brightness',
            type: 'number',
            role: 'level.dimmer',
            write: true,
            min: 0,
            max: 100,
        })
        .state(`${bulb}.colortemp`, {
            name: 'Color temperature',
            type: 'number',
            role: 'level.color.temperature',
            write: true,
            min: 153,
            max: 500,
        })
        .state(`${bulb}.color`, { name: 'Color', type: 'string', role: 'level.color.rgb', write: true })
        .state(`${bulb}.brightness_move`, { name: 'Dimming', type: 'number', role: 'state', write: true, read: false })
        .state(`${bulb}.transition_time`, {
            name: 'Transition time',
            type: 'number',
            role: 'state',
            write: true,
            unit: 'sec',
        });

    const door = dev('00158d0001a2b3c4', 'Fenster Bad', 'MCCGQ11LM');
    t.state(`${door}.contact`, { name: 'Contact event', type: 'boolean', role: 'sensor' }).state(`${door}.opened`, {
        name: 'Is open',
        type: 'boolean',
        role: 'sensor.contact',
    });
    battery(door);

    const motion = dev('00158d0002b3c4d5', 'Bewegungsmelder Flur', 'RTCGQ11LM');
    t.state(`${motion}.occupancy`, { name: 'Occupancy', type: 'boolean', role: 'sensor.motion' })
        .state(`${motion}.illuminance`, { name: 'Illuminance', type: 'number', role: 'value.brightness', unit: 'lux' })
        .state(`${motion}.no_motion`, { name: 'Time from last motion', type: 'number', role: 'state', unit: 's' });
    battery(motion);

    const climate = dev('00158d0003c4d5e6', 'Klima Schlafzimmer', 'WSDCGQ11LM');
    t.state(`${climate}.temperature`, { name: 'Temperature', type: 'number', role: 'value.temperature', unit: '°C' })
        .state(`${climate}.humidity`, { name: 'Humidity', type: 'number', role: 'value.humidity', unit: '%' })
        .state(`${climate}.pressure`, { name: 'Pressure', type: 'number', role: 'value.pressure', unit: 'hPa' });
    battery(climate);

    const plug = dev('ccccccfffe1a2b3c', 'Steckdose Fernseher', 'TS011F_plug_1');
    t.state(`${plug}.state`, { name: 'Switch state', type: 'boolean', role: 'switch', write: true })
        .state(`${plug}.load_power`, { name: 'Load power', type: 'number', role: 'value.power', unit: 'W' })
        .state(`${plug}.voltage`, { name: 'Voltage', type: 'number', role: 'value.voltage', unit: 'V' })
        .state(`${plug}.energy`, { name: 'Energy', type: 'number', role: 'value.energy', unit: 'kWh' })
        .state(`${plug}.child_lock`, { name: 'Child lock', type: 'boolean', role: 'switch.lock', write: true });

    // Doppel-Unterputzschalter (Endpunkte l1/l2)
    const dbl = dev('a4c1381234567890', 'Schalter Treppe', 'TS0012');
    t.state(`${dbl}.state_l1`, { name: 'state_l1', type: 'boolean', role: 'switch', write: true }).state(
        `${dbl}.state_l2`,
        { name: 'state_l2', type: 'boolean', role: 'switch', write: true },
    );

    const cover = dev('a4c138abcdef0123', 'Rollladen Arbeitszimmer', 'TS130F');
    t.state(`${cover}.position`, {
        name: 'position',
        type: 'number',
        role: 'level',
        write: true,
        unit: '%',
        min: 0,
        max: 100,
    }).state(`${cover}.state`, {
        name: 'state',
        type: 'string',
        role: 'state',
        write: true,
        states: { OPEN: 'OPEN', CLOSE: 'CLOSE', STOP: 'STOP' },
    });

    const trv = dev('84fd27fffe123456', 'Heizung Wohnzimmer', 'TV02-Zigbee');
    t.state(`${trv}.local_temperature`, {
        name: 'local_temperature',
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
    })
        .state(`${trv}.current_heating_setpoint`, {
            name: 'current_heating_setpoint',
            type: 'number',
            role: 'level.temperature',
            write: true,
            unit: '°C',
            min: 5,
            max: 30,
        })
        .state(`${trv}.child_lock`, { name: 'Child lock', type: 'boolean', role: 'switch.lock', write: true });
    battery(trv);

    const leak = dev('00158d0004d5e6f7', 'Wassermelder Keller', 'SJCGQ11LM');
    t.state(`${leak}.detected`, { name: 'Water leak detected', type: 'boolean', role: 'indicator.leakage' });
    battery(leak);

    // Gruppe
    t.device('zigbee.0.group_1', 'Wohnzimmer Lichter', { group: true })
        .state('zigbee.0.group_1.state', { name: 'Switch state', type: 'boolean', role: 'switch.light', write: true })
        .state('zigbee.0.group_1.brightness', {
            name: 'Brightness',
            type: 'number',
            role: 'level.dimmer',
            write: true,
        });
    return t;
}
