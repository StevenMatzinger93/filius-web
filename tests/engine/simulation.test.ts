import { describe, expect, it } from 'vitest';
import { Terminal } from '../../src/engine/cli/terminal.ts';
import { lookupRoute, routingTable } from '../../src/engine/layers/routing.ts';
import { addStaticRoute, removeStaticRoute } from '../../src/engine/model/edit.ts';
import { addDevice, createProject } from '../../src/engine/model/factory.ts';
import { LINK_DELAY_MS, RTT_MS } from '../../src/engine/model/original.ts';
import type { DeviceConfig, Project } from '../../src/engine/model/project.ts';
import { connect } from '../../src/engine/model/topology.ts';
import { Simulation } from '../../src/engine/simulation.ts';
import { createExampleProject } from '../../src/io/examples.ts';

const text = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join('\n');

function setIp(d: DeviceConfig, index: number, address: string, prefix = 24): void {
  d.interfaces[index]!.ipv4 = { address, prefix };
}

/** Zwei Netze über einen Router: A (192.168.1.0/24) – Router – B (192.168.2.0/24). */
function routedProject(): { p: Project; a: DeviceConfig; b: DeviceConfig; r: DeviceConfig } {
  const p = createProject('Routing', 7, 'now');
  const a = addDevice(p, 'pc', { x: 0, y: 0 });
  const b = addDevice(p, 'pc', { x: 0, y: 0 });
  const r = addDevice(p, 'router', { x: 0, y: 0 });
  const s1 = addDevice(p, 'switch', { x: 0, y: 0 });
  const s2 = addDevice(p, 'switch', { x: 0, y: 0 });
  setIp(a, 0, '192.168.1.10');
  setIp(b, 0, '192.168.2.10');
  setIp(r, 0, '192.168.1.1');
  setIp(r, 1, '192.168.2.1');
  a.gateway = '192.168.1.1';
  b.gateway = '192.168.2.1';
  connect(p, { a: { deviceId: a.id }, b: { deviceId: s1.id } });
  connect(p, { a: { deviceId: r.id, interfaceId: r.interfaces[0]!.id }, b: { deviceId: s1.id } });
  connect(p, { a: { deviceId: b.id }, b: { deviceId: s2.id } });
  connect(p, { a: { deviceId: r.id, interfaceId: r.interfaces[1]!.id }, b: { deviceId: s2.id } });
  return { p, a, b, r };
}

describe('Simulation: zwei Rechner an einem Switch', () => {
  it('ping ist erfolgreich, mit ARP zuerst und Statistik wie im Original', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    const sim = new Simulation(p);
    const result = new Terminal(sim, pc1.id).run('ping 192.168.0.11');
    const out = text(result);
    expect(out).toContain('PING 192.168.0.11 (192.168.0.11)');
    expect(out).toContain('icmp_seq=1 ttl=64');
    expect(out).toContain('4 Paket(e) gesendet, 4 Paket(e) empfangen, 0% Paketverlust');
    // erstes Echo: ARP-Anfrage + Antwort (2 Hops hin und zurück) + Echo hin und zurück
    expect(out).toContain(`icmp_seq=1 ttl=64 time=${8 * LINK_DELAY_MS}ms`);
    expect(out).toContain(`icmp_seq=2 ttl=64 time=${4 * LINK_DELAY_MS}ms`);
    expect(result.duration).toBe(4000);
    const arp = sim.trace.filter((e) => e.protocol === 'ARP');
    expect(arp[0]?.info).toBe('Suche nach MAC für 192.168.0.11');
    expect(arp[0]?.dstMac).toBe('FF:FF:FF:FF:FF:FF');
    // ARP-Tabelle gefüllt, Switch hat beide MACs gelernt
    const t = new Terminal(sim, pc1.id);
    expect(text(t.run('arp'))).toContain('192.168.0.11');
    const sw = p.devices.find((d) => d.type === 'switch')!;
    const table = sim.macTable(sw.id);
    expect(table.map((e) => e.port)).toEqual(['Gi0/1', 'Gi0/2']);
    t.run('arp -d');
    expect(sim.arpTable(pc1.id)).toHaveLength(0);
  });

  it('Ping an sich selbst und an 127.0.0.1 geht nicht aufs Netz', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    const sim = new Simulation(p);
    const t = new Terminal(sim, pc1.id);
    expect(text(t.run('ping 192.168.0.10'))).toContain('4 Paket(e) empfangen');
    expect(text(t.run('ping 127.0.0.1'))).toContain('0% Paketverlust');
    expect(sim.trace).toHaveLength(0);
  });

  it('Ping per Gerätename, unbekannte Namen und Broadcast werden abgefangen', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    const sim = new Simulation(p);
    const t = new Terminal(sim, pc1.id);
    expect(text(t.run('ping Rechner2'))).toContain('PING Rechner2 (192.168.0.11)');
    expect(text(t.run('ping Gibtsnicht'))).toContain('Hostname konnte nicht aufgelöst werden!');
    expect(text(t.run('ping 192.168.0.255'))).toContain('Ping zu Broadcast-Adressen');
    expect(text(t.run('ping'))).toContain('Hostname konnte nicht aufgelöst werden!');
  });

  it('nicht vorhandenes Ziel im eigenen Netz: Zeitüberschreitung, 100 % Verlust', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    const sim = new Simulation(p);
    const result = new Terminal(sim, pc1.id).run('ping 192.168.0.99');
    const out = text(result);
    expect(out).toContain('icmp_seq=1 -- Timeout!');
    expect(out).toContain('4 Paket(e) gesendet, 0 Paket(e) empfangen, 100% Paketverlust');
    // 2 ARP-Versuche (IP.sendeUnicastLokal); wartende Echos teilen sich dieselbe Auflösung
    const arp = sim.trace.filter((e) => e.protocol === 'ARP' && e.fromDeviceId === pc1.id);
    expect(arp.map((e) => e.start)).toEqual([0, RTT_MS]);
    expect(result.lines.at(-1)!.t).toBeGreaterThanOrEqual(3 * 1000 + RTT_MS);
  });

  it('verschiedene Netze ohne Gateway: Zieladresse nicht erreichbar', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    const sim = new Simulation(p);
    expect(text(new Terminal(sim, pc1.id).run('ping 10.0.0.1'))).toBe(
      'PING 10.0.0.1 (10.0.0.1)\nZieladresse nicht erreichbar',
    );
  });

  it('deaktivierte Schnittstelle sendet nichts', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    pc1.interfaces[0]!.enabled = false;
    const sim = new Simulation(p);
    expect(text(new Terminal(sim, pc1.id).run('ping 192.168.0.11'))).toContain(
      'Zieladresse nicht erreichbar',
    );
  });
});

describe('Simulation: Router mit statischem Routing', () => {
  it('Ping über den Router: TTL sinkt auf 63', () => {
    const { p, a } = routedProject();
    const sim = new Simulation(p);
    const out = text(new Terminal(sim, a.id).run('ping 192.168.2.10'));
    expect(out).toContain('icmp_seq=1 ttl=63');
    expect(out).toContain('4 Paket(e) empfangen');
  });

  it('traceroute zeigt den Router und das Ziel', () => {
    const { p, a } = routedProject();
    const sim = new Simulation(p);
    const out = text(new Terminal(sim, a.id).run('traceroute 192.168.2.10'));
    expect(out).toContain('max. 20 Stationen');
    expect(out).toMatch(/1\s+192\.168\.1\.1/);
    expect(out).toMatch(/2\s+192\.168\.2\.10/);
    expect(out).toContain('Ziel 192.168.2.10 erreicht.');
  });

  it('Router ohne Route meldet Netz nicht erreichbar', () => {
    const { p, a, b } = routedProject();
    a.gateway = '192.168.1.1';
    b.gateway = '';
    const sim = new Simulation(p);
    const out = text(new Terminal(sim, a.id).run('ping 172.16.0.1'));
    expect(out).toContain('Zieladresse nicht erreichbar');
    expect(out).toContain('4 Paket(e) gesendet, 0 Paket(e) empfangen');
  });

  it('Rückweg fehlt (kein Gateway beim Ziel): Timeout', () => {
    const { p, a, b } = routedProject();
    b.gateway = '';
    const sim = new Simulation(p);
    expect(text(new Terminal(sim, a.id).run('ping 192.168.2.10'))).toContain('100% Paketverlust');
  });

  it('statische Route zu einem dritten Netz hinter einem zweiten Router', () => {
    const { p, a, r } = routedProject();
    const r2 = addDevice(p, 'router', { x: 0, y: 0 });
    const c = addDevice(p, 'pc', { x: 0, y: 0 });
    setIp(r2, 0, '192.168.2.2');
    setIp(r2, 1, '10.0.0.1', 8);
    setIp(c, 0, '10.0.0.5', 8);
    c.gateway = '10.0.0.1';
    r2.gateway = '192.168.2.1';
    const s2 = p.devices.find((d) => d.name === 'Switch2')!;
    connect(p, { a: { deviceId: r2.id, interfaceId: r2.interfaces[0]!.id }, b: { deviceId: s2.id } });
    connect(p, { a: { deviceId: r2.id, interfaceId: r2.interfaces[1]!.id }, b: { deviceId: c.id } });
    let sim = new Simulation(p);
    expect(text(new Terminal(sim, a.id).run('ping 10.0.0.5'))).toContain('Zieladresse nicht erreichbar');
    expect(addStaticRoute(p, r.id, '10.1.2.3', '255.0.0.0', '192.168.2.2')).toBeNull();
    expect(r.routes[0]).toEqual({ destination: '10.0.0.0', prefix: 8, nextHop: '192.168.2.2' });
    expect(addStaticRoute(p, r.id, '10.0.0.0', '255.0.0.0', '192.168.2.2')).toBe('duplicate-route');
    sim = new Simulation(p);
    const out = text(new Terminal(sim, a.id).run('ping 10.0.0.5'));
    expect(out).toContain('icmp_seq=2 ttl=62');
    expect(text(new Terminal(sim, r.id).run('route'))).toMatch(
      /\| 10\.0\.0\.0\s+\| 255\.0\.0\.0\s+\| 192\.168\.2\.2/,
    );
    expect(removeStaticRoute(p, r.id, 0)).toBeNull();
    expect(removeStaticRoute(p, r.id, 5)).toBe('unknown-route');
  });

  it('TTL läuft ab: Time Exceeded vom ersten Router', () => {
    const { p, a } = routedProject();
    const sim = new Simulation(p);
    const replies: number[] = [];
    sim.onIcmp(a.id, (packet) => replies.push(packet.icmp.type));
    sim.sendIcmp(a.id, '192.168.2.10', { type: 8, code: 0, identifier: 9, sequence: 1 }, 1);
    sim.scheduler.runAll();
    expect(replies).toEqual([11]);
  });

  it('nicht vorhandener Host hinter dem Router: Host nicht erreichbar (ICMP 3/1)', () => {
    const { p, a } = routedProject();
    const sim = new Simulation(p);
    const out = text(new Terminal(sim, a.id).run('ping 192.168.2.99'));
    // Der Router gibt nach 2 ARP-Versuchen (2 × RTT) auf – später als das Wartefenster des Pings.
    expect(out).toContain('100% Paketverlust');
    sim.scheduler.runAll();
    const unreachable = sim.trace.filter((e) => e.info.includes('ICMP Host Unreachable'));
    expect(unreachable.length).toBeGreaterThan(0);
    expect(unreachable[0]!.start).toBeGreaterThanOrEqual(2 * RTT_MS);
  });
});

describe('Routingtabelle', () => {
  it('enthält lokale, angeschlossene, manuelle und Default-Einträge', () => {
    const { r } = routedProject();
    r.gateway = '192.168.2.254';
    r.routes.push({ destination: '10.0.0.0', prefix: 8, nextHop: '192.168.1.254' });
    r.routes.push({ destination: '172.16.0.0', prefix: 12, nextHop: '8.8.8.8' }); // kein passendes Interface
    const kinds = routingTable(r).map((x) => x.kind);
    expect(kinds).toEqual(['local', 'local', 'connected', 'connected', 'local', 'static', 'default']);
    expect(lookupRoute(r, '10.1.1.1')?.gateway).toBe('192.168.1.254');
    expect(lookupRoute(r, '8.8.8.8')?.kind).toBe('default');
    expect(lookupRoute(r, '192.168.1.1')?.kind).toBe('local');
  });

  it('Befehle help, ipconfig, route und unbekannte Befehle', () => {
    const p = createExampleProject('x', 'now');
    const pc1 = p.devices.find((d) => d.name === 'Rechner1')!;
    pc1.gateway = '192.168.0.1';
    const sim = new Simulation(p);
    const t = new Terminal(sim, pc1.id);
    expect(text(t.run('help'))).toContain('ipconfig');
    const ip = text(t.run('ipconfig'));
    expect(ip).toContain('IP Adresse . . . : 192.168.0.10');
    expect(ip).toContain('Netzmaske. . . . : 255.255.255.0');
    expect(ip).toContain('Standardgateway. : 192.168.0.1');
    expect(text(t.run('route'))).toContain('|      Ziel       |    Netzmaske    |');
    expect(text(t.run('foo'))).toContain('Unbekannter Befehl!');
    expect(t.run('cls').clear).toBe(true);
    expect(t.run('   ').lines).toHaveLength(0);
    const r = addDevice(p, 'router', { x: 0, y: 0 });
    expect(text(new Terminal(new Simulation(p), r.id).run('ipconfig'))).toContain('Gi0/1:');
  });

  it('Switch-Frames gehen nie an den Eingangsport zurück; Tabellen altern', () => {
    const p = createProject('x', 3, 'now');
    const a = addDevice(p, 'pc', { x: 0, y: 0 });
    const b = addDevice(p, 'pc', { x: 0, y: 0 });
    setIp(b, 0, '192.168.0.11');
    const s = addDevice(p, 'switch', { x: 0, y: 0 });
    connect(p, { a: { deviceId: a.id }, b: { deviceId: s.id } });
    connect(p, { a: { deviceId: b.id }, b: { deviceId: s.id } });
    const sim = new Simulation(p);
    new Terminal(sim, a.id).run('ping 192.168.0.11');
    expect(sim.trace.some((e) => e.fromDeviceId === s.id && e.toDeviceId === s.id)).toBe(false);
    expect(sim.macTable(s.id)).toHaveLength(2);
    sim.scheduler.runUntil(sim.now + 300_000);
    expect(sim.macTable(s.id)).toHaveLength(0);
    expect(sim.macTable('nope')).toEqual([]);
    expect(sim.arpTable('nope')).toEqual([]);
    sim.clearArp('nope');
    sim.scheduler.runUntil(sim.now + 4 * 3600_000);
    expect(sim.arpTable(a.id)).toHaveLength(0);
  });
});
