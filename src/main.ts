import * as utils from '@iobroker/adapter-core';
import { join } from 'node:path';
import { discover, type DiscoveryResult } from './lib/discovery';
import { historyOptions, toPoints } from './lib/history';
import {
    applyClientAction,
    clientInfo,
    emptyStore,
    overridesFor,
    parseStore,
    registerClient,
    withOverrides,
} from './lib/clientOverrides';
import { applyEdit, applyOverrides } from './lib/overrides';
import { SmartVisServer } from './lib/server';
import type {
    SvClientAction,
    SvEdit,
    SvHistoryRange,
    SvModel,
    SvOverrideStore,
    SvStateValue,
    ioBrokerValue,
} from './shared/protocol';

/** Datei im ioBroker-Dateispeicher der Instanz (Teil von Backups) */
const OVERRIDES_FILE = 'overrides.json';

class SmartVis extends utils.Adapter {
    private server?: SmartVisServer;
    private discovery?: DiscoveryResult;
    /** Anpassungen je Endgerät (overrides.json) */
    private store: SvOverrideStore = emptyStore();
    /** Änderungen nacheinander ausführen */
    private saveQueue: Promise<void> = Promise.resolve();
    private states: Record<string, SvStateValue | null> = {};
    private subscribed = new Set<string>();
    private rediscoverTimer?: ioBroker.Timeout;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'smartvis' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.loadOverrides();
        await this.runDiscovery();

        this.server = new SmartVisServer(
            {
                port: Number(this.config.port) || 8099,
                bind: this.config.bind || '0.0.0.0',
                wwwDir: join(__dirname, '..', 'www'),
                version: this.version || '0.0.0',
            },
            {
                getModel: clientId => this.modelFor(clientId),
                hello: (clientId, name) => this.queue(() => this.registerClient(clientId, name)),
                client: (clientId, request) => this.queue(() => this.clientAction(clientId, request)),
                getStates: () => this.states,
                setState: (id, val) => this.writeState(id, val),
                edit: (clientId, edit) => this.queue(() => this.applyAndSave(clientId, edit)),
                history: (id, range) => this.readHistory(id, range),
                onClientCountChange: count => void this.setState('info.clients', count, true),
                log: this.log,
            },
        );

        try {
            await this.server.start();
            this.log.info(
                `SmartVis läuft auf http://${this.config.bind || '0.0.0.0'}:${this.config.port}${
                    this.config.allowEdit === false ? ' (Bearbeiten deaktiviert)' : ''
                }`,
            );
        } catch (e) {
            this.log.error(`Webserver konnte nicht gestartet werden: ${(e as Error).message}`);
            this.terminate?.(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }

        // Objektänderungen → Neu-Erkennung (entprellt)
        await this.subscribeForeignObjectsAsync('*');
    }

    private async runDiscovery(): Promise<void> {
        const started = Date.now();
        const objects = await this.loadObjects();

        this.discovery = discover(objects, {
            language: this.config.language || 'de',
            ignoreAdapters: [this.name, ...(this.config.ignoreAdapters || '').split(',')],
        });

        await this.syncSubscriptions(this.discovery.stateIds);

        const { devices, rooms } = this.discovery.model;
        const withoutRoom = devices.filter(d => !d.roomId).length;
        this.log.info(
            `Erkennung: ${devices.length} Geräte, ${rooms.length} Räume, ${withoutRoom} ohne Raum (${Date.now() - started} ms)`,
        );
        await this.setStateAsync('info.devices', devices.length, true);
        this.updateModel(true);
    }

    private updateModel(withStates: boolean): void {
        if (!this.discovery) {
            return;
        }
        this.server?.publishModels(withStates);
    }

    /** Erkanntes Model mit den Anpassungen eines Endgeräts */
    private modelFor(clientId: string | undefined): SvModel {
        const model = applyOverrides(
            this.discovery!.model,
            overridesFor(this.store, clientId),
            this.config.allowEdit !== false,
        );
        return { ...model, client: clientInfo(this.store, clientId) };
    }

    private async loadOverrides(): Promise<void> {
        // Meta-Objekt für den Dateispeicher der Instanz
        await this.setForeignObjectNotExistsAsync(this.namespace, {
            type: 'meta',
            common: { name: 'SmartVis', type: 'meta.user' },
            native: {},
        });
        try {
            if (await this.fileExistsAsync(this.namespace, OVERRIDES_FILE)) {
                const { file } = await this.readFileAsync(this.namespace, OVERRIDES_FILE);
                this.store = parseStore(file);
                const n = Object.keys(this.store.clients).length;
                this.log.info(`Anpassungen geladen (${n} ${n === 1 ? 'Gerät' : 'Geräte'})`);
            }
        } catch (e) {
            this.log.warn(`Anpassungen konnten nicht gelesen werden: ${(e as Error).message}`);
        }
    }

    /**
     * Änderungen strikt nacheinander verarbeiten: jede baut auf dem gespeicherten Stand der vorherigen auf
     * (sonst gingen schnell aufeinanderfolgende Änderungen verloren).
     */
    private queue(task: () => Promise<void>): Promise<void> {
        const run = this.saveQueue.then(task);
        this.saveQueue = run.catch(() => undefined);
        return run;
    }

    /** Erst speichern, dann übernehmen: die App sieht nur, was wirklich gesichert ist */
    private async save(next: SvOverrideStore): Promise<void> {
        try {
            await this.writeFileAsync(this.namespace, OVERRIDES_FILE, JSON.stringify(next, null, 2));
        } catch (e) {
            this.log.error(`Anpassungen konnten nicht gespeichert werden: ${(e as Error).message}`);
            throw new Error('Anpassung konnte nicht gespeichert werden');
        }
        this.store = next;
    }

    private async registerClient(clientId: string, name: string | undefined): Promise<void> {
        const known = !!this.store.clients[clientId];
        const next = registerClient(this.store, clientId, name, Date.now());
        // "Zuletzt gesehen" höchstens stündlich speichern, neue Geräte sofort
        const last = this.store.clients[clientId]?.lastSeen ?? 0;
        if (!known || Date.now() - last > 3600_000) {
            await this.save(next);
        } else {
            this.store = next;
        }
        if (!known) {
            this.log.info(`Neues Gerät angemeldet: ${next.clients[clientId].name}`);
            // Geräteliste der anderen Clients aktualisieren
            this.server?.publishModels(false);
        }
    }

    private async applyAndSave(clientId: string | undefined, edit: SvEdit): Promise<void> {
        if (this.config.allowEdit === false) {
            throw new Error('Bearbeiten ist in den Adapter-Einstellungen deaktiviert');
        }
        const next = withOverrides(this.store, clientId, applyEdit(overridesFor(this.store, clientId), edit));
        await this.save(next);
        // Nur dieses Gerät sieht die Änderung (ohne Kennung: alle ohne Kennung)
        this.server?.publishModels(false, clientId);
    }

    private async clientAction(clientId: string | undefined, request: SvClientAction): Promise<void> {
        if (this.config.allowEdit === false) {
            throw new Error('Bearbeiten ist in den Adapter-Einstellungen deaktiviert');
        }
        await this.save(applyClientAction(this.store, clientId, request));
        this.log.info(`Anpassungen: ${request.action}${clientId ? ` (${this.store.clients[clientId]?.name})` : ''}`);
        this.server?.publishModels(false);
    }

    /**
     * Lädt alle für die Erkennung nötigen Objekte.
     * Achtung: getForeignObjects('*') ohne Typ liefert nur Objekte vom Typ "state" –
     * Geräte, Kanäle, Ordner, Aufzählungen und Instanzen müssen einzeln geholt werden.
     */
    private async loadObjects(): Promise<Record<string, ioBroker.Object>> {
        const types: { pattern: string; type: ioBroker.ObjectType }[] = [
            { pattern: '*', type: 'state' },
            { pattern: '*', type: 'channel' },
            { pattern: '*', type: 'device' },
            { pattern: '*', type: 'folder' },
            { pattern: 'enum.*', type: 'enum' },
            // Instanz-Konfigurationen (z. B. shuttercontrol: Zuordnung Rollladen → Level-State)
            { pattern: 'system.adapter.*', type: 'instance' },
            // Hosts (js-controller) für die Statuskarte
            { pattern: 'system.host.*', type: 'host' },
        ];
        const result: Record<string, ioBroker.Object> = {};
        for (const { pattern, type } of types) {
            try {
                Object.assign(result, await this.getForeignObjectsAsync(pattern, type as 'state'));
            } catch (e) {
                this.log.warn(`Objekte vom Typ ${type} konnten nicht gelesen werden: ${(e as Error).message}`);
            }
        }
        return result;
    }

    private async syncSubscriptions(ids: string[]): Promise<void> {
        const wanted = new Set(ids);
        for (const id of this.subscribed) {
            if (!wanted.has(id)) {
                await this.unsubscribeForeignStatesAsync(id);
                delete this.states[id];
            }
        }
        const added = ids.filter(id => !this.subscribed.has(id));
        for (const id of added) {
            await this.subscribeForeignStatesAsync(id);
        }
        this.subscribed = wanted;

        if (added.length) {
            const current = await this.getForeignStatesAsync(added);
            for (const id of added) {
                this.states[id] = toValue(current[id]);
            }
        }
    }

    /** Verlauf aus der History-Instanz (sql, history, influxdb) lesen – nur für erkannte, aufgezeichnete States */
    private async readHistory(id: string, range: SvHistoryRange): Promise<[number, number][]> {
        const instance = this.discovery?.historyIds.get(id);
        if (!instance) {
            throw new Error(`Kein Verlauf für ${id}`);
        }
        const response = (await this.sendToAsync(
            instance,
            'getHistory',
            { id, options: historyOptions(range) },
            { timeout: 20_000 },
        )) as { result?: unknown; error?: string } | undefined;
        if (!response) {
            throw new Error(`${instance} antwortet nicht`);
        }
        if (response.error) {
            throw new Error(String(response.error));
        }
        return toPoints(response.result);
    }

    private async writeState(id: string, val: ioBrokerValue): Promise<void> {
        if (!this.discovery?.writableIds.has(id)) {
            throw new Error(`State ${id} ist nicht freigegeben`);
        }
        await this.setForeignStateAsync(id, val, false);
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!this.subscribed.has(id)) {
            return;
        }
        const value = toValue(state);
        this.states[id] = value;
        this.server?.queueState(id, value);
    }

    private onObjectChange(id: string): void {
        // Eigene Objekte und System-Objekte ignorieren – außer Instanz-Konfigurationen (z. B. shuttercontrol)
        const isInstanceConfig = /^system\.adapter\.[^.]+\.\d+$/.test(id);
        if (id.startsWith(`${this.namespace}.`) || (id.startsWith('system.') && !isInstanceConfig)) {
            return;
        }
        if (this.rediscoverTimer) {
            this.clearTimeout(this.rediscoverTimer);
        }
        const delay = (Number(this.config.rediscoverDelay) || 10) * 1000;
        this.rediscoverTimer = this.setTimeout(() => {
            this.rediscoverTimer = undefined;
            this.runDiscovery().catch(e => this.log.error(`Erkennung fehlgeschlagen: ${(e as Error).message}`));
        }, delay);
    }

    private onUnload(callback: () => void): void {
        Promise.resolve(this.server?.stop())
            .catch(() => undefined)
            .finally(() => callback());
    }
}

function toValue(state: ioBroker.State | null | undefined): SvStateValue | null {
    if (!state) {
        return null;
    }
    return { val: state.val, ack: state.ack, ts: state.ts };
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new SmartVis(options);
} else {
    (() => new SmartVis())();
}
