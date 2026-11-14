import { Tree } from './build';

/**
 * ioBroker.tuya, nach main.js (initDeviceObjects) und lib/mapper.js:
 * je Gerät ein Objekt "device" `tuya.0.<devId>` (Name aus der Tuya/Smart-Life-App), States `<devId>.<dpId>`.
 * Rolle nur aus dem Datentyp geraten (boolean rw → switch, number rw → level, number ro → value),
 * die Bedeutung steht im Datenpunkt-Code (common.name bzw. native.code). Aus colour_data entsteht `<dp>-rgb`.
 */
export function tuyaTree(): Tree {
    const t = new Tree().instance('tuya.0');
    const dev = (id: string, name: string, productKey: string): string => {
        const full = `tuya.0.${id}`;
        t.device(full, name, { productKey, id });
        t.state(`${full}.online`, {
            name: 'Local connection status',
            type: 'boolean',
            role: 'indicator.reachable',
        }).state(`${full}.ip`, { name: 'Device IP', type: 'string', role: 'info.ip', write: true });
        return full;
    };
    const dp = (
        dev: string,
        id: number | string,
        code: string,
        type: string,
        mode: 'rw' | 'ro',
        extra: Record<string, unknown> = {},
    ): void => {
        const write = mode === 'rw';
        const role =
            type === 'boolean'
                ? write
                    ? 'switch'
                    : 'sensor'
                : type === 'number'
                  ? write
                      ? 'level'
                      : 'value'
                  : 'text';
        t.state(
            `${dev}.${id}`,
            { name: code, type: type as ioBroker.CommonType, role, read: true, write, id, ...extra },
            { code, id },
        );
    };

    // LED-Lampe (Kategorie dj)
    const bulb = dev('bf1234567890abcdef', 'Deckenlampe Kinderzimmer', 'keyabc123');
    dp(bulb, 20, 'switch_led', 'boolean', 'rw');
    dp(bulb, 21, 'work_mode', 'number', 'rw', { states: { 0: 'white', 1: 'colour', 2: 'scene', 3: 'music' } });
    dp(bulb, 22, 'bright_value_v2', 'number', 'rw', { min: 10, max: 1000 });
    dp(bulb, 23, 'temp_value_v2', 'number', 'rw', { min: 0, max: 1000 });
    dp(bulb, 24, 'colour_data_v2', 'string', 'rw');
    t.state(`${bulb}.24-rgb`, { name: 'colour_data_v2 RGB', type: 'string', role: 'level.color.rgb', write: true });

    // Steckdose mit Messung (Kategorie cz)
    const plug = dev('bf2234567890abcdef', 'Steckdose Trockner', 'keydef456');
    dp(plug, 1, 'switch_1', 'boolean', 'rw');
    dp(plug, 9, 'countdown_1', 'number', 'rw', { min: 0, max: 86400, unit: 's' });
    dp(plug, 17, 'add_ele', 'number', 'ro', { unit: 'kwh', scale: 3 });
    dp(plug, 18, 'cur_current', 'number', 'ro', { unit: 'mA' });
    dp(plug, 19, 'cur_power', 'number', 'ro', { unit: 'W', scale: 1 });
    dp(plug, 20, 'cur_voltage', 'number', 'ro', { unit: 'V', scale: 1 });
    dp(plug, 41, 'child_lock', 'boolean', 'rw');

    // Steckdosenleiste (Kategorie pc)
    const strip = dev('bf3234567890abcdef', 'Steckdosenleiste Büro', 'keyghi789');
    for (let i = 1; i <= 3; i++) {
        dp(strip, i, `switch_${i}`, 'boolean', 'rw');
    }
    dp(strip, 7, 'switch_usb1', 'boolean', 'rw');

    // Rollladenmotor (Kategorie cl): 0 % = zu, 100 % = offen
    const cover = dev('bf4234567890abcdef', 'Rollladen Gästezimmer', 'keyjkl012');
    dp(cover, 1, 'control', 'number', 'rw', { states: { 0: 'open', 1: 'stop', 2: 'close' } });
    dp(cover, 2, 'percent_control', 'number', 'rw', { min: 0, max: 100, unit: '%' });
    dp(cover, 3, 'percent_state', 'number', 'ro', { min: 0, max: 100, unit: '%' });
    dp(cover, 8, 'control_back_mode', 'number', 'rw', { states: { 0: 'forward', 1: 'back' } });

    // Heizkörperthermostat (Kategorie wkf)
    const trv = dev('bf5234567890abcdef', 'Heizung Gästezimmer', 'keymno345');
    dp(trv, 2, 'temp_set', 'number', 'rw', { min: 5, max: 35, unit: '℃' });
    dp(trv, 3, 'temp_current', 'number', 'ro', { min: -20, max: 50, unit: '℃' });
    dp(trv, 7, 'child_lock', 'boolean', 'rw');
    dp(trv, 35, 'battery_percentage', 'number', 'ro', { min: 0, max: 100, unit: '%' });

    // Temperatur-/Feuchtesensor (Kategorie wsdcg)
    const th = dev('bf6234567890abcdef', 'Thermometer Keller', 'keypqr678');
    dp(th, 1, 'va_temperature', 'number', 'ro', { unit: '℃', scale: 1 });
    dp(th, 2, 'va_humidity', 'number', 'ro', { unit: '%' });
    dp(th, 4, 'battery_percentage', 'number', 'ro', { unit: '%' });

    // Tür-/Fensterkontakt (Kategorie mcs)
    const door = dev('bf7234567890abcdef', 'Kellertür', 'keystu901');
    dp(door, 1, 'doorcontact_state', 'boolean', 'ro');
    dp(door, 2, 'battery_percentage', 'number', 'ro', { unit: '%' });

    // Bewegungsmelder (Kategorie pir): Wert "pir"/"none"
    const pir = dev('bf8234567890abcdef', 'Bewegung Garage', 'keyvwx234');
    dp(pir, 1, 'pir', 'number', 'ro', { states: { 0: 'pir', 1: 'none' } });
    dp(pir, 4, 'battery_percentage', 'number', 'ro', { unit: '%' });

    // Gerät ohne Schema (nur Datenpunkt-Nummern) – bleibt unbekannt
    const raw = dev('bf9234567890abcdef', 'Unbekanntes Gerät', 'keyyz0567');
    dp(raw, 1, '1', 'boolean', 'rw');
    dp(raw, 2, '2', 'number', 'rw');
    return t;
}
