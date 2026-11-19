/**
 * Das Projektmodell: reine, JSON-serialisierbare Daten.
 * Es ist die einzige Wahrheit für die Konfiguration; GUI und CLI ändern nur dieses Modell,
 * die Simulation liest es und meldet Laufzeitzustand separat zurück.
 * Das Dateischema dazu steht in src/io/schema.ts und docs/DATENMODELL.md.
 */

export const DEVICE_TYPES = [
  'pc',
  'notebook',
  'switch',
  'router',
  'gateway',
  'server',
  'l3switch',
  'tor',
  'spine',
  'firewall',
  'loadbalancer',
  'nas',
  'vmhost',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export interface Position {
  x: number;
  y: number;
}

/** IPv4-Konfiguration eines Interfaces (Präfixlänge statt Maske, damit sie immer gültig ist). */
export interface Ipv4Config {
  address: string;
  prefix: number;
}

/** Ein physisches Interface (Netzwerkkarte oder Switch-Port). */
export interface InterfaceConfig {
  id: string;
  name: string;
  mac: string;
  /** Administrativ eingeschaltet («no shutdown»). */
  enabled: boolean;
  ipv4: Ipv4Config | null;
}

export interface DeviceConfig {
  id: string;
  type: DeviceType;
  name: string;
  position: Position;
  interfaces: InterfaceConfig[];
  /** Standard-Gateway (Endgeräte, Router: Default-Route). Leer = keins. */
  gateway: string;
  /** DNS-Server (Endgeräte). Leer = keiner. */
  dns: string;
  /** IP-Konfiguration per DHCP beziehen (Endgeräte). */
  dhcpClient: boolean;
  /** Freitext-Notiz (Dokumentation). */
  note: string;
}

export interface LinkEnd {
  deviceId: string;
  interfaceId: string;
}

export interface LinkConfig {
  id: string;
  a: LinkEnd;
  b: LinkEnd;
}

export interface ProjectMeta {
  name: string;
  created: string;
  modified: string;
}

export const PROJECT_SCHEMA_ID = 'filius-web/project';
export const PROJECT_SCHEMA_VERSION = 1;

export interface Project {
  schema: typeof PROJECT_SCHEMA_ID;
  version: typeof PROJECT_SCHEMA_VERSION;
  meta: ProjectMeta;
  /** Seed für den deterministischen Zufallsgenerator. */
  seed: number;
  /** Zähler für fortlaufende ids (deterministisch statt UUIDs). */
  nextId: number;
  devices: DeviceConfig[];
  links: LinkConfig[];
}
