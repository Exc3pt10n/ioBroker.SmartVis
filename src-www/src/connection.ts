import { useSyncExternalStore } from 'react';
import type {
    ClientMessage,
    ServerMessage,
    SvClientAction,
    SvDiagnosis,
    SvEdit,
    SvHistoryRange,
    SvModel,
    SvStateValue,
    ioBrokerValue,
} from '../../src/shared/protocol';
import { getClientId, suggestedName } from './clientId';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface Snapshot {
    status: ConnectionStatus;
    version?: string;
    model?: SvModel;
    states: Record<string, SvStateValue | null>;
    lastError?: string;
}

/**
 * WebSocket-Verbindung zum Adapter inkl. automatischem Reconnect.
 * Hält Model und State-Werte als unveränderliche Snapshots (für useSyncExternalStore).
 */
class Connection {
    private ws?: WebSocket;
    private listeners = new Set<() => void>();
    private retry = 0;
    private snapshot: Snapshot = { status: 'connecting', states: {} };
    private nextReqId = 1;
    private pendingHistory = new Map<
        number,
        { resolve: (p: [number, number][]) => void; reject: (e: Error) => void; timer: number }
    >();
    private pendingDiagnosis = new Map<
        number,
        { resolve: (r: SvDiagnosis) => void; reject: (e: Error) => void; timer: number }
    >();

    constructor() {
        this.connect();
        document.addEventListener('visibilitychange', () => {
            // Handy aus dem Standby: sofort neu verbinden statt auf Backoff zu warten
            if (document.visibilityState === 'visible' && this.snapshot.status === 'offline') {
                this.connect();
            }
        });
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): Snapshot => this.snapshot;

    setState(id: string, val: ioBrokerValue): void {
        // Optimistisch anzeigen, Bestätigung (ack) kommt per Update
        this.update({ states: { ...this.snapshot.states, [id]: { val, ack: false, ts: Date.now() } } });
        this.send({ t: 'set', id, val });
    }

    /** Verlauf eines aufgezeichneten States anfragen (Punkte [ts, wert]) */
    history(id: string, range: SvHistoryRange): Promise<[number, number][]> {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Keine Verbindung'));
        }
        const reqId = this.nextReqId++;
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                this.pendingHistory.delete(reqId);
                reject(new Error('Zeitüberschreitung beim Laden des Verlaufs'));
            }, 25_000);
            this.pendingHistory.set(reqId, { resolve, reject, timer });
            this.send({ t: 'history', reqId, id, range });
        });
    }

    /** Diagnose der Erkennung anfordern (erkannte Geräte, Kanäle ohne Kachel) */
    diagnose(): Promise<SvDiagnosis> {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Keine Verbindung'));
        }
        const reqId = this.nextReqId++;
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                this.pendingDiagnosis.delete(reqId);
                reject(new Error('Zeitüberschreitung bei der Diagnose'));
            }, 15_000);
            this.pendingDiagnosis.set(reqId, { resolve, reject, timer });
            this.send({ t: 'diagnose', reqId });
        });
    }

    /** Anpassung aus dem Bearbeiten-Modus senden; der Server antwortet mit neuem Model */
    edit(edit: SvEdit): void {
        this.update({ lastError: undefined });
        this.send({ t: 'edit', edit });
    }

    /** Anpassungen der Endgeräte verwalten (zurücksetzen, übernehmen, umbenennen …) */
    client(request: SvClientAction): void {
        this.update({ lastError: undefined });
        this.send({ t: 'client', request });
    }

    /** Wert nur lokal anzeigen (z. B. gespiegelte States), bis die echte Bestätigung kommt */
    preview(id: string, val: ioBrokerValue): void {
        this.update({ states: { ...this.snapshot.states, [id]: { val, ack: false, ts: Date.now() } } });
    }

    private connect(): void {
        this.ws?.close();
        const url = new URL('ws', window.location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(url);
        this.ws = ws;
        this.update({ status: 'connecting' });

        ws.onopen = () => {
            this.retry = 0;
            this.update({ status: 'online', lastError: undefined });
            // Anmeldung mit Geräte-Kennung: der Server schickt dann das Model mit den Anpassungen dieses Geräts
            this.send({ t: 'hello', clientId: getClientId(), name: suggestedName() });
        };
        ws.onmessage = event => this.onMessage(JSON.parse(event.data as string) as ServerMessage);
        ws.onclose = () => {
            if (this.ws !== ws) {
                return;
            }
            this.update({ status: 'offline' });
            const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
            setTimeout(() => this.ws === ws && this.connect(), delay);
        };
    }

    private onMessage(msg: ServerMessage): void {
        switch (msg.t) {
            case 'hello':
                this.update({ version: msg.version });
                break;
            case 'model':
                this.update({ model: msg.model });
                break;
            case 'states':
                this.update({ states: { ...this.snapshot.states, ...msg.states } });
                break;
            case 'error':
                this.update({ lastError: msg.message });
                break;
            case 'diagnose': {
                const pending = this.pendingDiagnosis.get(msg.reqId);
                if (pending) {
                    window.clearTimeout(pending.timer);
                    this.pendingDiagnosis.delete(msg.reqId);
                    if (msg.report) {
                        pending.resolve(msg.report);
                    } else {
                        pending.reject(new Error(msg.error || 'Diagnose fehlgeschlagen'));
                    }
                }
                break;
            }
            case 'history': {
                const pending = this.pendingHistory.get(msg.reqId);
                if (pending) {
                    window.clearTimeout(pending.timer);
                    this.pendingHistory.delete(msg.reqId);
                    if (msg.error) {
                        pending.reject(new Error(msg.error));
                    } else {
                        pending.resolve(msg.points);
                    }
                }
                break;
            }
        }
    }

    private send(msg: ClientMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private update(patch: Partial<Snapshot>): void {
        this.snapshot = { ...this.snapshot, ...patch };
        this.listeners.forEach(l => l());
    }
}

export const connection = new Connection();

export function useConnection(): Snapshot {
    return useSyncExternalStore(connection.subscribe, connection.getSnapshot);
}
