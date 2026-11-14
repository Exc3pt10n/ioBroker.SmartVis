import { expect } from 'chai';
import { discover } from '../discovery';
import { invertNumber, presentStates, presentValue } from '../invert';
import { outputLabel } from '../outputs';
import { isTechnicalName } from './index';
import { shellyModel } from './shelly';
import type { Tree } from '../fixtures/build';
import { sonoffTree } from '../fixtures/sonoff';
import { shellyTree } from '../fixtures/shelly';
import { tuyaTree } from '../fixtures/tuya';
import { fritzdectTree } from '../fixtures/fritzdect';
import { zigbeeTree } from '../fixtures/zigbee';
import { zigbee2mqttTree } from '../fixtures/zigbee2mqtt';
import { deconzTree } from '../fixtures/deconz';

/**
 * Erkennung der meistgenutzten Geräte-Adapter anhand nachgebauter Objektbäume (siehe ../fixtures).
 * Je Gerät: "<ID ohne Instanz> <Typ> <Name> [@Raum]".
 */
const EXPECTED: Record<string, string[]> = {
    sonoff: [
        'DVES_4CH#0 socket Gartenrelais 1 @Garten',
        'DVES_4CH#1 socket Gartenrelais 2 @Garten',
        'DVES_4CH#2 socket Gartenrelais 3 @Garten',
        'DVES_4CH#3 socket Gartenrelais 4 @Garten',
        'DVES_BULB rgbSingle Stehlampe @Wohnzimmer',
        'DVES_PLUG01 socket Kaffeemaschine',
        'DVES_SHUT blind Rollladen @Küche',
        'DVES_TH16#0 temperature Gewächshaus',
        'DVES_TH16#1 socket Gewächshaus',
    ],
    shelly: [
        'SHDW-2#AABBCC#1.sensor#0 door Haustür',
        'SHDW-2#AABBCC#1.sensor#1 temperature Haustür',
        'shellyplus010v#a8032ab44444#1.Light0 dimmer Esstisch',
        'shellyplus1pm#a8032ab11111#1.Relay0 socket Shelly Plus 1PM 1111',
        'shellyplus1pm#a8032ab22222#1.Relay0 socket Licht @Flur',
        'shellyplus2pm#a8032ab33333#1.Cover0 blind Terrassentür @Wohnzimmer',
        'shellyplusht#a8032ab66666#1.Humidity0 humidity Klima @Bad',
        'shellyplusht#a8032ab66666#1.Temperature0 temperature Klima @Bad',
        'shellypro3em#a8032ab55555#1.EM0 electricity Hausanschluss',
        'shellypro3em#a8032ab55555#1.EMData0 electricity Hausanschluss',
    ],
    tuya: [
        'bf1234567890abcdef rgbSingle Deckenlampe @Kinderzimmer',
        'bf2234567890abcdef socket Steckdose Trockner',
        'bf3234567890abcdef#0 socket Steckdosenleiste Büro 1 @Büro',
        'bf3234567890abcdef#1 socket Steckdosenleiste Büro 2 @Büro',
        'bf3234567890abcdef#2 socket Steckdosenleiste Büro 3 @Büro',
        'bf3234567890abcdef#3 socket Steckdosenleiste Büro USB1 @Büro',
        'bf4234567890abcdef blind Rollladen @Gästezimmer',
        'bf5234567890abcdef thermostat Heizung @Gästezimmer',
        'bf6234567890abcdef temperature Thermometer @Keller',
        'bf7234567890abcdef door Kellertür @Keller',
        'bf9234567890abcdef socket Unbekanntes Gerät',
    ],
    fritzdect: [
        'DECT_087610123456#0 socket Waschmaschine',
        'DECT_087610123456#1 temperature Waschmaschine',
        'DECT_099950123456 temperature Taster @Schlafzimmer',
        'DECT_119340123456-1 blind Rollladen @Küche',
        'DECT_119340654321-1 window Fenster @Kinderzimmer',
        'DECT_135430123456-1 hue Stehlampe @Wohnzimmer',
        'DECT_139790123456 thermostat Heizung @Bad',
    ],
    zigbee: [
        '00158d0001a2b3c4 window Fenster @Bad',
        '00158d0002b3c4d5 motion Bewegungsmelder @Flur',
        '00158d0003c4d5e6#0 temperature Klima @Schlafzimmer',
        '00158d0003c4d5e6#1 pressure Klima @Schlafzimmer',
        '00158d0004d5e6f7 floodAlarm Wassermelder @Keller',
        '001788010a1b2c3d rgbSingle Deckenlampe @Küche',
        '84fd27fffe123456 thermostat Heizung @Wohnzimmer',
        'a4c1381234567890#0 socket Schalter Treppe L1',
        'a4c1381234567890#1 socket Schalter Treppe L2',
        'a4c138abcdef0123 blind Rollladen @Arbeitszimmer',
        'ccccccfffe1a2b3c socket Steckdose Fernseher',
        'group_1 dimmer Lichter @Wohnzimmer',
    ],
    zigbee2mqtt: [
        '0x00158d0001112233 door Terrassentür @Terrasse',
        '0x00158d0009988776 floodAlarm Wassermelder Waschküche',
        '0x0017880104abcdef ct Esstisch',
        '0x84fd27fffe654321 thermostat Heizung @Büro',
        '0xa4c1380011223344 blind Markise',
        '0xa4c1385566778899#0 socket Doppelschalter Küche L1 @Küche',
        '0xa4c1385566778899#1 socket Doppelschalter Küche L2 @Küche',
    ],
    deconz: [
        'Groups.1 dimmer Licht @Wohnzimmer',
        'Lights.1 ct Leselampe @Wohnzimmer',
        'Lights.2 blind Rollladen @Schlafzimmer',
        'Sensors.3 window Fenster @Küche',
        'Sensors.4 motion Bewegung @Diele',
        'Sensors.5 floodAlarm Wasser @Bad',
        'Sensors.6 temperature Klima @Keller',
    ],
};

const TREES: Record<string, () => Tree> = {
    sonoff: sonoffTree,
    shelly: shellyTree,
    tuya: tuyaTree,
    fritzdect: fritzdectTree,
    zigbee: zigbeeTree,
    zigbee2mqtt: zigbee2mqttTree,
    deconz: deconzTree,
};

export function summary(tree: Tree): { lines: string[]; result: ReturnType<typeof discover> } {
    const result = discover(tree.objects, { language: 'de', ignoreAdapters: [] });
    const lines = [...result.model.devices]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(d => {
            const room = result.model.rooms.find(r => r.id === d.roomId)?.name;
            return `${d.id.replace(/^[^.]+\.0\./, '')} ${d.type} ${d.name}${room ? ` @${room}` : ''}`;
        });
    return { lines, result };
}

describe('Geräte-Adapter (nachgebaute Objektbäume)', () => {
    for (const [adapter, build] of Object.entries(TREES)) {
        it(`erkennt die Geräte von ${adapter}`, () => {
            expect(summary(build()).lines).to.deep.equal(EXPECTED[adapter]);
        });
    }
});

describe('Adapter-Anpassungen im Detail', () => {
    it('meldet umgekehrt laufende Rollläden (deCONZ, FRITZ!DECT) mit Wertebereich', () => {
        expect(summary(deconzTree()).result.inverted.get('deconz.0.Lights.2.lift')).to.deep.equal({ min: 0, max: 100 });
        expect(
            summary(fritzdectTree()).result.inverted.get('fritzdect.0.DECT_119340123456-1.levelpercentage'),
        ).to.deep.equal({
            min: 0,
            max: 100,
        });
        expect(summary(zigbeeTree()).result.inverted.size).to.equal(0);
    });

    it('spiegelt Werte beim Lesen, Schreiben und im Verlauf', () => {
        const inverted = new Map([['a', { min: 0, max: 100 }]]);
        expect(invertNumber(30, inverted.get('a'))).to.equal(70);
        expect(invertNumber(true, inverted.get('a'))).to.equal(true);
        expect(invertNumber(30, undefined)).to.equal(30);
        expect(presentValue('a', { val: 0, ack: true, ts: 1 }, inverted)?.val).to.equal(100);
        expect(
            presentStates({ a: { val: 100, ack: true, ts: 1 }, b: { val: 5, ack: true, ts: 1 } }, inverted),
        ).to.deep.equal({
            a: { val: 0, ack: true, ts: 1 },
            b: { val: 5, ack: true, ts: 1 },
        });
    });

    it('teilt Mehrfach-Schalter auf und übernimmt nur Indikatoren', () => {
        const { result } = summary(sonoffTree());
        const relays = result.model.devices.filter(d => d.id.startsWith('sonoff.0.DVES_4CH#'));
        expect(relays.map(d => d.states.find(s => s.name === 'SET')?.id)).to.deep.equal(
            [1, 2, 3, 4].map(n => `sonoff.0.DVES_4CH.POWER${n}`),
        );
        expect(outputLabel('state_l1')).to.equal('L1');
        expect(outputLabel('POWER3')).to.equal('3');
        expect(outputLabel('switch_usb1')).to.equal('USB1');
    });

    it('benennt technisch benannte Geräte nach dem smartName (iot/Alexa)', () => {
        const plug = summary(sonoffTree()).result.model.devices.find(d => d.id === 'sonoff.0.DVES_PLUG01');
        expect(plug?.name).to.equal('Kaffeemaschine');
        expect(isTechnicalName('DVES_4E55F6', 'sonoff.0.DVES_4E55F6')).to.equal(true);
        expect(isTechnicalName('Channel Relay0', 'shelly.0.x.Relay0')).to.equal(true);
        expect(isTechnicalName('Licht Flur', 'shelly.0.x')).to.equal(false);
    });

    it('nutzt bei Shelly ohne Namen die Modellbezeichnung', () => {
        expect(shellyModel('shellyplus1pm#a8032ab11111#1')).to.equal('Shelly Plus 1PM 1111');
        expect(shellyModel('shellypro3em#a8032ab55555#1')).to.equal('Shelly Pro 3EM 5555');
        expect(shellyModel('SHDW-2#AABBCC#1')).to.equal('Shelly DW-2 BBCC');
    });

    it('übernimmt Batteriestände der neuen Adapter', () => {
        const names = (tree: Tree): string[] => (summary(tree).result.model.batteries ?? []).map(b => b.name);
        expect(names(fritzdectTree())).to.include('Heizung');
        expect(names(tuyaTree())).to.include('Kellertür');
        expect(names(shellyTree())).to.include('Haustür');
    });
});
