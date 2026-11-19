import { isValidIp, isValidMac, normalizeMac, parseMask } from './address.ts';
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
  | 'duplicate-mac';

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
