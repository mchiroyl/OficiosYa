export function adminEmailsFrom(raw?: string | null) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function correoEsAdmin(correo: string | null | undefined, raw?: string | null) {
  if (!correo) return false;
  return adminEmailsFrom(raw).includes(correo.trim().toLowerCase());
}
