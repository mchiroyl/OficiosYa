const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS || 'admin@oficiosya.gt')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user) {
  if (!user) return false;
  if (user.es_admin === true || user.rol === 'Admin' || user.rol === 'admin') return true;
  const correo = String(user.correo || '').toLowerCase();
  return ADMIN_EMAILS.includes(correo);
}
