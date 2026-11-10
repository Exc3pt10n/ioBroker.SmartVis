![Logo](admin/smartvis.svg)

# ioBroker.SmartVis

Selbstkonfigurierende, **mobile-first** Visualisierung für ioBroker.
SmartVis erkennt Geräte und Räume automatisch und zeigt sie ohne manuelles Anlegen von Widgets als installierbare Web-App (PWA) an – auf dem Smartphone wie im Browser.

> ⚠️ Frühe Entwicklungsphase. Das Konzept steht in [docs/KONZEPT.md](docs/KONZEPT.md).

## Funktionen (aktueller Stand)

- Automatische Geräteerkennung über [`@iobroker/type-detector`](https://github.com/ioBroker/ioBroker.type-detector)
- Räume aus `enum.rooms` **oder** – wenn nicht gepflegt – aus Geräte­namen („Wohnzimmer Deckenlicht“ → Raum *Wohnzimmer*, Gerät *Deckenlicht*)
- Eigener Webserver mit WebSocket-API; die App erhält nur erkannte States, Schreibzugriffe nur auf freigegebene States
- Neu-Erkennung bei Objektänderungen
- Responsive Oberfläche: Bottom-Navigation auf dem Handy, Seitenleiste ab Tablet, Hell/Dunkel automatisch

## Konfiguration

| Einstellung | Standard | Beschreibung |
|---|---|---|
| IP-Adresse | `0.0.0.0` | Netzwerk-Interface des Webservers |
| Port | `8099` | Aufruf: `http://<iobroker>:8099` |
| Sprache | `de` | Sprache für mehrsprachige Objektnamen |
| Neu-Erkennung | `10` s | Wartezeit nach Objektänderungen |
| Ignorierte Adapter | `system,admin,…` | Werden bei der Erkennung übersprungen |

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

## License

MIT License

Copyright (c) 2026 Exc3pt10n
