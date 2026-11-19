/// <reference lib="webworker" />
import { EngineHost } from './host.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

const host = new EngineHost();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  try {
    response = host.handle(event.data);
  } catch (error) {
    response = {
      id: event.data.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response);
};
