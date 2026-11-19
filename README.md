# Filius Web

Netzwerksimulation für den Unterricht – installationsfrei im Browser.
Lernende bauen Netze aus Rechnern, Switches und Routern, vergeben Adressen und schauen später
im Simulationsmodus Schicht für Schicht zu, was auf den Kabeln passiert. Erweitert um
**VLANs** und **Rechenzentrums-Szenarien**.

Fachliches Vorbild ist [Filius](https://www.lernsoftware-filius.de/) der Universität Siegen
(GPLv2/GPLv3). Filius Web ist eine **eigenständige Neuentwicklung**; es wurde kein Code übernommen.
Die Analyse des Originals steht in [`docs/ANALYSE.md`](docs/ANALYSE.md).

## Stand

Phase 2 von 9 (Grundgerüst) – siehe [`docs/FORTSCHRITT.md`](docs/FORTSCHRITT.md).
Netze zeichnen, konfigurieren, speichern und laden funktioniert; die Simulation folgt ab Phase 3.

## Schnellstart

Voraussetzung: Node.js 24.

```bash
npm install
npm run build        # statisches Bundle in dist/
npm run preview      # dist/ lokal ansehen
```

`dist/` ist rein statisch und läuft auf jedem Webserver, auf GitHub Pages oder Cloudflare Pages
(relative Pfade, kein Backend).

Optional gibt es eine Desktop-Hülle (Electron), die `dist/` lokal ausliefert und in einem eigenen
Fenster zeigt: `npm run desktop`. Mit `npx electron . --screenshot bild.png` speichert sie ein Bild der
App und beendet sich (für automatische Prüfungen). Die Web-App selbst braucht sie nicht.

| Befehl                            | Zweck                                               |
| --------------------------------- | --------------------------------------------------- |
| `npm test`                        | Unit- und Szenario-Tests (Vitest)                   |
| `npm run test:coverage`           | mit Abdeckung (Engine mind. 80 %)                   |
| `npm run test:e2e`                | End-to-End-Tests (Playwright, nach `npm run build`) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                   |

## Bedienung (Entwurfsmodus)

- **Gerät hinzufügen:** aus der Palette links auf die Arbeitsfläche ziehen – oder Gerät mit Tab
  ansteuern und Enter drücken.
- **Verkabeln:** Kabel-Werkzeug (Taste **K**), erstes Gerät anklicken, dann das zweite.
  Oder vom blauen Punkt eines Geräts zu einem anderen ziehen. Freie Ports werden automatisch gewählt;
  umstecken im Eigenschaften-Panel des Kabels.
- **Konfigurieren:** Gerät anklicken, rechts Name, IP-Adresse, Subnetzmaske, Gateway, DNS und MAC ändern.
  Eingaben werden geprüft und mit Enter übernommen.

| Taste             | Wirkung                                               |
| ----------------- | ----------------------------------------------------- |
| Entf / Rücktaste  | Auswahl löschen (Kabel der Geräte werden mitgelöscht) |
| Strg+Z / Strg+Y   | Rückgängig / Wiederholen (vollständiger Verlauf)      |
| Strg+C / Strg+V   | Geräte kopieren / einfügen                            |
| Strg+S / Strg+O   | Projekt als Datei speichern / öffnen                  |
| K / Esc           | Kabel-Werkzeug ein/aus / abbrechen                    |
| Umschalt + Ziehen | Auswahlrechteck                                       |

Jede Änderung wird automatisch im Browser (IndexedDB) gesichert. Daten verlassen den Rechner nie.

## Lizenz

GPL-3.0-or-later (siehe [`LICENSE`](LICENSE)).
