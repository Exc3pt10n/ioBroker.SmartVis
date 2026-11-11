import * as utils from '@iobroker/adapter-core';
import { join } from 'node:path';
import { discover, type DiscoveryResult } from './lib/discovery';
import { applyEdit, applyOverrides, emptyOverrides, parseOverrides } from './lib/overrides';
import { SmartVisServer } from './lib/server';
import type { SvEdit, SvModel, SvOverrides, SvStateValue, ioBrokerValue } from './shared/protocol';

/** Datei im ioBroker-Dateispeicher der Instanz (Teil von Backups) */
const OVERRIDES_FILE = 'overrides.json';

class SmartVis extends utils.Adapter {
    private server?: SmartVisServer;
    private discovery?: DiscoveryResult;
    /** Erkanntes Model mit angewendeten Nutzer-Anpassungen */
    private model?: SvModel;
    private overrides: SvOverrides = emptyOverrides();
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
                getModel: () => this.model!,
                getStates: () => this.states,
                setState: (id, val) => this.writeState(id, val),
                edit: edit => this.handleEdit(edit),
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
        this.model = applyOverrides(this.discovery.model, this.overrides, this.config.allowEdit !== false);
        this.server?.publishModel(this.model, withStates);
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
                this.overrides = parseOverrides(file);
                const n = Object.keys(this.overrides.devices).length + Object.keys(this.overrides.rooms).length;
                this.log.info(`Anpassungen geladen (${n} Einträge)`);
            }
        } catch (e) {
            this.log.warn(`Anpassungen konnten nicht gelesen werden: ${(e as Error).message}`);
        }
    }

    /**
     * Änderungen strikt nacheinander verarbeiten: jede baut auf dem gespeicherten Stand der vorherigen auf
     * (sonst gingen schnell aufeinanderfolgende Änderungen verloren).
     */
    private handleEdit(edit: SvEdit): Promise<void> {
        const run = this.saveQueue.then(() => this.applyAndSave(edit));
        this.saveQueue = run.catch(() => undefined);
        return run;
    }

    private async applyAndSave(edit: SvEdit): Promise<void> {
        if (this.config.allowEdit === false) {
            throw new Error('Bearbeiten ist in den Adapter-Einstellungen deaktiviert');
        }
        const next = applyEdit(this.overrides, edit);
        try {
            // Erst speichern, dann übernehmen und verteilen: die App sieht nur, was wirklich gesichert ist
            await this.writeFileAsync(this.namespace, OVERRIDES_FILE, JSON.stringify(next, null, 2));
        } catch (e) {
            this.log.error(`Anpassungen konnten nicht gespeichert werden: ${(e as Error).message}`);
            throw new Error('Anpassung konnte nicht gespeichert werden');
        }
        this.overrides = next;
        this.updateModel(false);
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
