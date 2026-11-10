const path = require('node:path');
const { expect } = require('chai');
const WebSocket = require('ws');
const { tests } = require('@iobroker/testing');

/** Verbindet sich (mit Wiederholungen, bis der Webserver lauscht) und liefert das erste Model */
async function connect(port) {
    const until = Date.now() + 15000;
    for (;;) {
        try {
            return await connectOnce(port);
        } catch (e) {
            if (Date.now() > until || !/ECONNREFUSED/.test(String(e))) {
                throw e;
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }
}

function connectOnce(port) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
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
    defineAdditionalTests({ suite }) {
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

                const { file } = await harness.objects.readFile('smartvis.0', 'overrides.json');
                const saved = JSON.parse(file.toString());
                expect(saved.rooms).to.deep.equal({
                    'custom.vorhanden': { name: 'Vorhanden', custom: true, hidden: true },
                    'custom.werkstatt': { name: 'Werkstatt', custom: true },
                });
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
