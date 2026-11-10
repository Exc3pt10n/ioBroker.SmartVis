/**
 * Gemeinsame Typen für Backend (Adapter) und Frontend (PWA).
 * Änderungen hier betreffen beide Seiten – PROTOCOL_VERSION erhöhen, wenn inkompatibel.
 */

export const PROTOCOL_VERSION = 1;

/** Woher stammt eine Raumzuordnung? enum = ioBroker-Aufzählung, adapter = z. B. Hue-Raum, name = aus dem Gerätenamen */
export type RoomSource = 'enum' | 'adapter' | 'name';

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

/** Wallbox (Ladestation) */
export interface SvWallbox {
    /** Instanz-ID, z. B. "kecontact.0" */
    id: string;
    name: string;
    adapter: string;
    /** Aktuelle Ladeleistung (Einheit im State, z. B. mW bei Keba) */
    power?: SvStateRef;
    /** Ladezustand der Wallbox, normalisiert über statusMap */
    status?: SvStateRef;
    statusMap?: Record<string, SvWallboxStatus>;
    /** Steckerzustand; Werte in vehiclePluggedValues = Fahrzeug verbunden */
    plug?: SvStateRef;
    vehiclePluggedValues?: number[];
    /** Geladene Energie der laufenden Sitzung */
    sessionEnergy?: SvStateRef;
    /** Energie der letzten abgeschlossenen Sitzung */
    lastSessionEnergy?: SvStateRef;
    /** Schalter: Laden nach PV-Überschuss */
    pvAutomatic?: SvStateRef;
    /** Schalter: Laden pausieren */
    pause?: SvStateRef;
    connected?: SvStateRef;
}

export type SvWallboxStatus = 'starting' | 'notReady' | 'ready' | 'charging' | 'error' | 'interrupted';

/** Aktuelle Wetterdaten einer lokalen Wetterstation */
export interface SvWeather {
    /** Geräte-ID, z. B. "hm-rpc.0.00181BE98EF40A" */
    id: string;
    name: string;
    adapter: string;
    /** Gerätemodell, z. B. "HmIP-SWO-PL" */
    model?: string;
    temperature?: SvStateRef;
    humidity?: SvStateRef;
    windSpeed?: SvStateRef;
    /** Windrichtung in Grad (nur Modelle mit Windfahne) */
    windDirection?: SvStateRef;
    /** Schwellwert Wind überschritten (Sturmwarnung der Station) */
    windAlarm?: SvStateRef;
    raining?: SvStateRef;
    /** Niederschlag heute in mm (CCU-Systemvariable) */
    rainToday?: SvStateRef;
    rainYesterday?: SvStateRef;
    illumination?: SvStateRef;
    /** Sonnenschein-Schwelle überschritten = Sonne scheint gerade */
    sunshine?: SvStateRef;
    /** Sonnenscheindauer heute in Minuten (CCU-Systemvariable) */
    sunshineToday?: SvStateRef;
    unreach?: SvStateRef;
    lowBat?: SvStateRef;
}

/** Schalter, dessen Anzeige- und Schreib-State verschieden sein können (z. B. gespiegelte Trigger-Datenpunkte) */
export interface SvSwitch {
    /** Angezeigter Zustand */
    value: SvStateRef;
    /** Wohin geschrieben wird (Quell-Datenpunkt, falls konfiguriert, sonst value) */
    write: SvStateRef;
}

export type SvShutterArea = 'living' | 'sleep' | 'children';

export interface SvShutterAreaInfo {
    key: SvShutterArea;
    label: string;
    /** Automatik des Bereichs ein/aus */
    auto?: SvSwitch;
    open?: SvStateRef;
    close?: SvStateRef;
    sunProtect?: SvStateRef;
    /** Nächste Fahrzeiten (Text, z. B. "07:30") */
    upTime?: SvStateRef;
    downTime?: SvStateRef;
}

/** Ein von der Rollladen-Automatik gesteuerter Rollladen */
export interface SvAutoShutter {
    name: string;
    /** Zugehöriger Level-State (verknüpft mit der Rollladen-Kachel) */
    level?: SvStateRef;
    area?: SvShutterArea;
    heightUp: number;
    heightDown: number;
    enabled: boolean;
    autoUp?: SvStateRef;
    autoDown?: SvStateRef;
    autoSun?: SvStateRef;
    /** Aktueller Automatik-Status (up, down, sunProtect, Manu_Mode …) */
    autoState?: SvStateRef;
}

/** Rollladen-Automatik (Adapter shuttercontrol) */
export interface SvShutterControl {
    id: string;
    name: string;
    adapter: string;
    openAll?: SvStateRef;
    closeAll?: SvStateRef;
    sunProtectAll?: SvStateRef;
    autoAll?: SvStateRef;
    holiday?: SvSwitch;
    schoolfree?: SvSwitch;
    areas: SvShutterAreaInfo[];
    shutters: SvAutoShutter[];
    sun: {
        sunrise?: SvStateRef;
        sunset?: SvStateRef;
        elevation?: SvStateRef;
        azimuth?: SvStateRef;
    };
}

export interface SvModel {
    rooms: SvRoom[];
    devices: SvDevice[];
    /** Über Adapter-Profile erkannte Energiesysteme (PV, Speicher …) */
    energy: SvEnergySystem[];
    wallboxes: SvWallbox[];
    /** Lokale Wetterstationen; die erste wird auf der Startseite angezeigt */
    weather: SvWeather[];
    shutterControl: SvShutterControl[];
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
