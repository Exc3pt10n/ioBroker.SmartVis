import { Tree } from './build';

/**
 * ioBroker.fritzdect, nach main.js (createObject, createValueState …):
 * je Gerät ein Kanal `fritzdect.0.DECT_<AIN>` mit dem Namen aus der FRITZ!Box und einer Kanal-Rolle
 * (thermo.heat, switch, light, blinds, sensor, thermo). Fast alle Messwerte haben nur die Rolle "value".
 */
export function fritzdectTree(): Tree {
    const t = new Tree().instance('fritzdect.0');
    const dev = (ain: string, name: string, role: string): string => {
        const id = `fritzdect.0.DECT_${ain}`;
        t.channel(id, name, { aid: ain }, { role });
        t.state(`${id}.present`, { name: 'device present', type: 'boolean', role: 'indicator' })
            .state(`${id}.name`, { name: 'Device Name', type: 'string', role: 'info' })
            .state(`${id}.txbusy`, { name: 'Trasmitting active', type: 'boolean', role: 'indicator' });
        return id;
    };
    const value = (id: string, name: string, unit: string, min = 0, max = 100): void => {
        t.state(id, { name, type: 'number', role: 'value', unit, min, max, desc: name });
    };
    const ctrl = (id: string, name: string, unit: string, role: string, min: number, max: number): void => {
        t.state(id, { name, type: 'number', role, unit, min, max, write: true, desc: name });
    };

    // FRITZ!DECT 301 Heizkörperthermostat
    const hkr = dev('139790123456', 'Heizung Bad', 'thermo.heat');
    value(`${hkr}.tist`, 'Actual temperature', '°C', 0, 65);
    ctrl(`${hkr}.tsoll`, 'Setpoint Temperature', '°C', 'value.temperature', 0, 35);
    value(`${hkr}.absenk`, 'reduced (night) temperature', '°C', 8, 32);
    value(`${hkr}.komfort`, 'comfort temperature', '°C', 8, 32);
    value(`${hkr}.celsius`, 'Temperature', '°C', -30, 50);
    value(`${hkr}.offset`, 'Temperature Offset', '°C', -10, 10);
    value(`${hkr}.battery`, 'battery status', '%');
    t.state(`${hkr}.batterylow`, { name: 'battery low', type: 'boolean', role: 'indicator' })
        .state(`${hkr}.lock`, { name: 'Thermostat UI/API lock', type: 'boolean', role: 'indicator' })
        .state(`${hkr}.summeractive`, { name: 'summer active status', type: 'boolean', role: 'indicator' })
        .state(`${hkr}.boostactive`, {
            name: 'Boost active status and cmd',
            type: 'boolean',
            role: 'switch',
            write: true,
        })
        .state(`${hkr}.windowopenactiv`, {
            name: 'Window open status and cmd',
            type: 'boolean',
            role: 'switch',
            write: true,
        })
        .state(`${hkr}.operationmode`, { name: 'Operation mode', type: 'string', role: 'info' })
        .state(`${hkr}.hkrmode`, { name: 'Thermostat operation mode', type: 'number', role: 'indicator', write: true });
    ctrl(`${hkr}.boostactivetime`, 'boost active time for cmd', 'min', 'value', 0, 1440);

    // FRITZ!DECT 200 Steckdose
    const sw = dev('087610123456', 'Waschmaschine', 'switch');
    t.state(`${sw}.state`, { name: 'Switch Status and Control', type: 'boolean', role: 'switch', write: true })
        .state(`${sw}.lock`, { name: 'API Lock', type: 'boolean', role: 'indicator' })
        .state(`${sw}.devicelock`, { name: 'Device (Button)lock', type: 'boolean', role: 'indicator' });
    value(`${sw}.power`, 'actual Power', 'W', 0, 4000);
    value(`${sw}.voltage`, 'actual Voltage', 'V', 0, 255);
    value(`${sw}.energy`, 'Energy consumption', 'Wh', 0, 9999999999);
    value(`${sw}.celsius`, 'Temperature', '°C', -30, 50);

    // FRITZ!DECT 500 LED-Lampe
    const led = dev('135430123456-1', 'Stehlampe Wohnzimmer', 'light');
    t.state(`${led}.state`, { name: 'Simple ON/OFF state and cmd', type: 'boolean', role: 'switch', write: true });
    ctrl(`${led}.level`, 'level 0..255', '', 'value.level', 0, 255);
    ctrl(`${led}.levelpercentage`, 'level in %', '%', 'value.level', 0, 100);
    ctrl(`${led}.hue`, 'HUE color', '°', 'value.hue', 0, 359);
    ctrl(`${led}.saturation`, 'Saturation', '', 'value.saturation', 0, 255);
    ctrl(`${led}.temperature`, 'color temperature', 'K', 'value.temperature', 2700, 6500);
    value(`${led}.unmapped_hue`, 'unmapped hue value', '°', 0, 359);
    t.state(`${led}.fullcolorsupport`, { name: 'Full Color Support', type: 'boolean', role: 'indicator' });

    // Rollladen (FRITZ!DECT 350 / Rademacher)
    const bl = dev('119340123456-1', 'Rollladen Küche', 'blinds');
    ctrl(`${bl}.level`, 'level 0..255', '', 'value.level', 0, 255);
    ctrl(`${bl}.levelpercentage`, 'level in %', '%', 'value.level', 0, 100);
    t.state(`${bl}.blindsopen`, { name: 'Open', type: 'boolean', role: 'button', write: true })
        .state(`${bl}.blindsclose`, { name: 'Close', type: 'boolean', role: 'button', write: true })
        .state(`${bl}.blindsstop`, { name: 'Stop', type: 'boolean', role: 'button', write: true })
        .state(`${bl}.endpositionsset`, { name: 'Endposition Setting', type: 'boolean', role: 'indicator' });

    // FRITZ!DECT 440 Taster mit Temperatur und Luftfeuchte
    const tst = dev('099950123456', 'Taster Schlafzimmer', 'thermo');
    value(`${tst}.celsius`, 'Temperature', '°C', -30, 50);
    value(`${tst}.rel_humidity`, 'relative Humidity', '%');
    value(`${tst}.battery`, 'Battery Charge State', '%');
    t.state(`${tst}.batterylow`, { name: 'Battery Low State', type: 'boolean', role: 'indicator' });

    // Fenster-/Türkontakt (HAN-FUN)
    const con = dev('119340654321-1', 'Fenster Kinderzimmer', 'sensor');
    t.state(`${con}.state`, { name: 'Alert State', type: 'boolean', role: 'indicator' });
    return t;
}
