import { generateMac, isValidIp } from './address.ts';
import { isEndDevice, specOf } from './catalog.ts';
import { DEFAULT_NIC_IP, DEFAULT_NIC_PREFIX, GATEWAY_WAN_IP, GATEWAY_WAN_PREFIX } from './original.ts';
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

/**
 * Freier Name «Rechner1», «Rechner2» … pro Präfix.
 * Im Original heisst jedes neue Gerät nur nach seinem Typ («Rechner», Rechner.<init> @0x0020), Namen
 * dürfen sich dort doppeln. Wir hängen eine Nummer an, weil Befehlszeile und Prüfregeln Geräte über
 * ihren Namen ansprechen (dokumentierte Abweichung).
 */
export function uniqueName(project: Project, prefix: string): string {
  const taken = new Set(project.devices.map((d) => d.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const candidate = `${prefix}${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Präfix eines vorhandenen Namens ohne angehängte Nummer («Rechner12» → «Rechner»). */
export function namePrefixOf(name: string): string {
  return name.replace(/\d+$/, '') || name;
}

/** Neue Netzwerkkarte mit den Standardwerten aus NetzwerkInterface.<init>. */
export function newInterface(
  project: Project,
  name: string,
  rngSalt: number,
  withDefaultIp: boolean,
): InterfaceConfig {
  const rng = createRng((project.seed ^ Math.imul(project.nextId + rngSalt, 0x9e3779b1)) >>> 0);
  const mac = generateMac(rng, usedMacs(project));
  return {
    id: allocateId(project, 'if'),
    name,
    mac,
    enabled: true,
    ipv4: withDefaultIp ? { address: DEFAULT_NIC_IP, prefix: DEFAULT_NIC_PREFIX } : null,
  };
}

/**
 * Welche Anschlüsse eine Standard-IP bekommen. Im Original erhält jede Netzwerkkarte 192.168.0.10/24
 * (Rechner, Notebook, Vermittlungsrechner, Heimrouter-LAN); Switch-Ports haben keine IP.
 * Für die neuen Rechenzentrums-Geräte gibt es kein Original: Server-artige Geräte bekommen die
 * Standard-IP auf der ersten Karte, Layer-3-Geräte und Firewall starten ohne IP (geschätzt).
 */
function defaultIpFor(type: DeviceType, index: number): boolean {
  if (type === 'pc' || type === 'notebook' || type === 'router' || type === 'gateway') return true;
  return isEndDevice(type) && index === 0;
}

/** Neues Gerät mit Standardwerten anlegen und ins Projekt einfügen. */
export function addDevice(
  project: Project,
  type: DeviceType,
  position: Position,
  namePrefix: string = specOf(type).namePrefix,
): DeviceConfig {
  const device: DeviceConfig = {
    id: allocateId(project, 'dev'),
    type,
    name: uniqueName(project, namePrefix),
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    interfaces: [],
    gateway: '',
    dns: '',
    dhcpClient: false,
    note: '',
    routes: [],
  };
  project.devices.push(device);
  // Einzeln anhängen, damit jede neue MAC auch gegen die Karten desselben Geräts geprüft wird.
  specOf(type).ports.forEach((portName, index) => {
    device.interfaces.push(newInterface(project, portName, index, defaultIpFor(type, index)));
  });
  if (type === 'gateway') {
    // Gateway.<init>: nur die WAN-Seite wird gesetzt; LAN behält 192.168.0.10/24.
    const wan = device.interfaces[0];
    if (wan) wan.ipv4 = { address: GATEWAY_WAN_IP, prefix: GATEWAY_WAN_PREFIX };
  }
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
    copy.name = uniqueName(project, namePrefixOf(source.name));
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
