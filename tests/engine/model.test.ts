import { describe, expect, it } from 'vitest';
import { DEVICE_CATALOG, isEndDevice, portsCarryIp, specOf } from '../../src/engine/model/catalog.ts';
import {
  renameDevice,
  setDhcpClient,
  setDns,
  setGateway,
  setInterfaceEnabled,
  setInterfaceIp,
  setInterfaceMac,
  setNote,
} from '../../src/engine/model/edit.ts';
import {
  addDevice,
  createProject,
  isOptionalIp,
  pasteDevices,
  suggestHostIp,
  uniqueName,
} from '../../src/engine/model/factory.ts';
import { DEVICE_TYPES, type Project } from '../../src/engine/model/project.ts';
import {
  connect,
  findInterface,
  firstFreeInterface,
  linkAt,
  movePort,
  planConnection,
  removeDevices,
  removeLinks,
} from '../../src/engine/model/topology.ts';

const NOW = '2026-11-19T00:00:00.000Z';
const fresh = (): Project => createProject('Test', 123, NOW);

describe('Gerätekatalog', () => {
  it('beschreibt jeden Gerätetyp', () => {
    for (const type of DEVICE_TYPES) {
      const spec = specOf(type);
      expect(spec.type).toBe(type);
      expect(spec.ports.length).toBeGreaterThan(0);
      expect(new Set(spec.ports).size).toBe(spec.ports.length);
    }
    expect(DEVICE_CATALOG.switch.ports).toHaveLength(24); // wie Switch.<init> im Original
    expect(DEVICE_CATALOG.gateway.ports).toEqual(['WAN', 'LAN']);
    expect(portsCarryIp('switch')).toBe(false);
    expect(portsCarryIp('router')).toBe(true);
    expect(isEndDevice('server')).toBe(true);
    expect(isEndDevice('l3switch')).toBe(false);
  });
});

describe('Geräte anlegen', () => {
  it('vergibt Namen, ids, MACs und Standardadressen', () => {
    const p = fresh();
    const pc1 = addDevice(p, 'pc', { x: 10.4, y: 20.6 });
    const pc2 = addDevice(p, 'pc', { x: 0, y: 0 });
    const sw = addDevice(p, 'switch', { x: 0, y: 0 });
    expect(pc1.name).toBe('PC1');
    expect(pc2.name).toBe('PC2');
    expect(sw.name).toBe('Switch1');
    expect(pc1.position).toEqual({ x: 10, y: 21 });
    expect(pc1.interfaces[0]?.ipv4).toEqual({ address: '192.168.0.10', prefix: 24 });
    expect(pc2.interfaces[0]?.ipv4?.address).toBe('192.168.0.11');
    expect(sw.interfaces.every((i) => i.ipv4 === null)).toBe(true);
    const macs = p.devices.flatMap((d) => d.interfaces.map((i) => i.mac));
    expect(new Set(macs).size).toBe(macs.length);
    expect(new Set(p.devices.flatMap((d) => [d.id, ...d.interfaces.map((i) => i.id)])).size).toBe(
      3 + 1 + 1 + 24,
    );
  });

  it('ist bei gleichem Seed reproduzierbar', () => {
    const a = fresh();
    const b = fresh();
    addDevice(a, 'router', { x: 0, y: 0 });
    addDevice(b, 'router', { x: 0, y: 0 });
    expect(a).toEqual(b);
  });

  it('setzt die Gateway-Standardwerte aus dem Original', () => {
    const p = fresh();
    const gw = addDevice(p, 'gateway', { x: 0, y: 0 });
    expect(gw.interfaces[0]?.ipv4).toEqual({ address: '42.0.0.10', prefix: 8 });
    expect(gw.interfaces[1]?.ipv4).toEqual({ address: '192.168.0.1', prefix: 24 });
  });

  it('findet freie Namen und Adressen', () => {
    const p = fresh();
    addDevice(p, 'pc', { x: 0, y: 0 });
    const d = p.devices[0];
    if (d) d.name = 'pc2';
    expect(uniqueName(p, 'PC')).toBe('PC1');
    addDevice(p, 'pc', { x: 0, y: 0 });
    expect(uniqueName(p, 'PC')).toBe('PC3');
    for (const dev of p.devices)
      for (const i of dev.interfaces) i.ipv4 = { address: '192.168.0.10', prefix: 24 };
    expect(suggestHostIp(p)).toBe('192.168.0.11');
    for (let host = 10; host < 255; host++)
      p.devices[0]!.interfaces.push({
        id: `x${host}`,
        name: 'x',
        mac: '02:00:00:00:00:00',
        enabled: true,
        ipv4: { address: `192.168.0.${host}`, prefix: 24 },
      });
    expect(suggestHostIp(p)).toBe('192.168.0.10');
    expect(isOptionalIp('')).toBe(true);
    expect(isOptionalIp('1.2.3.4')).toBe(true);
    expect(isOptionalIp('x')).toBe(false);
  });

  it('fügt Kopien mit neuen ids, Namen, MACs und internen Kabeln ein', () => {
    const p = fresh();
    const a = addDevice(p, 'pc', { x: 0, y: 0 });
    const s = addDevice(p, 'switch', { x: 100, y: 0 });
    connect(p, { a: { deviceId: a.id }, b: { deviceId: s.id } });
    const ids = pasteDevices(p, [a, s], p.links, { x: 40, y: 40 });
    expect(ids).toHaveLength(2);
    expect(p.devices).toHaveLength(4);
    expect(p.links).toHaveLength(2);
    const copy = p.devices.find((d) => d.id === ids[0]);
    expect(copy?.name).toBe('PC2');
    expect(copy?.position).toEqual({ x: 40, y: 40 });
    expect(copy?.interfaces[0]?.mac).not.toBe(a.interfaces[0]?.mac);
    // Kabel, deren Gegenstelle nicht kopiert wurde, werden nicht kopiert
    pasteDevices(p, [a], p.links, { x: 80, y: 80 });
    expect(p.links).toHaveLength(2);
  });
});

describe('Verkabelung', () => {
  it('verbindet über freie Ports und lehnt Doppelverbindungen ab', () => {
    const p = fresh();
    const a = addDevice(p, 'pc', { x: 0, y: 0 });
    const b = addDevice(p, 'pc', { x: 0, y: 0 });
    const s = addDevice(p, 'switch', { x: 0, y: 0 });
    const r1 = connect(p, { a: { deviceId: a.id }, b: { deviceId: s.id } });
    expect(r1.ok).toBe(true);
    expect(linkAt(p, a.interfaces[0]!.id)?.id).toBe(r1.linkId);
    expect(findInterface(p, { deviceId: s.id, interfaceId: s.interfaces[0]!.id })?.name).toBe('Gi0/1');
    expect(planConnection(p, { a: { deviceId: a.id }, b: { deviceId: s.id } })).toEqual({
      ok: false,
      error: 'already-connected',
    });
    expect(planConnection(p, { a: { deviceId: a.id }, b: { deviceId: a.id } })).toEqual({
      ok: false,
      error: 'same-device',
    });
    expect(planConnection(p, { a: { deviceId: a.id }, b: { deviceId: b.id } })).toEqual({
      ok: false,
      error: 'no-free-port',
    });
    expect(planConnection(p, { a: { deviceId: 'nope' }, b: { deviceId: b.id } })).toEqual({
      ok: false,
      error: 'unknown',
    });
    const r2 = connect(p, { a: { deviceId: b.id }, b: { deviceId: s.id } });
    expect(r2.ok && r2.b.interfaceId).toBe(s.interfaces[1]!.id);
    expect(firstFreeInterface(p, s)?.name).toBe('Gi0/3');
  });

  it('erlaubt mit Portangabe mehrere Kabel und erkennt belegte Ports', () => {
    const p = fresh();
    const s1 = addDevice(p, 'switch', { x: 0, y: 0 });
    const s2 = addDevice(p, 'switch', { x: 0, y: 0 });
    connect(p, { a: { deviceId: s1.id }, b: { deviceId: s2.id } });
    const second = connect(p, {
      a: { deviceId: s1.id, interfaceId: s1.interfaces[1]!.id },
      b: { deviceId: s2.id, interfaceId: s2.interfaces[1]!.id },
    });
    expect(second.ok).toBe(true);
    expect(
      planConnection(p, {
        a: { deviceId: s1.id, interfaceId: s1.interfaces[0]!.id },
        b: { deviceId: s2.id, interfaceId: s2.interfaces[5]!.id },
      }),
    ).toEqual({ ok: false, error: 'port-in-use' });
    expect(
      planConnection(p, {
        a: { deviceId: s1.id, interfaceId: 'missing' },
        b: { deviceId: s2.id, interfaceId: s2.interfaces[5]!.id },
      }),
    ).toEqual({ ok: false, error: 'unknown' });
    const blocked = connect(p, { a: { deviceId: s1.id }, b: { deviceId: s2.id } });
    expect(blocked.ok).toBe(false);
  });

  it('steckt um und löscht Geräte samt Kabeln', () => {
    const p = fresh();
    const a = addDevice(p, 'pc', { x: 0, y: 0 });
    const b = addDevice(p, 'pc', { x: 0, y: 0 });
    const s = addDevice(p, 'switch', { x: 0, y: 0 });
    const l1 = connect(p, { a: { deviceId: a.id }, b: { deviceId: s.id } });
    const l2 = connect(p, { a: { deviceId: b.id }, b: { deviceId: s.id } });
    expect(movePort(p, l1.linkId!, 'b', s.interfaces[10]!.id)).toBe(true);
    expect(p.links[0]?.b.interfaceId).toBe(s.interfaces[10]!.id);
    expect(movePort(p, l1.linkId!, 'b', s.interfaces[1]!.id)).toBe(false); // von l2 belegt
    expect(movePort(p, l1.linkId!, 'b', a.interfaces[0]!.id)).toBe(false); // anderes Gerät
    expect(movePort(p, 'nope', 'a', 'x')).toBe(false);
    removeLinks(p, new Set([l2.linkId!]));
    expect(p.links).toHaveLength(1);
    removeDevices(p, new Set([s.id]));
    expect(p.devices).toHaveLength(2);
    expect(p.links).toHaveLength(0);
  });
});

describe('Konfiguration bearbeiten', () => {
  it('prüft Eingaben und ändert nur bei gültigen Werten', () => {
    const p = fresh();
    const pc = addDevice(p, 'pc', { x: 0, y: 0 });
    const other = addDevice(p, 'pc', { x: 0, y: 0 });
    const iface = pc.interfaces[0]!;
    expect(renameDevice(p, pc.id, '  Labor-PC  ')).toBeNull();
    expect(pc.name).toBe('Labor-PC');
    expect(renameDevice(p, pc.id, '   ')).toBe('invalid-name');
    expect(renameDevice(p, 'x', 'a')).toBe('unknown-device');
    expect(setInterfaceIp(p, pc.id, iface.id, '10.0.10.5', '255.255.255.0')).toBeNull();
    expect(iface.ipv4).toEqual({ address: '10.0.10.5', prefix: 24 });
    expect(setInterfaceIp(p, pc.id, iface.id, '10.0.10.500', '255.255.255.0')).toBe('invalid-ip');
    expect(setInterfaceIp(p, pc.id, iface.id, '10.0.10.5', '255.0.255.0')).toBe('invalid-mask');
    expect(setInterfaceIp(p, pc.id, 'nope', '1.1.1.1', '255.0.0.0')).toBe('unknown-interface');
    expect(setInterfaceIp(p, 'nope', 'nope', '1.1.1.1', '255.0.0.0')).toBe('unknown-device');
    expect(setInterfaceIp(p, pc.id, iface.id, '', '')).toBeNull();
    expect(iface.ipv4).toBeNull();
    expect(setInterfaceMac(p, pc.id, iface.id, 'aa:bb:cc:dd:ee:01')).toBeNull();
    expect(iface.mac).toBe('AA:BB:CC:DD:EE:01');
    expect(setInterfaceMac(p, other.id, other.interfaces[0]!.id, 'AA:BB:CC:DD:EE:01')).toBe('duplicate-mac');
    expect(setInterfaceMac(p, pc.id, iface.id, 'zz')).toBe('invalid-mac');
    expect(setInterfaceMac(p, pc.id, 'nope', 'AA:BB:CC:DD:EE:02')).toBe('unknown-interface');
    expect(setInterfaceEnabled(p, pc.id, iface.id, false)).toBeNull();
    expect(iface.enabled).toBe(false);
    expect(setInterfaceEnabled(p, pc.id, 'nope', true)).toBe('unknown-interface');
    expect(setGateway(p, pc.id, '10.0.10.1')).toBeNull();
    expect(pc.gateway).toBe('10.0.10.1');
    expect(setGateway(p, pc.id, 'x')).toBe('invalid-ip');
    expect(setGateway(p, 'nope', '')).toBe('unknown-device');
    expect(setDns(p, pc.id, ' 10.0.10.53 ')).toBeNull();
    expect(pc.dns).toBe('10.0.10.53');
    expect(setDns(p, pc.id, '1.2.3')).toBe('invalid-ip');
    expect(setDns(p, 'nope', '')).toBe('unknown-device');
    expect(setDhcpClient(p, pc.id, true)).toBeNull();
    expect(pc.dhcpClient).toBe(true);
    expect(setDhcpClient(p, 'nope', true)).toBe('unknown-device');
    expect(setNote(p, pc.id, 'Raum 12')).toBeNull();
    expect(pc.note).toBe('Raum 12');
    expect(setNote(p, 'nope', '')).toBe('unknown-device');
  });
});
