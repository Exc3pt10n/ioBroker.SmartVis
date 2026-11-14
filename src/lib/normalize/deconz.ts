import type { AdapterRules } from './types';

/**
 * deCONZ (ioBroker.deconz): Lampen `Lights.<n>`, Sensoren `Sensors.<n>`, Gruppen `Groups.<n>`.
 * - Helligkeit doppelt (bri 0–255, level 0–100, beide "level.brightness") → level als Dimmer
 * - Rollladen: lift 0 = offen, 100 = zu (Rolle "level.value")
 * - Kontakt "open" (sensor.open) → Fenster
 */
export const deconzRules: AdapterRules = {
    state(id, common) {
        const parts = id.split('.');
        const kind = parts[2];
        const key = parts[parts.length - 1];
        if (key === 'bri' && (kind === 'Lights' || kind === 'Groups')) {
            return 'hide';
        }
        if (key === 'on' && common.role === 'switch' && (kind === 'Lights' || kind === 'Groups')) {
            return { role: 'switch.light' };
        }
        if (key === 'level' && common.role === 'level.brightness') {
            return { role: 'level.dimmer' };
        }
        if (key === 'lift' && kind === 'Lights') {
            return { role: 'level.blind', invert: true };
        }
        if (key === 'tilt' && kind === 'Lights') {
            return { role: 'level.tilt', invert: true };
        }
        if (key === 'open' && common.role === 'sensor.open') {
            // Bei Rollläden meldet "open" nur "nicht ganz zu"
            return kind === 'Sensors' ? { role: 'sensor.window' } : 'hide';
        }
        if (key === 'stop' && kind === 'Lights') {
            return { role: 'button.stop' };
        }
        if (/^(transitiontime|alert|effect|colorloopspeed|dimspeed|dimup|dimdown|action)$/.test(key)) {
            return 'hide';
        }
        // Gruppe: "any_on" ist nur Anzeige
        if (key === 'any_on' || key === 'all_on') {
            return 'hide';
        }
        return undefined;
    },
};
