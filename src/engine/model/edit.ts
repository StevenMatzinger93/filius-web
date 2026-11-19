import { isValidIp, isValidMac, isValidMask, normalizeMac, parseMask } from './address.ts';
import { routerPortName } from './catalog.ts';
import { newInterface } from './factory.ts';
import { ROUTER_MAX_INTERFACES, ROUTER_MIN_INTERFACES } from './original.ts';
import { findDevice } from './topology.ts';
import type { DeviceConfig, InterfaceConfig, Project } from './project.ts';

/**
 * Änderungen am Konfigurationsmodell. GUI und (ab Phase 4) CLI benutzen dieselben Funktionen,
 * damit beide immer dasselbe Ergebnis erzeugen. Jede Funktion gibt null (ok) oder einen Fehlerschlüssel zurück.
 */
export type EditError =
  | 'unknown-device'
  | 'unknown-interface'
  | 'invalid-name'
  | 'invalid-ip'
  | 'invalid-mask'
  | 'invalid-mac'
  | 'duplicate-mac'
  | 'not-a-router'
  | 'too-many-interfaces'
  | 'too-few-interfaces';

/**
 * Router-Schnittstelle hinzufügen (Dialog «Verbindungen verwalten» im Original): höchstens 8
 * (JConnectionsDialog, «Maximal 8 Schnittstellen erlaubt!»). Neue Karten erhalten wie jede
 * Netzwerkkarte 192.168.0.10/24 (NetzwerkInterface.<init>).
 */
export function addRouterInterface(project: Project, deviceId: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  if (d.type !== 'router') return 'not-a-router';
  if (d.interfaces.length >= ROUTER_MAX_INTERFACES) return 'too-many-interfaces';
  d.interfaces.push(newInterface(project, routerPortName(d.interfaces.length), 0, true));
  return null;
}

/** Letzte Router-Schnittstelle entfernen (mindestens 1, Vermittlungsrechner.<init>); ihr Kabel geht mit. */
export function removeRouterInterface(project: Project, deviceId: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  if (d.type !== 'router') return 'not-a-router';
  if (d.interfaces.length <= ROUTER_MIN_INTERFACES) return 'too-few-interfaces';
  const removed = d.interfaces.pop();
  if (removed) {
    project.links = project.links.filter(
      (l) => l.a.interfaceId !== removed.id && l.b.interfaceId !== removed.id,
    );
  }
  return null;
}

function iface(project: Project, deviceId: string, interfaceId: string): InterfaceConfig | EditError {
  const device = findDevice(project, deviceId);
  if (!device) return 'unknown-device';
  return device.interfaces.find((i) => i.id === interfaceId) ?? 'unknown-interface';
}

function device(project: Project, deviceId: string): DeviceConfig | EditError {
  return findDevice(project, deviceId) ?? 'unknown-device';
}

export function renameDevice(project: Project, deviceId: string, name: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > 64) return 'invalid-name';
  d.name = trimmed;
  return null;
}

/** IP und Maske setzen; beide leer entfernt die Adresse. */
export function setInterfaceIp(
  project: Project,
  deviceId: string,
  interfaceId: string,
  address: string,
  mask: string,
): EditError | null {
  const i = iface(project, deviceId, interfaceId);
  if (typeof i === 'string') return i;
  if (address.trim() === '' && mask.trim() === '') {
    i.ipv4 = null;
    return null;
  }
  if (!isValidIp(address)) return 'invalid-ip';
  // Regel des Originals: Maske mit mindestens einer Eins (EingabenUeberpruefung @0x0070).
  if (!isValidMask(mask)) return 'invalid-mask';
  let prefix: number;
  try {
    prefix = parseMask(mask);
  } catch {
    return 'invalid-mask';
  }
  i.ipv4 = { address: address.trim(), prefix };
  return null;
}

export function setInterfaceMac(
  project: Project,
  deviceId: string,
  interfaceId: string,
  mac: string,
): EditError | null {
  const i = iface(project, deviceId, interfaceId);
  if (typeof i === 'string') return i;
  if (!isValidMac(mac)) return 'invalid-mac';
  const normalized = normalizeMac(mac);
  const clash = project.devices.some((d) =>
    d.interfaces.some((x) => x.id !== interfaceId && x.mac === normalized),
  );
  if (clash) return 'duplicate-mac';
  i.mac = normalized;
  return null;
}

export function setInterfaceEnabled(
  project: Project,
  deviceId: string,
  interfaceId: string,
  enabled: boolean,
): EditError | null {
  const i = iface(project, deviceId, interfaceId);
  if (typeof i === 'string') return i;
  i.enabled = enabled;
  return null;
}

export function setGateway(project: Project, deviceId: string, gateway: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  if (gateway.trim() !== '' && !isValidIp(gateway)) return 'invalid-ip';
  d.gateway = gateway.trim();
  return null;
}

export function setDns(project: Project, deviceId: string, dns: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  if (dns.trim() !== '' && !isValidIp(dns)) return 'invalid-ip';
  d.dns = dns.trim();
  return null;
}

export function setDhcpClient(project: Project, deviceId: string, enabled: boolean): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  d.dhcpClient = enabled;
  return null;
}

export function setNote(project: Project, deviceId: string, note: string): EditError | null {
  const d = device(project, deviceId);
  if (typeof d === 'string') return d;
  d.note = note;
  return null;
}
