import type { Project } from '../engine/model/project.ts';
import { Scheduler } from '../engine/scheduler.ts';
import { ENGINE_VERSION, type WorkerRequest, type WorkerResponse } from './protocol.ts';

/**
 * Verarbeitet Anfragen an die Engine. Ohne Worker-Abhängigkeit, damit sie in Vitest
 * direkt geprüft werden kann; engine.worker.ts hängt sie nur an onmessage.
 */
export class EngineHost {
  private project: Project | null = null;
  private scheduler = new Scheduler();

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
          simTime: this.scheduler.now,
          events: this.scheduler.executedCount,
        };
    }
  }
}
