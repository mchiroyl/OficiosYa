const SESSION_KEY = 'oficiosya.session';

export function readSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSession(session, rememberMe) {
  clearSession();
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify({ ...session, rememberMe: Boolean(rememberMe) }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function sessionUsesRemember() {
  return Boolean(localStorage.getItem(SESSION_KEY));
}
