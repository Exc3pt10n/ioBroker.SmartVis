import type { SvPvForecast, SvPvForecastValues } from '../../shared/protocol';
import { getName } from '../names';
import { ref, type AdapterProfile, type ObjectMap } from './types';

/**
 * PV-Prognose (Adapter: ioBroker.pvforecast)
 *
 * - summary.power.now (kW oder W), summary.energy.{now,nowUntilEndOfDay,today,tomorrow} (kWh/Wh)
 * - summary.JSONData: [{ t: Zeitstempel ms, y: Leistung }] – Verlauf für heute und morgen
 * - plants.<Anlage>.*: dieselben Werte je Anlage (z. B. Ost- und Westdach)
 */
function values(objects: ObjectMap, base: string, name: string): SvPvForecastValues {
    return {
        name,
        powerNow: ref(objects, `${base}.power.now`, 'Leistung jetzt'),
        energyNow: ref(objects, `${base}.energy.now`, 'Bisher heute'),
        energyRemaining: ref(objects, `${base}.energy.nowUntilEndOfDay`, 'Noch heute'),
        energyToday: ref(objects, `${base}.energy.today`, 'Heute'),
        energyTomorrow: ref(objects, `${base}.energy.tomorrow`, 'Morgen'),
        installed: ref(objects, `${base}.power.installed`, 'Installiert'),
    };
}

export const pvforecastProfile: AdapterProfile = {
    adapter: 'pvforecast',
    claimsInstance: true,
    detect(instance, objects: ObjectMap, lang) {
        const summary = values(objects, `${instance}.summary`, 'Gesamt');
        if (!summary.energyToday && !summary.powerNow) {
            return null;
        }
        const plants: SvPvForecastValues[] = [];
        const prefix = `${instance}.plants.`;
        for (const [id, obj] of Object.entries(objects)) {
            // Anlagen: plants.<id> als Gerät/Kanal direkt unter "plants"
            if (id.startsWith(prefix) && !id.slice(prefix.length).includes('.') && obj.type !== 'state') {
                plants.push(values(objects, id, getName(obj, lang) || id.slice(prefix.length)));
            }
        }
        plants.sort((a, b) => a.name.localeCompare(b.name, lang));

        const pvForecast: SvPvForecast = {
            id: instance,
            name: 'PV-Prognose',
            adapter: 'pvforecast',
            summary,
            // Bei nur einer Anlage ist die Aufteilung überflüssig
            plants: plants.length > 1 ? plants : [],
            curve: ref(objects, `${instance}.summary.JSONData`, 'Verlauf'),
            lastUpdated: ref(objects, `${instance}.summary.lastUpdated`, 'Aktualisiert'),
        };
        return { pvForecast };
    },
};
