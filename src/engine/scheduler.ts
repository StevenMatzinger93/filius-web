/**
 * Diskreter, zeitgesteuerter Event-Loop mit virtueller Zeit in Millisekunden.
 *
 * Ersetzt die Threads des Originals (ein Thread pro Kabelrichtung und Protokoll).
 * Ereignisse mit gleicher Zeit laufen in der Reihenfolge, in der sie geplant wurden
 * (Sequenznummer) – dadurch ist jeder Lauf deterministisch.
 */
export type TaskFn = () => void;

interface Entry {
  time: number;
  seq: number;
  fn: TaskFn;
  cancelled: boolean;
}

export interface TimerHandle {
  cancel(): void;
}

export class Scheduler {
  private heap: Entry[] = [];
  private seq = 0;
  private current = 0;
  private executed = 0;

  /** Aktuelle virtuelle Zeit in ms. */
  get now(): number {
    return this.current;
  }

  /** Anzahl ausgeführter Ereignisse (für Tests und Endlosschleifen-Schutz). */
  get executedCount(): number {
    return this.executed;
  }

  get pending(): number {
    return this.heap.filter((e) => !e.cancelled).length;
  }

  /** Ereignis nach `delay` ms planen. */
  schedule(delay: number, fn: TaskFn): TimerHandle {
    if (!(delay >= 0) || !Number.isFinite(delay)) throw new Error(`Ungültige Verzögerung: ${delay}`);
    const entry: Entry = { time: this.current + delay, seq: this.seq++, fn, cancelled: false };
    this.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      },
    };
  }

  /** Nächstes Ereignis ausführen. Gibt false zurück, wenn nichts mehr ansteht. */
  step(): boolean {
    for (;;) {
      const entry = this.pop();
      if (!entry) return false;
      if (entry.cancelled) continue;
      this.current = entry.time;
      this.executed++;
      entry.fn();
      return true;
    }
  }

  /** Alle Ereignisse bis einschliesslich `until` ausführen; danach steht die Uhr auf `until`. */
  runUntil(until: number, maxEvents = 1_000_000): number {
    let count = 0;
    while (count < maxEvents) {
      const next = this.peekTime();
      if (next === undefined || next > until) break;
      if (this.step()) count++;
    }
    if (count >= maxEvents) throw new Error('Simulation abgebrochen: zu viele Ereignisse (Endlosschleife?)');
    this.current = Math.max(this.current, until);
    return count;
  }

  /** Laufen lassen, bis keine Ereignisse mehr anstehen. */
  runAll(maxEvents = 1_000_000): number {
    let count = 0;
    while (this.step()) {
      if (++count >= maxEvents)
        throw new Error('Simulation abgebrochen: zu viele Ereignisse (Endlosschleife?)');
    }
    return count;
  }

  /** Zeit des nächsten (nicht abgebrochenen) Ereignisses. */
  peekTime(): number | undefined {
    while (this.heap[0]?.cancelled) this.pop();
    return this.heap[0]?.time;
  }

  private less(a: Entry, b: Entry): boolean {
    return a.time < b.time || (a.time === b.time && a.seq < b.seq);
  }

  private push(entry: Entry): void {
    const h = this.heap;
    h.push(entry);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = h[parent] as Entry;
      if (!this.less(entry, p)) break;
      h[i] = p;
      i = parent;
    }
    h[i] = entry;
  }

  private pop(): Entry | undefined {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (top === undefined || last === undefined || h.length === 0) return top;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      let candidate = last;
      const left = h[l];
      const right = h[r];
      if (left && this.less(left, candidate)) {
        smallest = l;
        candidate = left;
      }
      if (right && this.less(right, candidate)) smallest = r;
      if (smallest === i) break;
      h[i] = h[smallest] as Entry;
      i = smallest;
    }
    h[i] = last;
    return top;
  }
}
