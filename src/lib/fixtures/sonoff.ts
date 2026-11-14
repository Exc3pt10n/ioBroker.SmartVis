import { Tree } from './build';

/**
 * ioBroker.sonoff (Tasmota über MQTT), nach src/lib/mqttBase.ts und src/lib/datapoints.ts:
 * je Gerät ein Kanal `sonoff.0.<Client-ID>` (Name = Client-ID, z. B. "DVES_4E55F6"), darunter flache States;
 * verschachtelte Sensorwerte heißen `<Sensor>_<Wert>` (ENERGY_Power, DS18B20_Temperature …).
 * Der Datenpunkt-Name ist "<Client-ID> <Pfad> <Attribut>".
 */
export function sonoffTree(): Tree {
    const t = new Tree().instance('sonoff.0');
    const info = (dev: string): void => {
        t.state(`sonoff.0.${dev}.alive`, { name: `${dev} alive`, type: 'boolean', role: 'indicator.reachable' })
            .state(`sonoff.0.${dev}.Hostname`, { name: `${dev}  Hostname`, type: 'string', role: 'info.name' })
            .state(`sonoff.0.${dev}.IPAddress`, { name: `${dev}  IPAddress`, type: 'string', role: 'info.ip' })
            .state(`sonoff.0.${dev}.Wifi_RSSI`, { name: `${dev} Wifi  RSSI`, type: 'number', role: 'value.rssi' })
            .state(`sonoff.0.${dev}.Wifi_Channel`, { name: `${dev} Wifi  Channel`, type: 'number', role: 'level' })
            .state(`sonoff.0.${dev}.Uptime`, { name: `${dev}  Uptime`, type: 'string', role: 'state' })
            .state(`sonoff.0.${dev}.INFO.Info1_Module`, { name: `${dev} INFO Info1  Module`, type: 'string' });
    };
    const ch = (dev: string): void => {
        t.channel(`sonoff.0.${dev}`, dev, { clientId: dev });
        info(dev);
    };

    // Steckdose mit Energiemessung (Gosund/Nous A1), per iot/Alexa als "Kaffeemaschine" benannt
    ch('DVES_PLUG01');
    t.state('sonoff.0.DVES_PLUG01.POWER', {
        name: 'DVES_PLUG01 POWER',
        type: 'boolean',
        role: 'switch',
        write: true,
        smartName: { de: 'Kaffeemaschine' },
    })
        .state('sonoff.0.DVES_PLUG01.ENERGY_Power', {
            name: 'DVES_PLUG01 ENERGY  Power',
            type: 'number',
            role: 'value.power',
            unit: 'W',
        })
        .state('sonoff.0.DVES_PLUG01.ENERGY_Voltage', {
            name: 'DVES_PLUG01 ENERGY  Voltage',
            type: 'number',
            role: 'value.voltage',
            unit: 'V',
        })
        .state('sonoff.0.DVES_PLUG01.ENERGY_Current', {
            name: 'DVES_PLUG01 ENERGY  Current',
            type: 'number',
            role: 'value.current',
            unit: 'A',
        })
        .state('sonoff.0.DVES_PLUG01.ENERGY_Today', {
            name: 'DVES_PLUG01 ENERGY  Today',
            type: 'number',
            role: 'value.energy.consumed',
            unit: 'kWh',
        })
        .state('sonoff.0.DVES_PLUG01.ENERGY_Total', {
            name: 'DVES_PLUG01 ENERGY  Total',
            type: 'number',
            role: 'value.power.consumption',
            unit: 'kWh',
        });

    // 4-Kanal-Relais (Sonoff 4CH), Kanal in ioBroker umbenannt
    ch('DVES_4CH');
    t.objects['sonoff.0.DVES_4CH'].common.name = 'Gartenrelais';
    for (let i = 1; i <= 4; i++) {
        t.state(`sonoff.0.DVES_4CH.POWER${i}`, {
            name: `DVES_4CH POWER${i}`,
            type: 'boolean',
            role: 'switch',
            write: true,
        });
    }

    // Lampe mit Dimmer, Farbtemperatur und Farbe
    ch('DVES_BULB');
    t.objects['sonoff.0.DVES_BULB'].common.name = 'Stehlampe Wohnzimmer';
    t.state('sonoff.0.DVES_BULB.POWER', { name: 'DVES_BULB POWER', type: 'boolean', role: 'switch', write: true })
        .state('sonoff.0.DVES_BULB.Dimmer', {
            name: 'DVES_BULB Dimmer',
            type: 'number',
            role: 'level.dimmer',
            write: true,
            min: 0,
            max: 100,
        })
        .state('sonoff.0.DVES_BULB.CT', {
            name: 'DVES_BULB CT',
            type: 'number',
            role: 'level.color.temperature',
            write: true,
            min: 153,
            max: 500,
            unit: 'mired',
        })
        .state('sonoff.0.DVES_BULB.Color', {
            name: 'DVES_BULB Color',
            type: 'string',
            role: 'level.color.rgb',
            write: true,
        })
        .state('sonoff.0.DVES_BULB.HSBColor', {
            name: 'DVES_BULB HSBColor',
            type: 'string',
            role: 'value.hsb',
            write: true,
        });

    // Rollladen (Shelly 2.5 mit Tasmota im Shutter-Modus): Relais POWER1/2 treiben den Motor
    ch('DVES_SHUT');
    t.objects['sonoff.0.DVES_SHUT'].common.name = 'Rollladen Küche';
    t.state('sonoff.0.DVES_SHUT.POWER1', { name: 'DVES_SHUT POWER1', type: 'boolean', role: 'switch', write: true })
        .state('sonoff.0.DVES_SHUT.POWER2', { name: 'DVES_SHUT POWER2', type: 'boolean', role: 'switch', write: true })
        .state('sonoff.0.DVES_SHUT.Shutter1_Position', {
            name: 'DVES_SHUT Shutter1  Position',
            type: 'number',
            role: 'level.blind',
            write: true,
            min: 0,
            max: 100,
            unit: '%',
        })
        .state('sonoff.0.DVES_SHUT.Shutter1_Direction', {
            name: 'DVES_SHUT Shutter1  Direction',
            type: 'number',
            role: 'value.direction',
        })
        .state('sonoff.0.DVES_SHUT.Shutter1_Target', {
            name: 'DVES_SHUT Shutter1  Target',
            type: 'number',
            role: 'value',
            unit: '%',
        });

    // Temperatur-/Feuchtesensor (Sonoff TH16 mit AM2301), Relais zusätzlich
    ch('DVES_TH16');
    t.objects['sonoff.0.DVES_TH16'].common.name = 'Gewächshaus';
    t.state('sonoff.0.DVES_TH16.POWER', { name: 'DVES_TH16 POWER', type: 'boolean', role: 'switch', write: true })
        .state('sonoff.0.DVES_TH16.AM2301_Temperature', {
            name: 'DVES_TH16 AM2301  Temperature',
            type: 'number',
            role: 'value.temperature',
            unit: '°C',
        })
        .state('sonoff.0.DVES_TH16.AM2301_Humidity', {
            name: 'DVES_TH16 AM2301  Humidity',
            type: 'number',
            role: 'value.humidity',
            unit: '%',
        });
    return t;
}
