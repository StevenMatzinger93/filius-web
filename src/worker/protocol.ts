import type { OutputLine } from '../engine/cli/terminal.ts';
import type { TraceEvent } from '../engine/layers/frames.ts';
import type { Project } from '../engine/model/project.ts';
import type { MacTableEntry } from '../engine/simulation.ts';

/**
 * Typisiertes Nachrichtenprotokoll zwischen Oberfläche und Simulations-Worker.
 * Jede Anfrage trägt eine id; die Antwort nennt dieselbe id.
 */
export type WorkerRequest =
  | { id: number; kind: 'hello' }
  | { id: number; kind: 'load-project'; project: Project }
  | { id: number; kind: 'stats' }
  | { id: number; kind: 'sim-start'; project: Project }
  | { id: number; kind: 'sim-command'; deviceId: string; line: string }
  | { id: number; kind: 'sim-mac-table'; deviceId: string };

export type WorkerResponse =
  | { id: number; kind: 'hello'; engineVersion: string }
  | { id: number; kind: 'loaded'; devices: number; links: number }
  | { id: number; kind: 'stats'; simTime: number; events: number }
  | { id: number; kind: 'sim-started'; simTime: number }
  | {
      id: number;
      kind: 'sim-output';
      lines: OutputLine[];
      /** Frames auf den Kabeln während des Befehls; Zeiten relativ zum Befehlsbeginn. */
      trace: TraceEvent[];
      duration: number;
      clear: boolean;
    }
  | { id: number; kind: 'sim-mac-table'; entries: MacTableEntry[]; simTime: number }
  | { id: number; kind: 'error'; message: string };

export type ResponseFor<K extends WorkerRequest['kind']> = K extends 'hello'
  ? Extract<WorkerResponse, { kind: 'hello' }>
  : K extends 'load-project'
    ? Extract<WorkerResponse, { kind: 'loaded' }>
    : K extends 'stats'
      ? Extract<WorkerResponse, { kind: 'stats' }>
      : K extends 'sim-start'
        ? Extract<WorkerResponse, { kind: 'sim-started' }>
        : K extends 'sim-command'
          ? Extract<WorkerResponse, { kind: 'sim-output' }>
          : Extract<WorkerResponse, { kind: 'sim-mac-table' }>;

export const ENGINE_VERSION = '0.3.0';
