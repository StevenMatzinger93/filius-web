import { allocateId } from './factory.ts';
import type { DeviceConfig, InterfaceConfig, LinkConfig, LinkEnd, Project } from './project.ts';

export function findDevice(project: Project, id: string): DeviceConfig | undefined {
  return project.devices.find((d) => d.id === id);
}

export function findInterface(project: Project, end: LinkEnd): InterfaceConfig | undefined {
  return findDevice(project, end.deviceId)?.interfaces.find((i) => i.id === end.interfaceId);
}

/** Das Kabel, das an einem Interface steckt. */
export function linkAt(project: Project, interfaceId: string): LinkConfig | undefined {
  return project.links.find((l) => l.a.interfaceId === interfaceId || l.b.interfaceId === interfaceId);
}

/** Erstes freies Interface eines Geräts (wie im Original: der nächste freie Anschluss). */
export function firstFreeInterface(project: Project, device: DeviceConfig): InterfaceConfig | undefined {
  return device.interfaces.find((i) => !linkAt(project, i.id));
}

export type ConnectError = 'same-device' | 'already-connected' | 'no-free-port' | 'port-in-use' | 'unknown';

export interface ConnectRequest {
  a: { deviceId: string; interfaceId?: string };
  b: { deviceId: string; interfaceId?: string };
}

export type ConnectPlan = { ok: true; a: LinkEnd; b: LinkEnd } | { ok: false; error: ConnectError };

/**
 * Prüft, ob zwei Geräte verbunden werden dürfen, und wählt freie Ports.
 * Regeln wie im Original (Meldungen «Komponenten bereits verbunden»,
 * «Maximale Anzahl angeschlossener Geräte überschritten»). Mehrere Kabel zwischen denselben
 * Geräten sind – anders als in Filius – erlaubt, wenn Ports angegeben werden (für Port-Channel/
 * Redundanz im Rechenzentrum); ohne Portangabe wird ein zweites Kabel abgelehnt.
 */
export function planConnection(project: Project, request: ConnectRequest): ConnectPlan {
  const da = findDevice(project, request.a.deviceId);
  const db = findDevice(project, request.b.deviceId);
  if (!da || !db) return { ok: false, error: 'unknown' };
  if (da.id === db.id) return { ok: false, error: 'same-device' };
  const explicit = request.a.interfaceId !== undefined && request.b.interfaceId !== undefined;
  const alreadyLinked = project.links.some(
    (l) =>
      (l.a.deviceId === da.id && l.b.deviceId === db.id) ||
      (l.a.deviceId === db.id && l.b.deviceId === da.id),
  );
  if (alreadyLinked && !explicit) return { ok: false, error: 'already-connected' };

  const pick = (device: DeviceConfig, wanted?: string): InterfaceConfig | ConnectError => {
    if (wanted !== undefined) {
      const iface = device.interfaces.find((i) => i.id === wanted);
      if (!iface) return 'unknown';
      return linkAt(project, iface.id) ? 'port-in-use' : iface;
    }
    return firstFreeInterface(project, device) ?? 'no-free-port';
  };
  const ia = pick(da, request.a.interfaceId);
  if (typeof ia === 'string') return { ok: false, error: ia };
  const ib = pick(db, request.b.interfaceId);
  if (typeof ib === 'string') return { ok: false, error: ib };
  return { ok: true, a: { deviceId: da.id, interfaceId: ia.id }, b: { deviceId: db.id, interfaceId: ib.id } };
}

export function connect(project: Project, request: ConnectRequest): ConnectPlan & { linkId?: string } {
  const plan = planConnection(project, request);
  if (!plan.ok) return plan;
  const linkId = allocateId(project, 'link');
  project.links.push({ id: linkId, a: plan.a, b: plan.b });
  return { ...plan, linkId };
}

/** Geräte löschen; ihre Kabel werden mitgelöscht. */
export function removeDevices(project: Project, deviceIds: ReadonlySet<string>): void {
  project.devices = project.devices.filter((d) => !deviceIds.has(d.id));
  project.links = project.links.filter((l) => !deviceIds.has(l.a.deviceId) && !deviceIds.has(l.b.deviceId));
}

export function removeLinks(project: Project, linkIds: ReadonlySet<string>): void {
  project.links = project.links.filter((l) => !linkIds.has(l.id));
}

/** Kabel auf einen anderen Port desselben Geräts umstecken. */
export function movePort(project: Project, linkId: string, side: 'a' | 'b', interfaceId: string): boolean {
  const link = project.links.find((l) => l.id === linkId);
  if (!link) return false;
  const device = findDevice(project, link[side].deviceId);
  if (!device?.interfaces.some((i) => i.id === interfaceId)) return false;
  const occupant = linkAt(project, interfaceId);
  if (occupant && occupant.id !== linkId) return false;
  link[side] = { deviceId: device.id, interfaceId };
  return true;
}
