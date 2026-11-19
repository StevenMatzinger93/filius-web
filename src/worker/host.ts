import { Terminal } from '../engine/cli/terminal.ts';
import type { Project } from '../engine/model/project.ts';
import { Scheduler } from '../engine/scheduler.ts';
import { Simulation } from '../engine/simulation.ts';
import { ENGINE_VERSION, type WorkerRequest, type WorkerResponse } from './protocol.ts';

/**
 * Verarbeitet Anfragen an die Engine. Ohne Worker-Abhängigkeit, damit sie in Vitest
 * direkt geprüft werden kann; engine.worker.ts hängt sie nur an onmessage.
 */
export class EngineHost {
  private project: Project | null = null;
  private scheduler = new Scheduler();
  private simulation: Simulation | null = null;
  private terminals = new Map<string, Terminal>();

  handle(request: WorkerRequest): WorkerResponse {
    switch (request.kind) {
      case 'hello':
        return { id: request.id, kind: 'hello', engineVersion: ENGINE_VERSION };
      case 'load-project':
        this.project = request.project;
        this.scheduler = new Scheduler();
        return {
          id: request.id,
          kind: 'loaded',
          devices: this.project.devices.length,
          links: this.project.links.length,
        };
      case 'stats':
        return {
          id: request.id,
          kind: 'stats',
          simTime: this.simulation?.now ?? this.scheduler.now,
          events: this.simulation?.scheduler.executedCount ?? this.scheduler.executedCount,
        };
      case 'sim-start':
        // Wie im Original: Beim Wechsel in den Simulationsmodus starten alle Geräte neu (leere Tabellen).
        this.simulation = new Simulation(structuredClone(request.project));
        this.terminals.clear();
        return { id: request.id, kind: 'sim-started', simTime: 0 };
      case 'sim-command': {
        const sim = this.requireSimulation();
        let terminal = this.terminals.get(request.deviceId);
        if (!terminal) {
          terminal = new Terminal(sim, request.deviceId);
          this.terminals.set(request.deviceId, terminal);
        }
        const start = sim.now;
        const traceFrom = sim.trace.length;
        const result = terminal.run(request.line);
        const trace = sim.trace
          .slice(traceFrom)
          .map((e) => ({ ...e, start: e.start - start, end: e.end - start }));
        return {
          id: request.id,
          kind: 'sim-output',
          lines: result.lines,
          trace,
          duration: result.duration,
          clear: result.clear === true,
        };
      }
      case 'sim-mac-table': {
        const sim = this.requireSimulation();
        return {
          id: request.id,
          kind: 'sim-mac-table',
          entries: sim.macTable(request.deviceId),
          simTime: sim.now,
        };
      }
    }
  }

  private requireSimulation(): Simulation {
    if (!this.simulation) throw new Error('Die Simulation läuft nicht.');
    return this.simulation;
  }
}
