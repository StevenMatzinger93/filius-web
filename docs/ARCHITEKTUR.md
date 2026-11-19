# Architektur

Begründungen und Alternativen stehen in [`ANALYSE.md`](ANALYSE.md), Abschnitt 6.

## Schichten

```
UI (React, React Flow, Tailwind)          src/ui, src/App.tsx
  │  liest/ändert
Zustand-Stores                             src/store
  │  projectStore: Projektmodell + Undo/Redo (Immer-Patches)
  │  uiStore: Theme, Modus, Kabel-Werkzeug
  │  Projekt (reine Daten)
  ▼
Engine (reines TypeScript, ohne UI)       src/engine
  model/   Projektmodell, Adressen, Gerätekatalog, Verkabelungsregeln, Bearbeiten
  scheduler.ts  diskreter Event-Loop mit virtueller Zeit
  ▲
  │ typisierte Nachrichten (worker/protocol.ts)
Web Worker                                 src/worker
  │
I/O                                        src/io
  schema.ts (zod), serialize.ts, storage.ts (IndexedDB), file.ts, examples.ts
```

## Grundregeln

1. **Eine Wahrheit.** Das Projektmodell (`engine/model/project.ts`) enthält die gesamte Konfiguration
   als JSON-fähige Daten. GUI und (ab Phase 4) CLI ändern es ausschliesslich über die Funktionen in
   `engine/model/edit.ts` und `topology.ts`. So sind GUI und CLI immer synchron, und jede Änderung ist
   rückgängig machbar.
2. **Undo/Redo.** `projectStore.change(label, recipe)` führt das Rezept mit `produceWithPatches` aus und
   legt Patches und Gegen-Patches auf den Verlauf (höchstens 200 Schritte). Änderungen ohne Wirkung
   (z. B. abgelehnte Eingaben) erzeugen keinen Verlaufseintrag.
3. **Determinismus.** ids sind fortlaufend (`nextId`), Zufall kommt aus einem Seed (`seed`, mulberry32).
   Zwei gleiche Projekte ergeben dieselben MAC-Adressen und später dieselben Simulationsläufe.
4. **Virtuelle Zeit.** `Scheduler` ordnet Ereignisse nach (Zeit, Planungsreihenfolge). Tests lassen die
   Simulation mit `runAll()` ohne Wartezeit laufen; die Oberfläche spielt sie gebremst ab.
5. **Engine ohne UI.** ESLint verbietet in `src/engine` Importe von React, React Flow, Zustand und `ui/`
   sowie `any`.

## Zeichenfläche

React Flow wird kontrolliert betrieben: Die Knoten werden aus dem Projekt abgeleitet; eine lokale Kopie
hält gemessene Grössen und Zwischenpositionen beim Ziehen. Erst beim Loslassen wird die neue Position
als **ein** Undo-Schritt ins Projekt geschrieben. Kabel sind gerade Linien von Geräterand zu Geräterand
mit Portnamen an beiden Enden. `onlyRenderVisibleElements` hält grosse Netze (200 Geräte) flüssig.

## Abweichungen vom Original

Siehe [`../MECHANICS.md`](../MECHANICS.md). Bisher umgesetzt:

- Standardwerte (192.168.0.10/24 je Netzwerkkarte, Heimrouter-WAN 42.0.0.10/8, 24 Switch-Ports,
  Router mit 2 bis 8 Schnittstellen, MAC-Regel, Tausch beim Umstecken) kommen aus dem Original
  (`src/engine/model/original.ts`, Fundstellen in `MECHANICS.md`).
- Gerätenamen bekommen eine Nummer (Original: nur Typname, Doppelnamen möglich).
- MAC-Zufall kommt aus dem Projekt-Seed statt aus `java.util.Random`.
- Ungültige Eingaben, die das Original wegen zu grosszügiger Prüfmuster durchliess
  (z. B. «.1.2.3», führende Nullen oder MAC mit «G»), werden abgelehnt.
