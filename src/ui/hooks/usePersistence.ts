import { useEffect, useState } from 'react';
import { createExampleProject } from '../../io/examples.ts';
import { parseProject } from '../../io/serialize.ts';
import { loadAutosave, saveAutosave } from '../../io/storage.ts';
import { translatorFor, useLocale } from '../../i18n/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Lädt beim Start den letzten automatisch gespeicherten Stand (oder ein kleines Beispielnetz)
 * und speichert danach jede Änderung verzögert in IndexedDB.
 */
export function usePersistence(): AutosaveState {
  const [state, setState] = useState<AutosaveState>('idle');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = useProjectStore.getState();
      const t = translatorFor(useLocale.getState().locale);
      try {
        const text = await loadAutosave();
        const parsed = text ? parseProject(text) : null;
        if (!cancelled && parsed?.ok) {
          store.replaceProject(parsed.project);
          store.setNotice({ kind: 'info', key: 'notice.restored' });
        } else if (!cancelled) {
          store.replaceProject(createExampleProject(t('project.exampleName'), new Date().toISOString()));
        }
      } catch {
        if (!cancelled)
          store.replaceProject(createExampleProject(t('project.exampleName'), new Date().toISOString()));
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useProjectStore.subscribe((s, prev) => {
      if (s.project === prev.project) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        setState('saving');
        saveAutosave(useProjectStore.getState().project).then(
          () => setState('saved'),
          () => setState('error'),
        );
      }, 600);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [ready]);

  return state;
}
