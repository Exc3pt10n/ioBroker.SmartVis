![Logo](admin/smartvis.svg)

# ioBroker.smartvis

[![Test](https://github.com/Exc3pt10n/ioBroker.SmartVis/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Exc3pt10n/ioBroker.SmartVis/actions/workflows/test.yml)

Selbstkonfigurierende, **mobile-first** Visualisierung für ioBroker.
SmartVis erkennt Geräte und Räume automatisch und zeigt sie ohne manuelles Anlegen von Widgets als installierbare Web-App (PWA) an – auf dem Smartphone wie im Browser.

> **Status:** Version 0.x – im täglichen Einsatz und vollständig nutzbar. Bis Version 1.0 können sich Einstellungen und das Speicherformat noch ändern; solche Änderungen sind im [Changelog](#changelog) als **Breaking** markiert und werden, wo möglich, automatisch übernommen.
> Die Erkennung ist bisher vor allem an einer Installation mit Homematic (IP), Philips Hue, QCells Q.HOME, KEBA, Toshiba-Klimageräten und Echo abgestimmt. Bei anderen Systemen können Geräte fehlen oder überzählig sein – sie lassen sich im Bearbeiten-Modus ausblenden; Rückmeldungen und Objektbäume (anonymisiert) als Issue helfen, die Erkennung zu verbessern.
> Hintergrund und Konzept: [docs/KONZEPT.md](docs/KONZEPT.md).

## Funktionen

- Automatische Geräteerkennung über [`@iobroker/type-detector`](https://github.com/ioBroker/ioBroker.type-detector)
- Räume aus mehreren Quellen, gleichnamige Räume werden zusammengeführt:
  1. `enum.rooms` – z. B. die Räume der Homematic-CCU, wenn `hm-rega` sie synchronisiert
  2. Hue-Räume aus dem `hue`-Adapter (Zonen werden bewusst nicht als Raum verwendet)
  3. Gerätenamen („Wohnzimmer Deckenlicht“ → Raum *Wohnzimmer*, Gerät *Deckenlicht*)
- **Bearbeiten-Modus** (✎ in Startseite, Raumliste und Räumen):
  - Geräte umbenennen, in einen anderen oder neuen Raum verschieben, ausblenden, als Favorit markieren; alles einzeln zurücksetzbar
  - Kacheln (Favoriten, Geräte im Raum) und Räume per Ziehen am Griff ⠿ anordnen – mit Maus und Finger; alternativ mit ← →
  - Alle Ansichten anpassbar: Bereiche bzw. Karten auf Startseite, Energie, Beschattung, Raumansicht (gilt für alle Räume) und „Mehr“ per Ziehen oder ↑ ↓ anordnen und aus-/einblenden; je Ansicht zurücksetzbar
  - Räume umbenennen, ausblenden, sortieren, selbst anlegen und wieder löschen
  - Favoriten oben auf der Startseite (auch per ☆ in der Detailansicht)
  - **Je Endgerät:** Jedes Handy, Tablet bzw. jeder Browser hat eigene Anpassungen (erkannt an einer im Browser gespeicherten Kennung). Neue Geräte starten mit den gemeinsamen Anpassungen aus der Zeit vor 0.2.0
  - Unter **Mehr → Anpassungen**: Gerät umbenennen, Anpassungen eines anderen Geräts übernehmen, **dieses Gerät** oder **alle Geräte** auf den Ausgangszustand (automatische Erkennung) zurücksetzen, alte Geräte entfernen
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
  - [ioBroker.qhome-ess-hyb-g2](https://github.com/Exc3pt10n/ioBroker.qhome-ess-hyb-g2) (QCells Q.HOME+ ESS HYB-G2) – inkl. zusätzlicher PV-Erzeuger (`PvPwTotal`/`PvPwExt`) und aller Energiezähler (Tag, Monat, Quartal, Halbjahr, Jahr jeweils mit Vorperiode, Gesamt)
  - `toshiba-ac` (Toshiba-Klimageräte): je Gerät eine Kachel „Klimaanlage“ im passenden Raum; Detailansicht mit Ein/Aus, Betriebsart, Solltemperatur (in ganzen Grad), Lüfterstufe und Lamellen, weitere Einstellungen (Sonderfunktion, Kaminmodus, Leistungsbegrenzung) als Auswahlfelder
  - `kecontact` (KEBA KeContact P20/P30): Status, Ladeleistung, PV-Überschuss, aktuelles Ladelimit (A und ≈ kW), PV-Überschussladen und Pause schaltbar, dazu die Einstellungen der Ladeautomatik (Phasen 1/3, zusätzlicher/maximaler Netzbezug, Ladestrom-Begrenzung, Batteriespeicher-Strategie und -Schwelle, Ziel-Ladung). Bei der Deutschland-Edition (ohne Energiezähler) wird die Ladeleistung wie im kecontact-Adapter aus Ladestrom × 230 V × Phasen geschätzt (Anzeige mit „≈“)
  - Ist eine Wallbox vorhanden, wird ihre Leistung aus dem Hausverbrauch des Speichers herausgerechnet (der Speicher misst am Netzanschluss)
- Neu-Erkennung bei Objektänderungen
- **Verläufe** aus `sql`, `history` oder `influxdb`: automatisch für alle aufgezeichneten Werte (Einstellung „Aufzeichnung aktiviert“ am Datenpunkt) – in der Detailansicht der Geräte, im Wetter-Verlauf (Link in der Wetterkarte) und in der Energie-Sicht; Zeiträume 6 Std./24 Std./7 Tage als Mittelwerte, mit Min./Ø/Max., Tooltip und Tabelle. Für die Q.HOME werden auch die aufgezeichneten kW-Varianten (`GridPwPurchase`, `GridPwFeedIn`) erkannt
- **Hue-Szenen**: die Szenen der Hue-Räume und -Zonen lassen sich in der Detailansicht jeder Hue-Lampe und in der Raumansicht (unter „Licht“) auslösen; interne Bridge-Szenen und doppelte Gruppen werden ausgeblendet
- Der Hinweis „Geräte ohne Raum“ auf der Startseite lässt sich mit ✕ ausblenden (gilt für alle Geräte); im Bearbeiten-Modus wieder einblenden
- Startseite zeigt unter „Läuft gerade“ alle Medien-Player (z. B. Echos), die gerade abspielen
- Auf dem Desktop nutzt die Oberfläche die gesamte Fensterbreite: Die Startseite wird ab 1200 px zum Dashboard mit Spalten (Wetter · Favoriten und Status · Energiefluss und PV-Prognose), darüber Kennzahl-Kacheln (PV, Batterie, Verbrauch, Prognose, Lichter, offene Fenster …); auf dem Handy stehen die Kennzahlen als kompaktes Raster (alle gleichzeitig sichtbar)
- Wetterkarte mit 24-Stunden-Temperaturkurve (wenn aufgezeichnet), Helligkeit als Balken je Himmelsrichtung und weiteren Außensensoren als eigene Zeilen; passt sich der verfügbaren Breite an
- „Mehr“ zeigt den Zustand von ioBroker: je Host Prozessor, Arbeitsspeicher, Festplatte (mit Warnschwelle), Laufzeit, js-controller- und Node.js-Version; dazu alle Adapter-Instanzen mit Status (läuft, läuft nicht, keine Verbindung, geplant, deaktiviert) – Probleme stehen oben
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

Voraussetzungen: js-controller ≥ 6.0.11, Admin ≥ 7.0.23, Node.js ≥ 22.

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
npm run test:integration   # Adapter in einer echten js-controller-Testinstanz
npm run lint && npm run check
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
  lib/profiles    Adapter-Profile für Systeme ohne Standard-Rollen (PV, Wallbox, Wetter, Klima, Szenen …)
  lib/overrides   Anpassungen aus dem Bearbeiten-Modus; lib/clientOverrides: je Endgerät
  lib/history     Verläufe aus sql/history/influxdb
  lib/system      Zustand von ioBroker (Hosts, Instanzen)
  lib/server      HTTP + WebSocket
  shared/         Protokoll-Typen und Zeitreihen-Hilfen (von Backend und Frontend genutzt)
src-www/        Frontend (React + Vite) → baut nach www/
admin/          jsonConfig für die Admin-Oberfläche
scripts/demo.ts Demo-Server ohne ioBroker
```

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.3.1 (2026-11-12)

- (Exc3pt10n) Startseite: Schaltfläche „💡 Alle aus“ neben jedem Raum unter „Eingeschaltete Lichter“
- (Exc3pt10n) Zurück aus einem Raum führt dorthin, woher man kam (Raumliste oder Startseite), und an dieselbe Scroll-Position statt ganz nach oben; Räume öffnen immer oben
- (Exc3pt10n) Licht-Szenen im Raum sind ausklappbar und standardmäßig eingeklappt (bleiben während der Sitzung offen, wenn man sie aufgeklappt hat)

### 0.3.0 (2026-11-12)

- (Exc3pt10n) Raumübersicht überarbeitet: Live-Status je Raum – Temperatur und Luftfeuchte sowie Kennzeichen für eingeschaltete Lichter, offene Fenster/Türen, Heizen/Kühlen, laufende Musik, (teilweise) geschlossene Rollläden und Probleme
- (Exc3pt10n) Raumsymbole: automatisch aus dem Raumnamen, im Bearbeiten-Modus frei wählbar (wird mit den Anpassungen gespeichert)
- (Exc3pt10n) Räume mit eingeschaltetem Licht sind hervorgehoben, Räume mit offenem Fenster oder Problem rot umrandet; auf dem iPhone zwei Spalten
- (Exc3pt10n) Schnellaktion „💡 aus“ auf der Raumkarte schaltet alle Lichter des Raums aus
- (Exc3pt10n) Lichter richtig gezählt: Hue-Raumgruppen („Alle Lichter“) und Zonen zählen auf der Startseite (Kennzahl, „Eingeschaltete Lichter“) und in der Raumliste nicht mehr zusätzlich zu ihren Lampen; die Gruppen-Kachel im Raum bleibt zum Schalten erhalten
- (Exc3pt10n) Einzelne Hue-Lampen, die wie ihr Raum heißen, heißen jetzt „Licht“ statt fälschlich „Alle Lichter“
- (Exc3pt10n) Diagramme auf dem iPhone/Touch (Verläufe, PV-Prognose, Temperaturkurve, Energiefluss): langes Drücken markiert bzw. kopiert nichts mehr; in Verläufen und PV-Prognose seitlich wischen zum Ablesen, der Wert bleibt nach dem Loslassen stehen
- (Exc3pt10n) Verläufe: Ablesen genau an der Zeiger-/Fingerposition – Uhrzeit dort und der Wert, der dann galt (bisher sprang der Punkt in Aufzeichnungslücken zum nächsten Messwert)

### 0.2.3 (2026-11-12)

- (Exc3pt10n) **Breaking:** Mindestversion Node.js 22 (Node.js 20 wird seit April 2026 nicht mehr unterstützt)
- (Exc3pt10n) Automatische Tests (GitHub Actions) verschlankt: keine Doppelläufe mehr, Node.js 22 und 24, Integrationstest einmal

### 0.2.2 (2026-11-12)

- (Exc3pt10n) Verläufe: Lücken ohne gespeicherte Werte (Aufzeichnung „nur Änderungen“, z. B. PV nachts) halten den letzten Wert bis zur nächsten Änderung bzw. bis jetzt, statt zwei weit auseinanderliegende Punkte schräg zu verbinden
- (Exc3pt10n) Verläufe: Mittelwert (Ø) zeitgewichtet – jeder Wert zählt so lange, bis der nächste kommt (bisher je Messpunkt, dadurch z. B. bei PV deutlich zu hoch)
- (Exc3pt10n) Verläufe: Die Zeitachse zeigt immer den vollen Zeitraum (6 Std./24 Std./7 Tage bis jetzt); liegen erst wenige Stunden Daten vor, werden sie nicht mehr über die ganze Breite gestreckt

### 0.2.1 (2026-11-11)

- (Exc3pt10n) Q.HOME mit zusätzlichen PV-Erzeugern (qhome-ess-hyb-g2 ab 0.3.0, z. B. zweiter Wechselrichter): PV-Leistung, Energiefluss, Kennzahl „PV jetzt“ und PV-Verlauf nutzen die Gesamtleistung `PvPwTotal`; der Energiefluss zeigt die Aufteilung (Q.HOME / weitere Erzeuger)

### 0.2.0 (2026-11-11)

- (Exc3pt10n) Anpassungen je Endgerät: Namen, Räume, Favoriten, ausgeblendete Geräte und die Anordnung gelten jetzt je Handy/Tablet/Browser
- (Exc3pt10n) Mehr → Anpassungen: Gerät umbenennen, Anpassungen eines anderen Geräts übernehmen, dieses Gerät oder alle Geräte auf den Ausgangszustand zurücksetzen, alte Geräte entfernen
- (Exc3pt10n) **Breaking:** neues Format von `overrides.json` (Version 2). Bestehende Anpassungen werden beim Start automatisch übernommen und gelten als Ausgangsbasis für jedes Gerät; eine Rückkehr zu 0.1.x verliert die Anpassungen, die danach gemacht wurden

### 0.1.1 (2026-11-11)

- (Exc3pt10n) Neue Einstellung „Animationen“ unter Mehr → Darstellung (Wie im System / Immer an / Aus, je Gerät): Wünscht das Betriebssystem reduzierte Bewegung (z. B. Windows: Animationseffekte aus), standen Animationen wie der Energiefluss bisher still – mit „Immer an“ laufen sie trotzdem

### 0.1.0 (2026-11-11)

- (Exc3pt10n) Erkennung: type-detector mit adapterspezifischen Regeln (Homematic, Hue, Alexa), Räume aus Enums, Hue und Gerätenamen; gegen einen echten Objektbaum abgestimmt (727 → 146 Kacheln)
- (Exc3pt10n) Eigener Webserver mit PWA (mobile first, Desktop mit Seitenleiste und Spalten), Live-Werte per WebSocket
- (Exc3pt10n) Detailansichten: Licht, Rollladen, Thermostat, Klima, Medien-Player; Wertelisten als Auswahlfelder
- (Exc3pt10n) Profile: QCells Q.HOME (inkl. aller Energiezähler), KEBA KeContact (inkl. Ladeautomatik), pvforecast, shuttercontrol, Homematic-Wetterstation und Lichtsensoren, Hue-Szenen, Toshiba-Klimageräte (toshiba-ac)
- (Exc3pt10n) Verläufe aus sql, history und influxdb
- (Exc3pt10n) Startseite als Dashboard mit Kennzahlen, Wetter, Favoriten, laufenden Medien und Statuslisten (eingeschaltete Lichter und Klimageräte, offene Fenster, Störungen)
- (Exc3pt10n) Bearbeiten-Modus: Geräte und Räume umbenennen, verschieben, ausblenden, Favoriten; Kacheln, Räume und alle Bereiche per Ziehen anordnen
- (Exc3pt10n) „Mehr“: Zustand von ioBroker (Host-Auslastung, Instanzen)

### 0.0.1

- (Exc3pt10n) Erstveröffentlichung

## License

MIT License

Copyright (c) 2026 Exc3pt10n
