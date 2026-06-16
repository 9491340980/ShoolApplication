export interface Theme {
  id: string;
  name: string;
  primary: string;
  dark: string;
  light: string;
}

/** Theme presets a super admin can assign per school. First is the default. */
export const THEMES: Theme[] = [
  { id: 'blue', name: 'Blue (default)', primary: '#1a56db', dark: '#1240a8', light: '#e8f0fe' },
  { id: 'green', name: 'Green', primary: '#059669', dark: '#047857', light: '#d1fae5' },
  { id: 'teal', name: 'Teal', primary: '#0d9488', dark: '#0f766e', light: '#ccfbf1' },
  { id: 'indigo', name: 'Indigo', primary: '#4f46e5', dark: '#4338ca', light: '#e0e7ff' },
  { id: 'purple', name: 'Purple', primary: '#7c3aed', dark: '#6d28d9', light: '#ede9fe' },
  { id: 'maroon', name: 'Maroon', primary: '#be123c', dark: '#9f1239', light: '#ffe4e6' },
  { id: 'orange', name: 'Orange', primary: '#ea580c', dark: '#c2410c', light: '#ffedd5' },
];

/** Apply a theme by overriding the primary CSS variables at runtime. */
export function applyTheme(themeId?: string): void {
  const t = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--color-primary', t.primary);
  r.setProperty('--color-primary-dark', t.dark);
  r.setProperty('--color-primary-light', t.light);
}
