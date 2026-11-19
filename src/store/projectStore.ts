import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { create } from 'zustand';
import { addDevice, createProject, pasteDevices } from '../engine/model/factory.ts';
import { translatorFor, useLocale } from '../i18n/index.ts';
import type { DeviceConfig, DeviceType, LinkConfig, Position, Project } from '../engine/model/project.ts';
import {
  connect,
  removeDevices,
  removeLinks,
  type ConnectError,
  type ConnectRequest,
} from '../engine/model/topology.ts';

enablePatches();

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

export interface Selection {
  deviceIds: string[];
  linkIds: string[];
}

export type Notice = { kind: 'info' | 'error'; key: string; params?: Record<string, string | number> } | null;

interface Clipboard {
  devices: DeviceConfig[];
  links: LinkConfig[];
  pasteCount: number;
}

export interface ProjectState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: Selection;
  /** Ungespeicherte Änderungen seit dem letzten Export. */
  dirty: boolean;
  notice: Notice;
  clipboard: Clipboard | null;

  /** Eine rückgängig machbare Änderung am Projekt ausführen. */
  change(label: string, recipe: (draft: Project) => void): void;
  undo(): void;
  redo(): void;
  replaceProject(project: Project, opts?: { dirty?: boolean }): void;
  newProject(name: string): void;
  markSaved(): void;
  setSelection(selection: Selection): void;
  setNotice(notice: Notice): void;

  addDevice(type: DeviceType, position: Position): string;
  moveDevices(moves: { id: string; position: Position }[]): void;
  connectDevices(request: ConnectRequest): { ok: true; linkId: string } | { ok: false; error: ConnectError };
  deleteSelection(): void;
  copySelection(): void;
  paste(): void;
}

export const HISTORY_LIMIT = 200;

const emptySelection: Selection = { deviceIds: [], linkIds: [] };

function nowIso(): string {
  return new Date().toISOString();
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createProject('Neues Netz', 1, nowIso()),
  past: [],
  future: [],
  selection: emptySelection,
  dirty: false,
  notice: null,
  clipboard: null,

  change(label, recipe) {
    const [next, patches, inverse] = produceWithPatches(get().project, recipe);
    if (patches.length === 0) return;
    const past = [...get().past, { label, patches, inverse }].slice(-HISTORY_LIMIT);
    set({ project: next, past, future: [], dirty: true });
  },

  undo() {
    const { past, future, project } = get();
    const entry = past.at(-1);
    if (!entry) return;
    set({
      project: applyPatches(project, entry.inverse),
      past: past.slice(0, -1),
      future: [...future, entry],
      dirty: true,
      selection: emptySelection,
    });
  },

  redo() {
    const { past, future, project } = get();
    const entry = future.at(-1);
    if (!entry) return;
    set({
      project: applyPatches(project, entry.patches),
      past: [...past, entry],
      future: future.slice(0, -1),
      dirty: true,
      selection: emptySelection,
    });
  },

  replaceProject(project, opts) {
    set({ project, past: [], future: [], selection: emptySelection, dirty: opts?.dirty ?? false });
  },

  newProject(name) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    get().replaceProject(createProject(name, seed, nowIso()));
  },

  markSaved() {
    set({ dirty: false });
  },

  setSelection(selection) {
    const current = get().selection;
    const same =
      current.deviceIds.length === selection.deviceIds.length &&
      current.linkIds.length === selection.linkIds.length &&
      current.deviceIds.every((id, i) => id === selection.deviceIds[i]) &&
      current.linkIds.every((id, i) => id === selection.linkIds[i]);
    if (!same) set({ selection });
  },

  setNotice(notice) {
    set({ notice });
  },

  addDevice(type, position) {
    let id = '';
    get().change('add-device', (draft) => {
      // Name wie im Original nach dem Gerätetyp, in der eingestellten Sprache («Rechner1», «Computer1»).
      const prefix = translatorFor(useLocale.getState().locale)(`deviceName.${type}`);
      id = addDevice(draft, type, position, prefix).id;
    });
    set({ selection: { deviceIds: [id], linkIds: [] } });
    return id;
  },

  moveDevices(moves) {
    get().change('move', (draft) => {
      for (const move of moves) {
        const device = draft.devices.find((d) => d.id === move.id);
        if (device) device.position = { x: Math.round(move.position.x), y: Math.round(move.position.y) };
      }
    });
  },

  connectDevices(request) {
    let result: { ok: true; linkId: string } | { ok: false; error: ConnectError } = {
      ok: false,
      error: 'unknown',
    };
    get().change('connect', (draft) => {
      const r = connect(draft, request);
      result =
        r.ok && r.linkId ? { ok: true, linkId: r.linkId } : { ok: false, error: r.ok ? 'unknown' : r.error };
    });
    if (!result.ok) set({ notice: { kind: 'error', key: `connect.${result.error}` } });
    return result;
  },

  deleteSelection() {
    const { deviceIds, linkIds } = get().selection;
    if (deviceIds.length === 0 && linkIds.length === 0) return;
    get().change('delete', (draft) => {
      removeLinks(draft, new Set(linkIds));
      removeDevices(draft, new Set(deviceIds));
    });
    set({ selection: emptySelection });
  },

  copySelection() {
    const { project, selection } = get();
    const ids = new Set(selection.deviceIds);
    if (ids.size === 0) return;
    set({
      clipboard: {
        devices: structuredClone(project.devices.filter((d) => ids.has(d.id))),
        links: structuredClone(project.links.filter((l) => ids.has(l.a.deviceId) && ids.has(l.b.deviceId))),
        pasteCount: 0,
      },
      notice: { kind: 'info', key: 'notice.copied', params: { count: ids.size } },
    });
  },

  paste() {
    const clipboard = get().clipboard;
    if (!clipboard) return;
    const count = clipboard.pasteCount + 1;
    let ids: string[] = [];
    get().change('paste', (draft) => {
      ids = pasteDevices(draft, clipboard.devices, clipboard.links, { x: 40 * count, y: 40 * count });
    });
    set({ clipboard: { ...clipboard, pasteCount: count }, selection: { deviceIds: ids, linkIds: [] } });
  },
}));
