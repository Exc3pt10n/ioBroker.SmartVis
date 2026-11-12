import { expect } from 'chai';
import { discover } from './discovery';
import { historyOptions, holdGaps, toPoints } from './history';

type Obj = ioBroker.Object;
const st = (
    id: string,
    role: string,
    unit: string,
    write: boolean,
    custom?: Record<string, unknown>,
): [string, Obj] => [
    id,
    {
        _id: id,
        type: 'state',
        common: { name: id, role, type: 'number', unit, read: true, write, ...(custom ? { custom } : {}) },
        native: {},
    } as unknown as Obj,
];
const sqlOn = { 'sql.0': { enabled: true, changesOnly: true, retention: 604800 } };

const objects: Record<string, Obj> = Object.fromEntries([
    // Instanzen: sql = History-Adapter, iqontrol nicht
    [
        'system.adapter.sql.0',
        { _id: 'system.adapter.sql.0', type: 'instance', common: { name: 'sql' }, native: {} } as unknown as Obj,
    ],
    [
        'system.adapter.iqontrol.0',
        {
            _id: 'system.adapter.iqontrol.0',
            type: 'instance',
            common: { name: 'iqontrol' },
            native: {},
        } as unknown as Obj,
    ],
    // Wandthermostat: Ist-Temperatur geloggt, Sollwert nur mit iQontrol-Einstellungen
    [
        'hm-rpc.0.WTH',
        {
            _id: 'hm-rpc.0.WTH',
            type: 'device',
            common: { name: 'Wandthermostat Bad' },
            native: { TYPE: 'HmIP-WTH-2' },
        } as unknown as Obj,
    ],
    [
        'hm-rpc.0.WTH.1',
        {
            _id: 'hm-rpc.0.WTH.1',
            type: 'channel',
            common: { name: 'Wandthermostat Bad:1' },
            native: { TYPE: 'HEATING_CLIMATECONTROL_TRANSCEIVER' },
        } as unknown as Obj,
    ],
    st('hm-rpc.0.WTH.1.ACTUAL_TEMPERATURE', 'value.temperature', '°C', false, sqlOn),
    st('hm-rpc.0.WTH.1.SET_POINT_TEMPERATURE', 'level.temperature', '°C', true, { 'iqontrol.0': { enabled: true } }),
    // Q.HOME: PvPw wird direkt geloggt; Netzbezug in W angezeigt, in kW geloggt
    st('qhome-ess-hyb-g2.0.PvPw', 'value', 'kW', false, sqlOn),
    st('qhome-ess-hyb-g2.0.GridPwPurchaseWb', 'value', 'W', false),
    st('qhome-ess-hyb-g2.0.GridPwPurchase', 'value', 'kW', false, sqlOn),
    st('qhome-ess-hyb-g2.0.BtSoc', 'value.battery', '%', false, sqlOn),
    st('qhome-ess-hyb-g2.0.ConsPw', 'value', 'kW', false),
]);

describe('history', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: ['system'] });
    const thermostat = result.model.devices.find(d => d.id === 'hm-rpc.0.WTH.1')!;
    const energy = result.model.energy[0];

    it('marks logged states with their history instance', () => {
        const actual = thermostat.states.find(s => s.name === 'ACTUAL')!;
        expect(actual.history).to.deep.equal({
            instance: 'sql.0',
            id: 'hm-rpc.0.WTH.1.ACTUAL_TEMPERATURE',
            unit: '°C',
        });
    });

    it('ignores custom settings of non-history adapters (iQontrol)', () => {
        expect(thermostat.states.find(s => s.name === 'SET')!.history).to.equal(undefined);
    });

    it('uses logged alternatives for the Q.HOME flows, with their own unit', () => {
        expect(energy.flows.pv?.history).to.deep.equal({
            instance: 'sql.0',
            id: 'qhome-ess-hyb-g2.0.PvPw',
            unit: 'kW',
        });
        expect(energy.flows.gridImport?.history?.id).to.equal('qhome-ess-hyb-g2.0.GridPwPurchase');
        expect(energy.flows.gridImport?.history?.unit).to.equal('kW');
        expect(energy.battery?.soc?.history?.id).to.equal('qhome-ess-hyb-g2.0.BtSoc');
        expect(energy.flows.home?.history).to.equal(undefined);
    });

    it('whitelists exactly the logged ids', () => {
        expect([...result.historyIds.keys()].sort()).to.deep.equal([
            'hm-rpc.0.WTH.1.ACTUAL_TEMPERATURE',
            'qhome-ess-hyb-g2.0.BtSoc',
            'qhome-ess-hyb-g2.0.GridPwPurchase',
            'qhome-ess-hyb-g2.0.PvPw',
        ]);
        expect(result.historyIds.get('qhome-ess-hyb-g2.0.BtSoc')).to.equal('sql.0');
    });

    it('builds averaged query options per range', () => {
        const now = 1_700_000_000_000;
        const o = historyOptions('24h', now);
        expect(o.start).to.equal(now - 24 * 3600_000);
        expect(o.aggregate).to.equal('average');
        expect(o.step).to.equal(15 * 60_000);
        expect(() => historyOptions('1y' as never)).to.throw();
    });

    it('converts getHistory results into sorted points and drops invalid rows', () => {
        expect(
            toPoints([
                { ts: 2000, val: 1.5 },
                { ts: 1000, val: true },
                { ts: 3000, val: null },
                { ts: 'x', val: 2 },
            ]),
        ).to.deep.equal([
            [1000, 1],
            [2000, 1.5],
        ]);
        expect(toPoints(undefined)).to.deep.equal([]);
    });

    it('hält bei Lücken (nur Änderungen aufgezeichnet) den letzten Wert statt schräg zu verbinden', () => {
        const m = 60_000;
        const step = 15 * m;
        const points: [number, number][] = [
            [0, 0.15],
            [15 * m, 0.16],
            // 20 Stunden ohne Änderung
            [20 * 60 * m, 0.18],
            [20 * 60 * m + 15 * m, 0.47],
        ];
        const end = 22 * 60 * m;
        expect(holdGaps(points, step, end)).to.deep.equal([
            [0, 0.15],
            [15 * m, 0.16],
            [20 * 60 * m - step, 0.16],
            [20 * 60 * m, 0.18],
            [20 * 60 * m + 15 * m, 0.47],
            [end, 0.47],
        ]);
        // Ohne Lücken unverändert
        expect(holdGaps(points.slice(0, 2), step, 20 * m)).to.deep.equal(points.slice(0, 2));
        expect(holdGaps([], step, end)).to.deep.equal([]);
    });
});
