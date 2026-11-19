import { z } from 'zod';
import { isValidIp, isValidMac } from '../engine/model/address.ts';
import {
  DEVICE_TYPES,
  PROJECT_SCHEMA_ID,
  PROJECT_SCHEMA_VERSION,
  type Project,
} from '../engine/model/project.ts';

/** Prüfschema für Projektdateien, Version 1. Beschreibung: docs/DATENMODELL.md. */

const ipString = z.string().refine(isValidIp, { message: 'keine gültige IPv4-Adresse' });
const optionalIp = z
  .string()
  .refine((s) => s === '' || isValidIp(s), { message: 'keine gültige IPv4-Adresse' });

const ipv4Config = z.object({
  address: ipString,
  prefix: z.number().int().min(0).max(32),
});

const interfaceConfig = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mac: z.string().refine(isValidMac, { message: 'keine gültige MAC-Adresse' }),
  enabled: z.boolean(),
  ipv4: ipv4Config.nullable(),
});

const deviceConfig = z.object({
  id: z.string().min(1),
  type: z.enum(DEVICE_TYPES),
  name: z.string().min(1).max(64),
  position: z.object({ x: z.number(), y: z.number() }),
  interfaces: z.array(interfaceConfig),
  gateway: optionalIp,
  dns: optionalIp,
  dhcpClient: z.boolean(),
  note: z.string(),
  // Seit 0.3 – ältere Dateien ohne Routen bleiben gültig (leere Liste).
  routes: z
    .array(
      z.object({
        destination: ipString,
        prefix: z.number().int().min(0).max(32),
        nextHop: ipString,
      }),
    )
    .default([]),
});

const linkEnd = z.object({ deviceId: z.string(), interfaceId: z.string() });

export const projectSchemaV1 = z
  .object({
    schema: z.literal(PROJECT_SCHEMA_ID),
    version: z.literal(PROJECT_SCHEMA_VERSION),
    meta: z.object({ name: z.string(), created: z.string(), modified: z.string() }),
    seed: z.number().int().nonnegative(),
    nextId: z.number().int().positive(),
    devices: z.array(deviceConfig),
    links: z.array(z.object({ id: z.string(), a: linkEnd, b: linkEnd })),
  })
  .superRefine((project, ctx) => {
    // Referenzielle Integrität: Kabel zeigen auf vorhandene Interfaces, jedes Interface höchstens ein Kabel.
    const owner = new Map<string, string>();
    for (const d of project.devices) for (const i of d.interfaces) owner.set(i.id, d.id);
    const used = new Set<string>();
    project.links.forEach((link, index) => {
      for (const end of [link.a, link.b]) {
        if (owner.get(end.interfaceId) !== end.deviceId) {
          ctx.addIssue({
            code: 'custom',
            path: ['links', index],
            message: `Kabel ${link.id}: Anschluss fehlt`,
          });
        } else if (used.has(end.interfaceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['links', index],
            message: `Kabel ${link.id}: Port doppelt belegt`,
          });
        }
        used.add(end.interfaceId);
      }
    });
  });

// Kompilierzeit-Prüfung: Schema und TypeScript-Modell stimmen überein.
type SchemaType = z.infer<typeof projectSchemaV1>;
const sameShape: [SchemaType] extends [Project] ? ([Project] extends [SchemaType] ? true : false) : false =
  true;
void sameShape;
