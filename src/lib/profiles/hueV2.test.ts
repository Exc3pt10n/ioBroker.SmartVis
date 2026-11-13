import { expect } from 'chai';
import { discover } from '../discovery';

type Obj = ioBroker.Object;
type Native = Record<string, unknown>;

function channel(id: string, name: string, native: Native, role?: string): [string, Obj] {
    return [id, { _id: id, type: 'channel', common: { name, ...(role && { role }) }, native } as unknown as Obj];
}
function folder(id: string, name: string): [string, Obj] {
    return [id, { _id: id, type: 'folder', common: { name }, native: {} } as unknown as Obj];
}
function state(id: string, common: Record<string, unknown>, native: Native = {}): [string, Obj] {
    return [
        id,
        {
            _id: id,
            type: 'state',
            common: { name: id.split('.').pop(), read: true, write: false, ...common },
            native,
        } as unknown as Obj,
    ];
}
/** Steuer-States wie in hue-v2 (lightControlObjects) */
function controls(base: string, color: boolean): [string, Obj][] {
    return [
        state(`${base}.on`, { type: 'boolean', role: 'switch.light', write: true }),
        state(`${base}.brightness`, { type: 'number', role: 'level.dimmer', unit: '%', min: 0, max: 100, write: true }),
        ...(color
            ? [
                  state(`${base}.colorTemperature`, {
                      type: 'number',
                      role: 'level.color.temperature',
                      unit: 'K',
                      min: 2000,
                      max: 6500,
                      write: true,
                  }),
                  state(`${base}.xy`, { type: 'string', role: 'level.color.xy', write: true }),
                  state(`${base}.rgb`, { type: 'string', role: 'level.color.rgb', write: true }),
              ]
            : []),
        state(`${base}.command`, { type: 'string', role: 'json', write: true }),
    ];
}

/** Objektbaum wie ihn hue-v2 anlegt (lights / rooms / zones / all, Szenen und Smart Scenes in Ordnern) */
function hueV2(withLights: boolean): [string, Obj][] {
    const lights = (ids: string[]): Native => (withLights ? { lights: ids } : {});
    const room = 'hue-v2.0.rooms.Wohnzimmer';
    return [
        folder('hue-v2.0.lights', 'Lights'),
        channel('hue-v2.0.lights.Desk', 'Desk', { id: 'light-desk', type: 'light', deviceId: 'dev-desk' }),
        ...controls('hue-v2.0.lights.Desk', true),
        state('hue-v2.0.lights.Desk.reachable', { type: 'boolean', role: 'indicator.reachable' }),
        channel('hue-v2.0.lights.Hall', 'Hall', { id: 'light-hall', type: 'light', deviceId: 'dev-hall' }),
        ...controls('hue-v2.0.lights.Hall', false),
        folder('hue-v2.0.rooms', 'Rooms'),
        channel(room, 'Wohnzimmer', {
            id: 'room-living',
            type: 'room',
            groupedLightId: 'gl-living',
            ...lights(['light-desk', 'light-hall']),
        }),
        ...controls(room, true),
        state(`${room}.allOn`, { type: 'boolean', role: 'indicator' }),
        state(`${room}.activeScene`, { type: 'string', role: 'text' }),
        folder(`${room}.scenes`, 'Scenes'),
        state(
            `${room}.scenes.Entspannen`,
            { name: 'Entspannen', type: 'boolean', role: 'button', read: false, write: true },
            { id: 'scene-relax', type: 'scene' },
        ),
        folder(`${room}.smartScenes`, 'Smart scenes'),
        state(
            `${room}.smartScenes.Natürliches_Licht`,
            { name: 'Natürliches Licht', type: 'boolean', role: 'switch', write: true },
            { id: 'smart-natural', type: 'smart_scene' },
        ),
        folder('hue-v2.0.zones', 'Zones'),
        channel('hue-v2.0.zones.Arbeit', 'Arbeit', {
            id: 'zone-work',
            type: 'zone',
            groupedLightId: 'gl-work',
            ...lights(['light-desk']),
        }),
        ...controls('hue-v2.0.zones.Arbeit', true),
        channel('hue-v2.0.all', 'All lights', { id: 'home', type: 'bridge_home', groupedLightId: 'gl-home' }),
        ...controls('hue-v2.0.all', true),
    ];
}

/** Alte Instanz (ioBroker.hue) mit derselben Lampe */
const hueV1: [string, Obj][] = [
    channel('hue.0.Stehlampe', 'Stehlampe', { id: '1' }, 'light.dimmer'),
    state('hue.0.Stehlampe.on', { type: 'boolean', role: 'switch.light', write: true }),
    state('hue.0.Stehlampe.level', { type: 'number', role: 'level.dimmer', min: 0, max: 100, write: true }),
    channel('hue.0.Wohnzimmer', 'Wohnzimmer', { id: '1', type: 'Room', name: 'Wohnzimmer', lights: ['1'] }, 'Room'),
    state('hue.0.Wohnzimmer.on', { type: 'boolean', role: 'switch.light', write: true }),
    state('hue.0.Wohnzimmer.scene_lesen', { name: 'Scene Lesen', type: 'boolean', role: 'button' }),
    [
        'system.adapter.hue.0',
        {
            _id: 'system.adapter.hue.0',
            type: 'instance',
            common: { name: 'hue', title: 'Hue', enabled: true, mode: 'daemon', version: '3.17.4' },
            native: {},
        } as unknown as Obj,
    ],
];

/** Alte Instanz in ioBroker deaktiviert (pausiert) oder aktiv */
function run(withLights: boolean, hueV1Enabled = false): ReturnType<typeof discover> {
    const objects = Object.fromEntries([...hueV2(withLights), ...hueV1]);
    const instance = objects['system.adapter.hue.0'];
    objects['system.adapter.hue.0'] = { ...instance, common: { ...instance.common, enabled: hueV1Enabled } } as Obj;
    return discover(objects, { language: 'de', ignoreAdapters: [] });
}

describe('hue-v2 and disabled instances', () => {
    it('detects lights, rooms and groups of hue-v2', () => {
        const { model } = run(true);
        const byId = Object.fromEntries(model.devices.map(d => [d.id, d]));
        const room = model.rooms.find(r => r.name === 'Wohnzimmer');
        expect(room).to.exist;
        expect(byId['hue-v2.0.lights.Desk']?.roomId).to.equal(room!.id);
        expect(byId['hue-v2.0.lights.Hall']?.roomId).to.equal(room!.id);
        // Raumgruppe als "Alle Lichter", deren Lampen bekannt sind (nicht doppelt zählen)
        expect(byId['hue-v2.0.rooms.Wohnzimmer']?.name).to.equal('Alle Lichter');
        expect(byId['hue-v2.0.rooms.Wohnzimmer']?.groupOf).to.have.members([
            'hue-v2.0.lights.Desk',
            'hue-v2.0.lights.Hall',
        ]);
        // Zone mit nur einer Lampe: keine eigene Kachel (wie bei ioBroker.hue)
        expect(byId['hue-v2.0.zones.Arbeit']).to.equal(undefined);
        // "Alle Lampen" der Bridge ist kein eigenes Gerät
        expect(byId['hue-v2.0.all']).to.equal(undefined);
    });

    it('offers scenes and smart scenes of hue-v2', () => {
        const { model } = run(true);
        const group = model.scenes.find(g => g.id === 'hue-v2.0.rooms.Wohnzimmer');
        expect(group?.kind).to.equal('room');
        expect(group?.scenes.map(s => [s.name, !!s.smart])).to.deep.equal([
            ['Entspannen', false],
            ['Natürliches Licht', true],
        ]);
        expect(group?.devices).to.include('hue-v2.0.lights.Desk');
    });

    it('keeps rooms and scenes when hue-v2 does not list the lights of a group', () => {
        const { model } = run(false);
        const byId = Object.fromEntries(model.devices.map(d => [d.id, d]));
        const room = model.rooms.find(r => r.name === 'Wohnzimmer');
        expect(byId['hue-v2.0.rooms.Wohnzimmer']?.roomId).to.equal(room!.id);
        expect(model.scenes.find(g => g.id === 'hue-v2.0.rooms.Wohnzimmer')?.scenes).to.have.length(2);
    });

    it('hides the objects of instances that are disabled in ioBroker', () => {
        const active = run(true, true);
        expect(active.model.devices.some(d => d.id.startsWith('hue.0.'))).to.equal(true);
        expect(active.model.scenes.some(g => g.id === 'hue.0.Wohnzimmer')).to.equal(true);
        expect(active.model.system?.instances.find(i => i.id === 'hue.0')?.paused).to.equal(undefined);

        const paused = run(true, false);
        expect(paused.model.devices.some(d => d.id.startsWith('hue.0.'))).to.equal(false);
        expect(paused.model.scenes.some(g => g.id.startsWith('hue.0.'))).to.equal(false);
        expect(paused.model.devices.some(d => d.id.startsWith('hue-v2.0.'))).to.equal(true);
        expect(paused.model.system?.instances.find(i => i.id === 'hue.0')?.paused).to.equal(true);
    });
});
