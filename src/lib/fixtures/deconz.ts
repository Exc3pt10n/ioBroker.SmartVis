import { Tree } from './build';

/**
 * ioBroker.deconz, nach main.js (SetObjectAndState, Rollen je Attribut):
 * Lampen `deconz.0.Lights.<n>`, Sensoren `deconz.0.Sensors.<n>`, Gruppen `deconz.0.Groups.<n>`, jeweils "device".
 * Helligkeit doppelt: bri (0–255) und level (0–100), beide "level.brightness".
 */
export function deconzTree(): Tree {
    const t = new Tree().instance('deconz.0');
    const dev = (id: string, name: string, type: string): string => {
        const full = `deconz.0.${id}`;
        t.device(full, name, { type });
        return full;
    };
    const light = dev('Lights.1', 'Leselampe Wohnzimmer', 'Color temperature light');
    t.state(`${light}.on`, { name: 'Leselampe Wohnzimmer on', type: 'boolean', role: 'switch', write: true })
        .state(`${light}.bri`, {
            name: 'Leselampe Wohnzimmer bri',
            type: 'number',
            role: 'level.brightness',
            write: true,
            min: 0,
            max: 255,
        })
        .state(`${light}.level`, {
            name: 'Leselampe Wohnzimmer level',
            type: 'number',
            role: 'level.brightness',
            write: true,
            min: 0,
            max: 100,
        })
        .state(`${light}.ct`, {
            name: 'Leselampe Wohnzimmer ct',
            type: 'number',
            role: 'level.color.temperature',
            write: true,
            min: 153,
            max: 500,
        })
        .state(`${light}.reachable`, {
            name: 'Leselampe Wohnzimmer reachable',
            type: 'boolean',
            role: 'indicator.reachable',
        })
        .state(`${light}.alert`, { name: 'Leselampe Wohnzimmer alert', type: 'string', role: 'state', write: true })
        .state(`${light}.transitiontime`, {
            name: 'Leselampe Wohnzimmer transitiontime',
            type: 'number',
            role: 'argument',
            write: true,
        });

    const cover = dev('Lights.2', 'Rollladen Schlafzimmer', 'Window covering device');
    t.state(`${cover}.lift`, {
        name: 'Rollladen Schlafzimmer lift',
        type: 'number',
        role: 'level.value',
        write: true,
        min: 0,
        max: 100,
    })
        .state(`${cover}.open`, { name: 'Rollladen Schlafzimmer open', type: 'boolean', role: 'sensor.open' })
        .state(`${cover}.stop`, { name: 'Rollladen Schlafzimmer stop', type: 'boolean', role: 'button', write: true })
        .state(`${cover}.reachable`, {
            name: 'Rollladen Schlafzimmer reachable',
            type: 'boolean',
            role: 'indicator.reachable',
        });

    const door = dev('Sensors.3', 'Fenster Küche', 'ZHAOpenClose');
    t.state(`${door}.open`, { name: 'Fenster Küche open', type: 'boolean', role: 'sensor.open' })
        .state(`${door}.battery`, { name: 'Fenster Küche battery', type: 'number', role: 'value.battery', unit: '%' })
        .state(`${door}.reachable`, { name: 'Fenster Küche reachable', type: 'boolean', role: 'indicator.reachable' });

    const pres = dev('Sensors.4', 'Bewegung Diele', 'ZHAPresence');
    t.state(`${pres}.presence`, { name: 'Bewegung Diele presence', type: 'boolean', role: 'sensor.motion' }).state(
        `${pres}.battery`,
        { name: 'Bewegung Diele battery', type: 'number', role: 'value.battery', unit: '%' },
    );

    const water = dev('Sensors.5', 'Wasser Bad', 'ZHAWater');
    t.state(`${water}.water`, { name: 'Wasser Bad water', type: 'boolean', role: 'sensor.alarm.flood' }).state(
        `${water}.lowbattery`,
        { name: 'Wasser Bad lowbattery', type: 'boolean', role: 'indicator.lowbat' },
    );

    const temp = dev('Sensors.6', 'Klima Keller', 'ZHATemperature');
    t.state(`${temp}.temperature`, {
        name: 'Klima Keller temperature',
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
    }).state(`${temp}.battery`, { name: 'Klima Keller battery', type: 'number', role: 'value.battery', unit: '%' });

    const grp = dev('Groups.1', 'Wohnzimmer', 'LightGroup');
    t.objects[grp].common.role = 'group';
    t.state(`${grp}.on`, { name: 'Wohnzimmer on', type: 'boolean', role: 'switch', write: true })
        .state(`${grp}.bri`, {
            name: 'Wohnzimmer bri',
            type: 'number',
            role: 'level.brightness',
            write: true,
            min: 0,
            max: 255,
        })
        .state(`${grp}.level`, {
            name: 'Wohnzimmer level',
            type: 'number',
            role: 'level.brightness',
            write: true,
            min: 0,
            max: 100,
        })
        .state(`${grp}.any_on`, { name: 'Wohnzimmer any_on', type: 'boolean', role: 'indicator' })
        .state(`${grp}.dimup`, { name: 'Dim up', type: 'boolean', role: 'button', write: true });
    return t;
}
