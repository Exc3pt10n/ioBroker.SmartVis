import {
    CARD_WIDTHS,
    type SvCardWidth,
    type SvDevice,
    type SvEdit,
    type SvModel,
    type SvOverrides,
    type SvRoom,
    type SvUiSettings,
    type SvViewLayout,
} from '../shared/protocol';
import { slug } from './rooms';

export function emptyOverrides(): SvOverrides {
    return { version: 1, devices: {}, rooms: {} };
}

/** Liest gespeicherte Overrides tolerant ein (kaputte/alte Dateien → leer) */
export function parseOverrides(raw: string | Buffer | undefined | null): SvOverrides {
    if (!raw) {
        return emptyOverrides();
    }
    try {
        const data = JSON.parse(raw.toString()) as Partial<SvOverrides>;
        const result: SvOverrides = {
            version: 1,
            devices: data.devices && typeof data.devices === 'object' ? data.devices : {},
            rooms: data.rooms && typeof data.rooms === 'object' ? data.rooms : {},
        };
        const ui = parseUi(data.ui);
        if (ui) {
            result.ui = ui;
        }
        return result;
    } catch {
        return emptyOverrides();
    }
}

const VIEW_KEY = /^[a-z][a-z0-9.-]{0,39}$/i;
const MAX_KEYS = 200;

/** Liste von Bereichs-Schlüsseln bereinigen (Strings, ohne Duplikate, begrenzt) */
function keyList(raw: unknown): string[] | undefined {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const list = [
        ...new Set(raw.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 200)),
    ].slice(0, MAX_KEYS);
    return list.length ? list : undefined;
}

function widthMap(raw: unknown): Record<string, SvCardWidth> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }
    const entries = Object.entries(raw as Record<string, unknown>)
        .filter(
            (e): e is [string, SvCardWidth] =>
                e[0].length > 0 && e[0].length <= 200 && CARD_WIDTHS.includes(e[1] as SvCardWidth),
        )
        .slice(0, MAX_KEYS);
    return entries.length ? Object.fromEntries(entries) : undefined;
}

function parseViews(raw: unknown): Record<string, SvViewLayout> | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const views: Record<string, SvViewLayout> = {};
    for (const [view, layout] of Object.entries(raw as Record<string, unknown>).slice(0, 100)) {
        if (!VIEW_KEY.test(view) || !layout || typeof layout !== 'object') {
            continue;
        }
        const order = keyList((layout as SvViewLayout).order);
        const hidden = keyList((layout as SvViewLayout).hidden);
        const widths = widthMap((layout as SvViewLayout).widths);
        if (order || hidden || widths) {
            views[view] = { ...(order && { order }), ...(hidden && { hidden }), ...(widths && { widths }) };
        }
    }
    return Object.keys(views).length ? views : undefined;
}

/** Nur bekannte Einstellungen übernehmen */
function parseUi(raw: unknown): SvUiSettings | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const ui: SvUiSettings = {};
    if ((raw as SvUiSettings).hideNoRoomHint === true) {
        ui.hideNoRoomHint = true;
    }
    const views = parseViews((raw as SvUiSettings).views);
    if (views) {
        ui.views = views;
    }
    return Object.keys(ui).length ? ui : undefined;
}

const MAX_NAME = 60;

function cleanName(name: unknown): string | undefined {
    if (typeof name !== 'string') {
        return undefined;
    }
    const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    return trimmed || undefined;
}

/** Entfernt leere Einträge, damit die Datei klein und lesbar bleibt */
function prune(o: SvOverrides): SvOverrides {
    for (const map of [o.devices, o.rooms] as Record<string, Record<string, unknown>>[]) {
        for (const [id, entry] of Object.entries(map)) {
            for (const [k, v] of Object.entries(entry)) {
                // roomId: null ist eine bewusste Zuordnung ("Ohne Raum") und bleibt erhalten
                if (v === undefined || (v === null && k !== 'roomId')) {
                    delete entry[k];
                }
            }
            if (!Object.keys(entry).length) {
                delete map[id];
            }
        }
    }
    o.ui = parseUi(o.ui);
    if (!o.ui) {
        delete o.ui;
    }
    return o;
}

/**
 * Wendet eine Änderung aus dem Bearbeiten-Modus an (gibt neue Overrides zurück).
 * Wirft bei ungültigen Eingaben – der Server meldet den Fehler an die App.
 */
export function applyEdit(current: SvOverrides, edit: SvEdit): SvOverrides {
    const o: SvOverrides = JSON.parse(JSON.stringify(current)) as SvOverrides;
    switch (edit.kind) {
        case 'device': {
            const entry = (o.devices[edit.id] ||= {});
            const p = edit.patch;
            if ('name' in p) {
                entry.name = p.name === null ? undefined : cleanName(p.name);
            }
            if ('roomId' in p) {
                // '' = zurück zum erkannten Raum, null = bewusst "Ohne Raum", sonst Raum-ID
                if (p.roomId === '' || p.roomId === undefined) {
                    delete entry.roomId;
                } else {
                    entry.roomId = p.roomId;
                }
            }
            for (const key of ['hidden', 'favorite'] as const) {
                if (key in p) {
                    entry[key] = p[key] ? true : undefined;
                }
            }
            for (const key of ['order', 'favoriteOrder'] as const) {
                if (key in p) {
                    const v = p[key];
                    entry[key] = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
                }
            }
            break;
        }
        case 'room': {
            const entry = (o.rooms[edit.id] ||= {});
            const p = edit.patch;
            if ('name' in p) {
                entry.name = p.name === null ? undefined : cleanName(p.name);
            }
            if ('hidden' in p) {
                entry.hidden = p.hidden ? true : undefined;
            }
            if ('order' in p) {
                entry.order = typeof p.order === 'number' ? p.order : undefined;
            }
            if ('icon' in p) {
                // Ein Emoji (ggf. mit Varianten-/Verbindungszeichen) – kein Text, keine Markup-Reste
                const icon = typeof p.icon === 'string' ? p.icon.trim() : '';
                entry.icon = icon && icon.length <= 16 && !/[\p{L}\p{N}<>&"']/u.test(icon) ? icon : undefined;
            }
            break;
        }
        case 'deviceOrder':
        case 'favoriteOrder': {
            const key = edit.kind === 'deviceOrder' ? 'order' : 'favoriteOrder';
            edit.ids.forEach((id, index) => {
                (o.devices[id] ||= {})[key] = index;
            });
            break;
        }
        case 'roomOrder':
            edit.ids.forEach((id, index) => {
                (o.rooms[id] ||= {}).order = index;
            });
            break;
        case 'createRoom': {
            const name = cleanName(edit.name);
            if (!name) {
                throw new Error('Raumname fehlt');
            }
            let id = `custom.${slug(name) || 'raum'}`;
            for (let n = 2; o.rooms[id]; n++) {
                id = `custom.${slug(name)}-${n}`;
            }
            o.rooms[id] = { name, custom: true };
            if (edit.deviceId) {
                (o.devices[edit.deviceId] ||= {}).roomId = id;
            }
            break;
        }
        case 'deleteRoom': {
            if (!o.rooms[edit.id]?.custom) {
                throw new Error('Nur selbst angelegte Räume können gelöscht werden');
            }
            delete o.rooms[edit.id];
            // Geräte, die dorthin verschoben waren, kehren in ihren erkannten Raum zurück
            for (const entry of Object.values(o.devices)) {
                if (entry.roomId === edit.id) {
                    delete entry.roomId;
                }
            }
            break;
        }
        case 'resetDevice':
            delete o.devices[edit.id];
            break;
        case 'ui': {
            const ui = { ...o.ui };
            if ('hideNoRoomHint' in edit.patch) {
                ui.hideNoRoomHint = edit.patch.hideNoRoomHint ? true : undefined;
            }
            o.ui = ui;
            break;
        }
        case 'view': {
            if (typeof edit.view !== 'string' || !VIEW_KEY.test(edit.view)) {
                throw new Error('Unbekannte Ansicht');
            }
            const views = { ...o.ui?.views };
            const layout: SvViewLayout = { ...views[edit.view] };
            if ('order' in edit) {
                layout.order = edit.order === null ? undefined : keyList(edit.order);
            }
            if ('hidden' in edit) {
                layout.hidden = edit.hidden === null ? undefined : keyList(edit.hidden);
            }
            if ('widths' in edit && edit.widths === null) {
                layout.widths = undefined;
            }
            if (edit.width) {
                const { key, width } = edit.width;
                if (typeof key !== 'string' || !key || key.length > 200) {
                    throw new Error('Ungültiger Bereich');
                }
                if (width !== null && !CARD_WIDTHS.includes(width)) {
                    throw new Error('Ungültige Breite');
                }
                const widths = { ...layout.widths };
                if (width === null) {
                    delete widths[key];
                } else {
                    widths[key] = width;
                }
                layout.widths = Object.keys(widths).length ? widths : undefined;
            }
            views[edit.view] = layout;
            o.ui = { ...o.ui, views };
            break;
        }
        default:
            throw new Error('Unbekannte Änderung');
    }
    return prune(o);
}

function byOrder<T extends { name: string }>(order: (item: T) => number | undefined): (a: T, b: T) => number {
    return (a, b) => {
        const oa = order(a) ?? Number.MAX_SAFE_INTEGER;
        const ob = order(b) ?? Number.MAX_SAFE_INTEGER;
        return oa - ob || a.name.localeCompare(b.name, 'de');
    };
}

/**
 * Wendet die Overrides auf das erkannte Model an. Reine Funktion.
 * Ausgeblendete Geräte/Räume bleiben im Model (für den Bearbeiten-Modus), sind aber markiert.
 */
export function applyOverrides(model: SvModel, overrides: SvOverrides, editable: boolean): SvModel {
    const rooms: SvRoom[] = model.rooms.map(r => {
        const o = overrides.rooms[r.id];
        return o
            ? {
                  ...r,
                  name: o.name || r.name,
                  hidden: o.hidden || undefined,
                  originalName: o.name ? r.name : undefined,
                  icon: o.icon || undefined,
              }
            : r;
    });
    for (const [id, o] of Object.entries(overrides.rooms)) {
        if (o.custom && o.name && !rooms.some(r => r.id === id)) {
            rooms.push({
                id,
                name: o.name,
                source: 'custom',
                hidden: o.hidden || undefined,
                icon: o.icon || undefined,
            });
        }
    }
    const roomIds = new Set(rooms.map(r => r.id));

    const devices: SvDevice[] = model.devices.map(d => {
        const o = overrides.devices[d.id];
        if (!o) {
            return d;
        }
        // Verschoben in einen Raum, den es nicht mehr gibt → erkannter Raum
        const roomId = o.roomId === undefined || (o.roomId !== null && !roomIds.has(o.roomId)) ? d.roomId : o.roomId;
        return {
            ...d,
            name: o.name || d.name,
            roomId,
            hidden: o.hidden || undefined,
            favorite: o.favorite || undefined,
            favoriteOrder: o.favorite ? o.favoriteOrder : undefined,
            originalName: o.name ? d.name : undefined,
            originalRoomId: roomId !== d.roomId ? d.roomId : undefined,
        };
    });

    rooms.sort(byOrder(r => overrides.rooms[r.id]?.order));
    devices.sort(byOrder(d => overrides.devices[d.id]?.order));

    return { ...model, rooms, devices, editable, ui: overrides.ui || {} };
}
