import * as React from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleTheme: () => void;
}

const STORAGE_KEY = 'formatjs-theme';
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // El tema sigue funcionando en memoria si localStorage está bloqueado.
    }
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider.');
  }

  return context;
}
