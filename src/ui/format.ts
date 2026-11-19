import { formatMask } from '../engine/model/address.ts';
import { isEndDevice, portsCarryIp } from '../engine/model/catalog.ts';
import type { DeviceConfig, Project } from '../engine/model/project.ts';

/** Kurzinfo unter dem Gerätesymbol. */
export function deviceDetail(device: DeviceConfig, project: Project): string {
  if (isEndDevice(device.type)) {
    if (device.dhcpClient) return 'DHCP';
    const ip = device.interfaces[0]?.ipv4;
    return ip ? `${ip.address}/${ip.prefix}` : '';
  }
  if (portsCarryIp(device.type)) {
    const count = device.interfaces.filter((i) => i.ipv4).length;
    return count > 0 ? `${count} × IP` : '';
  }
  const used = new Set(project.links.flatMap((l) => [l.a.interfaceId, l.b.interfaceId]));
  const busy = device.interfaces.filter((i) => used.has(i.id)).length;
  return `${busy}/${device.interfaces.length} Ports`;
}

/** Tooltip mit Adressen (das Original zeigt IP/Maske (MAC), Gateway, DNS). */
export function deviceTooltip(device: DeviceConfig): string {
  const lines = [device.name];
  for (const iface of device.interfaces) {
    if (!iface.ipv4) continue;
    lines.push(`${iface.name}: ${iface.ipv4.address} / ${formatMask(iface.ipv4.prefix)} (${iface.mac})`);
  }
  if (device.gateway) lines.push(`Gateway: ${device.gateway}`);
  if (device.dns) lines.push(`DNS: ${device.dns}`);
  return lines.join('\n');
}
