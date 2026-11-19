import { create } from 'zustand';
import { deCH, type MessageKey, type Messages } from './de-CH.ts';
import { en } from './en.ts';

export type Locale = 'de-CH' | 'en';

const catalogs: Record<Locale, Messages> = { 'de-CH': deCH, en };

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const template = catalogs[locale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

function initialLocale(): Locale {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('filius-web.locale') : null;
  return stored === 'en' ? 'en' : 'de-CH';
}

interface LocaleState {
  locale: Locale;
  setLocale(locale: Locale): void;
}

export const useLocale = create<LocaleState>()((set) => ({
  locale: initialLocale(),
  setLocale(locale) {
    localStorage.setItem('filius-web.locale', locale);
    document.documentElement.lang = locale;
    set({ locale });
  },
}));

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

const translators = new Map<Locale, TFunction>();

/** Stabile Übersetzungsfunktion pro Sprache (gleiche Referenz, solange die Sprache gleich bleibt). */
export function translatorFor(locale: Locale): TFunction {
  let fn = translators.get(locale);
  if (!fn) {
    fn = (key, params) => translate(locale, key, params);
    translators.set(locale, fn);
  }
  return fn;
}

export function useT(): TFunction {
  return translatorFor(useLocale((s) => s.locale));
}

export type { MessageKey };
