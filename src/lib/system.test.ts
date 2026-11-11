import { expect } from 'chai';
import { discover } from './discovery';

type Obj = ioBroker.Object;
const obj = (id: string, type: string, common: Record<string, unknown>): [string, Obj] => [
    id,
    { _id: id, type, common, native: {} } as unknown as Obj,
];
const st = (id: string, type = 'number', unit?: string): [string, Obj] =>
    obj(id, 'state', { name: id, type, unit, role: 'value', read: true, write: false });

const H = 'system.host.server';
const objects = Object.fromEntries([
    obj(H, 'host', { name: 'server', hostname: 'server', installedVersion: '7.2.5' }),
    st(`${H}.alive`, 'boolean'),
    st(`${H}.cpu`, 'number', '% of one core'),
    st(`${H}.mem`, 'number', '%'),
    st(`${H}.diskFree`, 'number', 'MiB'),
    st(`${H}.diskSize`, 'number', 'MiB'),
    st(`${H}.uptime`, 'number', 'seconds'),
    st(`${H}.versions.nodeCurrent`, 'string'),
    obj('system.adapter.hue.0', 'instance', {
        name: 'hue',
        title: 'Hue',
        titleLang: { de: 'Philips Hue-Bridge', en: 'Philips Hue Bridge' },
        enabled: true,
        mode: 'daemon',
        version: '3.17.4',
        host: 'server',
    }),
    st('system.adapter.hue.0.alive', 'boolean'),
    st('system.adapter.hue.0.connected', 'boolean'),
    st('hue.0.info.connection', 'boolean'),
    obj('system.adapter.feiertage.0', 'instance', {
        name: 'feiertage',
        title: 'Feiertage',
        enabled: false,
        mode: 'schedule',
    }),
    st('system.adapter.feiertage.0.alive', 'boolean'),
]);

describe('ioBroker-Status', () => {
    // "system" steht standardmäßig auf der Ignorierliste – der Status kommt trotzdem
    const result = discover(objects, { language: 'de', ignoreAdapters: ['system', 'hue'] });
    const status = result.model.system!;

    it('liest Hosts mit ihren Kennzahlen', () => {
        expect(status.hosts).to.have.length(1);
        const host = status.hosts[0];
        expect(host.name).to.equal('server');
        expect(host.controllerVersion).to.equal('7.2.5');
        expect(host.cpu?.id).to.equal(`${H}.cpu`);
        expect(host.nodeVersion?.id).to.equal(`${H}.versions.nodeCurrent`);
    });

    it('liest Instanzen mit Titel, Modus und Verbindungs-States', () => {
        expect(status.instances.map(i => i.id)).to.deep.equal(['feiertage.0', 'hue.0']);
        const hue = status.instances.find(i => i.id === 'hue.0')!;
        expect(hue.title).to.equal('Philips Hue-Bridge');
        expect(hue.enabled).to.equal(true);
        expect(hue.connection?.id).to.equal('hue.0.info.connection');
        expect(status.instances.find(i => i.id === 'feiertage.0')!.enabled).to.equal(false);
    });

    it('abonniert die Status-States (nur lesend)', () => {
        expect(result.stateIds).to.include.members([`${H}.cpu`, 'system.adapter.hue.0.alive', 'hue.0.info.connection']);
        expect(result.writableIds.has(`${H}.cpu`)).to.equal(false);
    });
});
