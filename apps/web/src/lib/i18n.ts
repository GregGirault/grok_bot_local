import { FR } from './i18nFr';
import { EN } from './i18nEn';
import type { Presence } from '@grok-bot/shared';

export type Lang = 'fr' | 'en';

const DICT = { fr: FR, en: EN };

export type I18nKey = keyof typeof DICT.fr;

export function t(lang: Lang, key: I18nKey): string {
  return DICT[lang][key] || DICT.fr[key];
}

export function loadLang(): Lang {
  const v = localStorage.getItem('gb-lang');
  if (v === 'en' || v === 'fr') return v;
  return 'fr';
}

export function saveLang(lang: Lang): void {
  localStorage.setItem('gb-lang', lang);
}

export function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  localStorage.setItem('gb-theme', theme);
  let resolved: 'dark' | 'light' = theme === 'system' ? 'dark' : theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}

export function applyAccent(color: string): void {
  localStorage.setItem('gb-accent', color);
  document.documentElement.style.setProperty('--gb-accent', color);
}

export function initChromePrefs(): { theme: 'dark' | 'light' | 'system'; lang: Lang; accent: string } {
  const theme = (localStorage.getItem('gb-theme') as 'dark' | 'light' | 'system') || 'dark';
  const lang = loadLang();
  const accent = localStorage.getItem('gb-accent') || '#FF6A00';
  applyTheme(theme);
  applyAccent(accent);
  return { theme, lang, accent };
}

export function formatTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return lang === 'fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' });
}

export function presenceLabel(lang: Lang, p: Presence): string {
  switch (p) {
    case 'thinking':
      return t(lang, 'thinking');
    case 'working':
      return t(lang, 'working');
    case 'waiting':
      return t(lang, 'waiting');
    case 'blocked':
      return t(lang, 'blocked');
    case 'done':
      return t(lang, 'done');
    case 'idle':
      return t(lang, 'idle');
    default: {
      const _n: never = p;
      void _n;
      return t(lang, 'idle');
    }
  }
}
