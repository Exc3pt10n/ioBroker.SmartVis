import { expect } from 'chai';
import {
    MAX_CLIENTS,
    applyClientAction,
    clientInfo,
    overridesFor,
    parseStore,
    registerClient,
    withOverrides,
} from './clientOverrides';
import { applyEdit, emptyOverrides } from './overrides';

const PHONE = 'phone-0000-0001';
const DESK = 'desk-0000-0002';

describe('Anpassungen je Endgerät', () => {
    // Bisherige Datei (Format 1): gemeinsame Anpassungen
    const legacy = applyEdit(emptyOverrides(), { kind: 'device', id: 'hue.0.Lampe', patch: { name: 'Leselampe' } });

    it('übernimmt das alte Format als Ausgangsbasis für alle Geräte', () => {
        const store = parseStore(JSON.stringify(legacy));
        expect(store.version).to.equal(2);
        expect(store.shared.devices['hue.0.Lampe'].name).to.equal('Leselampe');
        const withPhone = registerClient(store, PHONE, 'iPhone', 1000);
        expect(overridesFor(withPhone, PHONE).devices['hue.0.Lampe'].name).to.equal('Leselampe');
    });

    it('speichert Anpassungen je Gerät getrennt', () => {
        let store = registerClient(parseStore(JSON.stringify(legacy)), PHONE, 'iPhone', 1000);
        store = registerClient(store, DESK, 'Desktop', 2000);
        const phone = applyEdit(overridesFor(store, PHONE), {
            kind: 'device',
            id: 'hue.0.Lampe',
            patch: { hidden: true },
        });
        store = withOverrides(store, PHONE, phone);
        expect(overridesFor(store, PHONE).devices['hue.0.Lampe'].hidden).to.equal(true);
        expect(overridesFor(store, DESK).devices['hue.0.Lampe'].hidden).to.equal(undefined);
        // Datei hin und zurück
        const reloaded = parseStore(JSON.stringify(store));
        expect(reloaded.clients[PHONE].overrides.devices['hue.0.Lampe'].hidden).to.equal(true);
        expect(reloaded.clients[PHONE].name).to.equal('iPhone');
    });

    it('setzt dieses Gerät oder alles auf den Ausgangszustand zurück', () => {
        let store = registerClient(parseStore(JSON.stringify(legacy)), PHONE, 'iPhone', 1000);
        store = registerClient(store, DESK, 'Desktop', 2000);
        const reset = applyClientAction(store, PHONE, { action: 'reset' });
        expect(overridesFor(reset, PHONE)).to.deep.equal(emptyOverrides());
        expect(overridesFor(reset, DESK).devices['hue.0.Lampe'].name).to.equal('Leselampe');
        const all = applyClientAction(store, PHONE, { action: 'resetAll' });
        expect(overridesFor(all, DESK)).to.deep.equal(emptyOverrides());
        expect(all.shared).to.deep.equal(emptyOverrides());
        // Geräte und Namen bleiben erhalten
        expect(clientInfo(all, PHONE).devices.map(d => d.name)).to.deep.equal(['Desktop', 'iPhone']);
    });

    it('übernimmt Anpassungen eines anderen Geräts, benennt um und entfernt Geräte', () => {
        let store = registerClient(emptyStoreWith(), PHONE, 'iPhone', 1000);
        store = registerClient(store, DESK, 'Desktop', 2000);
        store = withOverrides(
            store,
            DESK,
            applyEdit(overridesFor(store, DESK), { kind: 'room', id: 'auto.kueche', patch: { name: 'Küche' } }),
        );
        store = applyClientAction(store, PHONE, { action: 'copyFrom', id: DESK });
        expect(overridesFor(store, PHONE).rooms['auto.kueche'].name).to.equal('Küche');
        store = applyClientAction(store, PHONE, { action: 'rename', name: '  Handy  ' });
        expect(clientInfo(store, PHONE)).to.include({ id: PHONE, name: 'Handy' });
        expect(() => applyClientAction(store, PHONE, { action: 'remove', id: PHONE })).to.throw();
        store = applyClientAction(store, PHONE, { action: 'remove', id: DESK });
        expect(Object.keys(store.clients)).to.deep.equal([PHONE]);
    });

    it('meldet bekannte Geräte erneut an, ohne ihre Anpassungen zu überschreiben', () => {
        let store = registerClient(emptyStoreWith(), PHONE, 'iPhone', 1000);
        store = withOverrides(store, PHONE, legacy);
        store = registerClient(store, PHONE, 'Anderer Name', 5000);
        expect(store.clients[PHONE]).to.include({ name: 'iPhone', lastSeen: 5000 });
        expect(overridesFor(store, PHONE).devices['hue.0.Lampe'].name).to.equal('Leselampe');
    });

    it('begrenzt die Anzahl der Geräte und verwirft ungültige Einträge', () => {
        let store = emptyStoreWith();
        for (let i = 0; i < MAX_CLIENTS + 3; i++) {
            store = registerClient(store, `client-${String(i).padStart(4, '0')}`, `Gerät ${i}`, i);
        }
        expect(Object.keys(store.clients)).to.have.length(MAX_CLIENTS);
        expect(store.clients['client-0000']).to.equal(undefined);
        const parsed = parseStore(
            JSON.stringify({ version: 2, shared: {}, clients: { '../x': {}, [PHONE]: { name: 1 } } }),
        );
        expect(Object.keys(parsed.clients)).to.deep.equal([PHONE]);
        expect(parseStore('{kaputt').clients).to.deep.equal({});
    });
});

function emptyStoreWith(): ReturnType<typeof parseStore> {
    return parseStore(undefined);
}
