import type { AdapterRules } from './types';

/**
 * Sonoff/Tasmota (ioBroker.sonoff): flache States je Gerätekanal.
 * - Im Shutter-Modus treiben POWER1/POWER2 den Motor – keine eigenen Schalter
 * - Diagnosewerte ohne Nutzen für die Bedienung ausblenden (Wifi_Channel hat die Rolle "level")
 */
export const sonoffRules: AdapterRules = {
    state(id, common, ctx) {
        const key = id.split('.').pop() || '';
        if (key === 'Wifi_Channel') {
            return 'hide';
        }
        if (/^POWER\d*$/.test(key)) {
            const channel = ctx.parentId(id);
            if (ctx.children(channel).some(c => /\.Shutter\d+_Position$/.test(c))) {
                return 'hide';
            }
        }
        // Rollladen: Ziel und Richtung sind nur Zwischenwerte
        if (/^Shutter\d+_(Target|Direction)$/.test(key)) {
            return 'hide';
        }
        return common.role === 'value.hsb' ? 'hide' : undefined;
    },
};
