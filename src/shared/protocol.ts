/**
 * Gemeinsame Typen für Backend (Adapter) und Frontend (PWA).
 * Änderungen hier betreffen beide Seiten – PROTOCOL_VERSION erhöhen, wenn inkompatibel.
 */

export const PROTOCOL_VERSION = 1;

/** Woher stammt eine Raumzuordnung? */
export type RoomSource = 'enum' | 'name';

export interface SvRoom {
    /** enum-ID (z. B. "enum.rooms.living") oder generiert ("auto.wohnzimmer") */
    id: string;
    name: string;
    source: RoomSource;
}

export interface SvStateRef {
    /** Name der Rolle innerhalb des Geräts laut type-detector, z. B. "SET", "ACTUAL", "UNREACH" */
    name: string;
    /** ioBroker State-ID */
    id: string;
    type?: string;
    role?: string;
    unit?: string;
    min?: number;
    max?: number;
    write: boolean;
    /** Nur Anzeige-Indikator (Batterie, Erreichbarkeit …) */
    indicator?: boolean;
}

export interface SvDevice {
    /** ID des Kanals/Geräts, aus dem das Gerät erkannt wurde – stabil, dient als Schlüssel für Overrides */
    id: string;
    name: string;
    /** Gerätetyp laut type-detector (light, dimmer, blind, thermostat, window, …) */
    type: string;
    roomId: string | null;
    roomSource: RoomSource | null;
    /** Quell-Adapter, z. B. "hm-rpc", "hue" */
    adapter: string;
    states: SvStateRef[];
}

/** Leistungsflüsse eines Energiesystems (je Richtung ein State, Werte ≥ 0) */
export interface SvEnergyFlows {
    pv?: SvStateRef;
    home?: SvStateRef;
    gridImport?: SvStateRef;
    gridExport?: SvStateRef;
    batteryCharge?: SvStateRef;
    batteryDischarge?: SvStateRef;
}

/** Energiemengen eines Zeitraums (z. B. heute) */
export interface SvEnergyTotals {
    pv?: SvStateRef;
    home?: SvStateRef;
    gridImport?: SvStateRef;
    gridExport?: SvStateRef;
    batteryCharge?: SvStateRef;
    batteryDischarge?: SvStateRef;
    autarky?: SvStateRef;
    selfConsumption?: SvStateRef;
}

export interface SvEnergySystem {
    /** Instanz-ID, z. B. "qhome-ess-hyb-g2.0" */
    id: string;
    name: string;
    adapter: string;
    flows: SvEnergyFlows;
    battery?: {
        soc?: SvStateRef;
        /** Restlaufzeit bis voll/leer */
        remaining?: SvStateRef;
    };
    today?: SvEnergyTotals;
    /** Verbindung zum Gerät (true = verbunden) */
    connected?: SvStateRef;
}

export interface SvModel {
    rooms: SvRoom[];
    devices: SvDevice[];
    /** Über Adapter-Profile erkannte Energiesysteme (PV, Speicher …) */
    energy: SvEnergySystem[];
    /** Zeitpunkt der letzten Erkennung (ms) */
    generatedAt: number;
}

export interface SvStateValue {
    val: ioBrokerValue;
    ack: boolean;
    ts: number;
}

export type ioBrokerValue = string | number | boolean | null;

/** Nachrichten Server → Client */
export type ServerMessage =
    | { t: 'hello'; protocol: number; version: string }
    | { t: 'model'; model: SvModel }
    | { t: 'states'; states: Record<string, SvStateValue | null> }
    | { t: 'error'; message: string };

/** Nachrichten Client → Server */
export type ClientMessage = { t: 'set'; id: string; val: ioBrokerValue } | { t: 'ping' };
