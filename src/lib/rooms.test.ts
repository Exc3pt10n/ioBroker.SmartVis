import { expect } from 'chai';
import { guessRoom, normalize, stripRoomFromName } from './rooms';

describe('rooms', () => {
    it('normalizes umlauts', () => {
        expect(normalize('Küche Süd')).to.equal('kueche sued');
    });

    it('detects a room at the beginning of a name', () => {
        expect(guessRoom(['Wohnzimmer Deckenlampe'])?.name).to.equal('Wohnzimmer');
    });

    it('detects rooms in CamelCase IDs', () => {
        expect(guessRoom(['hue.0.KuecheSpots'])?.name).to.equal('Küche');
    });

    it('prefers the longer room name', () => {
        expect(guessRoom(['Gäste-WC Licht'])?.name).to.equal('Gäste-WC');
    });

    it('detects compound words', () => {
        expect(guessRoom(['Schlafzimmerlampe'])?.name).to.equal('Schlafzimmer');
    });

    it('resolves synonyms', () => {
        expect(guessRoom(['Licht HWR'])?.name).to.equal('Hauswirtschaftsraum');
    });

    it('does not match substrings inside unrelated words', () => {
        expect(guessRoom(['Badewannenarmatur Sensor'])).to.equal(null);
    });

    it('uses later texts as fallback', () => {
        expect(guessRoom(['Deckenlampe', undefined, 'Flur Aktor'])?.name).to.equal('Flur');
    });

    it('supports custom room names', () => {
        expect(guessRoom(['Lampe Werkstatt'], ['Werkstatt'])?.name).to.equal('Werkstatt');
    });

    it('strips the room from a device name', () => {
        expect(stripRoomFromName('Wohnzimmer Deckenlampe', 'Wohnzimmer')).to.equal('Deckenlampe');
        expect(stripRoomFromName('Deckenlampe - Wohnzimmer', 'Wohnzimmer')).to.equal('Deckenlampe');
        expect(stripRoomFromName('Wohnzimmer', 'Wohnzimmer')).to.equal('Wohnzimmer');
    });
});
