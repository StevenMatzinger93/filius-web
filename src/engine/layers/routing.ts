import { formatIp, isValidIp, networkOf, parseIp, sameSubnet } from '../model/address.ts';
import type { DeviceConfig, InterfaceConfig } from '../model/project.ts';

/** Eine Zeile der Weiterleitungstabelle. */
export interface RouteEntry {
  destination: string;
  prefix: number;
  /** Nächstes Gateway; bei direkt angeschlossenen Netzen die eigene Adresse (wie im Original). */
  gateway: string;
  /** Ausgehende Schnittstelle (id) bzw. null für «lokal» (127.0.0.1). */
  interfaceId: string | null;
  /** Adresse der ausgehenden Schnittstelle (Anzeige). */
  interfaceIp: string;
  kind: 'local' | 'connected' | 'static' | 'default';
}

function addressed(device: DeviceConfig): { iface: InterfaceConfig; ip: number; prefix: number }[] {
  return device.interfaces
    .filter((i) => i.enabled && i.ipv4)
    .map((i) => ({ iface: i, ip: parseIp(i.ipv4!.address), prefix: i.ipv4!.prefix }));
}

/** Schnittstelle, deren Netz die Adresse enthält (erste passende). */
export function interfaceFor(device: DeviceConfig, ip: string): InterfaceConfig | undefined {
  if (!isValidIp(ip)) return undefined;
  const target = parseIp(ip);
  return addressed(device).find((a) => sameSubnet(a.ip, target, a.prefix))?.iface;
}

/**
 * Weiterleitungstabelle wie Weiterleitungstabelle.holeTabelle im Original:
 * eigene Adressen (Host-Routen), angeschlossene Netze, Loopback, manuelle Einträge und
 * Default-Route über das Standard-Gateway.
 */
export function routingTable(device: DeviceConfig): RouteEntry[] {
  const own = addressed(device);
  const rows: RouteEntry[] = [];
  for (const a of own) {
    const address = formatIp(a.ip);
    rows.push({
      destination: address,
      prefix: 32,
      gateway: '127.0.0.1',
      interfaceId: null,
      interfaceIp: '127.0.0.1',
      kind: 'local',
    });
  }
  for (const a of own) {
    const address = formatIp(a.ip);
    rows.push({
      destination: formatIp(networkOf(a.ip, a.prefix)),
      prefix: a.prefix,
      gateway: address,
      interfaceId: a.iface.id,
      interfaceIp: address,
      kind: 'connected',
    });
  }
  rows.push({
    destination: '127.0.0.0',
    prefix: 8,
    gateway: '127.0.0.1',
    interfaceId: null,
    interfaceIp: '127.0.0.1',
    kind: 'local',
  });
  for (const r of device.routes) {
    const out = interfaceFor(device, r.nextHop);
    if (!out?.ipv4) continue;
    rows.push({
      destination: r.destination,
      prefix: r.prefix,
      gateway: r.nextHop,
      interfaceId: out.id,
      interfaceIp: out.ipv4.address,
      kind: 'static',
    });
  }
  if (device.gateway && isValidIp(device.gateway)) {
    const out = interfaceFor(device, device.gateway) ?? own[0]?.iface;
    if (out?.ipv4) {
      rows.push({
        destination: '0.0.0.0',
        prefix: 0,
        gateway: device.gateway,
        interfaceId: out.id,
        interfaceIp: out.ipv4.address,
        kind: 'default',
      });
    }
  }
  return rows;
}

/** Längstes passendes Präfix; bei Gleichstand gewinnt die erste Zeile (wie im Original). */
export function lookupRoute(device: DeviceConfig, destination: string): RouteEntry | undefined {
  const target = parseIp(destination);
  let best: RouteEntry | undefined;
  for (const row of routingTable(device)) {
    if (!sameSubnet(parseIp(row.destination), target, row.prefix)) continue;
    if (!best || row.prefix > best.prefix) best = row;
  }
  return best;
}
