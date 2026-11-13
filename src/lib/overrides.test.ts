import { expect } from 'chai';
import type { SvDevice, SvModel } from '../shared/protocol';
import { applyEdit, applyOverrides, emptyOverrides, parseOverrides } from './overrides';

const dev = (id: string, name: string, roomId: string | null): SvDevice => ({
    id,
    name,
    type: 'light',
    roomId,
    roomSource: roomId ? 'enum' : null,
    adapter: 'hue',
    states: [],
});

const model: SvModel = {
    rooms: [
        { id: 'enum.rooms.kitchen', name: 'Küche', source: 'enum' },
        { id: 'auto.flur', name: 'Flur', source: 'name' },
    ],
    devices: [
        dev('a', 'Spots', 'enum.rooms.kitchen'),
        dev('b', 'Decke', 'enum.rooms.kitchen'),
        dev('c', 'Lampe', null),
    ],
    energy: [],
    wallboxes: [],
    pvForecast: [],
    weather: [],
    shutterControl: [],
    scenes: [],
    generatedAt: 0,
    editable: false,
};

describe('overrides', () => {
    it('renames, moves, hides and favors devices and keeps the original values', () => {
        let o = emptyOverrides();
        o = applyEdit(o, { kind: 'device', id: 'a', patch: { name: '  Arbeitslicht ', favorite: true } });
        o = applyEdit(o, { kind: 'device', id: 'c', patch: { roomId: 'auto.flur', hidden: true } });
        const m = applyOverrides(model, o, true);
        const a = m.devices.find(d => d.id === 'a')!;
        const c = m.devices.find(d => d.id === 'c')!;
        expect(a.name).to.equal('Arbeitslicht');
        expect(a.originalName).to.equal('Spots');
        expect(a.favorite).to.equal(true);
        expect(c.roomId).to.equal('auto.flur');
        expect(c.originalRoomId).to.equal(null);
        expect(c.hidden).to.equal(true);
        expect(m.editable).to.equal(true);
    });

    it('null resets a field back to the detected value', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'device', id: 'a', patch: { name: 'X' } });
        o = applyEdit(o, { kind: 'device', id: 'a', patch: { name: null } });
        expect(o.devices).to.deep.equal({});
    });

    it('can move a device to "no room" explicitly', () => {
        const o = applyEdit(emptyOverrides(), { kind: 'device', id: 'a', patch: { roomId: null } });
        expect(applyOverrides(model, o, true).devices.find(d => d.id === 'a')!.roomId).to.equal(null);
    });

    it('an empty roomId moves the device back to its detected room', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'device', id: 'a', patch: { roomId: 'auto.flur' } });
        o = applyEdit(o, { kind: 'device', id: 'a', patch: { roomId: '' } });
        expect(o.devices).to.deep.equal({});
    });

    it('orders devices and rooms', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'deviceOrder', ids: ['b', 'a'] });
        o = applyEdit(o, { kind: 'roomOrder', ids: ['auto.flur', 'enum.rooms.kitchen'] });
        const m = applyOverrides(model, o, true);
        expect(m.devices.filter(d => d.roomId === 'enum.rooms.kitchen').map(d => d.id)).to.deep.equal(['b', 'a']);
        expect(m.rooms.map(r => r.id)).to.deep.equal(['auto.flur', 'enum.rooms.kitchen']);
    });

    it('creates and deletes custom rooms; moved devices fall back', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'createRoom', name: 'Werkstatt' });
        expect(o.rooms['custom.werkstatt']).to.deep.equal({ name: 'Werkstatt', custom: true });
        o = applyEdit(o, { kind: 'device', id: 'a', patch: { roomId: 'custom.werkstatt' } });
        expect(applyOverrides(model, o, true).devices.find(d => d.id === 'a')!.roomId).to.equal('custom.werkstatt');
        o = applyEdit(o, { kind: 'deleteRoom', id: 'custom.werkstatt' });
        const m = applyOverrides(model, o, true);
        expect(m.rooms.some(r => r.id === 'custom.werkstatt')).to.equal(false);
        expect(m.devices.find(d => d.id === 'a')!.roomId).to.equal('enum.rooms.kitchen');
    });

    it('creates a room and moves a device into it in one step', () => {
        const o = applyEdit(emptyOverrides(), { kind: 'createRoom', name: 'Garage', deviceId: 'c' });
        expect(applyOverrides(model, o, true).devices.find(d => d.id === 'c')!.roomId).to.equal('custom.garage');
    });

    it('refuses to delete detected rooms', () => {
        expect(() => applyEdit(emptyOverrides(), { kind: 'deleteRoom', id: 'enum.rooms.kitchen' })).to.throw();
    });

    it('ignores moves into rooms that no longer exist', () => {
        const o = applyEdit(emptyOverrides(), { kind: 'device', id: 'a', patch: { roomId: 'enum.rooms.gone' } });
        expect(applyOverrides(model, o, true).devices.find(d => d.id === 'a')!.roomId).to.equal('enum.rooms.kitchen');
    });

    it('renames and hides rooms', () => {
        const o = applyEdit(emptyOverrides(), {
            kind: 'room',
            id: 'auto.flur',
            patch: { name: 'Diele', hidden: true },
        });
        const flur = applyOverrides(model, o, true).rooms.find(r => r.id === 'auto.flur')!;
        expect(flur.name).to.equal('Diele');
        expect(flur.originalName).to.equal('Flur');
        expect(flur.hidden).to.equal(true);
    });

    it('hides and shows the "no room" hint', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'ui', patch: { hideNoRoomHint: true } });
        expect(applyOverrides(model, o, true).ui).to.deep.equal({ hideNoRoomHint: true });
        expect(parseOverrides(JSON.stringify(o)).ui).to.deep.equal({ hideNoRoomHint: true });
        o = applyEdit(o, { kind: 'ui', patch: { hideNoRoomHint: null } });
        expect(o.ui).to.equal(undefined);
        expect(applyOverrides(model, o, true).ui).to.deep.equal({});
    });

    it('stores card widths of a view and resets them', () => {
        let o = applyEdit(emptyOverrides(), {
            kind: 'view',
            view: 'home.desk',
            width: { key: 'weather', width: 'half' },
        });
        o = applyEdit(o, { kind: 'view', view: 'home.desk', width: { key: 'lights', width: 'full' } });
        expect(parseOverrides(JSON.stringify(o)).ui?.views?.['home.desk']?.widths).to.deep.equal({
            weather: 'half',
            lights: 'full',
        });
        o = applyEdit(o, { kind: 'view', view: 'home.desk', width: { key: 'weather', width: null } });
        expect(o.ui?.views?.['home.desk']?.widths).to.deep.equal({ lights: 'full' });
        expect(() =>
            applyEdit(o, { kind: 'view', view: 'home.desk', width: { key: 'x', width: 'huge' as 'full' } }),
        ).to.throw();
        o = applyEdit(o, { kind: 'view', view: 'home.desk', widths: null });
        expect(o.ui?.views?.['home.desk']).to.equal(undefined);
        expect(
            parseOverrides(JSON.stringify({ ui: { views: { a: { widths: { x: 'third', y: 'giant' } } } } })).ui,
        ).to.deep.equal({ views: { a: { widths: { x: 'third' } } } });
    });

    it('stores the layout of views (order, hidden) and resets it', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'view', view: 'energy', order: ['history', 'flow', 'flow'] });
        o = applyEdit(o, { kind: 'view', view: 'energy', hidden: ['forecast'] });
        expect(applyOverrides(model, o, true).ui?.views).to.deep.equal({
            energy: { order: ['history', 'flow'], hidden: ['forecast'] },
        });
        expect(parseOverrides(JSON.stringify(o)).ui?.views?.energy?.hidden).to.deep.equal(['forecast']);
        o = applyEdit(o, { kind: 'view', view: 'energy', order: null, hidden: null });
        expect(o.ui).to.equal(undefined);
        expect(() => applyEdit(o, { kind: 'view', view: '../x', order: [] })).to.throw();
        // Fremde Inhalte in der Datei werden verworfen
        expect(
            parseOverrides(JSON.stringify({ ui: { views: { energy: { order: [1, 'a'], x: 1 }, 'bad key!': {} } } })).ui,
        ).to.deep.equal({ views: { energy: { order: ['a'] } } });
    });

    it('stores a room icon (emoji only) and resets it', () => {
        let o = applyEdit(emptyOverrides(), { kind: 'room', id: 'auto.flur', patch: { icon: '🛋️' } });
        expect(applyOverrides(model, o, true).rooms.find(r => r.id === 'auto.flur')?.icon).to.equal('🛋️');
        o = applyEdit(o, { kind: 'room', id: 'auto.flur', patch: { icon: '<b>x</b>' } });
        expect(o.rooms['auto.flur']).to.equal(undefined);
        o = applyEdit(o, { kind: 'room', id: 'auto.flur', patch: { icon: '🛁' } });
        o = applyEdit(o, { kind: 'room', id: 'auto.flur', patch: { icon: null } });
        expect(applyOverrides(model, o, true).rooms.find(r => r.id === 'auto.flur')?.icon).to.equal(undefined);
    });

    it('parses broken files as empty', () => {
        expect(parseOverrides('{kaputt')).to.deep.equal(emptyOverrides());
        expect(parseOverrides(undefined)).to.deep.equal(emptyOverrides());
    });
});
