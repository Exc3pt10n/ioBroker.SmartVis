# Hinweise für die Weiterentwicklung

## Versionierung

Jede Änderung, die gemergt werden soll, zieht die Adapter-Version **einmal pro Pull Request** hoch
(Semantic Versioning, solange < 1.0):

| Änderung | Version |
|---|---|
| Neue Funktion, neuer unterstützter Adapter | Minor: 0.1.0 → 0.2.0 |
| Fehlerbehebung, Layout-Korrektur, kleine Verbesserung | Patch: 0.2.0 → 0.2.1 |
| Inkompatible Änderung (Einstellungen, gespeicherte Anpassungen) | Minor, im Changelog als **Breaking** markiert |

Bei mehreren Änderungen in einem Pull Request gilt die höchste Stufe.

Ausnahme: Reine Änderungen an Entwicklungswerkzeugen ohne Auswirkung auf Nutzer (CI-Workflows,
Tests, Demo, Lint-Konfiguration, `CLAUDE.md`) brauchen keine neue Version.

Anzupassen sind jeweils:

- `package.json` und `package-lock.json` (Feld `version`, im Lockfile oben und unter `packages[""]`)
- `io-package.json`: `common.version` und ein neuer Eintrag ganz oben in `common.news`
  (alle Sprachen: en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn; höchstens 20 Einträge behalten)
- `README.md`: Abschnitt `### <version> (<datum>)` oben im Changelog, Einträge im Stil `- (Exc3pt10n) …`

Wird ein Pull Request erweitert, bevor er gemergt ist, bleibt es bei dieser einen Erhöhung
(ggf. von Patch auf Minor anheben). Nach einem Merge beginnt die nächste Änderung mit einer neuen Erhöhung.

## Automatische Tests (GitHub Actions)

`.github/workflows/test.yml` läuft für Pull Requests und Pushes auf `main` (nicht für jeden Branch-Push,
sonst doppelt): Lint, Typprüfung, Build und Tests auf den unterstützten Node-Versionen (22, 24),
der Integrationstest einmal auf Node 22. Ältere Läufe desselben Branches werden abgebrochen.
Wird die Node-Mindestversion geändert: `engines` in `package.json`/`package-lock.json`, README
(Voraussetzungen) und die Matrix im Workflow gemeinsam anpassen.

## Prüfen vor dem Push

```bash
npm run lint && npm run check && npm test && npm run build
```
