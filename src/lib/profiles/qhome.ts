import type { SvEnergySystem } from '../../shared/protocol';
import { ref, type EnergyProfile } from './types';

/**
 * QCells Q.HOME+ ESS HYB-G2 (Adapter: github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2)
 *
 * Echtzeitwerte direkt unter der Instanz, Richtungen bereits getrennt:
 * GridPwPurchaseWb/GridPwFeedInWb (W), BtPwCharge/BtPwDisCharge (W), PvPw/ConsPw (kW).
 * Energiezähler unter counters.day.* (kWh / %).
 */
export const qhomeProfile: EnergyProfile = {
    adapter: 'qhome-ess-hyb-g2',
    detect(instance, objects): SvEnergySystem | null {
        const id = (s: string): string => `${instance}.${s}`;
        const pv = ref(objects, id('PvPw'), 'PV');
        if (!pv) {
            return null;
        }
        const day = (s: string): string => id(`counters.day.${s}`);

        return {
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
            today: {
                pv: ref(objects, day('PvGen'), 'PV-Erzeugung'),
                home: ref(objects, day('Cons'), 'Verbrauch'),
                gridImport: ref(objects, day('GridPurchase'), 'Netzbezug'),
                gridExport: ref(objects, day('GridFeedIn'), 'Einspeisung'),
                batteryCharge: ref(objects, day('BtCharged'), 'Batterie geladen'),
                batteryDischarge: ref(objects, day('BtDischarged'), 'Batterie entladen'),
                autarky: ref(objects, day('Autarky'), 'Autarkie'),
                selfConsumption: ref(objects, day('SelfConsRate'), 'Eigenverbrauch'),
            },
            connected: ref(objects, id('info.connection'), 'Verbunden'),
        };
    },
};
