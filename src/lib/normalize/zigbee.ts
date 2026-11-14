import type { AdapterRules, RuleContext, StatePatch } from './types';

const HIDE =
    /^(child_lock|send_payload|brightness_move|brightness_step|colortemp_move|transition_time|transition|effect|power_on_behavior|power_outage_memory|indicator_mode|led_disabled_night|calibration|motor_reversal)$/;

/** Rollladen/Markise: Position (0–100 %) neben einem Fahrbefehl OPEN/CLOSE/STOP */
function coverPosition(id: string, common: ioBroker.StateCommon, ctx: RuleContext): StatePatch | undefined {
    if (common.type !== 'number' || !common.write) {
        return undefined;
    }
    const device = ctx.parentId(id);
    const stateObj = ctx.objects[`${device}.state`];
    const states = (stateObj?.common as ioBroker.StateCommon | undefined)?.states;
    const values = states && typeof states === 'object' ? Object.keys(states).join(' ').toUpperCase() : '';
    const isCover = /OPEN/.test(values) || (stateObj?.common as ioBroker.StateCommon | undefined)?.type === 'string';
    return isCover ? { role: 'level.blind' } : undefined;
}

function commonRules(id: string, common: ioBroker.StateCommon, ctx: RuleContext): StatePatch | 'hide' | undefined {
    const key = id.split('.').pop() || '';
    if (HIDE.test(key)) {
        return 'hide';
    }
    if (key === 'position' || key === 'position_l1' || key === 'position_left') {
        return coverPosition(id, common, ctx);
    }
    // Fahrbefehl als Text (OPEN/CLOSE/STOP) – kein Schalter
    if (key === 'state' && common.type === 'string' && common.role === 'switch') {
        return { role: 'state' };
    }
    // Kontakt: "opened" ist der Fenster-/Türzustand, "contact" das Gegenteil
    if (key === 'opened' && common.role === 'sensor.contact') {
        return { role: 'sensor.window' };
    }
    if (key === 'contact' && common.type === 'boolean' && ctx.objects[`${ctx.parentId(id)}.opened`]) {
        return 'hide';
    }
    // Der type-detector wertet "indicator.*" nie als Hauptwert aus
    if (common.role === 'indicator.leakage' || common.role === 'indicator.alarm.flood') {
        return { role: 'sensor.alarm.flood' };
    }
    if (common.role === 'indicator.alarm.fire' || common.role === 'indicator.smoke') {
        return { role: 'sensor.alarm.fire' };
    }
    if (key === 'available' && common.type === 'boolean' && common.role === 'state') {
        return { role: 'indicator.reachable' };
    }
    if (key === 'link_quality') {
        return 'hide';
    }
    return undefined;
}

/** ioBroker.zigbee: Geräte `zigbee.0.<IEEE>` mit States direkt darunter */
export const zigbeeRules: AdapterRules = {
    state: commonRules,
};

/** ioBroker.zigbee2mqtt: Geräte `zigbee2mqtt.0.<IEEE>`, sonst wie zigbee */
export const zigbee2mqttRules: AdapterRules = {
    state: commonRules,
};
