import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../src/engine/model/factory.ts';
import { HISTORY_LIMIT, useProjectStore } from '../../src/store/projectStore.ts';

const store = () => useProjectStore.getState();

beforeEach(() => {
  store().replaceProject(createProject('Test', 9, '2026-11-19T00:00:00.000Z'));
  useProjectStore.setState({ clipboard: null, notice: null });
});

describe('Projekt-Store mit Undo/Redo', () => {
  it('macht Hinzufügen, Verbinden und Löschen rückgängig und wiederholt sie', () => {
    const pc = store().addDevice('pc', { x: 0, y: 0 });
    const sw = store().addDevice('switch', { x: 200, y: 0 });
    const result = store().connectDevices({ a: { deviceId: pc }, b: { deviceId: sw } });
    expect(result.ok).toBe(true);
    expect(store().project.links).toHaveLength(1);
    expect(store().dirty).toBe(true);

    store().setSelection({ deviceIds: [sw], linkIds: [] });
    store().deleteSelection();
    expect(store().project.devices).toHaveLength(1);
    expect(store().project.links).toHaveLength(0);

    store().undo();
    expect(store().project.devices).toHaveLength(2);
    expect(store().project.links).toHaveLength(1);
    store().undo();
    store().undo();
    store().undo();
    expect(store().project.devices).toHaveLength(0);
    store().undo(); // nichts mehr da
    expect(store().past).toHaveLength(0);

    store().redo();
    store().redo();
    store().redo();
    expect(store().project.links).toHaveLength(1);
    store().redo();
    expect(store().project.devices).toHaveLength(1);
    store().redo(); // nichts mehr da
    expect(store().future).toHaveLength(0);
  });

  it('verwirft die Redo-Liste bei neuer Änderung und ignoriert Änderungen ohne Wirkung', () => {
    store().addDevice('pc', { x: 0, y: 0 });
    store().undo();
    expect(store().future).toHaveLength(1);
    store().addDevice('router', { x: 0, y: 0 });
    expect(store().future).toHaveLength(0);
    const before = store().past.length;
    store().change('noop', () => undefined);
    expect(store().past.length).toBe(before);
  });

  it('meldet Fehler beim Verbinden', () => {
    const pc = store().addDevice('pc', { x: 0, y: 0 });
    const result = store().connectDevices({ a: { deviceId: pc }, b: { deviceId: pc } });
    expect(result).toEqual({ ok: false, error: 'same-device' });
    expect(store().notice).toEqual({ kind: 'error', key: 'connect.same-device' });
  });

  it('verschiebt Geräte in einem Schritt', () => {
    const a = store().addDevice('pc', { x: 0, y: 0 });
    const b = store().addDevice('pc', { x: 0, y: 0 });
    store().moveDevices([
      { id: a, position: { x: 100.2, y: 40 } },
      { id: b, position: { x: 300, y: 40.7 } },
      { id: 'unbekannt', position: { x: 1, y: 1 } },
    ]);
    expect(store().project.devices.map((d) => d.position)).toEqual([
      { x: 100, y: 40 },
      { x: 300, y: 41 },
    ]);
    store().undo();
    expect(store().project.devices.every((d) => d.position.x === 0)).toBe(true);
  });

  it('kopiert und fügt mehrfach versetzt ein', () => {
    const a = store().addDevice('pc', { x: 0, y: 0 });
    store().paste(); // leere Zwischenablage
    store().setSelection({ deviceIds: [], linkIds: [] });
    store().copySelection(); // nichts ausgewählt
    expect(store().clipboard).toBeNull();
    store().setSelection({ deviceIds: [a], linkIds: [] });
    store().copySelection();
    store().paste();
    store().paste();
    const positions = store().project.devices.map((d) => d.position.x);
    expect(positions).toEqual([0, 40, 80]);
    expect(store().selection.deviceIds).toHaveLength(1);
  });

  it('begrenzt die History und setzt Auswahl nur bei Änderung', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) store().change('n', (d) => void (d.meta.name = `n${i}`));
    expect(store().past).toHaveLength(HISTORY_LIMIT);
    const sel = { deviceIds: ['x'], linkIds: [] };
    store().setSelection(sel);
    const first = store().selection;
    store().setSelection({ deviceIds: ['x'], linkIds: [] });
    expect(store().selection).toBe(first);
    store().deleteSelection(); // unbekannte id: Projekt unverändert
    store().setSelection({ deviceIds: [], linkIds: [] });
    store().deleteSelection();
  });

  it('startet neue Projekte und merkt sich den Speicherstand', () => {
    store().addDevice('pc', { x: 0, y: 0 });
    store().markSaved();
    expect(store().dirty).toBe(false);
    store().newProject('Leer');
    expect(store().project.devices).toHaveLength(0);
    expect(store().project.meta.name).toBe('Leer');
    expect(store().past).toHaveLength(0);
    store().setNotice({ kind: 'info', key: 'x' });
    expect(store().notice?.key).toBe('x');
  });
});
