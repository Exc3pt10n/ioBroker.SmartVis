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

### Release

Releases entstehen automatisch über den zentralen Workflow aus
[Exc3pt10n/ioBroker-workflows](https://github.com/Exc3pt10n/ioBroker-workflows) (eingebunden in
`.github/workflows/test.yml` über `@v1`). Nach einem Merge auf `main` laufen alle Checks; nur wenn sie grün
sind und die Version aus `package.json` noch keinen Tag hat, legt der Release-Job an:

- den annotierten Tag `vX.Y.Z`,
- ein GitHub-Release mit den Notes aus dem Changelog-Abschnitt der README und dem fertig gebauten
  `iobroker.smartvis-X.Y.Z.tgz` als Asset,
- den Branch `release`, der auf den neuen Tag vorgespult wird.

Tags, Releases und den Branch `release` also nie selbst anlegen oder pushen – insbesondere nicht bei einem
Versionssprung auf einem Feature-Branch. Ist lokal versehentlich ein Tag entstanden, ihn mit
`git tag -d vX.Y.Z` wieder löschen. Ein Merge ohne Versionssprung (z. B. nur Werkzeuge) erzeugt kein Release.

Der `release-guard` im Workflow prüft die Regeln oben maschinell: Ändert ein Pull Request ausgelieferte Dateien
(`files`/`main` aus `package.json`, `io-package.json`, `src/`, `src-www/`) oder Laufzeit-Abhängigkeiten
(auch nur im Lockfile, z. B. durch `npm audit fix`), muss die Version erhöht und vollständig eingetragen sein.

## Installation aus GitHub

Der Adapter wird nicht auf npm veröffentlicht. Installiert wird aus GitHub:

- stabil: `https://github.com/Exc3pt10n/ioBroker.smartvis/tarball/release` (nur freigegebene Releases),
- fertig gebaut: das `.tgz` am jeweiligen GitHub-Release (kein Build beim Nutzer),
- Entwicklungsstand: `https://github.com/Exc3pt10n/ioBroker.smartvis/tarball/main`.

Bei der Installation aus GitHub baut npm den Adapter über das Skript `prepare` selbst (Backend und Frontend).
Deshalb darf `common.nogit` in `io-package.json` **nicht** gesetzt werden (der `release-guard` prüft das), alles,
was der Build braucht, muss in `devDependencies` stehen, und `@iobroker/testing` bleibt bei 5.x (6.x lehnt
`prepare` ab).

## Automatische Tests (GitHub Actions)

`.github/workflows/test.yml` ruft den zentralen Workflow auf. Er läuft für Pull Requests, Pushes auf `main`
und wöchentlich:

- Pull Requests und `main`: Lint, Typprüfung, Build, Unit- und Paket-Tests auf Node 22 und 24,
  Integrationstest, Installationstest (Installation aus Git mit `prepare`-Build wie bei `iobroker url`),
  `npm audit` der Laufzeit-Abhängigkeiten und bei Pull Requests der `release-guard`
- wöchentlich: volle Matrix Linux und Windows, Node 22, 24 und 26

Pflicht-Check im Branch-Schutz von `main` ist `adapter / ci-result`. Der Branch `release` darf nicht
geschützt werden, sonst kann der Release-Job ihn nicht vorspulen.

Änderungen an den Checks oder am Release gehören in das zentrale Repo, nicht in diesen Adapter. Wird die
Node-Mindestversion geändert: `engines` in `package.json`/`package-lock.json`, README (Voraussetzungen) und
ggf. den Parameter `node-versions` in `test.yml` gemeinsam anpassen.

## Prüfen vor dem Push

```bash
npm run lint && npm run check && npm test && npm run build
```

Den `release-guard` lokal ausführen (mit einem Klon von ioBroker-workflows daneben):

```bash
node ../ioBroker-workflows/scripts/check-release.mjs pr --base origin/main
```

Bei Änderungen an `src/main.ts`, an der Erkennung oder am Webserver zusätzlich:

```bash
npm run test:integration
```
