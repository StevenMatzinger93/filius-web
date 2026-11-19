import { addDevice, createProject } from '../engine/model/factory.ts';
import type { Project } from '../engine/model/project.ts';
import { connect } from '../engine/model/topology.ts';

/**
 * Kleines Startnetz: zwei Rechner an einem Switch (wie die erste Übung in Filius).
 * Im Original bekommt jede neue Karte 192.168.0.10; damit das Beispiel sofort stimmig ist,
 * erhält der zweite Rechner hier ausdrücklich 192.168.0.11.
 */
export function createExampleProject(name: string, now: string, seed = 2026): Project {
  const project = createProject(name, seed, now);
  const sw = addDevice(project, 'switch', { x: 360, y: 220 });
  const pc1 = addDevice(project, 'pc', { x: 140, y: 380 });
  const pc2 = addDevice(project, 'pc', { x: 580, y: 380 });
  const second = pc2.interfaces[0];
  if (second) second.ipv4 = { address: '192.168.0.11', prefix: 24 };
  connect(project, { a: { deviceId: pc1.id }, b: { deviceId: sw.id } });
  connect(project, { a: { deviceId: pc2.id }, b: { deviceId: sw.id } });
  return project;
}
