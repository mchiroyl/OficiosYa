// Añade el segundo cliente (QA_CLIENT_B) a qa-reports/.qa-credentials.json
// si aún no existe. Reutiliza A, B y C del E2E de trabajador. No modifica la app.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.QA_API_URL || 'http://localhost:3000/api';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credsPath = join(root, '.qa-credentials.json');

if (!existsSync(credsPath)) {
  console.error(`No existe ${credsPath}. Ejecuta primero npm run setup:accounts.`);
  process.exit(1);
}

const current = JSON.parse(readFileSync(credsPath, 'utf8'));
const needed = ['QA_WORKER_A_EMAIL', 'QA_WORKER_B_EMAIL', 'QA_CLIENT_EMAIL'];
const missing = needed.filter((key) => !current[key]);
if (missing.length) {
  console.error(`Faltan ${missing.join(', ')} en ${credsPath}.`);
  process.exit(1);
}

if (current.QA_CLIENT_B_EMAIL && current.QA_CLIENT_B_PASSWORD && !process.argv.includes('--force')) {
  console.log(`Ya existe QA_CLIENT_B: ${current.QA_CLIENT_B_EMAIL}`);
  process.exit(0);
}

const stamp = Date.now().toString(36);
const password = `Qa-${randomBytes(9).toString('base64url')}9`;
const correo = `qa.cliente.b.${stamp}@oficiosya-qa.dev`;
const res = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre: 'QA Cliente B',
    correo,
    telefono: '50200000004',
    modo: 'cliente',
    password,
  }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`No se pudo registrar ${correo}: ${res.status} ${JSON.stringify(data)}`);
  process.exit(1);
}

current.QA_CLIENT_B_EMAIL = correo;
current.QA_CLIENT_B_PASSWORD = password;
writeFileSync(credsPath, `${JSON.stringify(current, null, 2)}\n`);
console.log(`Registrada QA_CLIENT_B: ${correo} (id_usuario ${data.user?.id_usuario})`);
console.log(`Credenciales actualizadas en ${credsPath}`);
