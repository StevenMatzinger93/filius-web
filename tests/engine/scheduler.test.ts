import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/model/random.ts';
import { Scheduler } from '../../src/engine/scheduler.ts';

describe('Zufallsgenerator', () => {
  it('ist deterministisch und bleibt im Bereich', () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA = Array.from({ length: 20 }, () => a.int(1, 6));
    const seqB = Array.from({ length: 20 }, () => b.int(1, 6));
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 1 && n <= 6)).toBe(true);
    expect(createRng(8).next()).not.toBe(createRng(7).next());
    expect(typeof a.state()).toBe('number');
  });
});

describe('Scheduler', () => {
  it('führt Ereignisse nach Zeit und bei Gleichstand in Planungsreihenfolge aus', () => {
    const s = new Scheduler();
    const log: string[] = [];
    s.schedule(50, () => log.push(`b@${s.now}`));
    s.schedule(10, () => log.push(`a@${s.now}`));
    s.schedule(50, () => log.push(`c@${s.now}`));
    s.schedule(0, () => log.push(`z@${s.now}`));
    expect(s.pending).toBe(4);
    s.runAll();
    expect(log).toEqual(['z@0', 'a@10', 'b@50', 'c@50']);
    expect(s.executedCount).toBe(4);
  });

  it('kann Ereignisse aus Ereignissen planen und abbrechen', () => {
    const s = new Scheduler();
    const log: number[] = [];
    const cancelled = s.schedule(30, () => log.push(-1));
    s.schedule(10, () => {
      log.push(s.now);
      s.schedule(5, () => log.push(s.now));
      cancelled.cancel();
    });
    s.runAll();
    expect(log).toEqual([10, 15]);
  });

  it('läuft bis zu einer Zeit und stellt die Uhr nach', () => {
    const s = new Scheduler();
    const log: number[] = [];
    for (const t of [5, 15, 25, 35]) s.schedule(t, () => log.push(t));
    expect(s.runUntil(20)).toBe(2);
    expect(s.now).toBe(20);
    expect(s.peekTime()).toBe(25);
    s.runUntil(100);
    expect(log).toEqual([5, 15, 25, 35]);
    expect(s.now).toBe(100);
    expect(s.step()).toBe(false);
  });

  it('hält mit vielen Ereignissen die Ordnung (Heap)', () => {
    const s = new Scheduler();
    const rng = createRng(3);
    const times: number[] = [];
    for (let i = 0; i < 500; i++) {
      const t = rng.int(0, 1000);
      s.schedule(t, () => times.push(s.now));
    }
    s.runAll();
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('erkennt Endlosschleifen und ungültige Verzögerungen', () => {
    const s = new Scheduler();
    const loop = () => void s.schedule(1, loop);
    s.schedule(0, loop);
    expect(() => s.runAll(100)).toThrow(/Endlosschleife/);
    const u = new Scheduler();
    const again = () => void u.schedule(0, again);
    u.schedule(0, again);
    expect(() => u.runUntil(10, 50)).toThrow(/Endlosschleife/);
    expect(() => s.schedule(-1, () => undefined)).toThrow();
    expect(() => s.schedule(Number.NaN, () => undefined)).toThrow();
  });
});
