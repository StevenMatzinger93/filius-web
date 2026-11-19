import { EngineClient } from './client.ts';

let shared: EngineClient | null = null;

/** Gemeinsamer Simulations-Worker der App (wird beim ersten Zugriff gestartet). */
export function getEngine(): EngineClient {
  shared ??= new EngineClient();
  return shared;
}
