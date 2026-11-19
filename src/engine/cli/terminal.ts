import { formatMask, isValidIp } from '../model/address.ts';
import {
  PING_COUNT,
  PING_INTERVAL_MS,
  RTT_MS,
  TRACEROUTE_MAX_HOPS,
  TRACEROUTE_MAX_LOSSES,
  TRACEROUTE_PROBES,
} from '../model/original.ts';
import { routingTable } from '../layers/routing.ts';
import type { Ipv4Packet } from '../layers/frames.ts';
import type { Simulation } from '../simulation.ts';

/**
 * Befehlszeile eines Endgeräts oder Routers (Original: software.lokal.Terminal).
 * Ein Befehl läuft vollständig in virtueller Zeit; jede Ausgabezeile trägt ihren Zeitpunkt
 * (ms seit Befehlsbeginn), damit die Oberfläche sie im Tempo der Animation zeigen kann.
 */
export interface OutputLine {
  t: number;
  text: string;
}

export interface CommandResult {
  lines: OutputLine[];
  /** Dauer des Befehls in virtueller Zeit. */
  duration: number;
  /** Die Oberfläche soll die Ausgabe leeren (cls). */
  clear?: boolean;
}

// Texte aus MessagesBundle_de_DE des Originals (sw_terminal_msg*), Schweizer Schreibweise.
const T = {
  ip: 'IP Adresse . . . :',
  mask: 'Netzmaske. . . . :',
  gateway: 'Standardgateway. :',
  mac: 'MAC-Adresse. . . :',
  dns: 'DNS-Server . . . :',
  routeHeader: '|      Ziel       |    Netzmaske    |     Gateway     |  Schnittstelle  |',
  arpHeader: '| Internetadresse  | Physische Adresse |',
  stats: 'Paketstatistik',
  sent: 'Paket(e) gesendet',
  received: 'Paket(e) empfangen',
  loss: 'Paketverlust',
  unreachable: 'Zieladresse nicht erreichbar',
  broadcast: 'Ping zu Broadcast-Adressen wird nicht unterstützt.',
  timeoutNoAnswer: 'Zeitüberschreitung! Keine Antwort empfangen.',
  unknown: 'Unbekannter Befehl!',
  helpHint: "Verwende den Befehl 'help' um Liste der verfügbaren Befehle anzuzeigen",
  noHost: 'Hostname konnte nicht aufgelöst werden!\nEventuell ist kein DNS-Server verfügbar.',
};

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const center = (s: string, n: number) => {
  const left = Math.floor((n - s.length) / 2);
  return pad(' '.repeat(Math.max(0, left)) + s, n);
};

export class Terminal {
  private nextIdentifier = 1;

  constructor(
    private readonly sim: Simulation,
    private readonly deviceId: string,
  ) {}

  /** Befehl ausführen; die Simulation läuft bis zum Ende des Befehls. */
  run(line: string): CommandResult {
    const [command = '', ...args] = line.trim().split(/\s+/);
    const start = this.sim.now;
    const out: OutputLine[] = [];
    const say = (text: string, at = this.sim.now) => {
      for (const part of text.split('\n')) out.push({ t: at - start, text: part });
    };
    let clear = false;
    switch (command.toLowerCase()) {
      case '':
        break;
      case 'help':
        this.help(say);
        break;
      case 'ipconfig':
        this.ipconfig(say);
        break;
      case 'route':
        this.route(say);
        break;
      case 'arp':
        this.arp(args, say);
        break;
      case 'ping':
        this.ping(args, say);
        break;
      case 'traceroute':
      case 'tracert':
        this.traceroute(args, say);
        break;
      case 'cls':
      case 'clear':
        clear = true;
        break;
      default:
        say(`${T.unknown}\n${T.helpHint}`);
    }
    const duration = this.sim.now - start;
    return { lines: out, duration, ...(clear ? { clear } : {}) };
  }

  private help(say: (s: string) => void): void {
    say(
      [
        'Liste verfügbarer Befehle:',
        '  ipconfig            Adresseinstellungen anzeigen',
        '  ping <ziel>         Erreichbarkeit prüfen (4 Echo-Anfragen)',
        '  traceroute <ziel>   Weg zum Ziel anzeigen',
        '  route               Weiterleitungstabelle anzeigen',
        '  arp [-a | -d [ip]]  ARP-Tabelle anzeigen bzw. löschen',
        '  cls                 Bildschirm leeren',
        '  help                diese Hilfe',
      ].join('\n'),
    );
  }

  private ipconfig(say: (s: string) => void): void {
    const device = this.sim.device(this.deviceId);
    if (!device) return;
    const shown = device.interfaces.filter((i) => i.ipv4);
    for (const iface of shown.length > 0 ? shown : device.interfaces.slice(0, 1)) {
      if (shown.length > 1) say(`${iface.name}:`);
      say(`${T.ip} ${iface.ipv4?.address ?? ''}`);
      say(`${T.mask} ${iface.ipv4 ? formatMask(iface.ipv4.prefix) : ''}`);
      say(`${T.mac} ${iface.mac}`);
    }
    say(`${T.gateway} ${device.gateway}`);
    say(`${T.dns} ${device.dns}`);
  }

  private route(say: (s: string) => void): void {
    const device = this.sim.device(this.deviceId);
    if (!device) return;
    const line = '+' + '-'.repeat(71) + '+';
    say(line);
    say(T.routeHeader);
    say(line);
    for (const r of routingTable(device)) {
      say(
        `| ${pad(r.destination, 15)} | ${pad(formatMask(r.prefix), 15)} | ${pad(r.gateway, 15)} | ${pad(r.interfaceIp, 15)} |`,
      );
    }
    say(line);
  }

  private arp(args: string[], say: (s: string) => void): void {
    if (args[0] === '-d') {
      this.sim.clearArp(this.deviceId, args[1]);
      return;
    }
    const filter = args[0] === '-a' ? args[1] : undefined;
    const dashes = '-'.repeat(40);
    say(T.arpHeader);
    say(dashes);
    for (const e of this.sim.arpTable(this.deviceId)) {
      if (filter && e.ip !== filter) continue;
      say(`| ${pad(e.ip, 16)} | ${pad(e.mac, 17)} |`);
    }
    say(dashes);
  }

  /** Zielangabe auflösen: IP-Adresse oder Gerätename (ohne DNS-Dienst; DNS folgt in Phase 5). */
  private resolve(target: string | undefined): string | null {
    if (!target) return null;
    if (isValidIp(target)) return target;
    const device = this.sim.findDeviceByName(target);
    return device?.interfaces.find((i) => i.ipv4)?.ipv4?.address ?? null;
  }

  /**
   * ping nach Terminal.ping: 4 Echo-Anfragen im 1000-ms-Takt, je bis 1 RTT warten,
   * Statistik mit Verlust = round((1 − empfangen/gesendet) × 100).
   */
  private ping(args: string[], say: (s: string, at?: number) => void): void {
    const target = args.find((a) => !a.startsWith('-'));
    const ip = this.resolve(target);
    if (!ip) {
      say(T.noHost);
      return;
    }
    if (this.sim.isBroadcastFor(this.deviceId, ip)) {
      say(T.broadcast);
      return;
    }
    const identifier = this.nextIdentifier++;
    let received = 0;
    let sent = 0;
    let unreachable = false;
    say(`PING ${target} (${ip})`);
    const replies = new Map<number, { packet: Ipv4Packet; at: number }>();
    const stop = this.sim.onIcmp(this.deviceId, (packet, at) => {
      const m = packet.icmp;
      if (m.identifier !== identifier) return;
      if (!replies.has(m.sequence)) replies.set(m.sequence, { packet, at });
    });
    const begin = this.sim.now;
    for (let seq = 1; seq <= PING_COUNT; seq++) {
      const sendAt = begin + (seq - 1) * PING_INTERVAL_MS;
      this.sim.scheduler.runUntil(sendAt);
      const result = this.sim.sendIcmp(this.deviceId, ip, { type: 8, code: 0, identifier, sequence: seq });
      if (result === 'no-route') {
        unreachable = true;
        break;
      }
      sent += 1;
      // Bis zur Antwort laufen lassen, höchstens 1 RTT.
      const deadline = sendAt + RTT_MS;
      while (!replies.has(seq) && (this.sim.scheduler.peekTime() ?? Infinity) <= deadline) {
        this.sim.scheduler.step();
      }
      const reply = replies.get(seq);
      if (reply && reply.packet.icmp.type === 0) {
        received += 1;
        say(
          `From ${reply.packet.src} (${reply.packet.src}): icmp_seq=${seq} ttl=${reply.packet.ttl} time=${reply.at - sendAt}ms`,
          reply.at,
        );
      } else if (reply) {
        say(`From ${reply.packet.src} (${reply.packet.src}): icmp_seq=${seq} -- ${T.unreachable}`, reply.at);
      } else {
        this.sim.scheduler.runUntil(deadline);
        say(`From ${target} (${ip}): icmp_seq=${seq} -- Timeout!`, deadline);
      }
    }
    stop();
    if (unreachable && sent === 0) {
      say(T.unreachable);
      return;
    }
    // Rest des letzten 1000-ms-Takts abwarten (Terminal.ping schläft bis zum Taktende).
    this.sim.scheduler.runUntil(Math.max(this.sim.now, begin + sent * PING_INTERVAL_MS));
    const loss = Math.round((1 - received / sent) * 100);
    say('');
    say(`--- ${target} ${T.stats} ---`);
    say(`${sent} ${T.sent}, ${received} ${T.received}, ${loss}% ${T.loss}`);
  }

  /** traceroute nach Terminal.traceroute: TTL 1 … 20, je bis 3 Proben à 1 RTT. */
  private traceroute(args: string[], say: (s: string, at?: number) => void): void {
    const target = args[0];
    const ip = this.resolve(target);
    if (!ip) {
      say(T.noHost);
      return;
    }
    say(`Verbindung nach ${target} (${ip}) wird aufgebaut (max. ${TRACEROUTE_MAX_HOPS} Stationen)`);
    const identifier = this.nextIdentifier++;
    let sequence = 0;
    let losses = 0;
    let reached = false;
    const answers = new Map<number, Ipv4Packet>();
    const stop = this.sim.onIcmp(this.deviceId, (packet) => {
      if (packet.icmp.identifier === identifier) answers.set(packet.icmp.sequence, packet);
    });
    for (let hop = 1; hop <= TRACEROUTE_MAX_HOPS && !reached && losses <= TRACEROUTE_MAX_LOSSES; hop++) {
      let line = `${center(String(hop), 4)}  `;
      let from: string | null = null;
      for (let probe = 0; probe < TRACEROUTE_PROBES && !from; probe++) {
        sequence += 1;
        const result = this.sim.sendIcmp(this.deviceId, ip, { type: 8, code: 0, identifier, sequence }, hop);
        if (result === 'no-route') {
          stop();
          say(T.unreachable);
          return;
        }
        const deadline = this.sim.now + RTT_MS;
        while (!answers.has(sequence) && (this.sim.scheduler.peekTime() ?? Infinity) <= deadline) {
          this.sim.scheduler.step();
        }
        const answer = answers.get(sequence);
        if (answer) {
          from = answer.src;
          losses = 0;
          if (answer.icmp.type !== 11) reached = true;
        } else {
          this.sim.scheduler.runUntil(deadline);
          line += '* ';
          losses += 1;
        }
      }
      say(line + (from ?? ''));
    }
    stop();
    say(reached ? `Ziel ${ip} erreicht.` : T.timeoutNoAnswer);
  }
}
