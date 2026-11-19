import { useEffect } from 'react';
import { useT } from '../i18n/index.ts';
import { useProjectStore } from '../store/projectStore.ts';
import type { AutosaveState } from './hooks/usePersistence.ts';

export function StatusBar({
  autosave,
  engineVersion,
}: {
  autosave: AutosaveState;
  engineVersion: string | null;
}) {
  const t = useT();
  const devices = useProjectStore((s) => s.project.devices.length);
  const links = useProjectStore((s) => s.project.links.length);
  const dirty = useProjectStore((s) => s.dirty);
  const notice = useProjectStore((s) => s.notice);
  const setNotice = useProjectStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-gray-300 bg-gray-100 px-3 text-xs text-ink-soft dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      <span>{t('status.devices', { count: devices })}</span>
      <span>{t('status.links', { count: links })}</span>
      <span>{dirty ? t('status.unsaved') : autosave === 'saved' ? t('status.autosaved') : ''}</span>
      <span
        role={notice?.kind === 'error' ? 'alert' : 'status'}
        className={`flex-1 truncate ${notice?.kind === 'error' ? 'font-medium text-danger' : ''}`}
      >
        {notice ? t(notice.key as Parameters<typeof t>[0], notice.params) : ''}
      </span>
      <span>
        {engineVersion ? t('status.engine', { version: engineVersion }) : t('status.engineStarting')}
      </span>
    </footer>
  );
}
