import { describe, expect, it } from 'vitest';
import {
  broadcastOf,
  formatCidr,
  formatIp,
  formatMask,
  generateMac,
  isValidIp,
  isValidMac,
  isValidMask,
  maskToPrefix,
  networkOf,
  normalizeMac,
  parseIp,
  parseMask,
  prefixToMask,
  sameSubnet,
} from '../../src/engine/model/address.ts';
import { createRng } from '../../src/engine/model/random.ts';

describe('IPv4-Adressen', () => {
  it('erkennt gültige und ungültige Adressen', () => {
    expect(isValidIp('192.168.0.10')).toBe(true);
    expect(isValidIp('0.0.0.0')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('256.1.1.1')).toBe(false);
    expect(isValidIp('1.2.3')).toBe(false);
    expect(isValidIp('.1.2.3')).toBe(false); // im Original fälschlich gültig
    expect(isValidIp('01.2.3.4')).toBe(false);
    expect(isValidIp('a.b.c.d')).toBe(false);
  });

  it('wandelt zwischen Text und Zahl', () => {
    expect(parseIp('192.168.10.1')).toBe(0xc0a80a01);
    expect(formatIp(0xc0a80a01)).toBe('192.168.10.1');
    expect(formatIp(parseIp('10.0.20.255'))).toBe('10.0.20.255');
    expect(() => parseIp('300.0.0.1')).toThrow(/Ungültige/);
  });

  it('rechnet Masken und Präfixe um', () => {
    expect(formatIp(prefixToMask(24))).toBe('255.255.255.0');
    expect(prefixToMask(0)).toBe(0);
    expect(prefixToMask(32)).toBe(0xffffffff);
    expect(maskToPrefix(parseIp('255.255.252.0'))).toBe(22);
    expect(maskToPrefix(parseIp('255.0.255.0'))).toBeNull();
    expect(maskToPrefix(0)).toBe(0);
    expect(isValidMask('255.255.255.128')).toBe(true);
    expect(isValidMask('255.255.255.1')).toBe(false);
    expect(isValidMask('nonsense')).toBe(false);
    expect(parseMask('255.255.255.0')).toBe(24);
    expect(() => parseMask('255.0.255.0')).toThrow(/Subnetzmaske/);
    expect(formatMask(16)).toBe('255.255.0.0');
    expect(() => prefixToMask(33)).toThrow();
  });

  it('bestimmt Netz, Broadcast und gleiches Subnetz', () => {
    const ip = parseIp('192.168.10.77');
    expect(formatIp(networkOf(ip, 24))).toBe('192.168.10.0');
    expect(formatIp(broadcastOf(ip, 24))).toBe('192.168.10.255');
    expect(formatIp(broadcastOf(ip, 30))).toBe('192.168.10.79');
    expect(sameSubnet(ip, parseIp('192.168.10.1'), 24)).toBe(true);
    expect(sameSubnet(ip, parseIp('192.168.20.1'), 24)).toBe(false);
    expect(formatCidr(networkOf(ip, 24), 24)).toBe('192.168.10.0/24');
  });
});

describe('MAC-Adressen', () => {
  it('prüft und normalisiert', () => {
    expect(isValidMac('aa:bb:cc:dd:ee:ff')).toBe(true);
    expect(isValidMac('GG:BB:CC:DD:EE:FF')).toBe(false); // im Original fälschlich gültig
    expect(normalizeMac('aa-bb-cc-dd-ee-0f')).toBe('AA:BB:CC:DD:EE:0F');
    expect(() => normalizeMac('xyz')).toThrow(/MAC/);
  });

  it('erzeugt eindeutige, lokal verwaltete Unicast-Adressen, reproduzierbar mit Seed', () => {
    const used = new Set<string>();
    const a = generateMac(createRng(42), used);
    const b = generateMac(createRng(42), used);
    expect(a).toBe(b);
    expect(a.startsWith('02:')).toBe(true);
    used.add(a);
    const c = generateMac(createRng(42), used);
    expect(c).not.toBe(a);
    expect(isValidMac(c)).toBe(true);
  });
});
