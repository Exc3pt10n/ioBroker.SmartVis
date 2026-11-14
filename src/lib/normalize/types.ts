export type ObjectMap = Record<string, ioBroker.Object>;

/** Änderung an einem State für die Erkennung (das Original in ioBroker bleibt unverändert) */
export type StatePatch = Partial<ioBroker.StateCommon> & {
    /**
     * Position läuft andersherum (z. B. Rollladen 0 = offen): SmartVis rechnet beim Lesen, Schreiben
     * und im Verlauf auf "100 = offen" um
     */
    invert?: boolean;
};

/** Ergebnis einer Regel: Änderung, "hide" (für die Erkennung ausblenden) oder nichts */
export type RuleResult<T> = T | 'hide' | undefined;

export interface RuleContext {
    objects: ObjectMap;
    /** Direkte Kinder (alle Objekttypen) einer ID */
    children(id: string): string[];
    /** ID ohne letztes Segment */
    parentId(id: string): string;
    /** Name in der Sprache der Anlage */
    name(obj: ioBroker.Object | undefined): string | undefined;
}

/**
 * Anpassungen für einen Adapter, dessen Objekte der type-detector nicht (richtig) versteht:
 * Rollen korrigieren, Hilfs-Datenpunkte ausblenden, technische Namen ersetzen.
 */
export interface AdapterRules {
    /**
     * Kanal, Gerät oder Ordner: neuer Name bzw. "hide" (blendet alles darunter aus).
     * fallback: Ersatzname (z. B. Modellbezeichnung) – ein smartName aus iot/Alexa hat Vorrang
     */
    structure?(id: string, obj: ioBroker.Object, ctx: RuleContext): RuleResult<{ name: string; fallback?: boolean }>;
    /** State: Rolle/Einheit/… ändern bzw. "hide" */
    state?(id: string, common: ioBroker.StateCommon, ctx: RuleContext): RuleResult<StatePatch>;
}
