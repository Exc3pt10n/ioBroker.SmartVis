# ioBroker.SmartVis – Konzept (Entwurf v0.2)

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
- **Hosting (entschieden):** eigener HTTP-Server mit eigenem Port (Standard 8099), WebSocket unter `/ws`.

### Frontend
- **React + TypeScript + Vite** (entschieden), PWA (Manifest, Service Worker, „Zum Startbildschirm hinzufügen“).
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
- **Übersicht/Home:** ✅ Wetterkarte (lokale Station), Lichter an (n), offene Fenster, PV/Batterie, Wallbox, Warnungen.
- **Status:** leere Batterien, nicht erreichbare Geräte.
- **Nach Funktion:** alle Lichter, alle Rollläden, … (inkl. „alle aus/zu“).

## 3a. Zielinstallation (erste Erkennungsprofile)

Räume sind in **CCU und Hue-App gepflegt**, aber kaum in ioBroker-Enums. Raumquellen in dieser Reihenfolge: `enum.rooms` (CCU via `hm-rega`) → Hue-Räume → Gerätename. Gleichnamige Räume werden zusammengeführt.

| System | Adapter | Erkennung | Besonderheiten |
|---|---|---|---|
| Homematic | `hm-rpc` (+ `hm-rega`) | type-detector klappt gut (saubere Rollen) | Kanal 0 = Wartung (`UNREACH`, `LOW_BAT`) → wird dem Gerät als Indikator zugeordnet. Kanalnamen „Gerät:1“ → Gerätename. **Tipp:** Sind Räume/Gewerke in der CCU gepflegt, kann `hm-rega` sie als Enums synchronisieren – dann kommen die Räume gratis. |
| Philips Hue | `hue` | Lichter über `switch.light`/`level.dimmer` | ✅ `src/lib/profiles/hueRooms.ts`: Gruppen mit `common.role = "Room"` + `native.lights` → Raum der Lampen (`native.id`). Raumgruppe erscheint als „Alle Lichter“, Zonen sind kein Raum, Entertainment-Bereiche werden ausgeblendet. |
| Keba KeContact P30 | `kecontact` | type-detector liefert nur Zufallstreffer aus `automatic.*` | ✅ `src/lib/profiles/kecontact.ts` (gegen echten Objektbaum getestet): `p` (mW), `state`, `plug`, `ePres` (Wh), `statistics.lastChargeAmount`, Schalter `automatic.photovoltaics` + `automatic.pauseWallbox`. Instanz wird komplett vom Profil übernommen. Offen: Ladestrom-Vorgabe (kollidiert mit der PV-Automatik des Adapters). |
| QCells Q.HOME+ ESS HYB-G2 | [`qhome-ess-hyb-g2`](https://github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2) | Rollen überwiegend `value` → type-detector greift nicht | ✅ Profil `src/lib/profiles/qhome.ts`: feste State-IDs je Instanz. Flüsse aus den richtungsgetrennten States (`GridPwPurchaseWb`/`GridPwFeedInWb`, `BtPwCharge`/`BtPwDisCharge`, `PvPw`, `ConsPw`), SoC, Restlaufzeit, Tageszähler `counters.day.*`. |

**Erkenntnisse aus dem vollständigen Objektbaum (~8.800 Objekte):**
- `enum.rooms` ist doch gut gefüllt (CCU-Räume via `hm-rega` + englische IDs aus `iot`/Alexa, z. B. `enum.rooms.living_room` = „Wohnzimmer“) → Zusammenführen gleichnamiger Räume ist Pflicht.
- Viele Hue-„Räume“ sind eigentlich Lampen-Gruppen („Licht Küche“ mit einer Lampe) → werden auf bekannte Räume abgebildet, Gruppen mit nur einer Lampe nicht als eigene Kachel.
- Ohne Regeln erzeugte der type-detector 727 Kacheln (238 Tasten, Lampen 3-fach als rgb/hue/ct, Alexa-Wecker, HmIP-Wartungs- und virtuelle Kanäle); mit Regeln 146, davon 30 ohne Raum.
- **Wetter:** kein Wetter-Adapter, aber HmIP-SWO-PL im Garten + HmIP-STHO im Vorgarten + CCU-Tagesvariablen für Regen/Sonne. Keine Vorhersage vorhanden → optional später ein Vorhersage-Adapter (z. B. DWD/Bright Sky).

**Rollladen-Automatik (`shuttercontrol` 2.1.2):** ✅ `src/lib/profiles/shuttercontrol.ts`. 13 Rollläden in drei Bereichen (Wohnen/Schlafen/Kinder, jeweils „-auto“). Die Instanz-Konfiguration (`system.adapter.shuttercontrol.0` → `native.events`) verknüpft jeden Rollladen mit seinem HmIP-Level-State – darüber zeigt die Rollladen-Kachel den Automatik-Status und übernimmt den Namen. Automatik-Schalter und Urlaub sind auf `0_userdata.0.Rollladen.*` gespiegelt → Schreiben auf die Quelle. Eigener Tab „Beschattung“.

Daraus folgt eine neue generierte Sicht **„Energie“**: Energiefluss PV → Haus/Batterie/Netz/Auto, Tageswerte, Wallbox-Steuerung. Die Wallbox- und PV-Profile werden als konfigurierbare Zuordnungen umgesetzt (Profil schlägt States vor, Nutzer bestätigt/korrigiert), da sich State-Namen je nach Adapter/Firmware unterscheiden.

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
| **0 – Grundgerüst** ✅ | Adapter-Scaffold, Discovery (Enums + type-detector + Namens-Heuristik), WebSocket-API, PWA-Shell mit Home/Räume/Mehr, Kacheln mit Tap-Aktion, Demo-Server, CI (Lint, Typen, Unit-, Paket- und Integrationstest). |
| **1 – MVP** | Detail-Sheet je Typ (Dimmer-Slider, Rollladen auf/ab/Position, Thermostat-Sollwert), Hue-Raumprofil, Homematic-Feinschliff, **Energie-Sicht** (✅ QCells, ✅ Keba inkl. Auto im Energiefluss), Authentifizierung. |
| **2 – Komfort** | Bearbeiten-Modus + Overrides, Favoriten, Home-Übersicht, Status-Sicht, Farblicht, Szenen. |
| **3 – Ausbau** | Verlaufsdiagramme (history/influxdb/sql), Media, Kamera, Schloss, Kiosk-Modus, Benutzerprofile, Push-Benachrichtigungen. |

## 8. Offene Fragen
1. ~~QCells-Adapter~~ → `qhome-ess-hyb-g2` (erledigt).
2. ~~Räume in CCU/Hue?~~ → ja (erledigt). Prüfen: synchronisiert `hm-rega` die CCU-Räume nach `enum.rooms`?
3. Objekt-Export von `hm-rpc` und `hue` als Testdaten (kecontact ✅).
4. Mehrbenutzer/Rechte schon im MVP oder später?
5. Verlaufsdiagramme bereits im MVP?
