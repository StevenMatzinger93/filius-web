import { create } from 'zustand';
import type { MacTableEntry } from '../engine/simulation.ts';
import type { Project } from '../engine/model/project.ts';
import { getEngine } from '../worker/engine.ts';

/**
 * Zustand des Simulationsmodus: Befehlszeilen je Gerät, gerade aktive Kabel (Animation) und Tempo.
 * Die Engine rechnet in virtueller Zeit; die Oberfläche spielt Ausgabe und Frames gedehnt ab.
 */
export type Speed = 'slow' | 'normal' | 'fast';

/** Faktor echte ms pro virtueller ms. «Schnell» entspricht dem Original (50 ms pro Kabel). */
export const SPEED_SCALE: Record<Speed, number> = { slow: 8, normal: 3, fast: 1 };

export interface TerminalState {
  lines: string[];
  busy: boolean;
  history: string[];
}

interface SimState {
  running: boolean;
  speed: Speed;
  terminals: Record<string, TerminalState>;
  /** Anzahl Frames, die gerade über ein Kabel laufen (> 0 = grün). */
  activeLinks: Record<string, number>;
  macTables: Record<string, MacTableEntry[]>;
  error: string | null;
  start(project: Project): Promise<void>;
  stop(): void;
  setSpeed(speed: Speed): void;
  runCommand(deviceId: string, line: string): Promise<void>;
  loadMacTable(deviceId: string): Promise<void>;
}

const emptyTerminal = (): TerminalState => ({ lines: [], busy: false, history: [] });

let timers: ReturnType<typeof setTimeout>[] = [];
function later(ms: number, fn: () => void): void {
  timers.push(setTimeout(fn, ms));
}

export const useSimStore = create<SimState>()((set, get) => {
  const updateTerminal = (deviceId: string, update: (t: TerminalState) => TerminalState) =>
    set((s) => ({
      terminals: { ...s.terminals, [deviceId]: update(s.terminals[deviceId] ?? emptyTerminal()) },
    }));
  const bumpLink = (linkId: string, delta: number) =>
    set((s) => ({
      activeLinks: { ...s.activeLinks, [linkId]: Math.max(0, (s.activeLinks[linkId] ?? 0) + delta) },
    }));

  return {
    running: false,
    speed: 'normal',
    terminals: {},
    activeLinks: {},
    macTables: {},
    error: null,

    async start(project) {
      get().stop();
      try {
        await getEngine().request({ kind: 'sim-start', project });
        set({ running: true, error: null });
      } catch (error) {
        set({ running: false, error: error instanceof Error ? error.message : String(error) });
      }
    },

    stop() {
      for (const t of timers) clearTimeout(t);
      timers = [];
      set({ running: false, terminals: {}, activeLinks: {}, macTables: {} });
    },

    setSpeed(speed) {
      set({ speed });
    },

    async runCommand(deviceId, line) {
      if (!get().running) return;
      updateTerminal(deviceId, (t) => ({
        ...t,
        busy: true,
        lines: [...t.lines, `> ${line}`],
        history: line.trim() ? [...t.history, line] : t.history,
      }));
      let response;
      try {
        response = await getEngine().request({ kind: 'sim-command', deviceId, line });
      } catch (error) {
        updateTerminal(deviceId, (t) => ({
          ...t,
          busy: false,
          lines: [...t.lines, error instanceof Error ? error.message : String(error)],
        }));
        return;
      }
      const scale = SPEED_SCALE[get().speed];
      if (response.clear) updateTerminal(deviceId, (t) => ({ ...t, lines: [] }));
      for (const event of response.trace) {
        later(event.start * scale, () => bumpLink(event.linkId, 1));
        later(event.end * scale, () => bumpLink(event.linkId, -1));
      }
      for (const out of response.lines) {
        later(out.t * scale, () =>
          updateTerminal(deviceId, (t) => ({ ...t, lines: [...t.lines, out.text] })),
        );
      }
      const lastLine = response.lines.reduce((m, l) => Math.max(m, l.t), 0);
      later(Math.max(response.duration, lastLine) * scale + 1, () =>
        updateTerminal(deviceId, (t) => ({ ...t, busy: false })),
      );
    },

    async loadMacTable(deviceId) {
      if (!get().running) return;
      const response = await getEngine().request({ kind: 'sim-mac-table', deviceId });
      set((s) => ({ macTables: { ...s.macTables, [deviceId]: response.entries } }));
    },
  };
});
