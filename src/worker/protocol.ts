import type { Project } from '../engine/model/project.ts';

/**
 * Typisiertes Nachrichtenprotokoll zwischen Oberfläche und Simulations-Worker.
 * Jede Anfrage trägt eine id; die Antwort nennt dieselbe id.
 * Phase 2: Verbindungsaufbau und Projektübergabe; die Simulation folgt in Phase 3.
 */
export type WorkerRequest =
  | { id: number; kind: 'hello' }
  | { id: number; kind: 'load-project'; project: Project }
  | { id: number; kind: 'stats' };

export type WorkerResponse =
  | { id: number; kind: 'hello'; engineVersion: string }
  | { id: number; kind: 'loaded'; devices: number; links: number }
  | { id: number; kind: 'stats'; simTime: number; events: number }
  | { id: number; kind: 'error'; message: string };

export type ResponseFor<K extends WorkerRequest['kind']> = K extends 'hello'
  ? Extract<WorkerResponse, { kind: 'hello' }>
  : K extends 'load-project'
    ? Extract<WorkerResponse, { kind: 'loaded' }>
    : Extract<WorkerResponse, { kind: 'stats' }>;

export const ENGINE_VERSION = '0.2.0';
