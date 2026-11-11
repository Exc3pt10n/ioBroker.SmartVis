import type { SvClientAction, SvClientInfo, SvOverrideStore, SvOverrides } from '../shared/protocol';
import { emptyOverrides, parseOverrides } from './overrides';

/** Geräte-Kennung aus dem Browser (zufällig erzeugt) */
const CLIENT_ID = /^[a-z0-9-]{8,64}$/i;
const MAX_NAME = 40;
/** Höchstens so viele Geräte; darüber fallen die am längsten nicht gesehenen weg */
export const MAX_CLIENTS = 50;

export function isClientId(id: unknown): id is string {
    return typeof id === 'string' && CLIENT_ID.test(id);
}

function cleanName(name: unknown, fallback: string): string {
    const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
    return n || fallback;
}

function copy(o: SvOverrides): SvOverrides {
    return JSON.parse(JSON.stringify(o)) as SvOverrides;
}

export function emptyStore(): SvOverrideStore {
    return { version: 2, shared: emptyOverrides(), clients: {} };
}

/**
 * Liest overrides.json tolerant ein. Format 1 (gemeinsame Anpassungen für alle Geräte) wird
 * übernommen: Es wird zur Ausgangsbasis, mit der jedes Gerät beim ersten Verbinden startet.
 */
export function parseStore(raw: string | Buffer | undefined | null): SvOverrideStore {
    if (!raw) {
        return emptyStore();
    }
    let data: unknown;
    try {
        data = JSON.parse(raw.toString());
    } catch {
        return emptyStore();
    }
    if (!data || typeof data !== 'object') {
        return emptyStore();
    }
    const d = data as Partial<SvOverrideStore> & { version?: number };
    if (d.version !== 2) {
        return { version: 2, shared: parseOverrides(raw), clients: {} };
    }
    const store: SvOverrideStore = {
        version: 2,
        shared: parseOverrides(JSON.stringify(d.shared ?? {})),
        clients: {},
    };
    for (const [id, entry] of Object.entries(d.clients && typeof d.clients === 'object' ? d.clients : {})) {
        if (!isClientId(id) || !entry || typeof entry !== 'object') {
            continue;
        }
        store.clients[id] = {
            name: cleanName(entry.name, 'Gerät'),
            created: Number(entry.created) || 0,
            lastSeen: Number(entry.lastSeen) || 0,
            overrides: parseOverrides(JSON.stringify(entry.overrides ?? {})),
        };
    }
    return store;
}

/** Anpassungen eines Clients (ohne Kennung: die gemeinsame Ausgangsbasis) */
export function overridesFor(store: SvOverrideStore, clientId: string | undefined): SvOverrides {
    return (clientId && store.clients[clientId]?.overrides) || store.shared;
}

/**
 * Gerät anmelden: unbekannte Geräte starten mit einer Kopie der Ausgangsbasis.
 * Aktualisiert "zuletzt gesehen"; der Name wird nur beim ersten Mal übernommen.
 */
export function registerClient(store: SvOverrideStore, id: string, name: unknown, now: number): SvOverrideStore {
    const next: SvOverrideStore = { ...store, clients: { ...store.clients } };
    const existing = next.clients[id];
    next.clients[id] = existing
        ? { ...existing, lastSeen: now }
        : { name: cleanName(name, 'Gerät'), created: now, lastSeen: now, overrides: copy(store.shared) };
    // Begrenzen: die am längsten nicht gesehenen Geräte fallen weg (nie das gerade angemeldete)
    const ids = Object.keys(next.clients);
    if (ids.length > MAX_CLIENTS) {
        ids.filter(x => x !== id)
            .sort((a, b) => next.clients[a].lastSeen - next.clients[b].lastSeen)
            .slice(0, ids.length - MAX_CLIENTS)
            .forEach(x => delete next.clients[x]);
    }
    return next;
}

/** Anpassungen eines Clients ersetzen (ohne Kennung: Ausgangsbasis) */
export function withOverrides(
    store: SvOverrideStore,
    clientId: string | undefined,
    overrides: SvOverrides,
): SvOverrideStore {
    if (clientId && store.clients[clientId]) {
        return {
            ...store,
            clients: { ...store.clients, [clientId]: { ...store.clients[clientId], overrides } },
        };
    }
    return { ...store, shared: overrides };
}

/** Verwaltung: umbenennen, zurücksetzen, von anderem Gerät übernehmen, entfernen */
export function applyClientAction(
    store: SvOverrideStore,
    clientId: string | undefined,
    request: SvClientAction,
): SvOverrideStore {
    const own = clientId ? store.clients[clientId] : undefined;
    switch (request.action) {
        case 'rename':
            if (!own || !clientId) {
                throw new Error('Dieses Gerät ist nicht angemeldet');
            }
            return {
                ...store,
                clients: { ...store.clients, [clientId]: { ...own, name: cleanName(request.name, own.name) } },
            };
        case 'reset':
            // Ausgangszustand = automatische Erkennung ohne Anpassungen
            return withOverrides(store, clientId, emptyOverrides());
        case 'resetAll':
            return {
                version: 2,
                shared: emptyOverrides(),
                clients: Object.fromEntries(
                    Object.entries(store.clients).map(([id, c]) => [id, { ...c, overrides: emptyOverrides() }]),
                ),
            };
        case 'copyFrom': {
            const source = store.clients[request.id];
            if (!source) {
                throw new Error('Gerät nicht gefunden');
            }
            return withOverrides(store, clientId, copy(source.overrides));
        }
        case 'remove': {
            if (request.id === clientId) {
                throw new Error('Das eigene Gerät kann nicht entfernt werden');
            }
            if (!store.clients[request.id]) {
                throw new Error('Gerät nicht gefunden');
            }
            const clients = { ...store.clients };
            delete clients[request.id];
            return { ...store, clients };
        }
        default:
            throw new Error('Unbekannte Aktion');
    }
}

/** Infos für die App: eigenes Gerät und alle Geräte (zuletzt gesehen zuerst) */
export function clientInfo(store: SvOverrideStore, clientId: string | undefined): SvClientInfo {
    const own = clientId ? store.clients[clientId] : undefined;
    return {
        ...(own && clientId && { id: clientId, name: own.name }),
        devices: Object.entries(store.clients)
            .map(([id, c]) => ({ id, name: c.name, lastSeen: c.lastSeen }))
            .sort((a, b) => b.lastSeen - a.lastSeen),
    };
}
