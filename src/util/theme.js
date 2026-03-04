const THEME_STORAGE_KEY = 'marketplace-theme';

export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';

const hasWindow = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const getPreferredTheme = () => {
  if (!hasWindow() || !window.matchMedia) {
    return THEME_LIGHT;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
};

const getStoredTheme = () => {
  if (!hasWindow()) {
    return null;
  }
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === THEME_DARK || value === THEME_LIGHT ? value : null;
};

const applyThemeToDOM = theme => {
  if (!hasWindow()) {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle('theme-dark', theme === THEME_DARK);
  root.setAttribute('data-theme', theme);
};

export const getCurrentTheme = () => {
  if (!hasWindow()) {
    return THEME_LIGHT;
  }

  return document.documentElement.classList.contains('theme-dark') ? THEME_DARK : THEME_LIGHT;
};

export const setTheme = theme => {
  if (!hasWindow()) {
    return;
  }

  const validTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  applyThemeToDOM(validTheme);
  window.localStorage.setItem(THEME_STORAGE_KEY, validTheme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: validTheme } }));
};

export const toggleTheme = () => {
  const nextTheme = getCurrentTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setTheme(nextTheme);
  return nextTheme;
};

export const initializeTheme = () => {
  if (!hasWindow()) {
    return THEME_LIGHT;
  }

  const selectedTheme = getStoredTheme() || getPreferredTheme();
  applyThemeToDOM(selectedTheme);
  return selectedTheme;
};
