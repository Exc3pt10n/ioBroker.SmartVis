import type { SvEnergyPeriod, SvEnergySystem, SvEnergyTotals } from '../../shared/protocol';
import { getName } from '../names';
import { ref, type AdapterProfile, type ObjectMap } from './types';

/**
 * QCells Q.HOME+ ESS HYB-G2 (Adapter: github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2)
 *
 * Echtzeitwerte direkt unter der Instanz, Richtungen bereits getrennt:
 * GridPwPurchaseWb/GridPwFeedInWb (W), BtPwCharge/BtPwDisCharge (W), PvPw/ConsPw (kW).
 * Ab Adapter 0.3.0 mit zusätzlichen Erzeugern: PvPwTotal (gesamt) = PvPw (Q.HOME) + PvPwExt.
 * Energiezähler unter counters.<zeitraum>.* (kWh / %), Vorperiode jeweils unter .previous.
 */

/** Bekannte Zeiträume: Reihenfolge und Bezeichnungen; weitere Kanäle unter counters.* werden ebenfalls erkannt */
const KNOWN_PERIODS: Record<string, { order: number; group: string; current: string; previous: string }> = {
    day: { order: 0, group: 'Tag', current: 'Heute', previous: 'Gestern' },
    week: { order: 1, group: 'Woche', current: 'Diese Woche', previous: 'Vorwoche' },
    month: { order: 2, group: 'Monat', current: 'Dieser Monat', previous: 'Vormonat' },
    quarter: { order: 3, group: 'Quartal', current: 'Dieses Quartal', previous: 'Vorquartal' },
    halfyear: { order: 4, group: 'Halbjahr', current: 'Dieses Halbjahr', previous: 'Vorhalbjahr' },
    year: { order: 5, group: 'Jahr', current: 'Dieses Jahr', previous: 'Vorjahr' },
    total: { order: 99, group: 'Gesamt', current: 'Gesamt', previous: 'Gesamt (vorher)' },
};
/** Unbekannte Zeiträume stehen vor "Gesamt" */
const UNKNOWN_ORDER = 50;

/**
 * Alle Zählerzeiträume einer Instanz: jeder Kanal counters.<zeitraum> mit bekannten Zählern,
 * die Vorperiode jeweils unter counters.<zeitraum>.previous.
 */
function findPeriods(objects: ObjectMap, instance: string, lang: string): SvEnergyPeriod[] {
    const prefix = `${instance}.counters.`;
    const keys = new Set<string>();
    for (const id of Object.keys(objects)) {
        if (id.startsWith(prefix)) {
            const key = id.slice(prefix.length).split('.')[0];
            if (key && objects[`${prefix}${key}`]?.type !== 'state') {
                keys.add(key);
            }
        }
    }
    const order = (key: string): number => KNOWN_PERIODS[key]?.order ?? UNKNOWN_ORDER;
    const sorted = [...keys].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

    const periods: SvEnergyPeriod[] = [];
    for (const key of sorted) {
        const base = `${prefix}${key}`;
        const known = KNOWN_PERIODS[key];
        const name = getName(objects[base], lang);
        const groupLabel = known?.group || (name ? name.replace(/^aktuelle[rs]?\s+/i, '') : key);
        const add = (subKey: string, label: string): void => {
            const t = totals(objects, `${prefix}${subKey}`);
            if (Object.values(t).some(Boolean)) {
                periods.push({
                    key: subKey,
                    group: key,
                    groupLabel,
                    label,
                    periodKey: ref(objects, `${prefix}${subKey}.periodKey`, 'Zeitraum'),
                    totals: t,
                });
            }
        };
        add(key, known?.current || name || key);
        add(
            `${key}.previous`,
            known?.previous || getName(objects[`${base}.previous`], lang) || `${groupLabel} (vorher)`,
        );
    }
    return periods;
}

function totals(objects: ObjectMap, base: string): SvEnergyTotals {
    const c = (s: string): string => `${base}.${s}`;
    return {
        pv: ref(objects, c('PvGen'), 'PV-Erzeugung'),
        home: ref(objects, c('Cons'), 'Verbrauch'),
        gridImport: ref(objects, c('GridPurchase'), 'Netzbezug'),
        gridExport: ref(objects, c('GridFeedIn'), 'Einspeisung'),
        batteryCharge: ref(objects, c('BtCharged'), 'Batterie geladen'),
        batteryDischarge: ref(objects, c('BtDischarged'), 'Batterie entladen'),
        autarky: ref(objects, c('Autarky'), 'Autarkie'),
        selfConsumption: ref(objects, c('SelfConsRate'), 'Eigenverbrauch'),
        selfSupply: ref(objects, c('SelfSupply'), 'Eigenversorgung'),
    };
}
export const qhomeProfile: AdapterProfile = {
    adapter: 'qhome-ess-hyb-g2',
    claimsInstance: true,
    detect(instance, objects, lang) {
        const id = (s: string): string => `${instance}.${s}`;
        const ownPv = ref(objects, id('PvPw'), 'Q.HOME');
        if (!ownPv) {
            return null;
        }
        // Zusätzliche Erzeuger (Adapter ab 0.3.0): PvPwTotal = PvPw + PvPwExt; ohne sie wie bisher PvPw
        const extPv = ref(objects, id('PvPwExt'), 'Weitere Erzeuger');
        const pv = ref(objects, id('PvPwTotal'), 'PV') || { ...ownPv, name: 'PV' };
        const periods = findPeriods(objects, instance, lang);

        const energy: SvEnergySystem = {
            id: instance,
            name: 'Q.HOME Speicher',
            adapter: 'qhome-ess-hyb-g2',
            flows: {
                pv,
                home: ref(objects, id('ConsPw'), 'Haus'),
                gridImport: ref(objects, id('GridPwPurchaseWb'), 'Netzbezug'),
                gridExport: ref(objects, id('GridPwFeedInWb'), 'Einspeisung'),
                batteryCharge: ref(objects, id('BtPwCharge'), 'Laden'),
                batteryDischarge: ref(objects, id('BtPwDisCharge'), 'Entladen'),
            },
            ...(extPv && pv.id !== ownPv.id && { pvParts: [ownPv, extPv] }),
            battery: {
                soc: ref(objects, id('BtSoc'), 'Ladezustand'),
                remaining: ref(objects, id('BtLast'), 'Restlaufzeit'),
            },
            today: periods.find(p => p.key === 'day')?.totals,
            periods,
            connected: ref(objects, id('info.connection'), 'Verbunden'),
        };
        return { energy };
    },
};
