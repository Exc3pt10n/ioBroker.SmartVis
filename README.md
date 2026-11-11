![Logo](admin/smartvis.svg)

# ioBroker.smartvis

Selbstkonfigurierende, **mobile-first** Visualisierung für ioBroker.
SmartVis erkennt Geräte und Räume automatisch und zeigt sie ohne manuelles Anlegen von Widgets als installierbare Web-App (PWA) an – auf dem Smartphone wie im Browser.

> ⚠️ Frühe Entwicklungsphase. Das Konzept steht in [docs/KONZEPT.md](docs/KONZEPT.md).

## Funktionen (aktueller Stand)

- Automatische Geräteerkennung über [`@iobroker/type-detector`](https://github.com/ioBroker/ioBroker.type-detector)
- Räume aus mehreren Quellen, gleichnamige Räume werden zusammengeführt:
  1. `enum.rooms` – z. B. die Räume der Homematic-CCU, wenn `hm-rega` sie synchronisiert
  2. Hue-Räume aus dem `hue`-Adapter (Zonen werden bewusst nicht als Raum verwendet)
  3. Gerätenamen („Wohnzimmer Deckenlicht“ → Raum *Wohnzimmer*, Gerät *Deckenlicht*)
- **Bearbeiten-Modus** (✎ in Startseite, Raumliste und Räumen):
  - Geräte umbenennen, in einen anderen oder neuen Raum verschieben, ausblenden, als Favorit markieren, mit ← → sortieren; alles einzeln zurücksetzbar
  - Räume umbenennen, ausblenden, sortieren, selbst anlegen und wieder löschen
  - Favoriten oben auf der Startseite (auch per ☆ in der Detailansicht)
  - Gespeichert im ioBroker-Dateispeicher (`smartvis.0/overrides.json`, Teil von Backups); Anpassungen hängen an stabilen Objekt-IDs und überleben Neu-Erkennungen
  - Im Admin abschaltbar („Bearbeiten-Modus erlauben“) – solange es keinen Login gibt, kann sonst jeder im Netz Anpassungen speichern
- **Detailansicht** je Gerät (Bottom-Sheet auf dem Handy, Dialog am Desktop; öffnet per ⋯-Knopf, langem Drücken oder Tap auf Geräte ohne Schaltfunktion; Zurück-Taste schließt):
  - Licht: Ein/Aus, Helligkeit, Farbtemperatur (Mired oder Kelvin), Farbe
  - Rollladen: Position, Auf/Stopp/Zu, Automatik aus shuttercontrol
  - Thermostat: Ist-/Solltemperatur, ± in 0,5-°C-Schritten, Slider, Boost
  - Alle übrigen Werte des Geräts; Slider senden erst beim Loslassen
- **PV-Prognose** aus `pvforecast`: heute/morgen erwartet, Rest des Tages, je Anlage (z. B. Ost/West), Abgleich mit der tatsächlichen Erzeugung, Tagesverlauf als Diagramm mit Istwert, Tooltip und Tabellenansicht
- **Wetter auf der Startseite** aus der lokalen Wetterstation (HmIP-SWO-PL/-PR/-B, HM-WDS100; Fallback Außensensor HmIP-STHO), dazu die Helligkeit der HmIP-SLO-Lichtsensoren je Himmelsrichtung: Temperatur, Wetterlage, Luftfeuchte, Wind, Regen und Sonnenscheindauer heute. Die Tageswerte stammen aus den Systemvariablen, die die CCU automatisch anlegt (`svHmIPRainCounterToday_…`, `svHmIPSunshineCounterToday_…`).
- **Beschattung** über [shuttercontrol](https://github.com/simatec/ioBroker.shuttercontrol):
  - Alle öffnen/schließen, Sonnenschutz, alle auf Automatik; Urlaub und Schulfrei schaltbar
  - Je Bereich (Wohnen, Schlafen, Kinder): Automatik ein/aus, öffnen/schließen/Sonnenschutz, nächste Fahrzeiten
  - Je Rollladen: Position, Automatik-Status, Automatik Auf/Ab/Sonne einzeln schaltbar, ▲/▼
  - Sonnenauf-/-untergang und Sonnenstand
  - Verknüpfung mit den Rollladen-Kacheln über die Instanz-Konfiguration: Status an der Kachel, Namen und fehlende Räume aus shuttercontrol
  - Sind Trigger-Datenpunkte konfiguriert (z. B. `triggerAutoLiving`, `HolidayDP`), schreibt SmartVis auf diese – shuttercontrol würde direkte Änderungen sonst wieder überschreiben
- Adapterspezifische Regeln gegen Kachel-Rauschen: Homematic IP nur den ersten virtuellen Kanal je Ausgang (keine Wartungs-, Tasten-, Wochenprofil- oder Schwellwert-Kanäle), Hue ohne Sensoren, Smart Scenes, Entertainment-Bereiche und Altlasten der alten Objektstruktur, Alexa nur Player
- Eigener Webserver mit WebSocket-API; die App erhält nur erkannte States, Schreibzugriffe nur auf freigegebene States
- **Energie-Sicht** mit Energiefluss (PV, Haus, Batterie, Netz, Auto) und Tageswerten über Adapter-Profile:
  - [ioBroker.qhome-ess-hyb-g2](https://github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2) (QCells Q.HOME+ ESS HYB-G2)
  - `kecontact` (KEBA KeContact P20/P30): Status, Ladeleistung, PV-Überschuss, aktuelles Ladelimit (A und ≈ kW), PV-Überschussladen und Pause schaltbar, dazu die Einstellungen der Ladeautomatik (Phasen 1/3, zusätzlicher/maximaler Netzbezug, Ladestrom-Begrenzung, Batteriespeicher-Strategie und -Schwelle, Ziel-Ladung). Bei der Deutschland-Edition (ohne Energiezähler) wird die Ladeleistung wie im kecontact-Adapter aus Ladestrom × 230 V × Phasen geschätzt (Anzeige mit „≈“)
  - Ist eine Wallbox vorhanden, wird ihre Leistung aus dem Hausverbrauch des Speichers herausgerechnet (der Speicher misst am Netzanschluss)
- Neu-Erkennung bei Objektänderungen
- **Verläufe** aus `sql`, `history` oder `influxdb`: automatisch für alle aufgezeichneten Werte (Einstellung „Aufzeichnung aktiviert“ am Datenpunkt) – in der Detailansicht der Geräte, im Wetter-Verlauf (Link in der Wetterkarte) und in der Energie-Sicht; Zeiträume 6 Std./24 Std./7 Tage als Mittelwerte, mit Min./Ø/Max., Tooltip und Tabelle. Für die Q.HOME werden auch die aufgezeichneten kW-Varianten (`PvPwTotal`, `GridPwPurchase`, `GridPwFeedIn`) erkannt
- Raumansicht nach Gerätegruppen (Licht, Beschattung, Heizung & Klima, Fenster & Türen, Steckdosen & Schalter, Medien, Sensoren); eingeschaltete Lichter auf der Startseite nach Raum
- Responsive Oberfläche: Bottom-Navigation auf dem Handy, Seitenleiste ab Tablet, Hell/Dunkel automatisch

## Installation

SmartVis ist (noch) nicht auf npm veröffentlicht und wird direkt aus GitHub installiert.

**Admin-Oberfläche:** Reiter *Adapter* → GitHub-Symbol („Installieren aus eigener URL“; ggf. Expertenmodus aktivieren) → Reiter *Beliebig* → URL eintragen, installieren, danach eine Instanz anlegen:

```
https://github.com/Exc3pt10n/ioBroker.smartvis/tarball/main
```

**Konsole** auf dem ioBroker-Host:

```bash
iobroker url https://github.com/Exc3pt10n/ioBroker.smartvis/tarball/main
iobroker add smartvis
```

> Hinweis: ioBroker leitet den Adapternamen aus dem Repository-Namen ab und unterscheidet dabei Groß-/Kleinschreibung. Der Name muss daher `ioBroker.smartvis` lauten (klein). Bei abweichender Schreibweise den Namen explizit angeben: `iobroker url <URL> smartvis`.

Statt `main` lässt sich jeder Branch oder Commit angeben, z. B. zum Testen eines Entwicklungsstands. Updates werden genauso installiert; Instanz, Einstellungen und Anpassungen bleiben erhalten.

> Bei der Installation von GitHub baut npm den Adapter selbst (Skript `prepare`): Dafür werden einmalig die Entwicklungswerkzeuge (TypeScript, Vite, React …) heruntergeladen. Das dauert auf einem Raspberry Pi einige Minuten und braucht vorübergehend etwa 300 MB Platz.

Voraussetzungen: js-controller ≥ 6.0.11, Admin ≥ 7.0.23, Node.js ≥ 20.

## Konfiguration

| Einstellung | Standard | Beschreibung |
|---|---|---|
| IP-Adresse | `0.0.0.0` | Netzwerk-Interface des Webservers |
| Port | `8099` | Aufruf: `http://<iobroker>:8099` |
| Sprache | `de` | Sprache für mehrsprachige Objektnamen |
| Neu-Erkennung | `10` s | Wartezeit nach Objektänderungen |
| Ignorierte Adapter | `system,admin,…,iot` | Werden bei der Erkennung übersprungen |
| Bearbeiten-Modus erlauben | an | Anpassungen aus der App speichern |

## Entwicklung

```bash
npm install
npm run build        # Backend (build/) + Frontend (www/)
npm test             # Unit- und Paket-Tests
npm run lint
```

**Frontend ohne ioBroker entwickeln:**

```bash
npm run build:www && npm run demo   # Demo-Server mit Beispielgeräten auf :8099
npm run dev:www                     # Vite mit Hot-Reload, leitet /ws auf :8099 weiter
```

**Projektstruktur**

```
src/            Adapter (TypeScript)
  main.ts         Lebenszyklus, Abos, Schreibzugriffe
  lib/discovery   Geräte-/Raumerkennung (reine Funktion, testbar)
  lib/rooms       Raumnamen-Heuristik
  lib/profiles    Adapter-Profile für Systeme ohne Standard-Rollen (PV, Speicher, Wallbox)
  lib/server      HTTP + WebSocket
  shared/         Protokoll-Typen (von Backend und Frontend genutzt)
src-www/        Frontend (React + Vite) → baut nach www/
admin/          jsonConfig für die Admin-Oberfläche
scripts/demo.ts Demo-Server ohne ioBroker
```

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (Exc3pt10n) Grundgerüst: Erkennung, Webserver, PWA-Oberfläche
- (Exc3pt10n) Energie-Sicht mit Profil für QCells Q.HOME+ ESS HYB-G2
- (Exc3pt10n) KEBA-Wallbox-Profil, Hue-Räume als Raumquelle, Zusammenführen gleichnamiger Räume
- (Exc3pt10n) Bearbeiten-Modus: umbenennen, verschieben, ausblenden, Favoriten, Reihenfolge, eigene Räume
- (Exc3pt10n) Detailansicht mit Slidern für Licht, Rollladen und Thermostat
- (Exc3pt10n) PV-Prognose aus pvforecast in der Energie-Sicht
- (Exc3pt10n) Beschattung mit shuttercontrol: Steuerung, Automatik je Bereich und Rollladen, Status an den Rollladen-Kacheln
- (Exc3pt10n) Wetter auf der Startseite (Homematic-Wetterstation + CCU-Tageswerte); Erkennung gegen einen echten Objektbaum mit ~8.800 Objekten abgestimmt (727 → 146 Kacheln)

## License

MIT License

Copyright (c) 2026 Exc3pt10n
