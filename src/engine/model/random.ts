/**
 * Deterministischer Pseudozufallsgenerator (mulberry32).
 * Jedes Projekt hat einen Seed; damit sind MAC-Adressen, TCP-Sequenznummern
 * und ephemere Ports in Tests reproduzierbar.
 */
export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Ganzzahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number;
  /** Aktueller interner Zustand, um den Generator später fortzusetzen. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    state: () => a,
  };
}
