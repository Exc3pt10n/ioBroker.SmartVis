import { expect } from 'chai';
import { discover } from '../discovery';

function st(id: string, unit = '', role = 'value'): [string, ioBroker.Object] {
    return [
        id,
        {
            _id: id,
            type: 'state',
            common: { name: id, type: 'number', role, unit, read: true, write: false },
            native: {},
        } as unknown as ioBroker.Object,
    ];
}

const I = 'qhome-ess-hyb-g2.0';
const objects = Object.fromEntries([
    st(`${I}.PvPw`, 'kW'),
    st(`${I}.ConsPw`, 'kW'),
    st(`${I}.GridPwPurchaseWb`, 'W'),
    st(`${I}.GridPwFeedInWb`, 'W'),
    st(`${I}.BtPwCharge`, 'W'),
    st(`${I}.BtPwDisCharge`, 'W'),
    st(`${I}.BtSoc`, '%', 'value.battery'),
    st(`${I}.BtLast`, 'Min'),
    [`${I}.counters.day`, { _id: `${I}.counters.day`, type: 'channel', common: { name: 'Tag' }, native: {} }],
    st(`${I}.counters.day.PvGen`, 'kWh', 'value.energy'),
    st(`${I}.counters.day.Autarky`, '%'),
    st(`${I}.counters.day.previous.PvGen`, 'kWh', 'value.energy'),
    st(`${I}.counters.month.PvGen`, 'kWh', 'value.energy'),
    st(`${I}.counters.month.SelfSupply`, 'kWh', 'value.energy'),
    st(`${I}.counters.total.PvGen`, 'kWh', 'value.energy'),
    // Später hinzugefügte Zeiträume: bekannt (Woche) und unbekannt (Name aus dem Objekt)
    st(`${I}.counters.week.PvGen`, 'kWh', 'value.energy'),
    st(`${I}.counters.week.previous.PvGen`, 'kWh', 'value.energy'),
    [
        `${I}.counters.season`,
        { _id: `${I}.counters.season`, type: 'channel', common: { name: 'Aktuelle Saison' }, native: {} },
    ],
    st(`${I}.counters.season.PvGen`, 'kWh', 'value.energy'),
    [
        `${I}.counters.season.previous`,
        { _id: `${I}.counters.season.previous`, type: 'channel', common: { name: 'Vorsaison' }, native: {} },
    ],
    st(`${I}.counters.season.previous.PvGen`, 'kWh', 'value.energy'),
    [
        `${I}.counters.month.periodKey`,
        {
            _id: `${I}.counters.month.periodKey`,
            type: 'state',
            common: { name: 'Zeitraum', type: 'string', role: 'text', read: true, write: false },
            native: {},
        },
    ],
]) as Record<string, ioBroker.Object>;

describe('profile: qhome-ess-hyb-g2', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const system = result.model.energy[0];

    it('detects the energy system per instance', () => {
        expect(result.model.energy).to.have.length(1);
        expect(system.id).to.equal(I);
    });

    it('maps power flows with units', () => {
        expect(system.flows.pv?.id).to.equal(`${I}.PvPw`);
        expect(system.flows.pv?.unit).to.equal('kW');
        expect(system.flows.gridImport?.id).to.equal(`${I}.GridPwPurchaseWb`);
        expect(system.flows.batteryDischarge?.id).to.equal(`${I}.BtPwDisCharge`);
        expect(system.battery?.soc?.id).to.equal(`${I}.BtSoc`);
    });

    it('maps daily counters and skips missing ones', () => {
        expect(system.today?.pv?.id).to.equal(`${I}.counters.day.PvGen`);
        expect(system.today?.gridImport).to.equal(undefined);
    });

    it('subscribes the states but does not create generic tiles for them', () => {
        expect(result.stateIds).to.include(`${I}.PvPw`);
        expect(result.model.devices.filter(d => d.adapter === 'qhome-ess-hyb-g2')).to.have.length(0);
    });

    it('can be disabled via ignored adapters', () => {
        const ignored = discover(objects, { language: 'de', ignoreAdapters: ['qhome-ess-hyb-g2'] });
        expect(ignored.model.energy).to.have.length(0);
    });

    it('liest alle Zählerzeiträume inkl. Vorperiode, auch neu hinzugekommene', () => {
        expect(system.periods?.map(p => `${p.group}:${p.label}`)).to.deep.equal([
            'day:Heute',
            'day:Gestern',
            'week:Diese Woche',
            'week:Vorwoche',
            'month:Dieser Monat',
            'season:Aktuelle Saison',
            'season:Vorsaison',
            'total:Gesamt',
        ]);
        expect(system.periods?.find(p => p.key === 'season')?.groupLabel).to.equal('Saison');
        expect(system.periods?.find(p => p.key === 'week')?.groupLabel).to.equal('Woche');
        const month = system.periods?.find(p => p.key === 'month');
        expect(month?.totals.selfSupply?.id).to.equal(`${I}.counters.month.SelfSupply`);
        expect(month?.periodKey?.id).to.equal(`${I}.counters.month.periodKey`);
        expect(system.today?.pv?.id).to.equal(`${I}.counters.day.PvGen`);
        expect(result.stateIds).to.include(`${I}.counters.total.PvGen`);
    });
});
