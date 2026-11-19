import type { ResponseFor, WorkerRequest, WorkerResponse } from './protocol.ts';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };

type RequestBody = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

/** Promise-basierter Zugang zum Simulations-Worker. */
export class EngineClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const entry = this.pending.get(event.data.id);
      if (!entry) return;
      this.pending.delete(event.data.id);
      if (event.data.kind === 'error') entry.reject(new Error(event.data.message));
      else entry.resolve(event.data);
    };
  }

  request<B extends RequestBody>(body: B): Promise<ResponseFor<B['kind']>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject });
      this.worker.postMessage({ ...body, id } as WorkerRequest);
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error('Worker beendet'));
    this.pending.clear();
  }
}
