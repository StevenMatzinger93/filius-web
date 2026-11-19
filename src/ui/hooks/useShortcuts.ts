import { useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { openProjectFromFile, saveProjectToFile } from '../projectFile.ts';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Tastaturkürzel: Entf/Rücktaste löschen, Strg+C/V kopieren/einfügen, Strg+Z rückgängig,
 * Strg+Y oder Strg+Umschalt+Z wiederholen, Strg+S speichern, Strg+O öffnen, K Kabel-Werkzeug, Esc abbrechen.
 */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useProjectStore.getState();
      const ui = useUiStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 's') {
        event.preventDefault();
        saveProjectToFile();
        return;
      }
      if (mod && key === 'o') {
        event.preventDefault();
        void openProjectFromFile();
        return;
      }
      if (isTyping(event.target)) return;

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        store.undo();
      } else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        store.redo();
      } else if (mod && key === 'c') {
        store.copySelection();
      } else if (mod && key === 'v') {
        event.preventDefault();
        store.paste();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.deleteSelection();
      } else if (!mod && key === 'k') {
        ui.toggleCableTool();
      } else if (event.key === 'Escape') {
        if (ui.cableTool) ui.toggleCableTool(false);
        else store.setSelection({ deviceIds: [], linkIds: [] });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
