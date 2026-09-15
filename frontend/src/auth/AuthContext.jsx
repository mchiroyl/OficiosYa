import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { clearSession, readSession, sessionUsesRemember, writeSession } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());
  const [ready, setReady] = useState(false);

  const persist = useCallback((next, rememberMe = sessionUsesRemember()) => {
    if (!next) {
      clearSession();
      setSession(null);
      return;
    }
    writeSession(next, rememberMe);
    setSession(next);
  }, []);

  const applyAuthResponse = useCallback((data, rememberMe) => {
    const next = {
      user: data.user,
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresAt: data.tokens.expiresAt,
      tienePerfilTrabajador: data.tienePerfilTrabajador,
      perfilTrabajador: data.perfilTrabajador,
    };
    persist(next, rememberMe);
    return next;
  }, [persist]);

  const refreshSession = useCallback(async (current = readSession()) => {
    if (!current?.refreshToken) return null;
    const tokens = await api('/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    });
    const next = {
      ...current,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    persist(next, current.rememberMe ?? sessionUsesRemember());
    return next;
  }, [persist]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = readSession();
      if (!stored?.accessToken) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const me = await api('/auth/me', { token: stored.accessToken });
        if (cancelled) return;
        persist(
          {
            ...stored,
            user: me.user,
            tienePerfilTrabajador: me.tienePerfilTrabajador,
            perfilTrabajador: me.perfilTrabajador,
          },
          stored.rememberMe ?? sessionUsesRemember(),
        );
      } catch {
        try {
          await refreshSession(stored);
        } catch {
          persist(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [persist, refreshSession]);

  const login = useCallback(
    async ({ correo, password, rememberMe }) => {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { correo, password, rememberMe: Boolean(rememberMe) },
      });
      return applyAuthResponse(data, Boolean(rememberMe));
    },
    [applyAuthResponse],
  );

  const register = useCallback(async (payload) => {
    return api('/auth/register', {
      method: 'POST',
      body: payload,
    });
  }, []);

  const logout = useCallback(async () => {
    const current = readSession();
    try {
      await api('/auth/logout', {
        method: 'POST',
        token: current?.accessToken,
      });
    } catch {
      // La sesión local se limpia igual.
    }
    persist(null);
  }, [persist]);

  const forgotPassword = useCallback((correo) => {
    return api('/auth/forgot-password', {
      method: 'POST',
      body: { correo },
    });
  }, []);

  const resetPassword = useCallback((payload) => {
    return api('/auth/reset-password', {
      method: 'POST',
      body: payload,
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.accessToken),
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
    }),
    [forgotPassword, login, logout, ready, register, resetPassword, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
