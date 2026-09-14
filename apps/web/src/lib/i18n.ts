export type Lang = 'en' | 'fr';

const DICT = {
  en: {
    agents: 'Agents',
    channels: 'Channels',
    memory: 'Memory',
    routines: 'Routines',
    skills: 'Skills',
    projects: 'Projects',
    settings: 'Settings',
    account: 'Account · Settings',
    hiddenChats: 'Hidden chats',
    none: 'None',
    newAgent: '+ New',
    online: 'Online',
    ollamaOffline: 'Ollama offline',
    general: 'General',
    computer: 'Computer',
    connection: 'Connection',
    tasks: 'Tasks',
    updates: 'Updates',
    connectors: 'Connectors',
    theme: 'Theme',
    language: 'Language',
    accent: 'Accent color',
    send: 'Send',
    clear: 'Clear',
    inbox: 'Inbox',
    hide: 'Hide',
    unhide: 'Restore',
    delete: 'Delete…',
    openChat: 'Open chat',
    typing: 'typing',
  },
  fr: {
    agents: 'Agents',
    channels: 'Canaux',
    memory: 'Mémoire',
    routines: 'Routines',
    skills: 'Compétences',
    projects: 'Projets',
    settings: 'Réglages',
    account: 'Compte · Réglages',
    hiddenChats: 'Chats masqués',
    none: 'Aucun',
    newAgent: '+ Nouveau',
    online: 'En ligne',
    ollamaOffline: 'Ollama hors ligne',
    general: 'Général',
    computer: 'Ordinateur',
    connection: 'Connexion',
    tasks: 'Tâches',
    updates: 'Mises à jour',
    connectors: 'Connecteurs',
    theme: 'Thème',
    language: 'Langue',
    accent: 'Couleur d’accent',
    send: 'Envoyer',
    clear: 'Effacer',
    inbox: 'Boîte',
    hide: 'Masquer',
    unhide: 'Restaurer',
    delete: 'Supprimer…',
    openChat: 'Ouvrir',
    typing: 'écrit',
  },
} as const;

export type I18nKey = keyof typeof DICT.en;

export function t(lang: Lang, key: I18nKey): string {
  return DICT[lang][key] || DICT.en[key] || key;
}

export function loadLang(): Lang {
  const v = localStorage.getItem('gb-lang');
  return v === 'fr' ? 'fr' : 'en';
}

export function saveLang(lang: Lang): void {
  localStorage.setItem('gb-lang', lang);
}

export function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  localStorage.setItem('gb-theme', theme);
  let resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function applyAccent(color: string): void {
  localStorage.setItem('gb-accent', color);
  document.documentElement.style.setProperty('--gb-accent', color);
}

export function initChromePrefs(): { theme: string; lang: Lang; accent: string } {
  const theme = (localStorage.getItem('gb-theme') as 'dark' | 'light' | 'system') || 'dark';
  const lang = loadLang();
  const accent = localStorage.getItem('gb-accent') || '#8b5cf6';
  applyTheme(theme);
  applyAccent(accent);
  return { theme, lang, accent };
}
