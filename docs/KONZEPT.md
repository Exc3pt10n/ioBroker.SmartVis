# ioBroker.SmartVis – Konzept (Entwurf v0.1)

> Status: Diskussionsgrundlage. Offene Entscheidungen sind mit **❓** markiert.

## 1. Ziele

| Ziel | Bedeutung |
|---|---|
| **Zero-Config-Start** | Nach der Installation zeigt die Visualisierung sofort sinnvolle Räume, Geräte und Bedienelemente – ohne dass der Nutzer ein einziges Widget anlegt. |
| **Intuitiv anpassbar** | Korrekturen (umbenennen, ausblenden, verschieben, Typ ändern) passieren direkt in der Visualisierung per Bearbeiten-Modus, nicht in Objekt-IDs. |
| **Mobile First** | Primär für Smartphone (Daumenbedienung, Touch, PWA installierbar), skaliert sauber auf Tablet (Wandpanel) und Desktop-Browser. |
| **Schnell & robust** | Live-Updates per WebSocket, kurze Ladezeit, funktioniert bei schlechter Verbindung (Offline-Shell, Reconnect). |

Nicht-Ziele (zunächst): freies Pixel-Layout à la VIS, Grafik-Editor für eigene Widgets.

## 2. Architektur

```
┌──────────────────────── ioBroker ────────────────────────┐
│  Objekte / States / Enums (rooms, functions)             │
│            │                                             │
│  ┌─────────▼──────────── SmartVis-Adapter (Node/TS) ───┐ │
│  │ Discovery  ─►  Device-Model  ◄─  User-Overrides     │ │
│  │ (type-detector + Heuristiken)     (JSON in Files)   │ │
│  │            │                                        │ │
│  │   HTTP-Server (PWA-Assets) + WebSocket-API          │ │
│  └────────────┬────────────────────────────────────────┘ │
└───────────────┼──────────────────────────────────────────┘
                │  nur freigegebene States, gebündelte Updates
        ┌───────▼────────┐
        │  Frontend (PWA) │  React + TypeScript + Vite
        └────────────────┘
```

### Backend (Adapter)
- **TypeScript**, Gerüst via `@iobroker/create-adapter`, Tests mit `@iobroker/testing`.
- **Discovery-Engine** erzeugt ein normalisiertes *Device-Model* (Räume → Geräte → Fähigkeiten).
- **Eigene WebSocket-API** statt direktem Zugriff des Frontends auf alle States:
  - Frontend bekommt nur das Device-Model + die tatsächlich benötigten States.
  - Updates werden gebündelt (z. B. 100 ms Debounce) → weniger Traffic auf dem Handy.
  - Schreibzugriffe werden gegen das Model validiert (nur bekannte, schreibbare States).
- **❓ Hosting:** eigener Port (einfach, unabhängig) **vs.** Erweiterung des `web`-Adapters (gemeinsamer Port/SSL/Auth). Vorschlag: eigener Server, optional Web-Extension später.

### Frontend
- **React + TypeScript + Vite**, PWA (Manifest, Service Worker, „Zum Startbildschirm hinzufügen“).
- UI-Basis: leichtgewichtig (eigene Komponenten + CSS-Variablen) statt schwerem Framework → schnelle Ladezeit auf Mobilgeräten.
- Hell/Dunkel automatisch (`prefers-color-scheme`), Akzentfarbe wählbar.
- i18n von Anfang an (de/en).

## 3. Automatische Erkennung (Kernstück)

Pipeline, läuft beim Start und bei Objektänderungen (debounced):

1. **Enums einlesen** – `enum.rooms.*` → Räume, `enum.functions.*` → Gewerke.
2. **Typ-Erkennung** – `@iobroker/type-detector` (wird auch von `material`, `iot` u. a. genutzt) erkennt aus Rollen/Typen: Licht, Dimmer, Farblicht (RGB/CT), Rollladen, Thermostat, Fenster/Tür, Bewegung, Temperatur/Feuchte, Steckdose/Schalter, Schloss, Media-Player, Wetter, Kamera, Info …
3. **Heuristiken als Fallback**
   - Geräte ohne Raum: Gruppierung nach Adapter/Gerät, Raumvorschlag aus dem Namen („Wohnzimmer Decke“ → Wohnzimmer).
   - Namen bereinigen (Raumname aus Gerätename entfernen, Adapter-Präfixe kürzen).
   - Bekannte Adapter-Strukturen (zigbee, hm-rpc, shelly, deconz, hue, …) als Profile.
   - Hilfs-States erkennen und zuordnen: `battery`, `available`/`UNREACH`, `link_quality`.
4. **Overrides anwenden** – Nutzerkorrekturen haben immer Vorrang und überleben Neu-Erkennungen (Zuordnung über stabile Objekt-ID).
5. **Änderungen melden** – neue Geräte erscheinen als „Neu gefunden“-Hinweis statt still im Layout.

Zusätzlich **generierte Sichten**:
- **Übersicht/Home:** Lichter an (n), offene Fenster, Raumtemperaturen, Anwesenheit, Warnungen.
- **Status:** leere Batterien, nicht erreichbare Geräte.
- **Nach Funktion:** alle Lichter, alle Rollläden, … (inkl. „alle aus/zu“).

## 4. Bedienkonzept (Mobile First)

**Smartphone**
- Bottom-Navigation: *Home · Räume · Favoriten · Mehr*
- Kacheln im 2-Spalten-Grid; Tap = Hauptaktion (an/aus, auf/zu), Long-Press bzw. Pfeil = **Bottom-Sheet** mit Details (Slider, Farbe, Verlauf).
- Große Touch-Ziele (≥ 44 px), Swipe zwischen Räumen, Pull-to-Refresh.

**Tablet / Desktop**
- Seitenleiste statt Bottom-Navigation, mehr Spalten, Details als Dialog/Seitenpanel.
- Optionaler **Kiosk-Modus** für Wandtablets (Vollbild, Bildschirm-Dimmen, kein Bearbeiten).

**Bearbeiten-Modus** (Stift-Symbol)
- Kacheln ziehen/sortieren, aus-/einblenden, umbenennen, Icon wählen, Gerätetyp korrigieren, in anderen Raum verschieben, als Favorit markieren.
- „Gerät manuell hinzufügen“: State auswählen → Typ wird vorgeschlagen.

## 5. Konfiguration

| Ort | Inhalt |
|---|---|
| **Admin (jsonConfig)** | Port, SSL, Authentifizierung, Sprache, welche Adapter/Bereiche ignoriert werden, Update-Intervall, Zurücksetzen der Erkennung. |
| **In der App** | Alles Visuelle: Layout, Namen, Icons, Favoriten, Theme. |
| **Speicherung** | Overrides als JSON im ioBroker-Dateispeicher (`smartvis.0/config.json`) → Teil des Backups. |

## 6. Sicherheit
- Optionaler Login mit ioBroker-Benutzern (inkl. Rechteprüfung), Token-basiert für PWA.
- **❓ Profile:** z. B. „Kinder“/„Gast“ mit eingeschränkten Räumen bzw. nur lesend.
- HTTPS über ioBroker-Zertifikate.

## 7. Roadmap

| Phase | Inhalt |
|---|---|
| **0 – Grundgerüst** | Adapter-Scaffold, Frontend-Build in Adapter-Paket, CI (Lint, Tests), Release-Script. |
| **1 – MVP** | Discovery (Enums + type-detector), WebSocket-API, Raumansicht, Widgets: Licht/Dimmer, Schalter, Rollladen, Thermostat, Fenster/Tür, Sensorwert. PWA installierbar. |
| **2 – Komfort** | Bearbeiten-Modus + Overrides, Favoriten, Home-Übersicht, Status-Sicht, Farblicht, Szenen. |
| **3 – Ausbau** | Verlaufsdiagramme (history/influxdb/sql), Media, Kamera, Schloss, Kiosk-Modus, Benutzerprofile, Push-Benachrichtigungen. |

## 8. Offene Fragen
1. Eigener Webserver oder `web`-Adapter-Extension?
2. React als Frontend-Framework ok (passt zum ioBroker-Ökosystem)?
3. Welche Geräte/Adapter sind bei dir im Einsatz (für die ersten Erkennungsprofile und Tests)?
4. Sind Räume/Funktionen in deinen Enums gepflegt – oder muss die Erkennung stark ohne Enums auskommen?
5. Mehrbenutzer/Rechte schon im MVP oder später?
6. Verlaufsdiagramme bereits im MVP?
