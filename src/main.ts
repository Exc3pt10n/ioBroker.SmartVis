import * as utils from '@iobroker/adapter-core';
import { join } from 'node:path';
import { discover, type DiscoveryResult } from './lib/discovery';
import { SmartVisServer } from './lib/server';
import type { SvStateValue, ioBrokerValue } from './shared/protocol';

class SmartVis extends utils.Adapter {
    private server?: SmartVisServer;
    private discovery?: DiscoveryResult;
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
        await this.runDiscovery();

        this.server = new SmartVisServer(
            {
                port: Number(this.config.port) || 8099,
                bind: this.config.bind || '0.0.0.0',
                wwwDir: join(__dirname, '..', 'www'),
                version: this.version || '0.0.0',
            },
            {
                getModel: () => this.discovery!.model,
                getStates: () => this.states,
                setState: (id, val) => this.writeState(id, val),
                onClientCountChange: count => void this.setState('info.clients', count, true),
                log: this.log,
            },
        );

        try {
            await this.server.start();
            this.log.info(`SmartVis läuft auf http://${this.config.bind || '0.0.0.0'}:${this.config.port}`);
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
        const objects: Record<string, ioBroker.Object> = await this.getForeignObjectsAsync('*');
        const enums = (await this.getForeignObjectsAsync('enum.*', 'enum')) as Record<string, ioBroker.Object>;

        this.discovery = discover(
            { ...objects, ...enums },
            {
                language: this.config.language || 'de',
                ignoreAdapters: [this.name, ...(this.config.ignoreAdapters || '').split(',')],
            },
        );

        await this.syncSubscriptions(this.discovery.stateIds);

        const { devices, rooms } = this.discovery.model;
        const withoutRoom = devices.filter(d => !d.roomId).length;
        this.log.info(
            `Erkennung: ${devices.length} Geräte, ${rooms.length} Räume, ${withoutRoom} ohne Raum (${Date.now() - started} ms)`,
        );
        await this.setStateAsync('info.devices', devices.length, true);
        this.server?.publishModel(this.discovery.model);
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
        if (id.startsWith(`${this.namespace}.`) || id.startsWith('system.')) {
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
