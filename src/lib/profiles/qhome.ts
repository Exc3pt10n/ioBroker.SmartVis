import type { SvEnergyPeriod, SvEnergySystem, SvEnergyTotals } from '../../shared/protocol';
import { ref, type AdapterProfile } from './types';

/**
 * QCells Q.HOME+ ESS HYB-G2 (Adapter: github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2)
 *
 * Echtzeitwerte direkt unter der Instanz, Richtungen bereits getrennt:
 * GridPwPurchaseWb/GridPwFeedInWb (W), BtPwCharge/BtPwDisCharge (W), PvPw/ConsPw (kW).
 * Energiezähler unter counters.<zeitraum>.* (kWh / %), Vorperiode jeweils unter .previous.
 */

/** Zeiträume des Adapters: [Kanal, Gruppe, Bezeichnung] */
const PERIODS: [string, string, string][] = [
    ['day', 'day', 'Heute'],
    ['day.previous', 'day', 'Gestern'],
    ['month', 'month', 'Dieser Monat'],
    ['month.previous', 'month', 'Vormonat'],
    ['quarter', 'quarter', 'Dieses Quartal'],
    ['quarter.previous', 'quarter', 'Vorquartal'],
    ['halfyear', 'halfyear', 'Dieses Halbjahr'],
    ['halfyear.previous', 'halfyear', 'Vorhalbjahr'],
    ['year', 'year', 'Dieses Jahr'],
    ['year.previous', 'year', 'Vorjahr'],
    ['total', 'total', 'Gesamt'],
];

function totals(objects: Parameters<typeof ref>[0], base: string): SvEnergyTotals {
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
    detect(instance, objects) {
        const id = (s: string): string => `${instance}.${s}`;
        const pv = ref(objects, id('PvPw'), 'PV');
        if (!pv) {
            return null;
        }
        const periods: SvEnergyPeriod[] = [];
        for (const [key, group, label] of PERIODS) {
            const t = totals(objects, id(`counters.${key}`));
            if (Object.values(t).some(Boolean)) {
                periods.push({
                    key,
                    group,
                    label,
                    periodKey: ref(objects, id(`counters.${key}.periodKey`), 'Zeitraum'),
                    totals: t,
                });
            }
        }

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
