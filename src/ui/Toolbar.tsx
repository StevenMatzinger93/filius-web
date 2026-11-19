import type { ReactNode } from 'react';
import { useLocale, useT, type Locale } from '../i18n/index.ts';
import { openProjectFromFile, saveProjectToFile } from './projectFile.ts';
import { useProjectStore } from '../store/projectStore.ts';
import { useUiStore } from '../store/uiStore.ts';

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  new: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6',
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  save: 'M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v6h8M7 21v-7h10v7',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  cable: 'M4 20c4 0 4-16 8-16s4 16 8 16M4 20h0M20 20h0',
  design: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  play: 'M7 4v16l13-8z',
  theme: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
};

function ToolButton(props: {
  label: string;
  shortcut?: string;
  icon: keyof typeof ICONS;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  children?: ReactNode;
}) {
  const title = props.title ?? (props.shortcut ? `${props.label} (${props.shortcut})` : props.label);
  return (
    <button
      type="button"
      className={`btn ${props.active ? 'btn-active' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={title}
      aria-pressed={props.active === undefined ? undefined : props.active}
      aria-keyshortcuts={props.shortcut?.replace(/Strg/g, 'Control')}
    >
      <Icon d={ICONS[props.icon]} />
      <span>{props.label}</span>
      {props.children}
    </button>
  );
}

export function Toolbar() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const dirty = useProjectStore((s) => s.dirty);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const newProject = useProjectStore((s) => s.newProject);
  const change = useProjectStore((s) => s.change);
  const { theme, setTheme, cableTool, toggleCableTool, mode } = useUiStore();

  const onNew = () => {
    if (dirty && !window.confirm(t('dialog.confirmNew'))) return;
    newProject(t('project.defaultName'));
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-gray-300 bg-gradient-to-b from-gray-50 to-gray-200 px-3 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
      <div className="mr-3 flex items-center gap-2">
        <img src="./favicon.svg" alt="" width={28} height={28} />
        <div className="leading-tight">
          <h1 className="text-sm font-bold">{t('app.title')}</h1>
          <input
            aria-label="Projektname"
            className="w-40 rounded border border-transparent bg-transparent px-0.5 text-xs text-ink-soft hover:border-gray-300 focus:border-accent dark:text-gray-400"
            defaultValue={projectName}
            key={projectName}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== projectName) change('rename-project', (d) => void (d.meta.name = name));
            }}
          />
        </div>
      </div>
      <nav aria-label={t('toolbar.fileMenu')} className="flex items-center gap-0.5">
        <ToolButton label={t('toolbar.new')} icon="new" shortcut="Alt+N" onClick={onNew} />
        <ToolButton
          label={t('toolbar.open')}
          icon="open"
          shortcut="Strg+O"
          onClick={() => void openProjectFromFile()}
        />
        <ToolButton label={t('toolbar.save')} icon="save" shortcut="Strg+S" onClick={saveProjectToFile} />
      </nav>
      <span className="mx-2 h-6 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
      <ToolButton
        label={t('toolbar.undo')}
        icon="undo"
        shortcut="Strg+Z"
        onClick={undo}
        disabled={!canUndo}
      />
      <ToolButton
        label={t('toolbar.redo')}
        icon="redo"
        shortcut="Strg+Y"
        onClick={redo}
        disabled={!canRedo}
      />
      <span className="mx-2 h-6 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
      <ToolButton
        label={t('toolbar.cableTool')}
        icon="cable"
        shortcut="K"
        active={cableTool}
        onClick={() => toggleCableTool()}
      />
      <div className="ml-auto flex items-center gap-1">
        <div
          role="group"
          aria-label="Modus"
          className="flex rounded-md border border-gray-300 dark:border-gray-600"
        >
          <ToolButton label={t('toolbar.design')} icon="design" active={mode === 'design'} />
          <ToolButton
            label={t('toolbar.simulation')}
            icon="play"
            active={mode === 'simulation'}
            disabled
            title={t('toolbar.simulationSoon')}
          />
        </div>
        <ToolButton
          label=""
          icon="theme"
          title={t('toolbar.theme')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span className="sr-only">{t('toolbar.theme')}</span>
        </ToolButton>
        <label className="sr-only" htmlFor="locale-select">
          {t('toolbar.language')}
        </label>
        <select
          id="locale-select"
          className="field w-auto py-1"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          <option value="de-CH">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>
    </header>
  );
}
