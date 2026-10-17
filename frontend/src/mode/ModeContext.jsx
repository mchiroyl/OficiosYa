import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ModeContext = createContext(null);
const STORAGE_KEY = 'oficiosya.mode';

function readMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'worker' ? 'worker' : 'client';
  } catch {
    return 'client';
  }
}

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);

  const setMode = useCallback((next) => {
    const value = next === 'worker' ? 'worker' : 'client';
    setModeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isClient: mode === 'client',
      isWorker: mode === 'worker',
    }),
    [mode, setMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode debe usarse dentro de <ModeProvider>');
  return ctx;
}
