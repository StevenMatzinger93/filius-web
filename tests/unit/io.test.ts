import { describe, expect, it } from 'vitest';
import { addDevice, createProject } from '../../src/engine/model/factory.ts';
import { connect } from '../../src/engine/model/topology.ts';
import { createExampleProject } from '../../src/io/examples.ts';
import { parseProject, serializeProject } from '../../src/io/serialize.ts';
import { translate } from '../../src/i18n/index.ts';
import { deCH } from '../../src/i18n/de-CH.ts';
import { en } from '../../src/i18n/en.ts';
import { EngineHost } from '../../src/worker/host.ts';
import { ENGINE_VERSION } from '../../src/worker/protocol.ts';

describe('Speichern und Laden (JSON-Schema v1)', () => {
  it('liest geschriebene Projekte identisch zurück', () => {
    const project = createExampleProject('Beispiel', '2026-11-19T00:00:00.000Z');
    const r = addDevice(project, 'router', { x: 0, y: 0 });
    r.interfaces[0]!.ipv4 = { address: '192.168.0.1', prefix: 24 };
    const parsed = parseProject(serializeProject(project));
    expect(parsed).toEqual({ ok: true, project });
  });

  it('lehnt kaputte, fremde und zukünftige Dateien mit Begründung ab', () => {
    expect(parseProject('{nicht json')).toEqual({ ok: false, errors: ['Die Datei ist kein gültiges JSON.'] });
    expect(parseProject('{"a":1}')).toEqual({
      ok: false,
      errors: ['Die Datei ist kein Filius-Web-Projekt.'],
    });
    expect(parseProject('null').ok).toBe(false);
    const future = { ...createProject('x', 1, 'now'), version: 99 };
    const r = parseProject(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/neueren Version/);
  });

  it('meldet ungültige Adressen und kaputte Kabel', () => {
    const project = createProject('x', 1, 'now');
    const a = addDevice(project, 'pc', { x: 0, y: 0 });
    const b = addDevice(project, 'pc', { x: 0, y: 0 });
    const s = addDevice(project, 'switch', { x: 0, y: 0 });
    connect(project, { a: { deviceId: a.id }, b: { deviceId: s.id } });
    a.interfaces[0]!.ipv4 = { address: '999.1.1.1', prefix: 24 };
    b.gateway = 'kein';
    project.links.push({
      id: 'bad',
      a: { deviceId: a.id, interfaceId: a.interfaces[0]!.id },
      b: { deviceId: 'x', interfaceId: 'y' },
    });
    const r = parseProject(JSON.stringify(project));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes('IPv4'))).toBe(true);
      expect(r.errors.some((e) => e.includes('Anschluss fehlt'))).toBe(true);
      expect(r.errors.some((e) => e.includes('doppelt'))).toBe(true);
    }
  });

  it('erzeugt ein verbundenes Beispielnetz', () => {
    const p = createExampleProject('Erstes Netz', 'now');
    expect(p.devices.map((d) => d.type)).toEqual(['switch', 'pc', 'pc']);
    expect(p.links).toHaveLength(2);
  });
});

describe('Wörterbuch', () => {
  it('hat in beiden Sprachen dieselben Schlüssel und kein ß', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(deCH).sort());
    for (const text of Object.values(deCH)) expect(text).not.toMatch(/ß/);
  });

  it('setzt Parameter ein', () => {
    expect(translate('de-CH', 'status.devices', { count: 3 })).toBe('3 Geräte');
    expect(translate('en', 'status.devices', { count: 3 })).toBe('3 devices');
    expect(translate('de-CH', 'panel.multi')).toBe('{count} Elemente ausgewählt');
    expect(translate('de-CH', 'panel.multi', {})).toBe('{count} Elemente ausgewählt');
  });
});

describe('Worker-Brücke', () => {
  it('beantwortet hello, load-project und stats', () => {
    const host = new EngineHost();
    expect(host.handle({ id: 1, kind: 'hello' })).toEqual({
      id: 1,
      kind: 'hello',
      engineVersion: ENGINE_VERSION,
    });
    const project = createExampleProject('x', 'now');
    expect(host.handle({ id: 2, kind: 'load-project', project })).toEqual({
      id: 2,
      kind: 'loaded',
      devices: 3,
      links: 2,
    });
    expect(host.handle({ id: 3, kind: 'stats' })).toEqual({ id: 3, kind: 'stats', simTime: 0, events: 0 });
  });
});
