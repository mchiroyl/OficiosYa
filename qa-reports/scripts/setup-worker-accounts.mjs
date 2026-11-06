// Registra las cuentas de prueba del QA del modo trabajador y guarda las credenciales
// en qa-reports/.qa-credentials.json (ignorado por git). No modifica la aplicación.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.QA_API_URL || 'http://localhost:3000/api';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credsPath = join(root, '.qa-credentials.json');

if (existsSync(credsPath) && !process.argv.includes('--force')) {
  const current = JSON.parse(readFileSync(credsPath, 'utf8'));
  console.log(`Ya existen credenciales en ${credsPath}:`);
  for (const key of Object.keys(current).filter((k) => k.endsWith('_EMAIL'))) {
    console.log(`  ${key}=${current[key]}`);
  }
  console.log('Usa --force para registrar cuentas nuevas.');
  process.exit(0);
}

const stamp = Date.now().toString(36);
const password = () => `Qa-${randomBytes(9).toString('base64url')}9`;

const accounts = [
  {
    key: 'QA_WORKER_A',
    body: {
      nombre: 'QA Trabajador A',
      correo: `qa.trabajador.a.${stamp}@oficiosya-qa.dev`,
      telefono: '50200000001',
      modo: 'trabajador',
      oficio_principal: 'Electricidad',
      descripcion: 'Cuenta de prueba E2E (trabajador A).',
      experiencia: '5 años',
    },
  },
  {
    key: 'QA_WORKER_B',
    body: {
      nombre: 'QA Trabajador B',
      correo: `qa.trabajador.b.${stamp}@oficiosya-qa.dev`,
      telefono: '50200000002',
      modo: 'trabajador',
      oficio_principal: 'Plomería',
      descripcion: 'Cuenta de prueba E2E (trabajador B).',
      experiencia: '3 años',
    },
  },
  {
    key: 'QA_CLIENT',
    body: {
      nombre: 'QA Cliente',
      correo: `qa.cliente.${stamp}@oficiosya-qa.dev`,
      telefono: '50200000003',
      modo: 'cliente',
    },
  },
];

const out = {};
for (const account of accounts) {
  const pass = password();
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...account.body, password: pass }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`No se pudo registrar ${account.body.correo}: ${res.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  out[`${account.key}_EMAIL`] = account.body.correo;
  out[`${account.key}_PASSWORD`] = pass;
  console.log(`Registrada ${account.key}: ${account.body.correo} (id_usuario ${data.user?.id_usuario})`);
}

writeFileSync(credsPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Credenciales guardadas en ${credsPath}`);
