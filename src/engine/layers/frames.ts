/**
 * Frames und Pakete der Simulation (Schicht 2 und 3). Reine Daten, damit sie in die Oberfläche
 * (Datenaustausch, Animation) übertragen werden können.
 */

/** Ethernet-Typen wie im Original (EthernetFrame.IP / ARP: "0x800" / "0x806"). */
export const ETHERTYPE_IPV4 = 0x0800;
export const ETHERTYPE_ARP = 0x0806;

export interface ArpPacket {
  kind: 'arp';
  /** 1 = Anfrage, 2 = Antwort (ArpPaket.<clinit>). */
  op: 1 | 2;
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

/** ICMP-Typen des Originals: 0 Echo Reply, 3 Unreachable (Code 0 Netz, 1 Host), 8 Echo Request, 11 Time Exceeded. */
export interface IcmpMessage {
  type: 0 | 3 | 8 | 11;
  code: number;
  identifier: number;
  sequence: number;
  /** Bei Fehlermeldungen das auslösende Paket (Original: Fehlermeldung trägt das Paket als Nutzlast). */
  original?: Ipv4Packet;
}

export interface Ipv4Packet {
  kind: 'ipv4';
  id: number;
  src: string;
  dst: string;
  ttl: number;
  /** Protokollnummer: 1 = ICMP. */
  protocol: 1;
  icmp: IcmpMessage;
}

export interface EthernetFrame {
  srcMac: string;
  dstMac: string;
  etherType: number;
  payload: ArpPacket | Ipv4Packet;
}

export type Layer = 'netzzugang' | 'vermittlung' | 'transport' | 'anwendung';

/** Ein Frame auf einem Kabel – für Animation und Datenaustausch-Ansicht. */
export interface TraceEvent {
  /** Beginn der Übertragung (virtuelle ms). */
  start: number;
  /** Ankunft beim Nachbarn (virtuelle ms). */
  end: number;
  linkId: string;
  fromDeviceId: string;
  toDeviceId: string;
  fromInterface: string;
  toInterface: string;
  protocol: 'ARP' | 'ICMP';
  srcMac: string;
  dstMac: string;
  /** Kurzbeschreibung wie die Bemerkungen im Original-Datenaustausch. */
  info: string;
}

export function icmpText(m: IcmpMessage): string {
  switch (m.type) {
    case 8:
      return `ICMP Echo Request (ping), Identifier: ${m.identifier}, Seq.-No.: ${m.sequence}`;
    case 0:
      return `ICMP Echo Reply (pong), Identifier: ${m.identifier}, Seq.-No.: ${m.sequence}`;
    case 11:
      return 'ICMP Time Exceeded';
    case 3:
      return m.code === 0 ? 'ICMP Network Unreachable' : 'ICMP Host Unreachable';
  }
}

/** Bemerkung zu einem Frame (Texte wie im Datenaustausch des Originals). */
export function describeFrame(frame: EthernetFrame): { protocol: 'ARP' | 'ICMP'; info: string } {
  const p = frame.payload;
  if (p.kind === 'arp') {
    return {
      protocol: 'ARP',
      info: p.op === 1 ? `Suche nach MAC für ${p.targetIp}` : `${p.senderIp}: MAC ist ${p.senderMac}`,
    };
  }
  return { protocol: 'ICMP', info: `${p.src} → ${p.dst}, ${icmpText(p.icmp)}, TTL: ${p.ttl}` };
}
