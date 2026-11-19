import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Mode = 'design' | 'simulation';

interface UiState {
  theme: Theme;
  mode: Mode;
  /** Kabel-Werkzeug wie im Original: erstes Gerät anklicken, dann das zweite. */
  cableTool: boolean;
  cableFrom: string | null;
  setTheme(theme: Theme): void;
  toggleCableTool(on?: boolean): void;
  setCableFrom(id: string | null): void;
}

function initialTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  const stored = localStorage.getItem('filius-web.theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useUiStore = create<UiState>()((set, get) => ({
  theme: initialTheme(),
  mode: 'design',
  cableTool: false,
  cableFrom: null,
  setTheme(theme) {
    localStorage.setItem('filius-web.theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleCableTool(on) {
    const next = on ?? !get().cableTool;
    set({ cableTool: next, cableFrom: null });
  },
  setCableFrom(id) {
    set({ cableFrom: id });
  },
}));
