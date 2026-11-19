import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { specOf } from '../../engine/model/catalog.ts';
import type { DeviceConfig } from '../../engine/model/project.ts';
import { useT } from '../../i18n/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import { useSimStore } from '../../store/simStore.ts';
import { DeviceIcon } from '../icons/DeviceIcon.tsx';

const EMPTY: string[] = [];

/** Befehlszeile eines Geräts (Original: Anwendung «Befehlszeile» auf dem Desktop). */
function TerminalView({ device }: { device: DeviceConfig }) {
  const t = useT();
  const lines = useSimStore((s) => s.terminals[device.id]?.lines ?? EMPTY);
  const busy = useSimStore((s) => s.terminals[device.id]?.busy ?? false);
  const history = useSimStore((s) => s.terminals[device.id]?.history ?? EMPTY);
  const runCommand = useSimStore((s) => s.runCommand);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [lines]);
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, device.id]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !busy) {
      void runCommand(device.id, input);
      setInput('');
      setHistoryIndex(null);
    } else if (event.key === 'ArrowUp' && history.length > 0) {
      event.preventDefault();
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next] ?? '');
    } else if (event.key === 'ArrowDown' && historyIndex !== null) {
      event.preventDefault();
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next] ?? '');
      }
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('sim.terminal')}>
      <h3 className="panel-heading">{t('sim.terminal')}</h3>
      <div
        ref={outputRef}
        data-testid="terminal-output"
        role="log"
        aria-live="polite"
        className="min-h-48 flex-1 overflow-auto rounded-t-md bg-gray-950 p-2 font-mono text-[11px] leading-snug whitespace-pre text-green-300"
      >
        {lines.length === 0 ? (
          <span className="text-gray-500">{t('sim.terminalHint')}</span>
        ) : (
          lines.join('\n')
        )}
      </div>
      <div className="flex items-center rounded-b-md bg-gray-900 px-2 py-1 font-mono text-[11px] text-green-300">
        <span aria-hidden="true">{device.name}&gt;&nbsp;</span>
        <input
          ref={inputRef}
          data-testid="terminal-input"
          aria-label={t('sim.commandInput')}
          className="flex-1 bg-transparent outline-none disabled:opacity-50"
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          placeholder={busy ? t('sim.running') : 'ping 192.168.0.11'}
        />
      </div>
    </section>
  );
}

/** MAC-Tabelle eines Switches (Original: «SAT Tabelle» – MAC, Port, letzte Aktualisierung). */
function MacTableView({ device }: { device: DeviceConfig }) {
  const t = useT();
  const entries = useSimStore((s) => s.macTables[device.id]);
  const loadMacTable = useSimStore((s) => s.loadMacTable);
  useEffect(() => {
    void loadMacTable(device.id);
  }, [device.id, loadMacTable]);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="panel-heading mb-0">{t('sim.macTable')}</h3>
        <button type="button" className="btn text-xs" onClick={() => void loadMacTable(device.id)}>
          {t('sim.refresh')}
        </button>
      </div>
      <table className="w-full font-mono text-xs" data-testid="mac-table">
        <thead>
          <tr className="text-left font-sans text-ink-soft dark:text-gray-400">
            <th className="py-0.5 font-medium">MAC</th>
            <th className="py-0.5 font-medium">{t('panel.port')}</th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((e) => (
            <tr key={e.mac} className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-0.5">{e.mac}</td>
              <td className="py-0.5">{e.port}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries && entries.length === 0 && (
        <p className="mt-2 text-xs text-ink-soft dark:text-gray-400">{t('sim.macTableEmpty')}</p>
      )}
    </section>
  );
}

export function SimulationPanel() {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const speed = useSimStore((s) => s.speed);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const device =
    selection.deviceIds.length === 1
      ? project.devices.find((d) => d.id === selection.deviceIds[0])
      : undefined;
  const role = device ? specOf(device.type).role : null;

  return (
    <aside
      aria-label={t('sim.panel')}
      className="flex h-full w-96 shrink-0 flex-col border-l border-gray-200 bg-surface dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <h2 className="text-sm font-semibold">{t('sim.panel')}</h2>
        <label className="flex items-center gap-1 text-xs">
          {t('sim.speed')}
          <select
            className="field w-auto py-0.5 text-xs"
            value={speed}
            onChange={(e) => setSpeed(e.target.value as typeof speed)}
            data-testid="sim-speed"
          >
            <option value="slow">{t('sim.speedSlow')}</option>
            <option value="normal">{t('sim.speedNormal')}</option>
            <option value="fast">{t('sim.speedFast')}</option>
          </select>
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {!device ? (
          <p className="text-sm text-ink-soft dark:text-gray-400">{t('sim.selectDevice')}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <DeviceIcon type={device.type} size={36} />
              <div>
                <div className="text-sm font-semibold">{device.name}</div>
                <div className="text-xs text-ink-soft dark:text-gray-400">{t(`device.${device.type}`)}</div>
              </div>
            </div>
            {role === 'switch' || role === 'l3switch' ? (
              <MacTableView key={device.id} device={device} />
            ) : (
              <TerminalView key={device.id} device={device} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
