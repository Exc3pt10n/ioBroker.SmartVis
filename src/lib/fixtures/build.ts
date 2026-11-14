/**
 * Hilfen für nachgebaute Objektbäume fremder Adapter (Testdaten).
 * Die Bäume folgen den Objekt-Definitionen im Quellcode des jeweiligen Adapters
 * (IDs, Objekttypen, Rollen, Namen) – Werte werden für die Erkennung nicht benötigt.
 */
export type ObjectMap = Record<string, ioBroker.Object>;

type Common = Partial<ioBroker.StateCommon> & Record<string, unknown>;

export class Tree {
    readonly objects: ObjectMap = {};

    /** Adapter-Instanz (aktiv) */
    instance(id: string, enabled = true): this {
        this.objects[`system.adapter.${id}`] = {
            _id: `system.adapter.${id}`,
            type: 'instance',
            common: { name: id.split('.')[0], enabled, host: 'host' },
            native: {},
        } as unknown as ioBroker.Object;
        return this;
    }

    folder(id: string, name: ioBroker.StringOrTranslated, native: Record<string, unknown> = {}): this {
        return this.add(id, 'folder', { name }, native);
    }

    device(
        id: string,
        name: ioBroker.StringOrTranslated,
        native: Record<string, unknown> = {},
        common: Common = {},
    ): this {
        return this.add(id, 'device', { name, ...common }, native);
    }

    channel(
        id: string,
        name: ioBroker.StringOrTranslated,
        native: Record<string, unknown> = {},
        common: Common = {},
    ): this {
        return this.add(id, 'channel', { name, ...common }, native);
    }

    /** State; read/write wie in ioBroker üblich (Standard: lesbar, nicht schreibbar) */
    state(id: string, common: Common, native: Record<string, unknown> = {}): this {
        return this.add(
            id,
            'state',
            { name: id.split('.').pop(), type: 'mixed', read: true, write: false, role: 'state', ...common },
            native,
        );
    }

    /** Raum-Enum */
    room(id: string, name: string, members: string[]): this {
        this.objects[`enum.rooms.${id}`] = {
            _id: `enum.rooms.${id}`,
            type: 'enum',
            common: { name, members },
            native: {},
        } as unknown as ioBroker.Object;
        return this;
    }

    private add(id: string, type: string, common: Record<string, unknown>, native: Record<string, unknown>): this {
        this.objects[id] = { _id: id, type, common, native } as unknown as ioBroker.Object;
        return this;
    }
}
