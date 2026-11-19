import { BROADCAST_MAC, broadcastOf, isValidIp, parseIp, sameSubnet } from './model/address.ts';
import { specOf } from './model/catalog.ts';
import { ARP_ATTEMPTS, DEFAULT_TTL, LINK_DELAY_MS, MAC_AGING_MS, RTT_MS } from './model/original.ts';
import type { DeviceConfig, InterfaceConfig, Project } from './model/project.ts';
import { linkAt } from './model/topology.ts';
import {
  describeFrame,
  ETHERTYPE_ARP,
  ETHERTYPE_IPV4,
  type ArpPacket,
  type EthernetFrame,
  type IcmpMessage,
  type Ipv4Packet,
  type TraceEvent,
} from './layers/frames.ts';
import { interfaceFor, lookupRoute } from './layers/routing.ts';
import { Scheduler } from './scheduler.ts';

/**
 * Netzwerksimulation in virtueller Zeit (Phase 3): Ethernet, Switch-Lernen, ARP, IPv4, ICMP,
 * Router mit statischen Routen. Regeln und Werte nach dem Original (siehe MECHANICS.md),
 * Abweichungen zugunsten echten Verhaltens sind dort dokumentiert.
 */

/** ARP-Einträge altern nach 4 h (Cisco-Standard); im Original laufen sie nie ab (dokumentierte Abweichung). */
export const ARP_AGING_MS = 4 * 60 * 60 * 1000;

export interface MacTableEntry {
  mac: string;
  interfaceId: string;
  port: string;
  updated: number;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  updated: number;
}

type IcmpListener = (packet: Ipv4Packet, at: number) => void;

interface PendingArp {
  interfaceId: string;
  packets: Ipv4Packet[];
  attempts: number;
  /** Pakete, die dieses Gerät weiterleitet (bei Misserfolg ICMP «Host nicht erreichbar» an den Absender). */
  forwarded: boolean[];
}

interface DeviceRuntime {
  config: DeviceConfig;
  arp: Map<string, ArpEntry>;
  macTable: Map<string, MacTableEntry>;
  pendingArp: Map<string, PendingArp>;
}

function isForwarder(device: DeviceConfig): boolean {
  return specOf(device.type).role === 'router';
}

function isSwitch(device: DeviceConfig): boolean {
  const role = specOf(device.type).role;
  // Layer-3-Switches arbeiten bis zur VLAN-Phase wie Layer-2-Switches.
  return role === 'switch' || role === 'l3switch';
}

export class Simulation {
  readonly scheduler = new Scheduler();
  readonly trace: TraceEvent[] = [];
  private readonly devices = new Map<string, DeviceRuntime>();
  /** Frei ab Zeitpunkt pro Kabel und Richtung: ein Frame nach dem anderen (SimplexVerbindung.run). */
  private readonly busyUntil = new Map<string, number>();
  private readonly icmpListeners = new Map<string, Set<IcmpListener>>();
  private packetId = 0;

  constructor(readonly project: Project) {
    for (const config of project.devices) {
      this.devices.set(config.id, { config, arp: new Map(), macTable: new Map(), pendingArp: new Map() });
    }
  }

  get now(): number {
    return this.scheduler.now;
  }

  device(id: string): DeviceConfig | undefined {
    return this.devices.get(id)?.config;
  }

  findDeviceByName(name: string): DeviceConfig | undefined {
    const lower = name.toLowerCase();
    return this.project.devices.find((d) => d.name.toLowerCase() === lower);
  }

  // ------------------------------------------------------------------ Laufzeitansichten

  macTable(deviceId: string): MacTableEntry[] {
    const rt = this.devices.get(deviceId);
    if (!rt) return [];
    this.ageMacTable(rt);
    return [...rt.macTable.values()].sort((a, b) => a.port.localeCompare(b.port, 'de', { numeric: true }));
  }

  arpTable(deviceId: string): ArpEntry[] {
    const rt = this.devices.get(deviceId);
    if (!rt) return [];
    for (const [ip, e] of rt.arp) if (this.now - e.updated >= ARP_AGING_MS) rt.arp.delete(ip);
    return [...rt.arp.values()];
  }

  clearArp(deviceId: string, ip?: string): void {
    const rt = this.devices.get(deviceId);
    if (!rt) return;
    if (ip) rt.arp.delete(ip);
    else rt.arp.clear();
  }

  // ------------------------------------------------------------------ ICMP-Schnittstelle für Befehle

  /** Auf ICMP-Pakete warten, die bei diesem Gerät ankommen (Echo-Antworten, Fehlermeldungen). */
  onIcmp(deviceId: string, listener: IcmpListener): () => void {
    let set = this.icmpListeners.get(deviceId);
    if (!set) {
      set = new Set();
      this.icmpListeners.set(deviceId, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  /**
   * ICMP-Paket von einem Gerät aus senden. Gibt «no-route» zurück, wenn keine Route existiert
   * (Original: RouteNotFoundException → «Zieladresse nicht erreichbar»).
   */
  sendIcmp(
    deviceId: string,
    dst: string,
    icmp: IcmpMessage,
    ttl = DEFAULT_TTL,
  ): 'sent' | 'local' | 'no-route' {
    const rt = this.devices.get(deviceId);
    if (!rt || !isValidIp(dst)) return 'no-route';
    const route = lookupRoute(rt.config, dst);
    if (!route) return 'no-route';
    if (route.kind === 'local') {
      // Eigene Adresse oder 127/8: geht nicht aufs Netz (IP.senden im Original).
      const packet = this.packet(dst, dst, ttl, icmp);
      this.scheduler.schedule(0, () => this.deliverLocal(rt, packet));
      return 'local';
    }
    const out = rt.config.interfaces.find((i) => i.id === route.interfaceId);
    if (!out?.ipv4) return 'no-route';
    const packet = this.packet(out.ipv4.address, dst, ttl, icmp);
    this.routeOut(rt, packet, false);
    return 'sent';
  }

  /** Ist die Adresse eine Broadcast-Adresse aus Sicht des Geräts? (Ping darauf wird abgelehnt.) */
  isBroadcastFor(deviceId: string, ip: string): boolean {
    const rt = this.devices.get(deviceId);
    if (!rt || !isValidIp(ip)) return false;
    if (ip === '255.255.255.255') return true;
    const target = parseIp(ip);
    return rt.config.interfaces.some(
      (i) => i.ipv4 && broadcastOf(parseIp(i.ipv4.address), i.ipv4.prefix) === target && i.ipv4.prefix < 31,
    );
  }

  // ------------------------------------------------------------------ Schicht 2: Kabel

  private transmit(deviceId: string, iface: InterfaceConfig, frame: EthernetFrame): void {
    if (!iface.enabled) return;
    const link = linkAt(this.project, iface.id);
    if (!link) return;
    const peer = link.a.interfaceId === iface.id ? link.b : link.a;
    const peerRt = this.devices.get(peer.deviceId);
    const peerIface = peerRt?.config.interfaces.find((i) => i.id === peer.interfaceId);
    if (!peerRt || !peerIface) return;
    const key = `${link.id}:${iface.id}`;
    const start = Math.max(this.now, this.busyUntil.get(key) ?? 0);
    const end = start + LINK_DELAY_MS;
    this.busyUntil.set(key, end);
    const { protocol, info } = describeFrame(frame);
    this.trace.push({
      start,
      end,
      linkId: link.id,
      fromDeviceId: deviceId,
      toDeviceId: peer.deviceId,
      fromInterface: iface.name,
      toInterface: peerIface.name,
      protocol,
      srcMac: frame.srcMac,
      dstMac: frame.dstMac,
      info,
    });
    const copy = structuredClone(frame);
    this.scheduler.schedule(end - this.now, () => this.receive(peerRt, peerIface, copy));
  }

  private receive(rt: DeviceRuntime, iface: InterfaceConfig, frame: EthernetFrame): void {
    if (!iface.enabled) return;
    if (isSwitch(rt.config)) this.switchFrame(rt, iface, frame);
    else this.hostFrame(rt, iface, frame);
  }

  private ageMacTable(rt: DeviceRuntime): void {
    for (const [mac, e] of rt.macTable) if (this.now - e.updated >= MAC_AGING_MS) rt.macTable.delete(mac);
  }

  /**
   * Switch (SwitchPortBeobachter): Quell-MAC am Eingangsport lernen, bekanntes Ziel gezielt
   * weiterleiten, sonst an alle anderen Ports fluten. Abweichung vom Original: Ein Frame wird nie an
   * den Eingangsport zurückgeschickt (Filterung wie IEEE 802.1D).
   */
  private switchFrame(rt: DeviceRuntime, ingress: InterfaceConfig, frame: EthernetFrame): void {
    this.ageMacTable(rt);
    if (frame.srcMac !== BROADCAST_MAC) {
      rt.macTable.set(frame.srcMac, {
        mac: frame.srcMac,
        interfaceId: ingress.id,
        port: ingress.name,
        updated: this.now,
      });
    }
    const known = frame.dstMac === BROADCAST_MAC ? undefined : rt.macTable.get(frame.dstMac);
    if (known) {
      if (known.interfaceId === ingress.id) return;
      const out = rt.config.interfaces.find((i) => i.id === known.interfaceId);
      if (out) this.transmit(rt.config.id, out, frame);
      return;
    }
    for (const out of rt.config.interfaces) {
      if (out.id !== ingress.id) this.transmit(rt.config.id, out, frame);
    }
  }

  // ------------------------------------------------------------------ Endgeräte und Router

  private hostFrame(rt: DeviceRuntime, iface: InterfaceConfig, frame: EthernetFrame): void {
    if (frame.dstMac !== BROADCAST_MAC && frame.dstMac !== iface.mac) return;
    const payload = frame.payload;
    if (payload.kind === 'arp') this.arpReceive(rt, iface, payload);
    else this.ipReceive(rt, iface, payload);
  }

  private arpReceive(rt: DeviceRuntime, iface: InterfaceConfig, arp: ArpPacket): void {
    const myIp = iface.ipv4?.address;
    if (!myIp) return;
    const forMe = arp.targetIp === myIp;
    // Lernen, wenn die Anfrage uns gilt oder eine Antwort eintrifft (ARPThread.verarbeiteDatenEinheit).
    if (forMe || (arp.op === 2 && arp.senderIp !== '0.0.0.0')) {
      rt.arp.set(arp.senderIp, { ip: arp.senderIp, mac: arp.senderMac, updated: this.now });
      this.flushPending(rt, arp.senderIp);
    }
    if (arp.op === 1 && forMe) {
      this.transmit(rt.config.id, iface, {
        srcMac: iface.mac,
        dstMac: arp.senderMac,
        etherType: ETHERTYPE_ARP,
        payload: {
          kind: 'arp',
          op: 2,
          senderMac: iface.mac,
          senderIp: myIp,
          targetMac: arp.senderMac,
          targetIp: arp.senderIp,
        },
      });
    }
  }

  private ownsAddress(rt: DeviceRuntime, ip: string): boolean {
    return rt.config.interfaces.some((i) => i.enabled && i.ipv4?.address === ip);
  }

  private ipReceive(rt: DeviceRuntime, iface: InterfaceConfig, packet: Ipv4Packet): void {
    if (this.ownsAddress(rt, packet.dst) || packet.dst === '255.255.255.255') {
      this.deliverLocal(rt, packet);
      return;
    }
    // Nur Router leiten weiter (IP-Weiterleitung ist auf Rechnern aus).
    if (!isForwarder(rt.config)) return;
    if (packet.ttl <= 1) {
      // IP.weiterleitenPaket: TTL abgelaufen → ICMP 11/0 an den Absender.
      this.sendError(rt, iface, packet, 11, 0);
      return;
    }
    const forwarded: Ipv4Packet = { ...packet, ttl: packet.ttl - 1 };
    if (!lookupRoute(rt.config, forwarded.dst)) {
      this.sendError(rt, iface, packet, 3, 0);
      return;
    }
    this.routeOut(rt, forwarded, true);
  }

  private sendError(
    rt: DeviceRuntime,
    ingress: InterfaceConfig,
    cause: Ipv4Packet,
    type: 3 | 11,
    code: number,
  ): void {
    // Keine Fehlermeldung über eine Fehlermeldung (ICMP im Original).
    if (cause.icmp.type === 3 || cause.icmp.type === 11) return;
    const src = ingress.ipv4?.address;
    if (!src) return;
    const error = this.packet(src, cause.src, DEFAULT_TTL, {
      type,
      code,
      identifier: cause.icmp.identifier,
      sequence: cause.icmp.sequence,
      original: cause,
    });
    this.routeOut(rt, error, false);
  }

  private deliverLocal(rt: DeviceRuntime, packet: Ipv4Packet): void {
    const icmp = packet.icmp;
    if (icmp.type === 8) {
      // Echo Request beantworten.
      const reply = this.packet(packet.dst, packet.src, DEFAULT_TTL, {
        type: 0,
        code: 0,
        identifier: icmp.identifier,
        sequence: icmp.sequence,
      });
      if (this.ownsAddress(rt, packet.src) || packet.src === packet.dst) {
        this.scheduler.schedule(0, () => this.deliverLocal(rt, reply));
      } else {
        this.routeOut(rt, reply, false);
      }
      return;
    }
    for (const listener of this.icmpListeners.get(rt.config.id) ?? []) listener(packet, this.now);
  }

  /** Paket über die passende Route senden; Ziel-MAC per ARP auflösen. */
  private routeOut(rt: DeviceRuntime, packet: Ipv4Packet, forwarded: boolean): void {
    const route = lookupRoute(rt.config, packet.dst);
    if (!route || route.kind === 'local') {
      if (route) this.deliverLocal(rt, packet);
      return;
    }
    const out = rt.config.interfaces.find((i) => i.id === route.interfaceId);
    if (!out?.ipv4) return;
    const nextHop = route.kind === 'connected' ? packet.dst : route.gateway;
    // Lokaler Broadcast (z. B. 192.168.0.255) geht ohne ARP an alle.
    if (sameSubnet(parseIp(nextHop), parseIp(out.ipv4.address), out.ipv4.prefix)) {
      const bc = broadcastOf(parseIp(out.ipv4.address), out.ipv4.prefix);
      if (parseIp(nextHop) === bc && out.ipv4.prefix < 31) {
        this.sendIp(rt, out, packet, BROADCAST_MAC);
        return;
      }
    }
    const cached = rt.arp.get(nextHop);
    if (cached && this.now - cached.updated < ARP_AGING_MS) {
      this.sendIp(rt, out, packet, cached.mac);
      return;
    }
    const pending = rt.pendingArp.get(nextHop);
    if (pending) {
      pending.packets.push(packet);
      pending.forwarded.push(forwarded);
      return;
    }
    rt.pendingArp.set(nextHop, {
      interfaceId: out.id,
      packets: [packet],
      attempts: 0,
      forwarded: [forwarded],
    });
    this.arpRequest(rt, nextHop);
  }

  /** ARP-Anfrage senden; nach 1 RTT ohne Antwort erneut, insgesamt 2 Versuche (IP.sendeUnicastLokal). */
  private arpRequest(rt: DeviceRuntime, ip: string): void {
    const pending = rt.pendingArp.get(ip);
    const out = pending ? rt.config.interfaces.find((i) => i.id === pending.interfaceId) : undefined;
    if (!pending || !out?.ipv4) return;
    pending.attempts += 1;
    this.transmit(rt.config.id, out, {
      srcMac: out.mac,
      dstMac: BROADCAST_MAC,
      etherType: ETHERTYPE_ARP,
      payload: {
        kind: 'arp',
        op: 1,
        senderMac: out.mac,
        senderIp: out.ipv4.address,
        targetMac: BROADCAST_MAC,
        targetIp: ip,
      },
    });
    this.scheduler.schedule(RTT_MS, () => {
      const still = rt.pendingArp.get(ip);
      if (still !== pending) return;
      if (pending.attempts < ARP_ATTEMPTS) {
        this.arpRequest(rt, ip);
        return;
      }
      rt.pendingArp.delete(ip);
      // Keine Antwort: weitergeleitete Pakete → ICMP 3/1 an den Absender.
      pending.packets.forEach((p, i) => {
        if (pending.forwarded[i]) this.sendError(rt, out, p, 3, 1);
      });
    });
  }

  private flushPending(rt: DeviceRuntime, ip: string): void {
    const pending = rt.pendingArp.get(ip);
    const entry = rt.arp.get(ip);
    if (!pending || !entry) return;
    rt.pendingArp.delete(ip);
    const out = rt.config.interfaces.find((i) => i.id === pending.interfaceId);
    if (!out) return;
    for (const p of pending.packets) this.sendIp(rt, out, p, entry.mac);
  }

  private sendIp(rt: DeviceRuntime, out: InterfaceConfig, packet: Ipv4Packet, dstMac: string): void {
    this.transmit(rt.config.id, out, { srcMac: out.mac, dstMac, etherType: ETHERTYPE_IPV4, payload: packet });
  }

  private packet(src: string, dst: string, ttl: number, icmp: IcmpMessage): Ipv4Packet {
    this.packetId += 1;
    return { kind: 'ipv4', id: this.packetId, src, dst, ttl, protocol: 1, icmp };
  }

  /** Adresse der ersten Schnittstelle (für ipconfig). */
  primaryInterface(deviceId: string): InterfaceConfig | undefined {
    const d = this.device(deviceId);
    return d?.interfaces.find((i) => i.ipv4) ?? d?.interfaces[0];
  }

  /** Schnittstelle zu einer Adresse (für Anzeigen). */
  interfaceFor(deviceId: string, ip: string): InterfaceConfig | undefined {
    const d = this.device(deviceId);
    return d ? interfaceFor(d, ip) : undefined;
  }
}
