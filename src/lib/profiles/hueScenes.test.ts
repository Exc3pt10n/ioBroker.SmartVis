import { expect } from 'chai';
import { discover } from '../discovery';
import { sceneName } from './hueScenes';

type Obj = ioBroker.Object;

function channel(id: string, name: string, role: string, native: Record<string, unknown>): [string, Obj] {
    return [id, { _id: id, type: 'channel', common: { name, role }, native } as unknown as Obj];
}
function state(id: string, role: string, type: ioBroker.CommonType): [string, Obj] {
    return [
        id,
        {
            _id: id,
            type: 'state',
            common: { name: id, role, type, read: true, write: true },
            native: {},
        } as unknown as Obj,
    ];
}
/** Szenen legt der Hue-Adapter ohne type/write an */
function scene(group: string, key: string, name: string): [string, Obj] {
    const id = `${group}.scene_${key}`;
    return [id, { _id: id, type: 'state', common: { name, role: 'button' }, native: { group: '5' } } as unknown as Obj];
}
function light(id: string, name: string, hueId: string): [string, Obj][] {
    return [
        channel(id, name, 'light.dimmer', { id: hueId }),
        state(`${id}.on`, 'switch.light', 'boolean'),
        state(`${id}.level`, 'level.dimmer', 'number'),
    ];
}

const objects = Object.fromEntries([
    ...light('hue.0.Spot_1', 'Spot 1', '1'),
    ...light('hue.0.Spot_2', 'Spot 2', '2'),
    channel('hue.0.Küche', 'Küche', 'Room', { id: '5', type: 'Room', name: 'Küche', lights: ['1', '2'] }),
    state('hue.0.Küche.on', 'switch.light', 'boolean'),
    state('hue.0.Küche.level', 'level.dimmer', 'number'),
    scene('hue.0.Küche', 'hell', 'Scene Hell'),
    scene('hue.0.Küche', 'sonnenuntergang_savanne', 'Scene Sonnenuntergang Savanne'),
    scene('hue.0.Küche', 'scene_recoveryscene_', 'Scene Scene recoveryScene '),
    // Zone mit nur einer Lampe
    channel('hue.0.Theke', 'Theke', 'Zone', { id: '6', type: 'Zone', name: 'Theke', lights: ['2'] }),
    scene('hue.0.Theke', 'lesen', 'Scene Lesen'),
    // Ältere Gruppe derselben Bridge mit gleicher Lampenauswahl und weniger Szenen
    channel('hue.0.Küche_Room', 'Küche Room', 'Room', { id: '9', type: 'Room', name: 'Küche', lights: ['1', '2'] }),
    scene('hue.0.Küche_Room', 'hell', 'Scene Hell'),
    // Allgemeine Szenen ohne Gruppe
    channel('hue.0.lightScenes', 'Light scenes', '', {}),
    scene('hue.0.lightScenes', 'scene_scene0_', 'Scene Scene scene0 '),
]);

describe('Hue-Szenen', () => {
    const result = discover(objects, { language: 'de', ignoreAdapters: [] });
    const { scenes } = result.model;

    it('liest Szenen je Raum und Zone ohne interne Szenen', () => {
        const kitchen = scenes.find(g => g.id === 'hue.0.Küche');
        expect(kitchen?.kind).to.equal('room');
        expect(kitchen?.scenes.map(s => s.name)).to.deep.equal(['Hell', 'Sonnenuntergang Savanne']);
        expect(scenes.find(g => g.id === 'hue.0.Theke')?.kind).to.equal('zone');
    });

    it('ordnet die Lampen-Geräte zu', () => {
        const kitchen = scenes.find(g => g.id === 'hue.0.Küche');
        expect(kitchen?.devices).to.have.members(['hue.0.Küche', 'hue.0.Spot_1', 'hue.0.Spot_2']);
        expect(scenes.find(g => g.id === 'hue.0.Theke')?.devices).to.deep.equal(['hue.0.Spot_2']);
    });

    it('liefert doppelte Gruppen und Gruppen ohne Lampen nicht', () => {
        expect(scenes.map(g => g.id)).to.have.members(['hue.0.Küche', 'hue.0.Theke']);
    });

    it('erlaubt das Auslösen der Szenen', () => {
        expect(result.writableIds.has('hue.0.Küche.scene_hell')).to.equal(true);
        expect(result.writableIds.has('hue.0.lightScenes.scene_scene_scene0_')).to.equal(false);
    });

    it('bereinigt Szenennamen', () => {
        expect(sceneName('Scene Scene recoveryScene ')).to.equal('recoveryScene');
        expect(sceneName('scene_energie_tanken')).to.equal('energie tanken');
    });
});
