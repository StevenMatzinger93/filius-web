import { ROUTER_DEFAULT_INTERFACES, SWITCH_PORTS } from './original.ts';
import type { DeviceType } from './project.ts';

/** Wie sich ein Gerät grundsätzlich verhält. */
export type DeviceRole = 'host' | 'switch' | 'l3switch' | 'router';

export type PaletteGroup = 'classic' | 'datacenter';

export interface DeviceSpec {
  type: DeviceType;
  role: DeviceRole;
  group: PaletteGroup;
  /**
   * Präfix für automatische Namen. Klassische Geräte heissen wie im Original nach ihrem Typ
   * (MessagesBundle_de_DE: hw_rechner_msg2 «Rechner», hw_notebook_msg2 «Notebook», hw_switch_msg1
   * «Switch / WLAN», hw_gateway_msg1 «Heimrouter»); der Vermittlungsrechner heisst wie im Auftrag «Router».
   * Die Oberfläche übergibt die übersetzte Fassung (deviceName.*).
   */
  namePrefix: string;
  /** Portnamen in Reihenfolge (Anzahl beim Anlegen). */
  ports: readonly string[];
  /** Höheneinheiten im Rack (0 = nicht rackfähig). */
  rackUnits: number;
}

const range = (count: number, make: (i: number) => string): string[] =>
  Array.from({ length: count }, (_, i) => make(i));

/** 24 Ports wie der Filius-Switch (Switch.<init> @0x0022), Cisco-übliche Namen Gi0/1 … Gi0/24. */
const switchPorts = range(SWITCH_PORTS, (i) => `Gi0/${i + 1}`);

/** Name der n-ten Router-Schnittstelle (0-basiert), Cisco-üblich. */
export function routerPortName(index: number): string {
  return `Gi0/${index}`;
}

export const DEVICE_CATALOG: Readonly<Record<DeviceType, DeviceSpec>> = {
  pc: { type: 'pc', role: 'host', group: 'classic', namePrefix: 'Rechner', ports: ['eth0'], rackUnits: 0 },
  notebook: {
    type: 'notebook',
    role: 'host',
    group: 'classic',
    namePrefix: 'Notebook',
    ports: ['eth0'],
    rackUnits: 0,
  },
  switch: {
    type: 'switch',
    role: 'switch',
    group: 'classic',
    namePrefix: 'Switch',
    ports: switchPorts,
    rackUnits: 1,
  },
  router: {
    type: 'router',
    role: 'router',
    group: 'classic',
    namePrefix: 'Router',
    // GUIContainer.neuerKnoten: Abfrage 2 … 8, ohne Auswahl 2 Schnittstellen.
    ports: range(ROUTER_DEFAULT_INTERFACES, routerPortName),
    rackUnits: 1,
  },
  gateway: {
    type: 'gateway',
    role: 'router',
    group: 'classic',
    namePrefix: 'Heimrouter',
    ports: ['WAN', 'LAN'],
    rackUnits: 0,
  },
  server: {
    type: 'server',
    role: 'host',
    group: 'datacenter',
    namePrefix: 'Server',
    ports: ['eth0', 'eth1'],
    rackUnits: 1,
  },
  l3switch: {
    type: 'l3switch',
    role: 'l3switch',
    group: 'datacenter',
    namePrefix: 'L3Switch',
    ports: switchPorts,
    rackUnits: 1,
  },
  tor: {
    type: 'tor',
    role: 'l3switch',
    group: 'datacenter',
    namePrefix: 'ToR',
    ports: [...range(48, (i) => `Gi1/0/${i + 1}`), ...range(4, (i) => `Te1/1/${i + 1}`)],
    rackUnits: 1,
  },
  spine: {
    type: 'spine',
    role: 'l3switch',
    group: 'datacenter',
    namePrefix: 'Spine',
    ports: range(32, (i) => `Eth1/${i + 1}`),
    rackUnits: 1,
  },
  firewall: {
    type: 'firewall',
    role: 'router',
    group: 'datacenter',
    namePrefix: 'FW',
    ports: range(4, (i) => `Gi0/${i}`),
    rackUnits: 1,
  },
  loadbalancer: {
    type: 'loadbalancer',
    role: 'host',
    group: 'datacenter',
    namePrefix: 'LB',
    ports: ['eth0', 'eth1'],
    rackUnits: 1,
  },
  nas: {
    type: 'nas',
    role: 'host',
    group: 'datacenter',
    namePrefix: 'NAS',
    ports: ['eth0', 'eth1'],
    rackUnits: 2,
  },
  vmhost: {
    type: 'vmhost',
    role: 'host',
    group: 'datacenter',
    namePrefix: 'VMHost',
    ports: ['eth0', 'eth1'],
    rackUnits: 2,
  },
};

export function specOf(type: DeviceType): DeviceSpec {
  return DEVICE_CATALOG[type];
}

/** Hat das Gerät IP-Adressen auf seinen physischen Ports? (Switch-Ports nicht.) */
export function portsCarryIp(type: DeviceType): boolean {
  const role = specOf(type).role;
  return role === 'host' || role === 'router';
}

/** Endgerät mit Gateway, DNS und DHCP-Client? */
export function isEndDevice(type: DeviceType): boolean {
  return specOf(type).role === 'host';
}
