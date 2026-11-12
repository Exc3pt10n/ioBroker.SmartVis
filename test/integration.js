const path = require('node:path');
const { expect } = require('chai');
const WebSocket = require('ws');
const { readFileSync } = require('node:fs');
const { tests } = require('@iobroker/testing');

const fixture = name => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));

/**
 * Verbindet sich (mit Wiederholungen, bis der Webserver lauscht) und liefert das erste Model.
 * Mit clientId meldet sich die Verbindung wie die App als Endgerät an.
 */
async function connect(port, clientId) {
    const until = Date.now() + 15000;
    for (;;) {
        try {
            return await connectOnce(port, clientId);
        } catch (e) {
            if (Date.now() > until || !/ECONNREFUSED/.test(String(e))) {
                throw e;
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }
}

function connectOnce(port, clientId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        if (clientId) {
            ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', clientId, name: 'Testgerät' })));
        }
        const timer = setTimeout(() => reject(new Error('Kein Model erhalten')), 10000);
        ws.on('message', raw => {
            const msg = JSON.parse(raw.toString());
            if (msg.t === 'model') {
                clearTimeout(timer);
                resolve({ ws, model: msg.model });
            }
        });
        ws.on('error', reject);
    });
}

/** Wartet auf das nächste Model nach einer Änderung */
function nextModel(ws) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Kein neues Model')), 10000);
        const onMessage = raw => {
            const msg = JSON.parse(raw.toString());
            if (msg.t === 'model') {
                clearTimeout(timer);
                ws.off('message', onMessage);
                resolve(msg.model);
            } else if (msg.t === 'error') {
                clearTimeout(timer);
                reject(new Error(msg.message));
            }
        };
        ws.on('message', onMessage);
    });
}

// Startet den Adapter in einer echten js-controller-Testinstanz
tests.integration(path.join(__dirname, '..'), {
    // Stabile js-controller-Version statt der nächtlichen Entwicklungsversion ("dev"):
    // entspricht den echten Installationen und bricht nicht bei fehlerhaften Nightly-Builds
    controllerVersion: 'latest',
    defineAdditionalTests({ suite }) {
        suite('Erkennung mit echten Objekten', getHarness => {
            it('liest Geräte, Kanäle, Aufzählungen und Instanz-Konfigurationen aus der Datenbank', async function () {
                this.timeout(90000);
                const harness = getHarness();
                const port = 18097;
                await harness.changeAdapterConfig('smartvis', { native: { port, ignoreAdapters: 'admin' } });

                // Auszüge aus einem echten Objektbaum: Wetterstation + CCU-Variablen, shuttercontrol, KEBA
                const objects = { ...fixture('hmip-weather'), ...fixture('shuttercontrol'), ...fixture('kecontact') };
                // Instanz soll nicht vom Controller gestartet werden
                objects['system.adapter.shuttercontrol.0'].common.enabled = false;
                // Homematic-Dimmer (Gerät → Kanal → State) in einem Raum aus enum.rooms
                Object.assign(objects, {
                    'hm-rpc.0.DIM1': { type: 'device', common: { name: 'Deckenlicht' }, native: { TYPE: 'HmIP-BDT' } },
                    'hm-rpc.0.DIM1.4': {
                        type: 'channel',
                        common: { name: 'Deckenlicht:4' },
                        native: { TYPE: 'DIMMER_VIRTUAL_RECEIVER' },
                    },
                    'hm-rpc.0.DIM1.3': {
                        type: 'channel',
                        common: { name: 'Deckenlicht:3' },
                        native: { TYPE: 'DIMMER_TRANSMITTER' },
                    },
                    'hm-rpc.0.DIM1.4.LEVEL': {
                        type: 'state',
                        common: { name: 'LEVEL', role: 'level.dimmer', type: 'number', read: true, write: true, min: 0, max: 100, unit: '%' },
                        native: {},
                    },
                    'enum.rooms.living': {
                        type: 'enum',
                        common: { name: 'Wohnzimmer', members: ['hm-rpc.0.DIM1.4'] },
                        native: {},
                    },
                });
                for (const [id, obj] of Object.entries(objects)) {
                    await harness.objects.setObjectAsync(id, { ...obj, _id: id });
                }

                await harness.startAdapterAndWait();
                const { ws, model } = await connect(port);

                // Verlauf nur für aufgezeichnete States – sonst Fehler statt Datenbankabfrage
                const answer = new Promise(resolve => {
                    ws.on('message', raw => {
                        const msg = JSON.parse(raw.toString());
                        if (msg.t === 'history' && msg.reqId === 7) {
                            resolve(msg);
                        }
                    });
                });
                ws.send(JSON.stringify({ t: 'history', reqId: 7, id: 'hm-rpc.0.DIM1.4.LEVEL', range: '24h' }));
                const history = await answer;
                expect(history.points).to.deep.equal([]);
                expect(history.error).to.match(/Kein Verlauf/);
                ws.close();

                const dimmer = model.devices.find(d => d.id === 'hm-rpc.0.DIM1.4');
                expect(dimmer, 'Homematic-Dimmer erkannt').to.exist;
                expect(dimmer.roomId).to.equal('enum.rooms.living');
                expect(model.weather.map(w => w.model)).to.include('HmIP-SWO-PL');
                expect(model.wallboxes).to.have.length(1);
                expect(model.shutterControl, 'shuttercontrol erkannt').to.have.length(1);
                expect(model.shutterControl[0].shutters).to.have.length(13);
            });
        });

        // Hinweis: Der Harness startet den Adapter je suite nur einmal zuverlässig – daher je Szenario eine suite.
        suite('Bearbeiten-Modus: laden und speichern', getHarness => {
            it('lädt vorhandene Anpassungen und speichert neue im Dateispeicher', async function () {
                this.timeout(60000);
                const harness = getHarness();
                const port = 18099;
                await harness.changeAdapterConfig('smartvis', { native: { port, allowEdit: true } });

                // Vorhandene Anpassung vor dem Start in den Dateispeicher der Instanz legen
                await harness.objects.setObjectAsync('smartvis.0', {
                    type: 'meta',
                    common: { name: 'SmartVis', type: 'meta.user' },
                    native: {},
                });
                const existing = { version: 1, devices: {}, rooms: { 'custom.vorhanden': { name: 'Vorhanden', custom: true } } };
                await harness.objects.writeFileAsync('smartvis.0', 'overrides.json', JSON.stringify(existing));

                await harness.startAdapterAndWait();
                // Ohne Geräte-Kennung (ältere App): gemeinsame Ausgangsbasis nach kurzer Wartezeit
                const { ws, model } = await connect(port);
                expect(model.editable).to.equal(true);
                expect(model.rooms.map(r => r.name)).to.include('Vorhanden');

                // Zwei Änderungen direkt hintereinander – keine darf verloren gehen
                const first = nextModel(ws);
                ws.send(JSON.stringify({ t: 'edit', edit: { kind: 'createRoom', name: 'Werkstatt' } }));
                ws.send(JSON.stringify({ t: 'edit', edit: { kind: 'room', id: 'custom.vorhanden', patch: { hidden: true } } }));
                await first;
                const second = await nextModel(ws);
                expect(second.rooms.map(r => r.name)).to.include.members(['Vorhanden', 'Werkstatt']);
                expect(second.rooms.find(r => r.id === 'custom.vorhanden').hidden).to.equal(true);
                ws.close();

                // Ohne Geräte-Kennung landen Änderungen in der gemeinsamen Ausgangsbasis (Format 2)
                let saved = JSON.parse((await harness.objects.readFile('smartvis.0', 'overrides.json')).file.toString());
                expect(saved.version).to.equal(2);
                expect(saved.shared.rooms).to.deep.equal({
                    'custom.vorhanden': { name: 'Vorhanden', custom: true, hidden: true },
                    'custom.werkstatt': { name: 'Werkstatt', custom: true },
                });

                // Ein Endgerät startet mit einer Kopie der Ausgangsbasis und hat danach eigene Anpassungen
                const phone = await connect(port, 'testgeraet-0001');
                expect(phone.model.client).to.include({ id: 'testgeraet-0001', name: 'Testgerät' });
                expect(phone.model.rooms.map(r => r.name)).to.include('Werkstatt');
                const changed = nextModel(phone.ws);
                phone.ws.send(JSON.stringify({ t: 'edit', edit: { kind: 'deleteRoom', id: 'custom.werkstatt' } }));
                expect((await changed).rooms.map(r => r.name)).to.not.include('Werkstatt');

                // Zurücksetzen: dieses Gerät wieder ohne Anpassungen
                const reset = nextModel(phone.ws);
                phone.ws.send(JSON.stringify({ t: 'client', request: { action: 'reset' } }));
                expect((await reset).rooms.map(r => r.name)).to.not.include('Vorhanden');
                phone.ws.close();

                saved = JSON.parse((await harness.objects.readFile('smartvis.0', 'overrides.json')).file.toString());
                expect(saved.shared.rooms).to.have.keys('custom.vorhanden', 'custom.werkstatt');
                expect(saved.clients['testgeraet-0001'].name).to.equal('Testgerät');
                expect(saved.clients['testgeraet-0001'].overrides.rooms).to.deep.equal({});
            });
        });

        suite('Bearbeiten-Modus: deaktiviert', getHarness => {
            it('verweigert Anpassungen, wenn Bearbeiten in den Einstellungen aus ist', async function () {
                this.timeout(60000);
                const harness = getHarness();
                const port = 18098;
                await harness.changeAdapterConfig('smartvis', { native: { port, allowEdit: false } });
                await harness.startAdapterAndWait();
                const { ws, model } = await connect(port);
                expect(model.editable).to.equal(false);
                const answer = nextModel(ws).then(
                    () => 'model',
                    e => e.message,
                );
                ws.send(JSON.stringify({ t: 'edit', edit: { kind: 'createRoom', name: 'Verboten' } }));
                expect(await answer).to.match(/deaktiviert/);
                ws.close();
            });
        });
    },
});
