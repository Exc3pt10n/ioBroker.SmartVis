/**
 * Gemeinsame Typen für Backend (Adapter) und Frontend (PWA).
 * Änderungen hier betreffen beide Seiten – PROTOCOL_VERSION erhöhen, wenn inkompatibel.
 */

export const PROTOCOL_VERSION = 1;

/** Woher stammt eine Raumzuordnung? enum = ioBroker-Aufzählung, adapter = z. B. Hue-Raum, name = aus dem Gerätenamen */
export type RoomSource = 'enum' | 'adapter' | 'name';

export interface SvRoom {
    /** enum-ID (z. B. "enum.rooms.living"), generiert ("auto.wohnzimmer") oder selbst angelegt ("custom.…") */
    id: string;
    name: string;
    source: RoomSource | 'custom';
    /** Vom Nutzer ausgeblendet (nur im Bearbeiten-Modus sichtbar) */
    hidden?: boolean;
    /** Name vor einer Umbenennung durch den Nutzer */
    originalName?: string;
}

/** Wo der Verlauf eines Werts aufgezeichnet wird */
export interface SvHistoryRef {
    /** History-Instanz, z. B. "sql.0" */
    instance: string;
    /** Aufgezeichneter State – kann vom angezeigten abweichen (z. B. PvPwTotal in kW statt PvPw) */
    id: string;
    unit?: string;
}

export type SvHistoryRange = '6h' | '24h' | '7d';

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
    /** Verlauf vorhanden (sql/history/influxdb) */
    history?: SvHistoryRef;
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
    /** Vom Nutzer ausgeblendet (nur im Bearbeiten-Modus sichtbar) */
    hidden?: boolean;
    favorite?: boolean;
    /** Position in den Favoriten */
    favoriteOrder?: number;
    /** Name/Raum laut Erkennung, falls der Nutzer sie geändert hat */
    originalName?: string;
    originalRoomId?: string | null;
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
    /** Eigenversorgung (Verbrauch ohne Netzbezug) */
    selfSupply?: SvStateRef;
}

/** Energiezähler eines Zeitraums (Heute, Gestern, Monat, Vormonat … Gesamt) */
export interface SvEnergyPeriod {
    /** z. B. "day", "day.previous", "total" */
    key: string;
    /** Zeitraumart für die Auswahl: day | month | quarter | halfyear | year | total */
    group: string;
    /** Anzeige, z. B. "Heute", "Vormonat" */
    label: string;
    /** Zeitraum-Kennung des Adapters (z. B. "2026-11"), falls vorhanden */
    periodKey?: SvStateRef;
    totals: SvEnergyTotals;
}

/** PV-Prognose einer Anlage bzw. der Summe (Adapter pvforecast) */
export interface SvPvForecastValues {
    name: string;
    /** Prognostizierte Leistung jetzt */
    powerNow?: SvStateRef;
    /** Energie heute bis jetzt */
    energyNow?: SvStateRef;
    /** Energie von jetzt bis Tagesende */
    energyRemaining?: SvStateRef;
    energyToday?: SvStateRef;
    energyTomorrow?: SvStateRef;
    installed?: SvStateRef;
}

export interface SvPvForecast {
    id: string;
    name: string;
    adapter: string;
    summary: SvPvForecastValues;
    plants: SvPvForecastValues[];
    /** Verlauf als JSON-String: [{ t: ms, y: Leistung }] in der Einheit von summary.powerNow */
    curve?: SvStateRef;
    lastUpdated?: SvStateRef;
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
    /** Alle Zählerzeiträume (Heute zuerst) */
    periods?: SvEnergyPeriod[];
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
    /**
     * Eingestellter Ladestrom (Limit), z. B. in mA. Wallboxen ohne Energiezähler (KEBA Deutschland-Edition)
     * melden keine Leistung – die App schätzt sie dann aus Strom × 230 V × Phasen.
     */
    current?: SvStateRef;
    /** Hardware-Maximum des Ladestroms */
    currentMax?: SvStateRef;
    /** Phasen, mit denen gerade geladen wird (falls gemessen) */
    phases?: SvStateRef;
    /** Konfigurierte Phasenzahl (Schätzung bei Wallboxen ohne Zähler) */
    configuredPhases?: SvStateRef;
    /** PV-Überschuss, mit dem die Ladeautomatik rechnet (W; negativ = kein Überschuss) */
    surplus?: SvStateRef;
    /** Weitere Einstellungen (Ladeautomatik, Batteriespeicher, Ziel-Ladung) */
    settings?: SvWallboxSetting[];
    /** Datenpunkt-Name des Fahrzeug-SoC (leer = Ziel-Ladung nicht möglich) */
    vehicleSoCSource?: SvStateRef;
    /** Schalter: Laden nach PV-Überschuss */
    pvAutomatic?: SvStateRef;
    /** Schalter: Laden pausieren */
    pause?: SvStateRef;
    connected?: SvStateRef;
}

/** Einstellbarer Wert einer Wallbox (z. B. der Ladeautomatik des Adapters) */
export interface SvWallboxSetting {
    key: string;
    label: string;
    hint?: string;
    group: string;
    state: SvStateRef;
    kind: 'switch' | 'number' | 'select';
    /** Anzeige-Einheit (z. B. "A", auch wenn der State mA speichert) */
    unit?: string;
    /** Faktor State → Anzeige (z. B. 0.001 für mA → A) */
    scale?: number;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: number; label: string }[];
    /** Bedeutung des Werts 0 (z. B. "keine Begrenzung") */
    zeroLabel?: string;
    /** Nur wirksam, wenn der SoC-Datenpunkt des Fahrzeugs im Adapter gesetzt ist */
    needsVehicleSoC?: boolean;
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
    /** Zusätzliche Helligkeitssensoren (z. B. HmIP-SLO je Himmelsrichtung) */
    lightSensors?: SvLightSensor[];
}

export interface SvLightSensor {
    /** Anzeigename, z. B. "Osten" */
    name: string;
    /** Aktuelle Helligkeit in Lux */
    current?: SvStateRef;
    /** Mittelwert der letzten Minuten in Lux */
    average?: SvStateRef;
    unreach?: SvStateRef;
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

/** Nutzer-Anpassungen; überleben Neu-Erkennungen (Schlüssel: stabile Objekt-IDs) */
export interface SvDeviceOverride {
    name?: string;
    /** Raum-ID oder null für "Ohne Raum" */
    roomId?: string | null;
    hidden?: boolean;
    favorite?: boolean;
    /** Position innerhalb des Raums */
    order?: number;
    /** Position innerhalb der Favoriten */
    favoriteOrder?: number;
}

export interface SvRoomOverride {
    name?: string;
    hidden?: boolean;
    order?: number;
    /** Vom Nutzer angelegter Raum */
    custom?: boolean;
}

/** Anzeige-Einstellungen der App (gelten für alle Geräte/Browser) */
export interface SvUiSettings {
    /** Hinweis "Geräte ohne Raum" auf der Startseite ausblenden */
    hideNoRoomHint?: boolean;
}

export interface SvOverrides {
    version: 1;
    devices: Record<string, SvDeviceOverride>;
    rooms: Record<string, SvRoomOverride>;
    ui?: SvUiSettings;
}

/**
 * Änderung aus dem Bearbeiten-Modus; null löscht ein Feld (zurück zur Erkennung).
 * Ausnahme roomId: null = "Ohne Raum", '' = zurück zum erkannten Raum.
 */
export type SvEdit =
    | { kind: 'device'; id: string; patch: { [K in keyof SvDeviceOverride]?: SvDeviceOverride[K] | null } }
    | { kind: 'room'; id: string; patch: { [K in keyof SvRoomOverride]?: SvRoomOverride[K] | null } }
    | { kind: 'deviceOrder'; ids: string[] }
    | { kind: 'favoriteOrder'; ids: string[] }
    | { kind: 'roomOrder'; ids: string[] }
    | { kind: 'createRoom'; name: string; /** Gerät gleich in den neuen Raum verschieben */ deviceId?: string }
    | { kind: 'deleteRoom'; id: string }
    | { kind: 'resetDevice'; id: string }
    | { kind: 'ui'; patch: { [K in keyof SvUiSettings]?: SvUiSettings[K] | null } };

/** Szene einer Hue-Gruppe (Knopf-State, wird mit true ausgelöst) */
export interface SvScene {
    name: string;
    state: SvStateRef;
}

/** Hue-Raum oder -Zone mit ihren Szenen */
export interface SvSceneGroup {
    /** Kanal-ID der Gruppe (z. B. "hue.0.Esszimmer") */
    id: string;
    name: string;
    kind: 'room' | 'zone';
    /** Geräte-IDs der Lampen dieser Gruppe (inkl. der Gruppe selbst, falls als Kachel erkannt) */
    devices: string[];
    scenes: SvScene[];
}

export interface SvModel {
    rooms: SvRoom[];
    devices: SvDevice[];
    /** Über Adapter-Profile erkannte Energiesysteme (PV, Speicher …) */
    energy: SvEnergySystem[];
    wallboxes: SvWallbox[];
    pvForecast: SvPvForecast[];
    /** Lokale Wetterstationen; die erste wird auf der Startseite angezeigt */
    weather: SvWeather[];
    shutterControl: SvShutterControl[];
    /** Hue-Szenen je Raum/Zone */
    scenes: SvSceneGroup[];
    /** Zeitpunkt der letzten Erkennung (ms) */
    generatedAt: number;
    /** Darf die App Anpassungen speichern? */
    editable: boolean;
    /** Anzeige-Einstellungen aus den Anpassungen */
    ui?: SvUiSettings;
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
    | { t: 'error'; message: string }
    | { t: 'history'; reqId: number; points: [number, number][]; error?: string };

/** Nachrichten Client → Server */
export type ClientMessage =
    | { t: 'set'; id: string; val: ioBrokerValue }
    | { t: 'edit'; edit: SvEdit }
    | { t: 'history'; reqId: number; id: string; range: SvHistoryRange }
    | { t: 'ping' };
