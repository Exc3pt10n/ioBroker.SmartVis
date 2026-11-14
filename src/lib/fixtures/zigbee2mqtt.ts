import { Tree } from './build';

/**
 * ioBroker.zigbee2mqtt, nach lib/deviceController.js, lib/exposes.js und lib/states.js:
 * je Gerät ein Objekt vom Typ "device" `zigbee2mqtt.0.<IEEE>` (Name = friendly_name), States direkt darunter.
 */
export function zigbee2mqttTree(): Tree {
    const t = new Tree().instance('zigbee2mqtt.0');
    const dev = (ieee: string, name: string): string => {
        const id = `zigbee2mqtt.0.${ieee}`;
        t.device(
            id,
            name,
            { deviceRemoved: false, groupDevice: false },
            { statusStates: { onlineId: `${id}.available` } },
        );
        t.state(`${id}.available`, { name: 'Available', type: 'boolean', role: 'indicator.reachable' }).state(
            `${id}.link_quality`,
            { name: 'Link quality', type: 'number', role: 'value' },
        );
        return id;
    };
    const bulb = dev('0x0017880104abcdef', 'Esstisch');
    t.state(`${bulb}.state`, { name: 'Switch state', type: 'boolean', role: 'switch', write: true })
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
        })
        .state(`${bulb}.effect`, { name: 'effect', type: 'string', role: 'state', write: true });

    const contact = dev('0x00158d0001112233', 'Terrassentür');
    t.state(`${contact}.contact`, { name: 'Contact event', type: 'boolean', role: 'state' })
        .state(`${contact}.opened`, { name: 'Is open', type: 'boolean', role: 'sensor.window' })
        .state(`${contact}.battery`, { name: 'Battery', type: 'number', role: 'value.battery', unit: '%' });

    const cover = dev('0xa4c1380011223344', 'Markise');
    t.state(`${cover}.state`, { name: 'state', type: 'string', role: 'switch', write: true }).state(
        `${cover}.position`,
        { name: 'Position of this cover', type: 'number', role: 'state', write: true, unit: '%', min: 0, max: 100 },
    );

    const dbl = dev('0xa4c1385566778899', 'Doppelschalter Küche');
    t.state(`${dbl}.state_l1`, { name: 'Switch state l1', type: 'boolean', role: 'switch', write: true }).state(
        `${dbl}.state_l2`,
        { name: 'Switch state l2', type: 'boolean', role: 'switch', write: true },
    );

    const trv = dev('0x84fd27fffe654321', 'Heizung Büro');
    t.state(`${trv}.local_temperature`, {
        name: 'Current temperature',
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
    })
        .state(`${trv}.occupied_heating_setpoint`, {
            name: 'Temperature setpoint',
            type: 'number',
            role: 'level.temperature',
            write: true,
            unit: '°C',
            min: 5,
            max: 30,
        })
        .state(`${trv}.system_mode`, {
            name: 'System mode',
            type: 'string',
            role: 'state',
            write: true,
            states: { auto: 'auto', off: 'off', heat: 'heat' },
        })
        .state(`${trv}.child_lock`, { name: 'Child lock', type: 'boolean', role: 'switch', write: true })
        .state(`${trv}.battery`, { name: 'Battery', type: 'number', role: 'value.battery', unit: '%' });

    const leak = dev('0x00158d0009988776', 'Wassermelder Waschküche');
    t.state(`${leak}.detected`, { name: 'Water leak detected', type: 'boolean', role: 'indicator.alarm.flood' }).state(
        `${leak}.battery_low`,
        { name: 'Battery Status Low', type: 'boolean', role: 'indicator.lowbat' },
    );
    return t;
}
