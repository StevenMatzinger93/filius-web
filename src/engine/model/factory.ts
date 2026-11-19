import { formatIp, generateMac, isValidIp, parseIp } from './address.ts';
import { isEndDevice, specOf } from './catalog.ts';
import type { DeviceConfig, DeviceType, InterfaceConfig, Position, Project } from './project.ts';
import { PROJECT_SCHEMA_ID, PROJECT_SCHEMA_VERSION } from './project.ts';
import { createRng } from './random.ts';

export function createProject(name: string, seed: number, now: string): Project {
  return {
    schema: PROJECT_SCHEMA_ID,
    version: PROJECT_SCHEMA_VERSION,
    meta: { name, created: now, modified: now },
    seed: seed >>> 0,
    nextId: 1,
    devices: [],
    links: [],
  };
}

/** Nächste fortlaufende id (verändert project.nextId). */
export function allocateId(project: Project, prefix: string): string {
  const id = `${prefix}${project.nextId}`;
  project.nextId += 1;
  return id;
}

export function usedMacs(project: Project): Set<string> {
  return new Set(project.devices.flatMap((d) => d.interfaces.map((i) => i.mac)));
}

/** Freier Name «PC1», «PC2» … pro Präfix. */
export function uniqueName(project: Project, prefix: string): string {
  const taken = new Set(project.devices.map((d) => d.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const candidate = `${prefix}${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Vorschlag für die IP eines neuen Endgeräts. Filius gibt jedem neuen Rechner 192.168.0.10/24
 * (NetzwerkInterface.<init>), was zu Adresskonflikten führt. Wir zählen ab .10 hoch und nehmen
 * die erste freie Adresse im Netz 192.168.0.0/24 (dokumentierte Abweichung).
 */
export function suggestHostIp(project: Project): string {
  const taken = new Set(
    project.devices.flatMap((d) => d.interfaces.flatMap((i) => (i.ipv4 ? [i.ipv4.address] : []))),
  );
  const base = parseIp('192.168.0.0');
  for (let host = 10; host < 255; host++) {
    const candidate = formatIp(base + host);
    if (!taken.has(candidate)) return candidate;
  }
  return '192.168.0.10';
}

function makeInterfaces(project: Project, type: DeviceType): InterfaceConfig[] {
  const spec = specOf(type);
  const rng = createRng((project.seed ^ Math.imul(project.nextId, 0x9e3779b1)) >>> 0);
  const used = usedMacs(project);
  return spec.ports.map((name) => {
    const mac = generateMac(rng, used);
    used.add(mac);
    return { id: allocateId(project, 'if'), name, mac, enabled: true, ipv4: null };
  });
}

/** Neues Gerät mit Standardwerten anlegen und ins Projekt einfügen. */
export function addDevice(project: Project, type: DeviceType, position: Position): DeviceConfig {
  const spec = specOf(type);
  const device: DeviceConfig = {
    id: allocateId(project, 'dev'),
    type,
    name: uniqueName(project, spec.namePrefix),
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    interfaces: [],
    gateway: '',
    dns: '',
    dhcpClient: false,
    note: '',
  };
  device.interfaces = makeInterfaces(project, type);
  const first = device.interfaces[0];
  if (isEndDevice(type) && first) {
    first.ipv4 = { address: suggestHostIp(project), prefix: 24 };
  }
  if (type === 'gateway') {
    // Werte aus Gateway.<init> des Originals: WAN 42.0.0.10/8; LAN als Gateway des Heimnetzes.
    const [wan, lan] = device.interfaces;
    if (wan) wan.ipv4 = { address: '42.0.0.10', prefix: 8 };
    if (lan) lan.ipv4 = { address: '192.168.0.1', prefix: 24 };
  }
  project.devices.push(device);
  return device;
}

/**
 * Kopie von Geräten einfügen (Einfügen aus der Zwischenablage): neue ids, MACs und Namen,
 * Kabel zwischen den kopierten Geräten werden mitkopiert. Gibt die neuen Geräte-ids zurück.
 */
export function pasteDevices(
  project: Project,
  devices: readonly DeviceConfig[],
  links: readonly {
    a: { deviceId: string; interfaceId: string };
    b: { deviceId: string; interfaceId: string };
  }[],
  offset: Position,
): string[] {
  const ifaceMap = new Map<string, string>();
  const deviceMap = new Map<string, string>();
  const used = usedMacs(project);
  const rng = createRng((project.seed ^ Math.imul(project.nextId, 0x85ebca6b)) >>> 0);
  for (const source of devices) {
    const copy: DeviceConfig = structuredClone(source);
    copy.id = allocateId(project, 'dev');
    copy.name = uniqueName(project, specOf(source.type).namePrefix);
    copy.position = { x: source.position.x + offset.x, y: source.position.y + offset.y };
    for (const iface of copy.interfaces) {
      const newId = allocateId(project, 'if');
      ifaceMap.set(iface.id, newId);
      iface.id = newId;
      iface.mac = generateMac(rng, used);
      used.add(iface.mac);
    }
    deviceMap.set(source.id, copy.id);
    project.devices.push(copy);
  }
  for (const link of links) {
    const da = deviceMap.get(link.a.deviceId);
    const db = deviceMap.get(link.b.deviceId);
    const ia = ifaceMap.get(link.a.interfaceId);
    const ib = ifaceMap.get(link.b.interfaceId);
    if (da && db && ia && ib) {
      project.links.push({
        id: allocateId(project, 'link'),
        a: { deviceId: da, interfaceId: ia },
        b: { deviceId: db, interfaceId: ib },
      });
    }
  }
  return [...deviceMap.values()];
}

/** Eingabe für Gateway/DNS: leer oder gültige IP. */
export function isOptionalIp(text: string): boolean {
  return text.trim() === '' || isValidIp(text);
}
