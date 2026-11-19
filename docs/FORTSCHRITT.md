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
- Nächster Schritt: Freigabe des Plans, dann Phase 2 (Grundgerüst).
