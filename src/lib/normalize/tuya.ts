import type { AdapterRules, StatePatch } from './types';

/**
 * Tuya-Standardcodes → ioBroker-Rollen. Der Tuya-Adapter rät die Rolle nur aus dem Datentyp
 * (switch/level/value); die Bedeutung steht im Datenpunkt-Code (native.code bzw. common.name).
 * Quelle: Tuya "Standard Instruction Set" der Kategorien dj (Licht), cz/pc (Steckdose), cl (Vorhang/Rollladen),
 * wk/wkf (Thermostat), wsdcg (Klima), mcs (Kontakt), sj (Wasser), pir (Bewegung).
 */
const ROLES: [RegExp, StatePatch][] = [
    [/^switch_led(_\d+)?$/, { role: 'switch.light' }],
    [/^bright_value(_v2)?(_\d+)?$/, { role: 'level.dimmer' }],
    // 0 = warm, 1000 = kalt (relativ, keine Kelvin) – SmartVis zeigt dafür Prozent
    [/^temp_value(_v2)?$/, { role: 'level.color.temperature', unit: '%' }],
    [/^switch(_\d+)?$|^switch_usb\d+$/, { role: 'switch' }],
    [/^cur_power$/, { role: 'value.power', unit: 'W' }],
    [/^cur_voltage$/, { role: 'value.voltage', unit: 'V' }],
    [/^cur_current$/, { role: 'value.current' }],
    [/^add_ele$/, { role: 'value.power.consumption', unit: 'kWh' }],
    [/^percent_control(_\d+)?$|^position$/, { role: 'level.blind' }],
    [/^(temp_set|TempSet)$/, { role: 'level.temperature' }],
    [/^(temp_current|TempCurrent|va_temperature)$/, { role: 'value.temperature' }],
    [/^(va_humidity|humidity_value|humidity_current)$/, { role: 'value.humidity' }],
    [/^battery_percentage$|^va_battery$/, { role: 'value.battery' }],
    [/^doorcontact_state$/, { role: 'sensor.window' }],
    [/^watersensor_state$/, { role: 'sensor.alarm.flood' }],
    [/^(smoke_sensor_status|smoke_sensor_state)$/, { role: 'sensor.alarm.fire' }],
];

/** Codes, die nur Einstellungen/Zwischenwerte sind */
const HIDE = [
    /^countdown/,
    /^child_lock$/,
    /^relay_status$/,
    /^light_mode$/,
    /^cycle_time$/,
    /^random_time$/,
    /^switch_inching$/,
    /^control_back_mode$/,
    /^control$/,
    /^percent_state(_\d+)?$/,
    /^work_mode$/,
    /^scene_data/,
    /^music_data$/,
    /^control_data$/,
    /^colour_data(_v2)?$/,
];

function codeOf(id: string, common: ioBroker.StateCommon, native: Record<string, unknown> | undefined): string {
    const code = native?.code;
    if (typeof code === 'string' && code) {
        return code;
    }
    return typeof common.name === 'string' ? common.name : id.split('.').pop() || '';
}

export const tuyaRules: AdapterRules = {
    state(id, common, ctx) {
        // tuya.0.<devId>.<dp> – Zusatz-States wie "<dp>-rgb" behalten ihre (richtige) Rolle
        if (id.split('.').length !== 4) {
            return undefined;
        }
        const code = codeOf(id, common, ctx.objects[id]?.native as Record<string, unknown> | undefined);
        if (HIDE.some(r => r.test(code))) {
            return 'hide';
        }
        // Bewegung: Aufzählung "pir"/"none" – als Wert anzeigen, nicht als Regler
        if (code === 'pir') {
            return { role: 'value', write: false };
        }
        for (const [re, patch] of ROLES) {
            if (re.test(code)) {
                return patch;
            }
        }
        return undefined;
    },
};
