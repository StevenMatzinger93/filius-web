import { MAC_OCTET_MAX } from './original.ts';
import type { Rng } from './random.ts';

/** IPv4-Adresse als vorzeichenlose 32-Bit-Zahl. */
export type Ip4 = number;

const OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isValidIp(text: string): boolean {
  const parts = text.trim().split('.');
  return parts.length === 4 && parts.every((p) => OCTET.test(p));
}

export function parseIp(text: string): Ip4 {
  if (!isValidIp(text)) throw new Error(`Ungültige IPv4-Adresse: «${text}»`);
  return text
    .trim()
    .split('.')
    .reduce((acc, p) => ((acc << 8) | Number(p)) >>> 0, 0);
}

export function formatIp(ip: Ip4): string {
  return [ip >>> 24, (ip >>> 16) & 255, (ip >>> 8) & 255, ip & 255].join('.');
}

/** Präfixlänge → Maske (z. B. 24 → 255.255.255.0 als Zahl). */
export function prefixToMask(prefix: number): Ip4 {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32)
    throw new Error(`Ungültige Präfixlänge: ${prefix}`);
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Maske → Präfixlänge; nur zusammenhängende Einsen sind gültig. 0.0.0.0 (/0) liefert 0 – das braucht
 * die Routingtabelle für Default-Routen. Gibt null zurück, wenn die Maske ungültig ist.
 */
export function maskToPrefix(mask: Ip4): number | null {
  const inverted = ~mask >>> 0;
  if ((inverted & (inverted + 1)) !== 0) return null;
  let prefix = 0;
  for (let m = mask; m & 0x80000000; m = (m << 1) >>> 0) prefix++;
  return prefix;
}

/**
 * Subnetzmaske einer Schnittstelle, Regel des Originals (EingabenUeberpruefung @0x0070, Muster
 * «^11*0*$» auf die Binärform): mindestens eine Eins, danach nur Nullen – 0.0.0.0 ist ungültig.
 */
export function isValidMask(text: string): boolean {
  if (!isValidIp(text)) return false;
  const prefix = maskToPrefix(parseIp(text));
  return prefix !== null && prefix >= 1;
}

export function parseMask(text: string): number {
  const prefix = isValidIp(text) ? maskToPrefix(parseIp(text)) : null;
  if (prefix === null) throw new Error(`Ungültige Subnetzmaske: «${text}»`);
  return prefix;
}

export function formatMask(prefix: number): string {
  return formatIp(prefixToMask(prefix));
}

export function networkOf(ip: Ip4, prefix: number): Ip4 {
  return (ip & prefixToMask(prefix)) >>> 0;
}

export function broadcastOf(ip: Ip4, prefix: number): Ip4 {
  return (networkOf(ip, prefix) | (~prefixToMask(prefix) >>> 0)) >>> 0;
}

export function sameSubnet(a: Ip4, b: Ip4, prefix: number): boolean {
  return networkOf(a, prefix) === networkOf(b, prefix);
}

/** CIDR-Schreibweise, z. B. «192.168.10.0/24». */
export function formatCidr(ip: Ip4, prefix: number): string {
  return `${formatIp(ip)}/${prefix}`;
}

// ---------------------------------------------------------------- MAC

const MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
export const BROADCAST_MAC = 'FF:FF:FF:FF:FF:FF';

export function isValidMac(text: string): boolean {
  return MAC.test(text.trim().toUpperCase());
}

export function normalizeMac(text: string): string {
  const mac = text.trim().toUpperCase().replace(/-/g, ':');
  if (!MAC.test(mac)) throw new Error(`Ungültige MAC-Adresse: «${text}»`);
  return mac;
}

/**
 * Neue, eindeutige MAC-Adresse nach der Regel des Originals (Information.holeFreieMACAdresse):
 * sechs Oktette, jedes Random.nextInt(255) = 0 … 254, zweistellig hex. Eine Adresse wird neu gezogen,
 * wenn sie schon vergeben ist oder ff:ff:ff:ff:ff:ff lautet (Information.macPruefen); Letzteres ist
 * wegen Oktett ≤ 254 ohnehin ausgeschlossen. Anzeige in Grossbuchstaben wie NetzwerkInterface.getMac.
 * Einziger Unterschied: Der Zufall kommt aus dem Projekt-Seed statt aus java.util.Random (Determinismus).
 */
export function generateMac(rng: Rng, used: ReadonlySet<string>): string {
  for (;;) {
    const octets = Array.from({ length: 6 }, () => rng.int(0, MAC_OCTET_MAX));
    const mac = octets.map((o) => o.toString(16).padStart(2, '0').toUpperCase()).join(':');
    if (!used.has(mac) && mac !== BROADCAST_MAC) return mac;
  }
}
