import { getName } from '../names';
import { deconzRules } from './deconz';
import { fritzdectRules } from './fritzdect';
import { shellyRules } from './shelly';
import { sonoffRules } from './sonoff';
import { tuyaRules } from './tuya';
import type { AdapterRules, ObjectMap, RuleContext, StatePatch } from './types';
import { zigbee2mqttRules, zigbeeRules } from './zigbee';

export type { ObjectMap } from './types';

/** Adapter mit eigenen Anpassungen (Schlüssel = Adaptername) */
export const ADAPTER_RULES: Record<string, AdapterRules> = {
    sonoff: sonoffRules,
    shelly: shellyRules,
    tuya: tuyaRules,
    fritzdect: fritzdectRules,
    zigbee: zigbeeRules,
    zigbee2mqtt: zigbee2mqttRules,
    deconz: deconzRules,
};

export interface NormalizeResult {
    objects: ObjectMap;
    /** States mit umgekehrter Position (Wertebereich für die Umrechnung) */
    inverted: Map<string, { min: number; max: number }>;
}

/** Sprachwert eines smartName (iot/Alexa): String oder { de, en, …, smartType } */
function smartNameOf(common: ioBroker.StateCommon | undefined, lang: string): string | undefined {
    const sn = (common as { smartName?: unknown } | undefined)?.smartName;
    if (!sn) {
        return undefined;
    }
    if (typeof sn === 'string') {
        return sn.trim() || undefined;
    }
    if (typeof sn === 'object') {
        const rec = sn as Record<string, unknown>;
        const value = rec[lang] ?? rec.de ?? rec.en;
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    }
    return undefined;
}

/** smartType "LIGHT" o. ä. aus der iot-Zuordnung */
function smartTypeOf(common: ioBroker.StateCommon | undefined): string | undefined {
    const sn = (common as { smartName?: unknown } | undefined)?.smartName;
    const type = sn && typeof sn === 'object' ? (sn as { smartType?: unknown }).smartType : undefined;
    return typeof type === 'string' && type ? type : undefined;
}

/**
 * Sieht der Name nach einer technischen Kennung aus (nicht vom Nutzer vergeben)?
 * Beispiele: "DVES_4E55F6" (Tasmota), "Device shellyplus1pm#…", "Channel Relay0", "0x00158d0001a2b3c4".
 */
export function isTechnicalName(name: string | undefined, id: string): boolean {
    if (!name) {
        return true;
    }
    const n = name.trim();
    const last = id.split('.').pop() || '';
    return (
        n.toLowerCase() === last.toLowerCase() ||
        /^(Device|Channel) \S+$/.test(n) ||
        /^DVES_[0-9A-F]+$/i.test(n) ||
        /^(0x)?[0-9a-f]{12,16}$/i.test(n) ||
        /#[0-9a-f]{6,}#\d+$/i.test(n)
    );
}

/** Schalt-/Stell-States zuerst: deren smartName benennt das Gerät am ehesten */
const MAIN_ROLE = /^(switch|level|state$)/;

/**
 * Bereitet die Objekte für die Erkennung auf: Adapter-Regeln anwenden und technische Namen von
 * Kanälen/Geräten durch den smartName (iot/Alexa) eines enthaltenen States ersetzen.
 * Geänderte Objekte werden kopiert – die übergebene Map bleibt unverändert.
 */
export function normalizeObjects(objects: ObjectMap, lang: string): NormalizeResult {
    const result: ObjectMap = { ...objects };
    const inverted = new Map<string, { min: number; max: number }>();

    const children = new Map<string, string[]>();
    for (const id of Object.keys(objects)) {
        const p = id.substring(0, id.lastIndexOf('.'));
        const list = children.get(p);
        if (list) {
            list.push(id);
        } else {
            children.set(p, [id]);
        }
    }
    const ctx: RuleContext = {
        objects,
        children: id => children.get(id) || [],
        parentId: id => id.substring(0, id.lastIndexOf('.')),
        name: obj => getName(obj, lang),
    };
    const hiddenPrefixes: string[] = [];
    const fallbackNames = new Set<string>();
    const isHidden = (id: string): boolean => hiddenPrefixes.some(p => id.startsWith(p));
    const ids = Object.keys(objects).sort();

    // 1. Struktur (Kanäle, Geräte, Ordner)
    for (const id of ids) {
        const obj = objects[id];
        if (!obj || (obj.type !== 'channel' && obj.type !== 'device' && obj.type !== 'folder')) {
            continue;
        }
        const rules = ADAPTER_RULES[id.split('.')[0]];
        const res = rules?.structure?.(id, obj, ctx);
        if (res === 'hide') {
            hiddenPrefixes.push(`${id}.`);
            delete result[id];
        } else if (res?.name) {
            result[id] = { ...obj, common: { ...obj.common, name: res.name } };
            if (res.fallback) {
                fallbackNames.add(id);
            }
        }
    }

    // 2. States
    for (const id of ids) {
        const obj = objects[id];
        if (!obj || obj.type !== 'state' || !id.includes('.')) {
            continue;
        }
        if (isHidden(id)) {
            delete result[id];
            continue;
        }
        const common = obj.common as ioBroker.StateCommon;
        const rules = ADAPTER_RULES[id.split('.')[0]];
        let patch: StatePatch | 'hide' | undefined = rules?.state?.(id, common, ctx);
        if (patch === 'hide') {
            delete result[id];
            continue;
        }
        // iot-Zuordnung "Licht": einfacher Schalter ist eine Lampe
        if (smartTypeOf(common) === 'LIGHT' && (patch?.role ?? common.role) === 'switch' && common.type === 'boolean') {
            patch = { ...patch, role: 'switch.light' };
        }
        if (patch) {
            const { invert, ...rest } = patch;
            if (invert) {
                inverted.set(id, {
                    min: Number(rest.min ?? common.min ?? 0),
                    max: Number(rest.max ?? common.max ?? 100),
                });
            }
            if (Object.keys(rest).length) {
                result[id] = { ...obj, common: { ...common, ...rest } };
            }
        }
    }

    // 3. Technische Kanal-/Gerätenamen durch den smartName eines enthaltenen States ersetzen
    for (const id of ids) {
        const obj = result[id];
        if (!obj || (obj.type !== 'channel' && obj.type !== 'device')) {
            continue;
        }
        if (!fallbackNames.has(id) && !isTechnicalName(getName(obj, lang), id)) {
            continue;
        }
        const states = (children.get(id) || []).filter(c => result[c]?.type === 'state');
        states.sort((a, b) => {
            const ra = MAIN_ROLE.test(String(result[a].common.role || '')) ? 0 : 1;
            const rb = MAIN_ROLE.test(String(result[b].common.role || '')) ? 0 : 1;
            return ra - rb;
        });
        for (const s of states) {
            const name = smartNameOf(result[s].common as ioBroker.StateCommon, lang);
            if (name) {
                result[id] = { ...obj, common: { ...obj.common, name } };
                break;
            }
        }
    }
    return { objects: result, inverted };
}
