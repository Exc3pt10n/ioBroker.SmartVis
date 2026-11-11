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

Anzupassen sind jeweils:

- `package.json` und `package-lock.json` (Feld `version`, im Lockfile oben und unter `packages[""]`)
- `io-package.json`: `common.version` und ein neuer Eintrag ganz oben in `common.news`
  (alle Sprachen: en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn; höchstens 20 Einträge behalten)
- `README.md`: Abschnitt `### <version> (<datum>)` oben im Changelog, Einträge im Stil `- (Exc3pt10n) …`

Wird ein Pull Request erweitert, bevor er gemergt ist, bleibt es bei dieser einen Erhöhung
(ggf. von Patch auf Minor anheben). Nach einem Merge beginnt die nächste Änderung mit einer neuen Erhöhung.

## Prüfen vor dem Push

```bash
npm run lint && npm run check && npm test && npm run build
```
