import type {
    SvAutoShutter,
    SvShutterArea,
    SvShutterAreaInfo,
    SvShutterControl,
    SvSwitch,
} from '../../shared/protocol';
import { ref, type AdapterProfile, type ObjectMap } from './types';

/**
 * Rollladen-Automatik (Adapter: ioBroker.shuttercontrol)
 *
 * - control.*: Buttons (openAll, closeLiving …) und Schalter (autoLiving, Holiday, schoolfree)
 * - shutters.{autoUp,autoDown,autoSun}.<Name>: Automatik je Rollladen
 * - shutters.autoState.<Name>: aktueller Status (up, down, sunProtect, Manu_Mode …)
 * - info.*: Sonnenauf-/-untergang, Sonnenstand, Fahrzeiten je Bereich
 * - Instanz-Konfiguration (native.events): Name → Level-State des Rollladens und Bereich.
 *   Darüber werden die Rollläden mit den Rollladen-Kacheln verknüpft.
 *
 * Sind Trigger-Datenpunkte konfiguriert (triggerAutoLiving, HolidayDP …), spiegelt
 * shuttercontrol deren Wert in control.* – geschrieben wird dann auf die Quelle, damit sie
 * den Wert nicht wieder überschreibt.
 */

interface ShutterEvent {
    enabled?: boolean;
    shutterName?: string;
    name?: string;
    typeUp?: string;
    typeDown?: string;
    heightUp?: string | number;
    heightDown?: string | number;
}

interface ShutterNative {
    events?: ShutterEvent[];
    triggerAutoLiving?: string;
    triggerAutoSleep?: string;
    triggerAutoChildren?: string;
    HolidayDP?: string;
    schoolfreeDP?: string;
}

const AREAS: { key: SvShutterArea; label: string; suffix: string; trigger: keyof ShutterNative }[] = [
    { key: 'living', label: 'Wohnbereich', suffix: 'Living', trigger: 'triggerAutoLiving' },
    { key: 'sleep', label: 'Schlafbereich', suffix: 'Sleep', trigger: 'triggerAutoSleep' },
    { key: 'children', label: 'Kinderbereich', suffix: 'Children', trigger: 'triggerAutoChildren' },
];

/** "living-auto" → living; "astro", "off" … → undefined */
function areaOf(type: string | undefined): SvShutterArea | undefined {
    const m = /^(living|sleep|children)/.exec(type || '');
    return m ? (m[1] as SvShutterArea) : undefined;
}

/** Wie shuttercontrol aus dem Namen die State-ID bildet */
export function shutterKey(name: string): string {
    return name.replace(/[.;, ]/g, '_');
}

function toSwitch(
    objects: ObjectMap,
    valueId: string,
    sourceId: string | undefined,
    label: string,
): SvSwitch | undefined {
    const value = ref(objects, valueId, label);
    if (!value) {
        return undefined;
    }
    const source = sourceId ? ref(objects, sourceId, label) : undefined;
    return { value, write: source && source.write ? source : { ...value, write: true } };
}

function num(v: string | number | undefined, fallback: number): number {
    const n = Number(v);
    return v === '' || v === undefined || !Number.isFinite(n) ? fallback : n;
}

export const shuttercontrolProfile: AdapterProfile = {
    adapter: 'shuttercontrol',
    claimsInstance: true,
    detect(instance, objects) {
        const id = (s: string): string => `${instance}.${s}`;
        if (!objects[id('shutters')] && !objects[id('control')]) {
            return null;
        }
        const native = (objects[`system.adapter.${instance}`]?.native || {}) as ShutterNative;
        const events = (native.events || []).filter(e => e.shutterName);

        const shutters: SvAutoShutter[] = events.map(e => {
            const key = shutterKey(e.shutterName!);
            const area = areaOf(e.typeUp) || areaOf(e.typeDown);
            const level = e.name ? ref(objects, e.name, 'Position') : undefined;
            return {
                name: e.shutterName!,
                level,
                area,
                heightUp: num(e.heightUp, 100),
                heightDown: num(e.heightDown, 0),
                enabled: e.enabled !== false,
                autoUp: ref(objects, id(`shutters.autoUp.${key}`), 'Automatisch öffnen'),
                autoDown: ref(objects, id(`shutters.autoDown.${key}`), 'Automatisch schließen'),
                autoSun: ref(objects, id(`shutters.autoSun.${key}`), 'Sonnenschutz'),
                autoState: ref(objects, id(`shutters.autoState.${key}`), 'Status'),
            };
        });

        const usedAreas = new Set(shutters.map(s => s.area).filter(Boolean));
        const areas: SvShutterAreaInfo[] = AREAS.filter(a => usedAreas.has(a.key) || !events.length).map(a => ({
            key: a.key,
            label: a.label,
            auto: toSwitch(
                objects,
                id(`control.auto${a.suffix}`),
                native[a.trigger] as string | undefined,
                'Automatik',
            ),
            open: ref(objects, id(`control.open${a.suffix}`), 'Öffnen'),
            close: ref(objects, id(`control.close${a.suffix}`), 'Schließen'),
            sunProtect: ref(objects, id(`control.sunProtect${a.suffix}`), 'Sonnenschutz'),
            upTime: ref(objects, id(`info.upTime${a.suffix}`), 'Öffnet'),
            downTime: ref(objects, id(`info.downTime${a.suffix}`), 'Schließt'),
        }));

        const shutterControl: SvShutterControl = {
            id: instance,
            name: 'Rollladen-Automatik',
            adapter: 'shuttercontrol',
            openAll: ref(objects, id('control.openAll'), 'Alle öffnen'),
            closeAll: ref(objects, id('control.closeAll'), 'Alle schließen'),
            sunProtectAll: ref(objects, id('control.sunProtect'), 'Sonnenschutz'),
            autoAll: ref(objects, id('control.autoAll'), 'Alle auf Automatik'),
            holiday: toSwitch(objects, id('control.Holiday'), native.HolidayDP, 'Urlaub / Wochenendzeiten'),
            schoolfree: toSwitch(objects, id('control.schoolfree'), native.schoolfreeDP, 'Schulfrei'),
            areas,
            shutters,
            sun: {
                sunrise: ref(objects, id('info.Sunrise'), 'Sonnenaufgang'),
                sunset: ref(objects, id('info.Sunset'), 'Sonnenuntergang'),
                elevation: ref(objects, id('info.Elevation'), 'Sonnenhöhe'),
                azimuth: ref(objects, id('info.Azimut'), 'Sonnenrichtung'),
            },
        };
        return { shutterControl };
    },
};
