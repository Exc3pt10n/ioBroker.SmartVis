import type { AdapterRules, StatePatch } from './types';

/**
 * Rollen je Kanal-Rolle des fritzdect-Adapters (Gerätetyp aus der FRITZ!Box) und Datenpunkt.
 * Der Adapter legt fast alle Messwerte mit der Rolle "value" an; die Bedeutung ergibt sich erst
 * aus dem Gerätetyp: "temperature" ist bei der LED-Lampe die Farbtemperatur, beim Thermostat gibt es keine.
 */
const BY_KIND: Record<string, Record<string, StatePatch | 'hide'>> = {
    thermo: {
        tsoll: { role: 'level.temperature' },
        tist: { role: 'value.temperature' },
        // Messwert des Gerätesensors – beim Thermostat doppelt zu tist
        celsius: 'hide',
        boostactive: { role: 'switch.mode.boost' },
        windowopenactiv: 'hide',
        rel_humidity: { role: 'value.humidity' },
    },
    switch: {
        state: { role: 'switch' },
        power: { role: 'value.power' },
        voltage: { role: 'value.voltage' },
        energy: { role: 'value.power.consumption' },
        celsius: { role: 'value.temperature' },
    },
    light: {
        state: { role: 'switch.light' },
        levelpercentage: { role: 'level.dimmer' },
        level: 'hide',
        hue: { role: 'level.color.hue' },
        saturation: { role: 'level.color.saturation' },
        temperature: { role: 'level.color.temperature' },
    },
    blinds: {
        // AVM: 0 % = offen, 100 % = geschlossen
        levelpercentage: { role: 'level.blind', invert: true },
        level: 'hide',
        blindsstop: { role: 'button.stop' },
    },
    sensor: {
        state: { role: 'sensor.window' },
    },
};

/** Für alle Gerätetypen gleich */
const COMMON: Record<string, StatePatch | 'hide'> = {
    battery: { role: 'value.battery' },
    batterylow: { role: 'indicator.lowbat' },
    celsius: { role: 'value.temperature' },
    rel_humidity: { role: 'value.humidity' },
    unmapped_hue: 'hide',
    unmapped_saturation: 'hide',
    offset: 'hide',
};

/** Kanal-Rolle → Gerätetyp ("thermo.heat" und "thermo" = Thermostat bzw. DECT 440) */
function kindOf(role: string | undefined): string {
    return String(role || '').split('.')[0];
}

/**
 * FRITZ!DECT (ioBroker.fritzdect): Kanal `fritzdect.0.DECT_<AIN>` mit Kanal-Rolle und flachen States.
 * Vorlagen, Routinen und Gruppen-Taster bleiben unverändert.
 */
export const fritzdectRules: AdapterRules = {
    state(id, _common, ctx) {
        const channelId = ctx.parentId(id);
        const channel = ctx.objects[channelId];
        if (!channel || channel.type !== 'channel' || !/\.DECT_[^.]+$/.test(channelId)) {
            return undefined;
        }
        const key = id.split('.').pop() || '';
        const kind = kindOf(channel.common?.role);
        // DECT 440 hat die Rolle "thermo", aber keinen Sollwert: dann zählen nur die Sensorwerte
        const table = kind === 'thermo' && !ctx.objects[`${channelId}.tsoll`] ? {} : BY_KIND[kind] || {};
        return table[key] ?? COMMON[key];
    },
};
