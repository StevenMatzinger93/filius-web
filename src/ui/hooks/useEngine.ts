import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore.ts';
import { EngineClient } from '../../worker/client.ts';

/** Startet den Simulations-Worker und übergibt ihm das aktuelle Projekt. */
export function useEngine(): { version: string | null } {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let engine: EngineClient;
    try {
      engine = new EngineClient();
    } catch {
      return;
    }
    engine.request({ kind: 'hello' }).then(
      (r) => setVersion(r.engineVersion),
      () => setVersion(null),
    );
    const sync = () =>
      void engine
        .request({ kind: 'load-project', project: useProjectStore.getState().project })
        .catch(() => undefined);
    sync();
    const unsubscribe = useProjectStore.subscribe((s, prev) => {
      if (s.project !== prev.project) sync();
    });
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, []);

  return { version };
}
