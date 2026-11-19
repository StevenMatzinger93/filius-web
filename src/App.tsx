import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { useLocale } from './i18n/index.ts';
import { applyTheme, useUiStore } from './store/uiStore.ts';
import { NetworkCanvas } from './ui/canvas/NetworkCanvas.tsx';
import { useEngine } from './ui/hooks/useEngine.ts';
import { usePersistence } from './ui/hooks/usePersistence.ts';
import { useShortcuts } from './ui/hooks/useShortcuts.ts';
import { DevicePalette } from './ui/palette/DevicePalette.tsx';
import { PropertiesPanel } from './ui/panels/PropertiesPanel.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { Toolbar } from './ui/Toolbar.tsx';

export function App() {
  const theme = useUiStore((s) => s.theme);
  const locale = useLocale((s) => s.locale);
  const autosave = usePersistence();
  const { version } = useEngine();
  useShortcuts();

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <DevicePalette />
          <main className="min-w-0 flex-1">
            <NetworkCanvas />
          </main>
          <PropertiesPanel />
        </div>
        <StatusBar autosave={autosave} engineVersion={version} />
      </div>
    </ReactFlowProvider>
  );
}
