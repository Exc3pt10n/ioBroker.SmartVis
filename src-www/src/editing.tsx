import { createContext, useContext } from 'react';
import type { SvDevice, SvModel, SvRoom } from '../../src/shared/protocol';

export interface EditState {
    editing: boolean;
    setEditing: (on: boolean) => void;
}

/** Bearbeiten-Modus (App-weit) */
export const EditContext = createContext<EditState>({ editing: false, setEditing: () => undefined });

export function useEditing(): EditState {
    return useContext(EditContext);
}

/** Geräte, die angezeigt werden (ausgeblendete nur im Bearbeiten-Modus) */
export function visibleDevices(model: SvModel, editing: boolean): SvDevice[] {
    return editing ? model.devices : model.devices.filter(d => !d.hidden);
}

export function visibleRooms(model: SvModel, editing: boolean): SvRoom[] {
    return editing ? model.rooms : model.rooms.filter(r => !r.hidden);
}

export function favorites(model: SvModel, editing: boolean): SvDevice[] {
    return visibleDevices(model, editing)
        .filter(d => d.favorite)
        .sort(
            (a, b) =>
                (a.favoriteOrder ?? Number.MAX_SAFE_INTEGER) - (b.favoriteOrder ?? Number.MAX_SAFE_INTEGER) ||
                a.name.localeCompare(b.name, 'de'),
        );
}

/** Element in einer Liste um eine Position verschieben */
export function moved(ids: string[], id: string, delta: -1 | 1): string[] | undefined {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) {
        return undefined;
    }
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}
