import type { AdapterRules, RuleContext } from './types';

/** Ausgänge (Kanaltyp + Nummer) eines Shelly-Geräts */
const OUTPUT = /^(Relay|Light|Cover|CCT|RGB|RGBW|Rgb|Rgbw|White|lights|EM|EM1|PM1)(\d+)$/;

/** "shellyplus1pm" → "Shelly Plus 1PM", "SHDW-2" → "Shelly DW-2" */
export function shellyModel(deviceKey: string): string {
    const [type, mac] = deviceKey.split('#');
    let model = type.replace(/^shelly/i, '').replace(/^SH/, '');
    const prefix = /^(plus|pro|mini|wall|blu)/i.exec(model)?.[1];
    if (prefix) {
        model = `${prefix[0].toUpperCase()}${prefix.slice(1).toLowerCase()} ${model.slice(prefix.length).toUpperCase()}`;
    } else {
        model = model.toUpperCase();
    }
    const tail = mac ? ` ${mac.slice(-4).toUpperCase()}` : '';
    return `Shelly ${model.trim()}${tail}`;
}

function deviceName(deviceId: string, ctx: RuleContext): { name: string; fallback: boolean } {
    const own = ctx.name(ctx.objects[deviceId]);
    if (own && !/^Device /.test(own)) {
        return { name: own, fallback: false };
    }
    return { name: shellyModel(deviceId.split('.')[2] || ''), fallback: true };
}

/**
 * Shelly (ioBroker.shelly): Gerät `shelly.0.<Typ>#<MAC>#1` mit Kanälen je Ausgang.
 * - Namen: "Device …"/"Channel …" bis in der Shelly-App Namen vergeben sind → Gerätename bzw. Modell
 * - Eingänge (InputN) sind Tasterkonfiguration, keine Schalter
 * - Gerätetemperatur, Übergangs-, Favoriten- und Schwellwerte ausblenden
 * - Helligkeit (level.brightness) als Dimmer, Wirkleistung des 3EM als Leistung
 */
export const shellyRules: AdapterRules = {
    structure(id, obj, ctx) {
        const parts = id.split('.');
        if (obj.type === 'device' && parts.length === 3) {
            const n = deviceName(id, ctx);
            return n.fallback ? n : undefined;
        }
        if (obj.type !== 'channel' || parts.length !== 4) {
            return undefined;
        }
        const key = parts[3];
        if (/^Input\d+$/.test(key) || /^(Sys|ext|Ext|BLE|DevicePower\d+)$/.test(key)) {
            // Systemkanäle enthalten nur Konfiguration; DevicePower liefert die Batterie über den Gerätenamen
            return key.startsWith('DevicePower') ? undefined : 'hide';
        }
        const own = ctx.name(obj);
        if (own && !/^Channel /.test(own)) {
            return undefined;
        }
        const deviceId = parts.slice(0, 3).join('.');
        const dev = deviceName(deviceId, ctx);
        const m = OUTPUT.exec(key);
        // Mehrere Ausgänge derselben Art (2PM, Pro 4PM …): durchnummerieren
        const same = m
            ? ctx.children(deviceId).filter(c => {
                  const k = c.split('.').pop() || '';
                  return OUTPUT.exec(k)?.[1] === m[1] && ctx.objects[c]?.type === 'channel';
              }).length
            : 0;
        return { name: m && same > 1 ? `${dev.name} ${Number(m[2]) + 1}` : dev.name, fallback: dev.fallback };
    },
    state(id, common) {
        const parts = id.split('.');
        const key = parts[parts.length - 1];
        const channel = parts[3] || '';
        if (/^temperature[CF]$/.test(key) && OUTPUT.test(channel)) {
            return 'hide';
        }
        if (/^temperatureF\d*$/.test(key) || /^(tF|Fahrenheit)$/.test(key)) {
            return 'hide';
        }
        if (
            /^Transition_|^FavoritePos|^NightMode|^ButtonDoublePush|^MinBrightness|^ReportThreshold$|^InputInverted$/.test(
                key,
            ) ||
            parts.some(p => /^FavoritePos\d+$/.test(p))
        ) {
            return 'hide';
        }
        // Ziel- statt Ist-Position würde den Rollladen-Regler springen lassen
        if (key === 'TargetPosition') {
            return 'hide';
        }
        const isLight = /^(Light|lights|RGBW?|White|CCT)\d*$/i.test(channel);
        if (common.role === 'level.brightness' && common.write && isLight) {
            return { role: 'level.dimmer' };
        }
        if (key === 'Switch' && common.role === 'switch' && isLight) {
            return { role: 'switch.light' };
        }
        if (/^EM\d+$/.test(channel)) {
            if (key === 'TotalActivePower') {
                return { role: 'value.power' };
            }
            // Einzelphasen bleiben in ioBroker, die Kachel zeigt die Summe
            if (
                /^(ActivePower|ApparentPower|Voltage|Current|PowerFactor)[A-C]$/.test(key) ||
                key === 'TotalApparentPower'
            ) {
                return 'hide';
            }
        }
        if (/^EM1:?\d+$/.test(channel) && key === 'Power') {
            return { role: 'value.power' };
        }
        return undefined;
    },
};
