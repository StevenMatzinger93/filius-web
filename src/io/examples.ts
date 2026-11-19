import { addDevice, createProject } from '../engine/model/factory.ts';
import type { Project } from '../engine/model/project.ts';
import { connect } from '../engine/model/topology.ts';

/** Kleines Startnetz: zwei Rechner an einem Switch (wie die erste Übung in Filius). */
export function createExampleProject(name: string, now: string, seed = 2026): Project {
  const project = createProject(name, seed, now);
  const sw = addDevice(project, 'switch', { x: 360, y: 220 });
  const pc1 = addDevice(project, 'pc', { x: 140, y: 380 });
  const pc2 = addDevice(project, 'pc', { x: 580, y: 380 });
  connect(project, { a: { deviceId: pc1.id }, b: { deviceId: sw.id } });
  connect(project, { a: { deviceId: pc2.id }, b: { deviceId: sw.id } });
  return project;
}
