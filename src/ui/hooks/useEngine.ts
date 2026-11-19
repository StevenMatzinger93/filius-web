import { useEffect, useState } from 'react';
import { getEngine } from '../../worker/engine.ts';

/** Startet den Simulations-Worker und meldet seine Version für die Statusleiste. */
export function useEngine(): { version: string | null } {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      getEngine()
        .request({ kind: 'hello' })
        .then(
          (r) => {
            if (!cancelled) setVersion(r.engineVersion);
          },
          () => undefined,
        );
    } catch {
      // Ohne Worker-Unterstützung bleibt die Anzeige «startet …».
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { version };
}
