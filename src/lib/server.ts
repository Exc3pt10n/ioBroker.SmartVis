import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import {
    PROTOCOL_VERSION,
    type ClientMessage,
    type ServerMessage,
    type SvEdit,
    type SvHistoryRange,
    type SvModel,
    type SvStateValue,
    type ioBrokerValue,
} from '../shared/protocol';

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

export interface ServerOptions {
    port: number;
    bind: string;
    wwwDir: string;
    version: string;
    /** Debounce für gebündelte State-Updates in ms */
    batchMs?: number;
}

export interface ServerHandlers {
    getModel(): SvModel;
    getStates(): Record<string, SvStateValue | null>;
    setState(id: string, val: ioBrokerValue): Promise<void>;
    /** Änderung aus dem Bearbeiten-Modus speichern (wirft bei Fehlern) */
    edit?(edit: SvEdit): Promise<void>;
    /** Verlauf eines aufgezeichneten States (Punkte [ts, wert]) */
    history?(id: string, range: SvHistoryRange): Promise<[number, number][]>;
    onClientCountChange?(count: number): void;
    log: ioBroker.Logger;
}

/**
 * HTTP-Server für die PWA-Dateien plus WebSocket-API unter /ws.
 */
export class SmartVisServer {
    private http?: Server;
    private wss?: WebSocketServer;
    private pending: Record<string, SvStateValue | null> = {};
    private flushTimer?: NodeJS.Timeout;
    private readonly root: string;

    constructor(
        private readonly options: ServerOptions,
        private readonly handlers: ServerHandlers,
    ) {
        this.root = resolve(options.wwwDir);
    }

    async start(): Promise<void> {
        this.http = createServer((req, res) => this.serveStatic(req, res));
        this.wss = new WebSocketServer({ server: this.http, path: '/ws' });
        this.wss.on('connection', ws => this.onConnection(ws));

        await new Promise<void>((resolvePromise, reject) => {
            this.http!.once('error', reject);
            this.http!.listen(this.options.port, this.options.bind || undefined, () => {
                this.http!.off('error', reject);
                resolvePromise();
            });
        });
    }

    async stop(): Promise<void> {
        clearTimeout(this.flushTimer);
        for (const client of this.wss?.clients || []) {
            client.terminate();
        }
        await new Promise<void>(r => (this.wss ? this.wss.close(() => r()) : r()));
        await new Promise<void>(r => (this.http ? this.http.close(() => r()) : r()));
    }

    /** Neues Model an alle Clients senden (nach einer Neu-Erkennung auch alle Werte) */
    publishModel(model: SvModel, withStates = true): void {
        this.broadcast({ t: 'model', model });
        if (withStates) {
            this.broadcast({ t: 'states', states: this.handlers.getStates() });
        }
    }

    /** State-Änderung vormerken; wird gebündelt verschickt */
    queueState(id: string, state: SvStateValue | null): void {
        this.pending[id] = state;
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.options.batchMs ?? 100);
        }
    }

    private flush(): void {
        this.flushTimer = undefined;
        const states = this.pending;
        this.pending = {};
        if (Object.keys(states).length) {
            this.broadcast({ t: 'states', states });
        }
    }

    private onConnection(ws: WebSocket): void {
        this.handlers.onClientCountChange?.(this.wss!.clients.size);
        send(ws, { t: 'hello', protocol: PROTOCOL_VERSION, version: this.options.version });
        send(ws, { t: 'model', model: this.handlers.getModel() });
        send(ws, { t: 'states', states: this.handlers.getStates() });

        ws.on('message', async (raw: Buffer) => {
            let msg: ClientMessage;
            try {
                msg = JSON.parse(raw.toString()) as ClientMessage;
            } catch {
                return send(ws, { t: 'error', message: 'invalid json' });
            }
            if (msg.t === 'history') {
                // Eigene Antwort mit reqId, damit die App sie der Anfrage zuordnen kann
                try {
                    if (!this.handlers.history) {
                        throw new Error('Verläufe sind nicht verfügbar');
                    }
                    const points = await this.handlers.history(String(msg.id), msg.range);
                    send(ws, { t: 'history', reqId: msg.reqId, points });
                } catch (e) {
                    send(ws, { t: 'history', reqId: msg.reqId, points: [], error: (e as Error).message });
                }
                return;
            }
            try {
                if (msg.t === 'set') {
                    await this.handlers.setState(msg.id, msg.val);
                } else if (msg.t === 'edit') {
                    if (!this.handlers.edit) {
                        throw new Error('Bearbeiten ist nicht verfügbar');
                    }
                    await this.handlers.edit(msg.edit);
                }
            } catch (e) {
                send(ws, { t: 'error', message: (e as Error).message });
            }
        });
        ws.on('close', () => this.handlers.onClientCountChange?.(this.wss!.clients.size));
    }

    private broadcast(msg: ServerMessage): void {
        const data = JSON.stringify(msg);
        for (const client of this.wss?.clients || []) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    private serveStatic(req: IncomingMessage, res: ServerResponse): void {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405).end();
            return;
        }
        let pathname: string;
        try {
            pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
        } catch {
            res.writeHead(400).end();
            return;
        }

        let file = resolve(this.root, `.${sep}${normalize(pathname)}`);
        if (file !== this.root && !file.startsWith(this.root + sep)) {
            res.writeHead(403).end();
            return;
        }
        if (!existsSync(file) || statSync(file).isDirectory()) {
            // SPA-Fallback: unbekannte Pfade liefern die App aus
            file = join(this.root, 'index.html');
            if (!existsSync(file)) {
                res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end(
                    'SmartVis frontend not built. Run "npm run build:www".',
                );
                return;
            }
        }

        const ext = extname(file);
        const immutable = pathname.startsWith('/assets/');
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        createReadStream(file).pipe(res);
    }
}

function send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
