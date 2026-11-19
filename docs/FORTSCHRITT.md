# Fortschritt

## Phase 1 – Analyse (19.11.2026) ✅

- Installationsprogramm entpackt: Der Programmkern ist `filius.jar` (Java 17, 513 Klassen).
- Untersucht: Klassenstruktur, Gerätetypen, Protokolle und ihre Konstanten, Befehlszeile,
  Datenaustausch-Ansicht, Oberfläche, Lizenz, Projektdateiformat.
- Ergebnisse:
  - `docs/ANALYSE.md` – Funktionsliste, Abbildung auf die neue Architektur, Phasenplan
  - `docs/analyse/SIMULATIONSREGELN-ORIGINAL.md` – Zeiten und Protokollregeln des Originals
  - `docs/FLS-FORMAT.md` – Aufbau der .fls-Dateien (ZIP + XMLEncoder-XML)
  - `MECHANICS.md`, `mechanics.json` – übernommene Werte mit Quelle
  - `tests/fixtures/fls/min.fls`, `full.fls` – Beispieldateien für den späteren Import
  - `docs/OFFENE-FRAGEN.md`
- Tests: in dieser Phase noch kein Code.
- Freigabe: Rückfragen sind in diesem Projekt auf «selbst entscheiden» gestellt; der Plan wurde daher
  ohne ausdrückliche Antwort übernommen. Änderungswünsche am Plan sind jederzeit möglich.

## Phase 2 – Grundgerüst (19.11.2026) ✅

- Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4 mit Theme-Tokens
  (Farben des Originals: Kabel, Schichtfarben), ESLint (0 Warnungen), Prettier, GitHub-Actions-CI.
- Datenmodell v1 (`engine/model`), zod-Schema mit Integritätsprüfung, JSON-Speichern/Laden als Datei,
  Autosave in IndexedDB, Beispielnetz beim ersten Start.
- Zustand-Store mit vollständigem Undo/Redo (Immer-Patches, 200 Schritte), Kopieren/Einfügen.
- Zeichenfläche mit React Flow 13: Drag & Drop aus der Palette (13 Gerätetypen inkl. Rechenzentrum),
  Kabel-Werkzeug wie im Original und Ziehen vom Anschlusspunkt, Zoom, Minimap, Raster (20 px),
  Mehrfachauswahl, Portnamen an den Kabelenden.
- Eigenschaften-Panel: Name, IP, Subnetzmaske, Gateway, DNS, MAC, DHCP-Client, Notiz; Router-Interfaces;
  Switch-Porttabelle; Kabel umstecken. Eingaben werden geprüft.
- Diskreter Event-Loop (`scheduler.ts`) und typisierte Web-Worker-Brücke (Projekt wird übergeben).
- Hell/Dunkel, Deutsch (Schweiz) / Englisch, Tastaturkürzel, ARIA-Beschriftungen, Tastaturbedienung der Palette.
- Tests: 36 Vitest-Tests (Engine-Abdeckung ≈ 99 %), 7 Playwright-Tests (inkl. «keine Konsolenfehler»).
- `npm run build` ohne Fehler und Warnungen.
- Nächster Schritt: Phase 3 (Ethernet, Switch-Lernen, ARP, IPv4, ICMP, Router, Ping).
