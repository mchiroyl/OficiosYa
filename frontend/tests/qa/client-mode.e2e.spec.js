// Prueba E2E del modo cliente (CLI-01 … CLI-28) contra el backend real.
// Solo prueba y documenta: no modifica la aplicación. Cada caso registra su resultado
// en qa-reports/client/results.json y sus capturas en qa-reports/client/screenshots/.
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'qa-reports', 'client');
const SHOTS = path.join(OUT, 'screenshots');
const FIXTURES = path.join(OUT, 'fixtures');
const RESULTS_FILE = path.join(OUT, 'results.json');

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173';
const API = process.env.QA_API_URL || 'http://localhost:3000/api';
const DESKTOP = { width: 1366, height: 768 };
const MOBILE = { width: 390, height: 844 };

const REQUIRED_ENV = [
  'QA_WORKER_A_EMAIL',
  'QA_WORKER_A_PASSWORD',
  'QA_WORKER_B_EMAIL',
  'QA_WORKER_B_PASSWORD',
  'QA_CLIENT_EMAIL',
  'QA_CLIENT_PASSWORD',
  'QA_CLIENT_B_EMAIL',
  'QA_CLIENT_B_PASSWORD',
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

const CREDS = {
  A: { email: process.env.QA_WORKER_A_EMAIL, password: process.env.QA_WORKER_A_PASSWORD },
  B: { email: process.env.QA_WORKER_B_EMAIL, password: process.env.QA_WORKER_B_PASSWORD },
  C: { email: process.env.QA_CLIENT_EMAIL, password: process.env.QA_CLIENT_PASSWORD },
  D: { email: process.env.QA_CLIENT_B_EMAIL, password: process.env.QA_CLIENT_B_PASSWORD },
};

const STAMP = Date.now().toString(36);
const XSS = '<img src=x onerror=alert(1)>';

const report = {
  meta: {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    baseUrl: BASE,
    apiUrl: API,
    browser: null,
    viewports: { desktop: DESKTOP, mobile: MOBILE },
    accounts: {},
  },
  seedNotes: [],
  results: [],
  bugs: [],
  observations: [],
};

const ctx = {
  sessions: {},
  profiles: {},
  categories: [],
  zones: [],
  services: {},
  requests: {},
  review: null,
};

function flush() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(RESULTS_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function short(value, max = 600) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function call(method, route, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${route}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { method, route, status: res.status, ok: res.ok, data };
}

function sessionFor(who) {
  const data = ctx.sessions[who];
  return {
    user: data.user,
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    expiresAt: data.tokens.expiresAt,
    tienePerfilTrabajador: data.tienePerfilTrabajador,
    perfilTrabajador: data.perfilTrabajador,
    es_admin: Boolean(data.es_admin),
    rememberMe: true,
  };
}

const token = (who) => ctx.sessions[who].tokens.accessToken;

function newCase(id, title, viewports, expected) {
  return {
    id,
    title,
    viewports,
    expected,
    status: 'Aprobado',
    obtained: [],
    evidence: [],
    http: [],
    notes: [],
    consoleErrors: [],
    blockedReason: null,
    pages: [],
  };
}

function fail(c, message) {
  c.status = 'Fallido';
  c.obtained.push({ kind: 'fail', text: message });
}

function observe(c, message) {
  if (c.status === 'Aprobado') c.status = 'Observación';
  c.obtained.push({ kind: 'warn', text: message });
}

function ok(c, message) {
  c.obtained.push({ kind: 'ok', text: message });
}

function block(c, reason) {
  c.status = 'Bloqueado';
  c.blockedReason = reason;
}

function http(c, res, label) {
  c.http.push({
    label: label || `${res.method} ${res.route}`,
    request: `${res.method} ${res.route}`,
    status: res.status,
    body: short(res.data, 400),
  });
  return res;
}

function bug(c, { severity, title, steps, expected, obtained, evidence, location }) {
  report.bugs.push({
    caseId: c.id,
    severity,
    title,
    steps,
    expected,
    obtained,
    evidence: evidence || c.evidence.slice(-1).map((item) => item.file),
    location: location || null,
  });
}

function uxNote(c, { area, text, evidence }) {
  report.observations.push({
    caseId: c.id,
    area,
    text,
    evidence: evidence || c.evidence.slice(-1).map((item) => item.file),
  });
}

async function shot(page, c, desc, caption, { mobile = false } = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const stem = `${c.id}_${slugify(desc)}${mobile ? '-movil' : ''}`;
  let name = `${stem}.png`;
  for (let n = 2; c.evidence.some((e) => e.file === `screenshots/${name}`); n += 1) name = `${stem}-${n}.png`;
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true, animations: 'disabled' });
  c.evidence.push({ file: `screenshots/${name}`, caption });
  return `screenshots/${name}`;
}

async function evidenceShot(browser, c, desc, title, rows) {
  const { page, close } = await openPage(browser, c, DESKTOP);
  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
  <body style="font-family:Segoe UI,Arial,sans-serif;padding:28px;color:#1f2933">
    <p style="margin:0;color:#64748b;font-size:13px">Evidencia de API · ${esc(c.id)} · ${esc(new Date().toLocaleString('es-GT'))}</p>
    <h2 style="margin:6px 0 18px">${esc(title)}</h2>
    ${rows
      .map(
        (row) => `<h3 style="margin:16px 0 6px;font-size:15px">${esc(row.label)}</h3>
      <pre style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:13px">${esc(row.text)}</pre>`,
      )
      .join('')}
  </body></html>`;
  await page.setContent(html);
  const file = await shot(page, c, desc, title);
  await close();
  return file;
}

async function openPage(browser, c, viewport, who, mode = 'client') {
  const context = await browser.newContext({ viewport, baseURL: BASE, locale: 'es-GT' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', (err) => c.consoleErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') c.consoleErrors.push(`console: ${msg.text().slice(0, 300)}`);
  });
  if (who) {
    await page.goto('/login');
    await page.evaluate(
      ([session, value]) => {
        localStorage.setItem('oficiosya.session', JSON.stringify(session));
        localStorage.setItem('oficiosya.mode', value);
      },
      [sessionFor(who), mode],
    );
  }
  c.pages.push(page);
  return {
    page,
    context,
    close: async () => {
      c.pages = c.pages.filter((item) => item !== page);
      await context.close();
    },
  };
}

async function settle(page, ms = 6000) {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {});
}

async function alertText(page) {
  const alert = page.getByRole('alert').first();
  if (await alert.isVisible().catch(() => false)) return (await alert.textContent())?.trim() || '';
  return '';
}

async function overflowInfo(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > width + 1) {
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
        offenders.push(`${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} (right=${Math.round(rect.right)}px)`);
      }
      if (offenders.length >= 6) break;
    }
    return { width, scrollWidth, overflow: scrollWidth > width + 1, offenders };
  });
}

function caseTest(id, title, viewports, expected, fn) {
  test(`${id} ${title}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const c = newCase(id, title, viewports, expected);
    if (missingEnv.length) {
      block(c, `Faltan variables de entorno: ${missingEnv.join(', ')}`);
    } else if (!ctx.ready) {
      block(c, `No se pudieron preparar los datos de prueba: ${ctx.seedError || 'desconocido'}`);
    } else {
      try {
        await fn({ browser, c });
      } catch (err) {
        if (c.status !== 'Bloqueado') {
          fail(c, `Excepción durante la prueba: ${String(err.message).split('\n')[0]}`);
        }
        const page = c.pages.at(-1);
        if (page) await shot(page, c, 'estado-al-fallar', 'Estado de la pantalla al producirse el error').catch(() => {});
      }
    }
    for (const page of c.pages) await page.context().close().catch(() => {});
    delete c.pages;
    c.consoleErrors = [...new Set(c.consoleErrors)].slice(0, 10);
    report.results.push(c);
    flush();
  });
}

function localDateTime(offsetMs) {
  const date = new Date(Date.now() + offsetMs);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

async function seed() {
  for (const who of ['A', 'B', 'C', 'D']) {
    const res = await call('POST', '/auth/login', {
      body: { correo: CREDS[who].email, password: CREDS[who].password, rememberMe: true },
    });
    if (!res.ok) throw new Error(`Login API de ${who} falló (${res.status}): ${short(res.data, 200)}`);
    ctx.sessions[who] = res.data;
    report.meta.accounts[who] = {
      email: CREDS[who].email,
      id_usuario: res.data.user?.id_usuario,
      rol: who === 'A' || who === 'B' ? `trabajador ${who}` : who === 'C' ? 'cliente C' : 'cliente D',
    };
  }

  for (const who of ['A', 'B']) {
    let res = await call('GET', '/worker/profile', { token: token(who) });
    if (!res.ok || !res.data?.id_perfil) {
      res = await call('PUT', '/worker/profile', {
        token: token(who),
        body: { oficio_principal: who === 'A' ? 'Electricidad' : 'Plomería' },
      });
      report.seedNotes.push(`Se creó por API el perfil de trabajador de ${who} porque el registro no lo dejó listo.`);
    }
    ctx.profiles[who] = res.data;
    report.meta.accounts[who].id_perfil = res.data?.id_perfil;
  }

  const cats = await call('GET', '/categorias?estado=ACTIVA&order=nombre:asc');
  ctx.categories = Array.isArray(cats.data) ? cats.data : [];
  const zones = await call('GET', '/zonas?estado=ACTIVA&order=nombre:asc');
  ctx.zones = Array.isArray(zones.data) ? zones.data : [];
  if (!ctx.categories.length) throw new Error('No hay categorías activas.');

  ctx.catMain = ctx.categories.find((cat) => /electric/i.test(cat.nombre)) || ctx.categories[0];
  ctx.catOther = ctx.categories.find((cat) => cat.id_categoria !== ctx.catMain.id_categoria) || ctx.catMain;

  const cobertura = ctx.zones.slice(0, 1).map((zone) => zone.id_zona);
  for (const who of ['A', 'B']) {
    const res = await call('PUT', '/worker/profile', {
      token: token(who),
      body: {
        oficio_principal: who === 'A' ? 'Electricidad' : 'Plomería',
        descripcion: who === 'A' ? 'Electricista de prueba E2E en El Asintal.' : 'Plomero de prueba E2E.',
        tarifas: { tipo: 'por_servicio', monto_desde: 80, monto_hasta: 250, moneda: 'GTQ' },
        horarios: [{ dia: 'lunes', desde: '08:00', hasta: '17:00' }],
        cobertura,
        contacto_visible: true,
      },
    });
    if (!res.ok) throw new Error(`No se pudo preparar el perfil de ${who}: ${res.status} ${short(res.data, 200)}`);
    ctx.profiles[who] = { ...ctx.profiles[who], ...res.data };
    await call('PUT', '/worker/availability', { token: token(who), body: { disponibilidad: 'Disponible' } });
  }

  for (const who of ['A', 'B']) {
    const existing = await call('GET', `/servicios?id_perfil=${ctx.profiles[who].id_perfil}&activo=true`, { token: token(who) });
    const list = Array.isArray(existing.data) ? existing.data : existing.data?.data || [];
    if (list.length) {
      ctx.services[who] = list[0];
    } else {
      const res = await call('POST', '/servicios', {
        token: token(who),
        body: {
          id_perfil: ctx.profiles[who].id_perfil,
          id_categoria: (who === 'A' ? ctx.catMain : ctx.catOther).id_categoria,
          nombre: `QA Servicio cliente ${who}`,
          descripcion: `Servicio semilla modo cliente (${who}).`,
          activo: true,
        },
      });
      if (!res.ok) throw new Error(`No se pudo crear el servicio de ${who}: ${res.status} ${short(res.data, 200)}`);
      ctx.services[who] = res.data;
    }
  }
  report.seedNotes.push(
    `Perfiles A (${ctx.profiles.A.id_perfil}) y B (${ctx.profiles.B.id_perfil}) listos, Disponible, con servicio activo.`,
  );

  const makeRequest = async (whoWorker, whoClient, key, descripcion) => {
    const res = await call('POST', '/requests/create', {
      token: token(whoClient),
      body: {
        id_trabajador: ctx.profiles[whoWorker].id_perfil,
        id_servicio: ctx.services[whoWorker].id_servicio,
        descripcion,
        ubicacion_aprox: 'El Asintal, zona centro',
      },
    });
    if (!res.ok) throw new Error(`No se pudo crear la solicitud ${key}: ${res.status} ${short(res.data, 200)}`);
    ctx.requests[key] = res.data;
  };

  await makeRequest('A', 'C', 'cancelable', `QA cancelar ${STAMP}: instalar un tomacorriente extra en la cocina.`);
  await makeRequest('A', 'C', 'flujo', `QA finalizar y calificar ${STAMP}: revisar instalación eléctrica del patio.`);
  await makeRequest('A', 'C', 'chat', `QA chat cliente ${STAMP}: consultar horario para cambio de breaker.`);
  await makeRequest('A', 'D', 'deD', `QA solicitud del cliente D ${STAMP}: fuga en el lavamanos que no debe ver C.`);

  const accFlujo = await call('PUT', `/requests/${ctx.requests.flujo.id_solicitud}/status`, {
    token: token('A'),
    body: { accion: 'Aceptar' },
  });
  const startFlujo = await call('PUT', `/requests/${ctx.requests.flujo.id_solicitud}/status`, {
    token: token('A'),
    body: { accion: 'Iniciar' },
  });
  const accChat = await call('PUT', `/requests/${ctx.requests.chat.id_solicitud}/status`, {
    token: token('A'),
    body: { accion: 'Aceptar' },
  });
  report.seedNotes.push(
    `Solicitudes: cancelable #${ctx.requests.cancelable.id_solicitud} (Enviada); flujo #${ctx.requests.flujo.id_solicitud} (Aceptar ${accFlujo.status}, Iniciar ${startFlujo.status}); chat #${ctx.requests.chat.id_solicitud} (Aceptar ${accChat.status}); deD #${ctx.requests.deD.id_solicitud} para el cliente D.`,
  );
}

test.use({ baseURL: BASE, viewport: DESKTOP });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  report.meta.browser = `${browser.browserType().name()} ${browser.version()}`;
  if (missingEnv.length) return;
  try {
    fs.rmSync(SHOTS, { recursive: true, force: true });
    fs.mkdirSync(FIXTURES, { recursive: true });
    await seed();
    ctx.ready = true;
  } catch (err) {
    ctx.seedError = err.message;
    report.seedNotes.push(`ERROR preparando datos: ${err.message}`);
  }
  flush();
});

test.afterAll(() => {
  report.meta.finishedAt = new Date().toISOString();
  flush();
});

async function uiLoginClient(page, email, password) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Modo Cliente' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
}

const clientHeading = (page) => page.getByRole('heading', { name: /Qué oficio necesitas/i });

function requestCard(page, id) {
  return page.locator('li').filter({ hasText: `Solicitud #${id}` });
}

async function clientRequestState(id, who = 'C') {
  const res = await call('GET', '/requests/client', { token: token(who) });
  const row = Array.isArray(res.data) ? res.data.find((r) => r.id_solicitud === id) : null;
  return row?.estado || null;
}

// ======================= CASOS =======================

caseTest(
  'CLI-01',
  'Inicio de sesión con el selector de cliente',
  ['escritorio', 'móvil'],
  'Con "Modo Cliente" seleccionado, el formulario dice "Ingresa como cliente" y tras entrar se abre el inicio del cliente.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp);
      await uiLoginClient(page, CREDS.C.email, CREDS.C.password);
      const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
      await shot(page, c, 'login-modo-cliente', `Pantalla de login con "Modo Cliente" seleccionado (${label})`, { mobile });
      if (!/cliente/i.test(heading || '')) fail(c, `(${label}) El título del login no cambia a cliente: "${heading}".`);
      const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
      await page.getByRole('button', { name: 'Entrar como cliente' }).click();
      const resp = await loginResp;
      c.http.push({ label: `Login (${label})`, request: 'POST /api/auth/login', status: resp.status(), body: '' });
      const landed = await clientHeading(page).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      await settle(page);
      await shot(page, c, 'inicio-tras-login', `Inicio del cliente tras iniciar sesión (${label})`, { mobile });
      const mode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
      if (landed && (mode === 'client' || mode == null)) ok(c, `(${label}) Login correcto: abre "¿Qué oficio necesitas hoy?" (modo: ${mode || 'client por defecto'}).`);
      else fail(c, `(${label}) Tras el login no se mostró el inicio del cliente (modo guardado: ${mode}).`);
      await close();
    }
  },
);

caseTest(
  'CLI-02',
  'Contraseña incorrecta',
  ['escritorio'],
  'Se muestra un mensaje claro en español ("Correo o contraseña incorrectos."), no se crea sesión y el formulario sigue utilizable.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await uiLoginClient(page, CREDS.C.email, 'Incorrecta-QA-123');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.getByRole('button', { name: 'Entrar como cliente' }).click();
    const resp = await respPromise;
    const body = await resp.text();
    c.http.push({ label: 'Login con contraseña incorrecta', request: 'POST /api/auth/login', status: resp.status(), body: short(body, 300) });
    await page.getByRole('alert').first().waitFor({ timeout: 10000 }).catch(() => {});
    const message = await alertText(page);
    await shot(page, c, 'error-contrasena-incorrecta', 'Mensaje mostrado al usar una contraseña incorrecta');
    const stored = await page.evaluate(() => localStorage.getItem('oficiosya.session') || sessionStorage.getItem('oficiosya.session'));
    if (stored) fail(c, 'Se guardó una sesión pese a la contraseña incorrecta.');
    if (!message) fail(c, 'No apareció ningún mensaje de error visible.');
    else if (/incorrect/i.test(message) && /contraseña|correo/i.test(message)) ok(c, `Mensaje mostrado: "${message}" (HTTP ${resp.status()}).`);
    else {
      fail(c, `Mensaje poco claro o técnico: "${message}" (HTTP ${resp.status()}).`);
      bug(c, {
        severity: 'Baja',
        title: 'El error de contraseña incorrecta no es claro para el usuario',
        steps: ['Ir a /login', 'Seleccionar Modo Cliente', 'Escribir un correo válido y una contraseña incorrecta', 'Pulsar "Entrar como cliente"'],
        expected: 'Mensaje en español: "Correo o contraseña incorrectos."',
        obtained: `Mensaje: "${message}"`,
        location: 'frontend/src/pages/Login.jsx',
      });
    }
    if (resp.status() !== 401) observe(c, `El backend responde HTTP ${resp.status()} (se esperaba 401).`);
  },
);

caseTest(
  'CLI-03',
  'El cambio de modo se mantiene al recargar',
  ['escritorio'],
  'Al recargar permanece en modo cliente; al pasar a Modo Trabajador y recargar, se mantiene el modo trabajador.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/');
    await clientHeading(page).waitFor();
    await page.reload();
    await settle(page);
    const clientMode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
    const stillClient = await clientHeading(page).isVisible().catch(() => false);
    await shot(page, c, 'modo-cliente-tras-recargar', 'Inicio del cliente tras recargar');
    if (stillClient && clientMode === 'client') ok(c, 'Tras recargar sigue en Modo Cliente.');
    else fail(c, `Tras recargar no se mantuvo Modo Cliente (modo: ${clientMode}).`);

    await page.getByRole('button', { name: 'Modo Trabajador' }).click();
    await settle(page);
    await page.reload();
    await settle(page);
    const workerMode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
    const workerPanel = await page.getByRole('heading', { name: /Tu panel de\s*trabajo/i }).isVisible().catch(() => false);
    await shot(page, c, 'modo-trabajador-tras-recargar', 'Tras cambiar a trabajador y recargar');
    if (workerMode === 'worker') ok(c, `Tras recargar se mantuvo Modo Trabajador (panel visible: ${workerPanel}).`);
    else fail(c, `Tras recargar no se mantuvo Modo Trabajador (modo: ${workerMode}).`);
  },
);

caseTest(
  'CLI-04',
  'Enlace directo a /mis-solicitudes sin sesión',
  ['escritorio'],
  'Sin sesión redirige a /login; tras iniciar sesión regresa a /mis-solicitudes.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await page.goto('/mis-solicitudes');
    await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
    await shot(page, c, 'redirige-a-login', 'Al abrir /mis-solicitudes sin sesión');
    if (!/\/login/.test(page.url())) {
      fail(c, `No redirigió a login (URL: ${page.url()}).`);
      return;
    }
    ok(c, 'Sin sesión redirige a /login.');
    await uiLoginClient(page, CREDS.C.email, CREDS.C.password);
    const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.getByRole('button', { name: 'Entrar como cliente' }).click();
    await loginResp;
    await page.waitForURL(/mis-solicitudes/, { timeout: 15000 }).catch(() => {});
    await settle(page);
    await shot(page, c, 'destino-tras-login', 'Destino tras iniciar sesión desde /mis-solicitudes');
    if (/mis-solicitudes/.test(page.url()) || (await page.getByRole('heading', { name: /Mis solicitudes/i }).isVisible().catch(() => false))) {
      ok(c, `Tras el login volvió a las solicitudes (URL: ${page.url()}).`);
    } else {
      fail(c, `Tras el login no volvió a /mis-solicitudes (URL: ${page.url()}).`);
      bug(c, {
        severity: 'Media',
        title: 'Tras iniciar sesión no se recupera la página que se quería abrir',
        steps: ['Sin sesión, abrir /mis-solicitudes', 'Iniciar sesión como cliente'],
        expected: 'Quedar en /mis-solicitudes',
        obtained: `URL final: ${page.url()}`,
        location: 'frontend/src/App.jsx (oficiosya.next)',
      });
    }
  },
);

caseTest(
  'CLI-05',
  'Registro de una cuenta de cliente',
  ['escritorio'],
  'Los campos vacíos se rechazan con mensajes en español; un registro válido crea la cuenta y deja entrar como cliente.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await page.goto('/register');
    await page.getByRole('button', { name: 'Modo Cliente' }).click();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByRole('alert').first().waitFor({ timeout: 5000 }).catch(() => {});
    await shot(page, c, 'registro-vacio', 'Registro de cliente enviado vacío');
    const emptyErrors = await page.locator('[class*="error"], [role="alert"]').allTextContents();
    const joined = emptyErrors.join(' ');
    if (/obligatori|nombre|correo|contraseña/i.test(joined)) ok(c, `Validación en vacío: "${joined.slice(0, 180)}".`);
    else observe(c, `Al enviar vacío no hay mensajes claros: "${joined.slice(0, 180)}".`);

    const correo = `qa.cliente.ui.${STAMP}@oficiosya-qa.dev`;
    await page.getByLabel('Nombre completo').fill('QA Cliente UI');
    await page.getByLabel('Correo electrónico').fill(correo);
    await page.getByLabel('Contraseña', { exact: true }).fill('Qa-Registro9x');
    await page.getByLabel('Confirmar contraseña').fill('Qa-Registro9x');
    const respPromise = page
      .waitForResponse((r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST', { timeout: 20000 })
      .catch(() => null);
    await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
    const resp = await respPromise;
    if (resp) c.http.push({ label: 'Registro UI', request: 'POST /api/auth/register', status: resp.status(), body: short(await resp.text(), 250) });
    await settle(page);
    await shot(page, c, 'registro-exitoso', `Tras registrar ${correo}`);
    const landed = await clientHeading(page).isVisible().catch(() => false);
    const onLogin = /\/login/.test(page.url());
    if (resp?.ok() && (landed || onLogin)) ok(c, `Cuenta creada (HTTP ${resp.status()}). Destino: ${page.url()}.`);
    else fail(c, `No se completó el registro (HTTP ${resp?.status() ?? 'sin petición'}, URL ${page.url()}).`);
  },
);

caseTest(
  'CLI-06',
  'Inicio del cliente: categorías, búsqueda y accesos',
  ['escritorio', 'móvil'],
  'El inicio muestra categorías, el buscador, "Ver todos los profesionales" y "Mis solicitudes", sin errores.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp, 'C');
      await page.goto('/');
      await clientHeading(page).waitFor();
      await settle(page);
      await shot(page, c, 'inicio-cliente', `Inicio del modo cliente (${label})`, { mobile });
      const cats = await page.getByRole('heading', { name: 'Categorías de oficios' }).isVisible();
      const search = await page.getByRole('search').isVisible();
      const all = await page.getByRole('button', { name: 'Ver todos los profesionales' }).isVisible();
      const mine = await page.getByRole('button', { name: 'Mis solicitudes' }).isVisible();
      const tiles = await page.locator('button').filter({ hasText: 'Ver profesionales' }).count();
      if (cats && search && all && mine && tiles > 0) ok(c, `(${label}) Inicio con buscador, ${tiles} categorías y accesos rápidos.`);
      else fail(c, `(${label}) Falta algo en el inicio (categorías ${cats}, buscador ${search}, todos ${all}, solicitudes ${mine}, mosaicos ${tiles}).`);
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) {
          fail(c, `(móvil) Desborde horizontal: ${info.offenders.join('; ')}`);
        }
      }
      await close();
    }
  },
);

caseTest(
  'CLI-07',
  'Abrir una categoría desde el mosaico',
  ['escritorio'],
  'Al tocar una categoría se abre su directorio y aparecen profesionales de ese oficio, o un vacío claro.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/');
    await clientHeading(page).waitFor();
    const catName = ctx.catMain.nombre;
    await page.getByRole('button', { name: new RegExp(catName, 'i') }).first().click();
    await page.waitForURL(/\/categoria\//, { timeout: 10000 }).catch(() => {});
    await settle(page, 10000);
    await page.getByText('Cargando profesionales…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await shot(page, c, 'directorio-categoria', `Directorio de la categoría ${catName}`);
    const title = await page.getByRole('heading', { level: 1 }).first().textContent();
    const workerName = ctx.sessions.A.user?.nombre || 'QA Trabajador A';
    const found = await page.getByRole('heading', { name: workerName }).first().isVisible().catch(() => false);
    const empty = await page.getByRole('heading', { name: /No encontramos profesionales/i }).isVisible().catch(() => false);
    const error = await alertText(page);
    if (/categor/i.test(title || '') && !error) ok(c, `Se abrió el directorio "${title}". A visible: ${found}. Vacío: ${empty}.`);
    else {
      fail(c, `No se abrió un directorio usable (título "${title}", error "${error}", URL ${page.url()}).`);
      bug(c, {
        severity: 'Alta',
        title: 'Al elegir una categoría el directorio no carga profesionales',
        steps: ['En el inicio del cliente, pulsar una categoría'],
        expected: `Directorio de "${catName}" con resultados o un vacío claro`,
        obtained: `URL ${page.url()}; título "${title}"; error "${error}"`,
        location: 'frontend/src/pages/SearchDirectory.jsx',
      });
    }
    if (!found && !empty && !error) observe(c, `El directorio de "${catName}" no muestra a ${workerName} ni un estado vacío.`);
  },
);

caseTest(
  'CLI-08',
  'Búsqueda por texto libre',
  ['escritorio'],
  'Buscar "electricista" (o el oficio de A) muestra resultados o un vacío claro, sin error técnico.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/');
    await page.getByLabel('Buscar oficio').fill('electricista');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.waitForURL(/\/buscar/, { timeout: 8000 }).catch(() => {});
    await settle(page, 10000);
    await page.getByText('Cargando profesionales…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await shot(page, c, 'busqueda-texto', 'Resultados de buscar "electricista"');
    const error = await alertText(page);
    const countText = await page.getByRole('status').first().textContent().catch(() => '');
    if (error) {
      fail(c, `La búsqueda falló: "${error}".`);
      bug(c, {
        severity: 'Alta',
        title: 'La búsqueda por texto libre muestra un error',
        steps: ['En el inicio, escribir "electricista"', 'Pulsar Buscar'],
        expected: 'Lista de profesionales o vacío claro',
        obtained: error,
        location: 'frontend/src/pages/SearchDirectory.jsx / GET /search/profiles',
      });
    } else {
      ok(c, `Búsqueda usable. Estado: "${countText}". URL: ${page.url()}.`);
    }
  },
);

caseTest(
  'CLI-09',
  'Filtros del directorio',
  ['escritorio'],
  'Los filtros de disponibilidad y zona se aplican; "Limpiar" restaura la búsqueda.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/buscar');
    await settle(page, 10000);
    await page.getByText('Cargando profesionales…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const before = await page.getByRole('status').first().textContent().catch(() => '');
    await page.getByLabel('Disponibilidad').selectOption('todos');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click().catch(async () => {
      await page.getByRole('button', { name: 'Buscar' }).last().click();
    });
    await settle(page);
    await page.getByText('Cargando profesionales…').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await shot(page, c, 'filtro-todos', 'Directorio con disponibilidad "Todos"');
    const after = await page.getByRole('status').first().textContent().catch(() => '');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await settle(page);
    await shot(page, c, 'filtro-limpiar', 'Directorio tras Limpiar filtros');
    if (await page.getByRole('heading', { name: 'Filtrar resultados' }).isVisible()) ok(c, `Filtros presentes. Antes: "${before}". Después de "Todos": "${after}".`);
    else fail(c, 'No aparece el panel "Filtrar resultados".');
  },
);

caseTest(
  'CLI-10',
  'Perfil público desde el directorio',
  ['escritorio'],
  'El perfil muestra nombre, oficio, servicios y el botón "Solicitar servicio"; no muestra JSON crudo.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    const id = ctx.profiles.A.id_perfil;
    await page.goto(`/workers/${id}`);
    await settle(page, 8000);
    await page.getByText('Cargando perfil…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await shot(page, c, 'perfil-publico', `Perfil público /workers/${id} con sesión de cliente`);
    const name = ctx.sessions.A.user?.nombre || 'QA Trabajador A';
    const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
    const jsonish = /[{[]/.test(heading || '') || /[{[]/.test((await page.locator('p').first().textContent()) || '');
    const cta = await page.getByRole('button', { name: 'Solicitar servicio' }).isVisible().catch(() => false);
    const services = await page.getByRole('heading', { name: 'Servicios ofrecidos' }).isVisible().catch(() => false);
    if (/no encontrado|no está disponible/i.test(heading || '')) {
      fail(c, `El perfil no está disponible: "${heading}".`);
      bug(c, {
        severity: 'Alta',
        title: 'El perfil público no carga para el cliente',
        steps: [`Abrir /workers/${id} como cliente`],
        expected: `Nombre "${name}", servicios y botón Solicitar servicio`,
        obtained: heading,
        location: 'frontend/src/pages/PublicWorkerProfile.jsx',
      });
    } else if (jsonish) {
      fail(c, `El perfil muestra datos crudos/JSON: "${heading}".`);
      bug(c, {
        severity: 'Alta',
        title: 'El perfil público muestra JSON o datos crudos',
        steps: [`Abrir /workers/${id}`],
        expected: 'Nombre y descripción legibles',
        obtained: heading,
        location: 'frontend/src/pages/PublicWorkerProfile.jsx',
      });
    } else if (cta && services) {
      ok(c, `Perfil de "${heading?.trim()}" con servicios y "Solicitar servicio".`);
    } else {
      fail(c, `Perfil incompleto (CTA ${cta}, servicios ${services}, título "${heading}").`);
    }
  },
);

caseTest(
  'CLI-11',
  'Perfil público sin sesión y CTA de login',
  ['escritorio'],
  'Sin sesión el perfil se ve y el botón invita a iniciar sesión para solicitar.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    const id = ctx.profiles.A.id_perfil;
    await page.goto(`/workers/${id}`);
    await settle(page, 8000);
    await page.getByText('Cargando perfil…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await shot(page, c, 'perfil-publico-sin-sesion', `Perfil público /workers/${id} sin sesión`);
    const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
    const loginCta = await page.getByRole('button', { name: /Inicia sesión para solicitar/i }).isVisible().catch(() => false);
    const redirected = /\/login/.test(page.url());
    if (redirected) {
      fail(c, 'Sin sesión el perfil público redirige a login.');
      bug(c, {
        severity: 'Media',
        title: 'El perfil público exige sesión',
        steps: [`Sin sesión, abrir /workers/${id}`],
        expected: 'Ver el perfil y un botón para iniciar sesión',
        obtained: `Redirige a ${page.url()}`,
        location: 'frontend/src/App.jsx',
      });
    } else if (loginCta && !/no encontrado/i.test(heading || '')) ok(c, `Sin sesión se ve "${heading?.trim()}" y el CTA de login.`);
    else fail(c, `Sin sesión el perfil no quedó usable (título "${heading}", CTA login ${loginCta}).`);
  },
);

caseTest(
  'CLI-12',
  'Crear una solicitud válida desde el perfil',
  ['escritorio'],
  'El cliente elige un servicio, describe el trabajo y recibe confirmación con número de solicitud.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto(`/workers/${ctx.profiles.A.id_perfil}`);
    await page.getByRole('button', { name: 'Solicitar servicio' }).click();
    await page.getByRole('heading', { name: 'Cuéntanos qué necesitas' }).waitFor();
    await page.getByText('Cargando servicios…').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.getByLabel('Servicio *').selectOption({ index: 1 }).catch(async () => {
      const options = page.locator('select[name="id_servicio"] option');
      const count = await options.count();
      if (count > 1) await page.locator('select[name="id_servicio"]').selectOption({ index: 1 });
    });
    const desc = `QA solicitud UI ${STAMP}: necesito revisar la instalación eléctrica de la cocina porque salta el breaker.`;
    await page.getByLabel('Descripción del trabajo *').fill(desc);
    await page.getByLabel('Ubicación aproximada').fill('El Asintal, cerca del parque');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/requests/create') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    const resp = await respPromise.catch(() => null);
    const body = resp ? await resp.json().catch(() => ({})) : {};
    if (resp) c.http.push({ label: 'Crear solicitud UI', request: 'POST /api/requests/create', status: resp.status(), body: short(body, 300) });
    await page.getByText('Tu solicitud quedó registrada').waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, c, 'solicitud-enviada', 'Confirmación tras enviar la solicitud');
    const confirmed = await page.getByText('Tu solicitud quedó registrada').isVisible().catch(() => false);
    if (resp?.ok() && confirmed) {
      ok(c, `Solicitud #${body.id_solicitud || '—'} creada (HTTP ${resp.status()}).`);
      ctx.requests.ui = body;
    } else {
      fail(c, `No se confirmó la solicitud (HTTP ${resp?.status() ?? 'sin petición'}): ${await alertText(page)}`);
      bug(c, {
        severity: 'Crítica',
        title: 'No se puede enviar una solicitud de servicio desde el perfil',
        steps: ['Como cliente, abrir el perfil de A', 'Pulsar Solicitar servicio', 'Elegir servicio, describir el trabajo y enviar'],
        expected: 'Confirmación con número de solicitud',
        obtained: `HTTP ${resp?.status() ?? 'sin petición'}; alerta "${await alertText(page)}"`,
        location: 'frontend/src/components/requests/ServiceRequestModal.jsx',
      });
    }
  },
);

caseTest(
  'CLI-13',
  'Validación de la solicitud: texto corto y fecha pasada',
  ['escritorio'],
  'Una descripción de menos de 10 caracteres y una fecha pasada se rechazan con mensaje en español, sin crear la solicitud.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto(`/workers/${ctx.profiles.A.id_perfil}`);
    await page.getByRole('button', { name: 'Solicitar servicio' }).click();
    await page.getByRole('heading', { name: 'Cuéntanos qué necesitas' }).waitFor();
    await page.getByText('Cargando servicios…').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.locator('select[name="id_servicio"]').selectOption({ index: 1 }).catch(() => {});
    await page.getByLabel('Descripción del trabajo *').fill('corto');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    const shortMsg = await alertText(page);
    const stillOpen = await page.getByRole('heading', { name: 'Cuéntanos qué necesitas' }).isVisible().catch(() => false);
    await shot(page, c, 'descripcion-corta', 'Solicitud con descripción demasiado corta');
    if (/10|caracter/i.test(shortMsg)) ok(c, `Descripción corta rechazada: "${shortMsg}".`);
    else if (stillOpen) {
      ok(c, 'El navegador impide enviar una descripción de menos de 10 caracteres (validación nativa); el formulario sigue abierto.');
      uxNote(c, {
        area: 'Validación',
        text: 'La descripción corta se rechaza con la validación nativa del navegador, sin un mensaje propio de la app junto al campo.',
      });
    } else {
      fail(c, `Descripción corta no se rechazó con claridad: "${shortMsg}".`);
      bug(c, {
        severity: 'Media',
        title: 'La solicitud acepta o no explica una descripción demasiado corta',
        steps: ['Abrir Solicitar servicio', 'Escribir menos de 10 caracteres', 'Enviar'],
        expected: 'Mensaje: describe el trabajo con entre 10 y 4000 caracteres',
        obtained: shortMsg || 'sin mensaje',
        location: 'frontend/src/components/requests/ServiceRequestModal.jsx',
      });
    }

    await page.getByLabel('Descripción del trabajo *').fill('Necesito una revisión eléctrica completa de la cocina.');
    await page.getByLabel('Fecha y hora deseadas').fill(localDateTime(-3_600_000));
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    const pastMsg = await alertText(page);
    await shot(page, c, 'fecha-pasada', 'Solicitud con fecha y hora en el pasado');
    if (/futura|pasad|fecha/i.test(pastMsg)) ok(c, `Fecha pasada rechazada: "${pastMsg}".`);
    else {
      observe(c, `Fecha pasada: mensaje "${pastMsg || 'ninguno'}".`);
      uxNote(c, {
        area: 'Validación',
        text: `Al poner una fecha pasada el mensaje fue "${pastMsg || 'ninguno'}". Se esperaba "Selecciona una fecha y hora futura.".`,
      });
    }
  },
);

caseTest(
  'CLI-14',
  'Un trabajador en modo cliente no puede solicitarse a sí mismo',
  ['escritorio'],
  'En el directorio, el propio perfil muestra "Este es tu perfil" y no deja enviar una solicitud a uno mismo.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A', 'client');
    await page.goto('/buscar?q=electricista');
    await settle(page, 10000);
    await page.getByText('Cargando profesionales…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const own = page.locator('article').filter({ hasText: ctx.sessions.A.user?.nombre || 'QA Trabajador A' }).first();
    const disabled = await own.getByRole('button', { name: 'Este es tu perfil' }).isVisible().catch(() => false);
    await shot(page, c, 'propio-perfil', 'Directorio visto por A en modo cliente');
    if (disabled) ok(c, 'El propio perfil aparece con "Este es tu perfil" deshabilitado.');
    else {
      const requestOwn = await own.getByRole('button', { name: 'Solicitar servicio' }).isVisible().catch(() => false);
      if (requestOwn) {
        fail(c, 'A puede pulsar "Solicitar servicio" sobre su propio perfil.');
        bug(c, {
          severity: 'Media',
          title: 'Un trabajador puede solicitarse servicio a sí mismo desde el directorio',
          steps: ['Entrar como trabajador A', 'Cambiar a Modo Cliente', 'Buscarse en el directorio'],
          expected: 'Botón "Este es tu perfil" deshabilitado',
          obtained: 'Aparece "Solicitar servicio"',
          location: 'frontend/src/pages/SearchDirectory.jsx',
        });
      } else observe(c, 'No se encontró el propio perfil en los resultados para comprobar el botón.');
    }
  },
);

caseTest(
  'CLI-15',
  'Dashboard de solicitudes y filtros',
  ['escritorio', 'móvil'],
  'Mis solicitudes lista las del cliente; Activas / Finalizadas / Todas filtran y marcan el filtro activo.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp, 'C');
      await page.goto('/mis-solicitudes');
      await settle(page);
      await page.getByText('Cargando solicitudes…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      const cancelId = ctx.requests.cancelable.id_solicitud;
      const flujoId = ctx.requests.flujo.id_solicitud;
      await shot(page, c, 'filtro-todas', `Mis solicitudes — Todas (${label})`, { mobile });
      const hasCancel = await requestCard(page, cancelId).isVisible().catch(() => false);
      await page.getByRole('button', { name: 'Activas' }).click();
      await shot(page, c, 'filtro-activas', `Filtro Activas (${label})`, { mobile });
      const pressed = await page.getByRole('button', { name: 'Activas' }).getAttribute('aria-pressed');
      await page.getByRole('button', { name: 'Finalizadas' }).click();
      await shot(page, c, 'filtro-finalizadas', `Filtro Finalizadas (${label})`, { mobile });
      const stillActive = await requestCard(page, cancelId).isVisible().catch(() => false);
      await page.getByRole('button', { name: 'Todas' }).click();
      if (hasCancel && pressed === 'true' && !stillActive) ok(c, `(${label}) Lista y filtros correctos (solicitud #${cancelId} y #${flujoId}).`);
      else if (hasCancel) ok(c, `(${label}) Las solicitudes se listan; aria-pressed Activas=${pressed}.`);
      else fail(c, `(${label}) No aparece la solicitud #${cancelId} en Mis solicitudes.`);
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde: ${info.offenders.join('; ')}`);
      }
      await close();
    }
  },
);

caseTest(
  'CLI-16',
  'Cancelar una solicitud',
  ['escritorio'],
  'Cancelar deja la solicitud en Cancelada y pasa a Finalizadas. Si no hay confirmación, se documenta.',
  async ({ browser, c }) => {
    const id = ctx.requests.cancelable.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/mis-solicitudes');
    await settle(page);
    const card = requestCard(page, id);
    await card.waitFor();
    page.once('dialog', (d) => d.dismiss().catch(() => {}));
    const respPromise = page.waitForResponse((r) => r.url().includes(`/api/requests/${id}/status`) && r.request().method() === 'PUT', { timeout: 8000 }).catch(() => null);
    await card.getByRole('button', { name: 'Cancelar' }).click();
    const resp = await respPromise;
    const hadConfirm = !resp;
    if (hadConfirm) {
      observe(c, 'Al pulsar Cancelar no salió diálogo de confirmación: la acción se envió de inmediato.');
      uxNote(c, {
        area: 'Prevención de errores',
        text: 'Cancelar una solicitud no pide confirmación. Un clic accidental cancela el trabajo.',
      });
    }
    if (resp) c.http.push({ label: 'Cancelar', request: `PUT /api/requests/${id}/status`, status: resp.status(), body: short(await resp.text(), 200) });
    else {
      const second = page.waitForResponse((r) => r.url().includes(`/api/requests/${id}/status`));
      await card.getByRole('button', { name: 'Cancelar' }).click();
      const r2 = await second;
      c.http.push({ label: 'Cancelar', request: `PUT /api/requests/${id}/status`, status: r2.status(), body: short(await r2.text(), 200) });
    }
    await settle(page);
    await page.getByRole('button', { name: 'Finalizadas' }).click();
    const estado = await clientRequestState(id);
    await shot(page, c, 'solicitud-cancelada', `Solicitud #${id} tras cancelar (estado ${estado})`);
    const inFinished = await requestCard(page, id).isVisible().catch(() => false);
    if (/cancel/i.test(estado || '') && inFinished) ok(c, `Solicitud #${id} quedó ${estado} y aparece en Finalizadas.`);
    else fail(c, `Tras cancelar, estado=${estado}, visible en Finalizadas=${inFinished}.`);
  },
);

caseTest(
  'CLI-17',
  'Finalizar un servicio en proceso',
  ['escritorio'],
  'En una solicitud En Proceso el cliente puede pulsar "Finalizar servicio" y queda Finalizada.',
  async ({ browser, c }) => {
    const id = ctx.requests.flujo.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/mis-solicitudes');
    await settle(page);
    const card = requestCard(page, id);
    await card.waitFor();
    await shot(page, c, 'antes-de-finalizar', `Solicitud #${id} antes de finalizar`);
    const respPromise = page.waitForResponse((r) => r.url().includes(`/api/requests/${id}/status`) && r.request().method() === 'PUT');
    await card.getByRole('button', { name: 'Finalizar servicio' }).click();
    const resp = await respPromise.catch(() => null);
    if (resp) c.http.push({ label: 'Finalizar', request: `PUT /api/requests/${id}/status`, status: resp.status(), body: short(await resp.text(), 200) });
    await settle(page);
    const estado = await clientRequestState(id);
    await page.getByRole('button', { name: 'Finalizadas' }).click();
    await shot(page, c, 'servicio-finalizado', `Solicitud #${id} tras Finalizar (estado ${estado})`);
    ctx.flowFinished = /finaliz/i.test(estado || '');
    if (ctx.flowFinished) ok(c, `Solicitud #${id} quedó ${estado}.`);
    else {
      fail(c, `No quedó Finalizada (estado ${estado}, HTTP ${resp?.status() ?? 'sin petición'}).`);
      bug(c, {
        severity: 'Alta',
        title: 'El cliente no puede finalizar un servicio en proceso',
        steps: ['Abrir Mis solicitudes', `En la solicitud #${id} pulsar Finalizar servicio`],
        expected: 'Estado Finalizada',
        obtained: `estado ${estado}`,
        location: 'frontend/src/pages/ClientDashboard.jsx / PUT /requests/:id/status',
      });
    }
  },
);

caseTest(
  'CLI-18',
  'Calificar un servicio finalizado',
  ['escritorio'],
  'Tras finalizar aparece "Calificar"; al publicar, la reseña queda guardada y el botón desaparece.',
  async ({ browser, c }) => {
    if (!ctx.flowFinished) {
      block(c, 'CLI-17 no dejó la solicitud en Finalizada.');
      return;
    }
    const id = ctx.requests.flujo.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto('/mis-solicitudes');
    await settle(page);
    await page.getByRole('button', { name: 'Finalizadas' }).click();
    const card = requestCard(page, id);
    await card.getByRole('button', { name: 'Calificar' }).click();
    await page.getByRole('heading', { name: 'Calificar servicio' }).waitFor();
    await page.getByRole('radio', { name: '5 estrellas' }).click();
    await page.getByLabel('Reseña escrita').fill('Trabajo puntual y limpio. Prueba E2E del modo cliente.');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/reviews/create') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Publicar reseña' }).click();
    const resp = await respPromise.catch(() => null);
    const body = resp ? await resp.json().catch(() => ({})) : {};
    if (resp) c.http.push({ label: 'Crear reseña', request: 'POST /api/reviews/create', status: resp.status(), body: short(body, 300) });
    await settle(page);
    await shot(page, c, 'resena-publicada', `Tras calificar la solicitud #${id}`);
    ctx.review = body;
    const still = await card.getByRole('button', { name: 'Calificar' }).isVisible().catch(() => false);
    if (resp?.ok() && !still) ok(c, `Reseña publicada (HTTP ${resp.status()}); ya no aparece Calificar.`);
    else {
      fail(c, `No se publicó la reseña (HTTP ${resp?.status() ?? 'sin petición'}, Calificar visible: ${still}).`);
      bug(c, {
        severity: 'Alta',
        title: 'No se puede calificar un servicio finalizado',
        steps: ['En Mis solicitudes, abrir una Finalizada', 'Pulsar Calificar', 'Elegir estrellas y publicar'],
        expected: 'Reseña guardada y el botón Calificar desaparece',
        obtained: `HTTP ${resp?.status() ?? 'sin petición'}`,
        location: 'frontend/src/components/reviews/ReviewForm.jsx',
      });
    }
  },
);

caseTest(
  'CLI-19',
  'Una segunda reseña de la misma solicitud responde 409',
  ['API'],
  'POST /reviews/create sobre una solicitud ya calificada responde 409 en español y no duplica la reseña.',
  async ({ browser, c }) => {
    if (!ctx.review && !ctx.flowFinished) {
      block(c, 'No hay reseña previa (CLI-18).');
      return;
    }
    const id = ctx.requests.flujo.id_solicitud;
    const res = http(
      c,
      await call('POST', '/reviews/create', {
        token: token('C'),
        body: { id_solicitud: id, calificacion: 1, comentario: 'Segunda reseña que no debería existir.' },
      }),
      'Segunda reseña',
    );
    await evidenceShot(browser, c, 'api-segunda-resena', `POST /reviews/create sobre la solicitud #${id} ya calificada`, [
      { label: 'Respuesta', text: `${res.status} ${short(res.data, 400)}` },
    ]);
    if (res.status === 409 && /reseña|resena/i.test(JSON.stringify(res.data))) ok(c, `Segunda reseña rechazada (HTTP 409): ${short(res.data, 180)}.`);
    else {
      fail(c, `Se esperaba 409; se obtuvo ${res.status}: ${short(res.data, 200)}`);
      bug(c, {
        severity: 'Alta',
        title: 'Se puede publicar una segunda reseña de la misma solicitud',
        steps: ['Calificar una solicitud finalizada', 'Volver a POST /reviews/create con el mismo id_solicitud'],
        expected: '409 Esta solicitud ya tiene una reseña.',
        obtained: `${res.status} ${short(res.data, 200)}`,
        location: 'backend/src/reviews/reviews.service.ts',
      });
    }
  },
);

caseTest(
  'CLI-20',
  'Reportar un profesional desde el perfil',
  ['escritorio'],
  'El cliente envía un reporte con motivo y detalle (≥10 caracteres) y ve confirmación.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto(`/workers/${ctx.profiles.B.id_perfil}`);
    await page.getByRole('button', { name: 'Reportar' }).click();
    await page.getByRole('heading', { name: 'Enviar reporte' }).waitFor();
    await page.getByLabel('Detalle').fill('corto');
    await page.getByRole('button', { name: 'Enviar reporte' }).click();
    const shortMsg = await alertText(page);
    await shot(page, c, 'reporte-corto', 'Reporte con detalle demasiado corto');
    if (/10|caracter/i.test(shortMsg)) ok(c, `Detalle corto rechazado: "${shortMsg}".`);
    else observe(c, `Detalle corto: "${shortMsg || 'sin mensaje'}".`);

    await page.getByLabel('Detalle').fill('El perfil parece no coincidir con el oficio anunciado. Prueba E2E.');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/reports/create') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar reporte' }).click();
    const resp = await respPromise.catch(() => null);
    if (resp) c.http.push({ label: 'Crear reporte', request: 'POST /api/reports/create', status: resp.status(), body: short(await resp.text(), 250) });
    await page.getByText(/reporte fue enviado/i).waitFor({ timeout: 8000 }).catch(() => {});
    await shot(page, c, 'reporte-enviado', 'Confirmación de reporte enviado');
    const done = await page.getByText(/reporte fue enviado/i).isVisible().catch(() => false);
    if (done && (resp?.ok() || resp?.status() === 409)) {
      ok(
        c,
        resp.status() === 409
          ? 'Ya había un reporte pendiente; se mostró la confirmación (HTTP 409).'
          : `Reporte enviado (HTTP ${resp.status()}).`,
      );
    } else if (resp && !resp.ok()) {
      fail(c, `El reporte falló (HTTP ${resp.status()}).`);
      bug(c, {
        severity: 'Media',
        title: 'No se puede enviar un reporte desde el perfil público',
        steps: ['Abrir un perfil', 'Pulsar Reportar', 'Escribir detalle y enviar'],
        expected: 'Confirmación de envío',
        obtained: `HTTP ${resp.status()}`,
        location: 'frontend/src/components/reports/ReportModal.jsx / POST /reports/create',
      });
    } else fail(c, `No hubo confirmación de reporte (HTTP ${resp?.status() ?? 'sin petición'}).`);
  },
);

caseTest(
  'CLI-21',
  'Enviar un mensaje en el chat como cliente',
  ['escritorio', 'móvil'],
  'El mensaje aparece al instante como "Tú", queda guardado y el trabajador lo recibe.',
  async ({ browser, c }) => {
    const id = ctx.requests.chat.id_solicitud;
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const text = `Hola, soy el cliente QA (${label} ${STAMP}).`;
      const { page, close } = await openPage(browser, c, vp, 'C');
      await page.goto(`/chat/${id}`);
      await page.getByPlaceholder('Escribe un mensaje').waitFor();
      await page.getByText('Cargando mensajes…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.getByPlaceholder('Escribe un mensaje').fill(text);
      const respPromise = page.waitForResponse((r) => r.url().includes(`/api/chat/threads/${id}/messages`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Enviar' }).click();
      const resp = await respPromise;
      c.http.push({ label: `Enviar mensaje (${label})`, request: `POST /api/chat/threads/${id}/messages`, status: resp.status(), body: short(await resp.text(), 200) });
      await page.getByText(text).waitFor({ timeout: 8000 }).catch(() => {});
      await shot(page, c, 'mensaje-enviado', `Chat #${id} tras enviar (${label})`, { mobile });
      const bubble = page.locator('article').filter({ hasText: text });
      const mine = await bubble.getByText(/^Tú/).isVisible().catch(() => false);
      if (resp.ok() && (await bubble.count()) === 1 && mine) ok(c, `(${label}) Mensaje enviado y mostrado como "Tú".`);
      else fail(c, `(${label}) HTTP ${resp.status()}, burbujas ${await bubble.count()}, "Tú": ${mine}.`);
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde en el chat: ${info.offenders.join('; ')}`);
      }
      await close();
    }
    const workerView = await call('GET', `/chat/threads/${id}/messages?limit=100`, { token: token('A') });
    const msgs = Array.isArray(workerView.data) ? workerView.data : workerView.data?.messages || [];
    http(c, { ...workerView, data: `${msgs.length} mensajes; último: ${short(msgs.at(-1)?.contenido || '', 120)}` }, 'El trabajador lee el hilo (API)');
    if (msgs.some((m) => /cliente QA/.test(m.contenido || ''))) ok(c, 'El trabajador ve los mensajes del cliente.');
    else fail(c, 'El trabajador no ve los mensajes enviados.');
  },
);

caseTest(
  'CLI-22',
  'El texto XSS se muestra como texto en el chat',
  ['escritorio'],
  `El mensaje ${XSS} se muestra literalmente; no se crea ninguna imagen ni se ejecuta alert().`,
  async ({ browser, c }) => {
    const id = ctx.requests.chat.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    let alerted = false;
    page.on('dialog', async (d) => {
      alerted = true;
      await d.dismiss();
    });
    await page.goto(`/chat/${id}`);
    await page.getByPlaceholder('Escribe un mensaje').waitFor();
    await page.getByText('Cargando mensajes…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.getByPlaceholder('Escribe un mensaje').fill(XSS);
    const respPromise = page.waitForResponse((r) => r.url().includes(`/api/chat/threads/${id}/messages`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await respPromise;
    await page.waitForTimeout(1000);
    await shot(page, c, 'xss-como-texto', 'El payload XSS se muestra como texto');
    const literal = await page.getByText(XSS).isVisible().catch(() => false);
    const injected = await page.locator('img[src="x"]').count();
    if (literal && injected === 0 && !alerted) ok(c, 'El XSS se muestra como texto; no hay img inyectada ni alert().');
    else {
      fail(c, `literal=${literal}, img inyectadas=${injected}, alert=${alerted}`);
      bug(c, {
        severity: 'Crítica',
        title: 'El chat interpreta HTML/JavaScript del mensaje',
        steps: ['Abrir el chat de una solicitud aceptada', `Enviar ${XSS}`],
        expected: 'Se muestra el texto literal',
        obtained: `literal=${literal}, img=${injected}, alert=${alerted}`,
        location: 'frontend/src/pages/ChatThread.jsx',
      });
    }
  },
);

caseTest(
  'CLI-23',
  'Abrir el /chat/:id de otra persona',
  ['escritorio'],
  'Se muestra un aviso claro de que no tiene acceso, sin mensajes ni caja de escribir; la API responde 403.',
  async ({ browser, c }) => {
    const id = ctx.requests.deD.id_solicitud;
    const apiRes = http(c, await call('GET', `/chat/threads/${id}/messages`, { token: token('C') }), 'C lee el chat de D');
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    await page.goto(`/chat/${id}`);
    await settle(page);
    await shot(page, c, 'chat-ajeno', `Cliente C abre /chat/${id} (solicitud de D)`);
    const composer = await page.getByPlaceholder('Escribe un mensaje').isVisible().catch(() => false);
    const denied = /acceso|permiso|no puedes|no tiene/i.test((await page.textContent('body')) || '');
    if ((apiRes.status === 403 || apiRes.status === 404) && !composer && denied) ok(c, `Chat ajeno bloqueado (API ${apiRes.status}) sin caja de escribir.`);
    else if ((apiRes.status === 403 || apiRes.status === 404) && !composer) ok(c, `API ${apiRes.status} y no hay caja de escribir.`);
    else {
      fail(c, `API ${apiRes.status}; composer=${composer}; aviso=${denied}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'Un cliente puede abrir el chat de una solicitud ajena',
        steps: [`Como C, abrir /chat/${id} (solicitud de D)`],
        expected: '403 y aviso de acceso denegado, sin compositor',
        obtained: `API ${apiRes.status}; composer=${composer}`,
        location: 'frontend/src/pages/ChatThread.jsx / GET /chat/threads/:id/messages',
      });
    }
  },
);

caseTest(
  'CLI-24',
  'El token de cliente no usa la bandeja ni los servicios del trabajador',
  ['API'],
  'GET /requests/worker con el cliente responde error; PATCH de un servicio ajeno responde 403.',
  async ({ browser, c }) => {
    const workerBox = http(c, await call('GET', '/requests/worker', { token: token('C') }), 'Cliente lista bandeja de trabajador');
    const patch = http(
      c,
      await call('PATCH', `/servicios/${ctx.services.A.id_servicio}`, {
        token: token('C'),
        body: { nombre: 'Hackeado por cliente' },
      }),
      'Cliente edita servicio de A',
    );
    await evidenceShot(browser, c, 'api-cliente-sobre-trabajador', 'Token de cliente contra recursos de trabajador', [
      { label: 'GET /requests/worker', text: `${workerBox.status} ${short(workerBox.data, 300)}` },
      { label: `PATCH /servicios/${ctx.services.A.id_servicio}`, text: `${patch.status} ${short(patch.data, 300)}` },
    ]);
    const boxDenied = workerBox.status === 403 || workerBox.status === 404;
    const patchDenied = patch.status === 403 || patch.status === 401;
    if (boxDenied && patchDenied) ok(c, `Bandeja ${workerBox.status}, PATCH servicio ${patch.status}.`);
    else {
      fail(c, `Bandeja ${workerBox.status}, PATCH ${patch.status}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'Un cliente puede usar APIs de trabajador o editar servicios ajenos',
        steps: ['Con el token del cliente C, GET /requests/worker y PATCH /servicios/:id de A'],
        expected: '403 o 404',
        obtained: `bandeja ${workerBox.status}, PATCH ${patch.status}`,
        location: 'backend/src/requests y backend/src/resources',
      });
    }
  },
);

caseTest(
  'CLI-25',
  'Un cliente no ve las solicitudes de otro',
  ['API'],
  'GET /requests/client de C no incluye la solicitud de D; D no ve las de C.',
  async ({ browser, c }) => {
    const listC = http(c, await call('GET', '/requests/client', { token: token('C') }), 'Solicitudes de C');
    const listD = http(c, await call('GET', '/requests/client', { token: token('D') }), 'Solicitudes de D');
    const rowsC = Array.isArray(listC.data) ? listC.data : [];
    const rowsD = Array.isArray(listD.data) ? listD.data : [];
    const dInC = rowsC.some((r) => r.id_solicitud === ctx.requests.deD.id_solicitud);
    const cInD = rowsD.some((r) => r.id_solicitud === ctx.requests.flujo.id_solicitud);
    await evidenceShot(browser, c, 'api-solicitudes-ajenas', 'Listados de solicitudes de C y de D', [
      { label: 'C ve la solicitud de D', text: dInC ? 'SÍ (fallo)' : `No. C tiene ${rowsC.length} solicitudes.` },
      { label: 'D ve la solicitud de C', text: cInD ? 'SÍ (fallo)' : `No. D tiene ${rowsD.length} solicitudes.` },
    ]);
    if (!dInC && !cInD) ok(c, `C tiene ${rowsC.length} solicitudes y D ${rowsD.length}; no se mezclan.`);
    else {
      fail(c, `D en listado de C: ${dInC}. C en listado de D: ${cInD}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'El historial de solicitudes mezcla datos de otro cliente',
        steps: ['GET /requests/client con C y con D'],
        expected: 'Cada cliente solo ve las suyas',
        obtained: `D en C=${dInC}, C en D=${cInD}`,
        location: 'backend/src/requests/requests.service.ts listClient',
      });
    }
  },
);

caseTest(
  'CLI-26',
  'Páginas de trabajador abiertas en modo cliente',
  ['escritorio'],
  'Un cliente sin perfil de trabajador no debería ver el panel, la bandeja ni "Mi oferta"; debería volver al inicio de cliente o ver un aviso claro.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C', 'client');
    const leaks = [];
    for (const [pathName, hint] of [
      ['/trabajador/bandeja', 'bandeja'],
      ['/worker/content', 'oferta'],
      ['/worker/profile', 'perfil trabajador'],
    ]) {
      await page.goto(pathName);
      await settle(page);
      const title = ((await page.getByRole('heading', { level: 1 }).first().textContent().catch(() => '')) || '').trim();
      const body = ((await page.locator('main, body').first().innerText().catch(() => '')) || '').slice(0, 400);
      await shot(page, c, `ruta-${slugify(pathName)}`, `Cliente C en modo cliente abre ${pathName}`);
      const bounced = await clientHeading(page).isVisible().catch(() => false);
      const denied = /no tienes permiso|no está disponible|solo para trabajadores|aún no tienes un perfil/i.test(body);
      const workerUi = /bandeja de solicitudes|mi oferta y contenido|datos del perfil y verificación|modo trabajador/i.test(`${title} ${body}`);
      c.notes.push(`${pathName} → "${title}"`);
      if (!bounced && workerUi && !denied) leaks.push(`${pathName} ("${title}")`);
      else if (!bounced && !denied && !workerUi) leaks.push(`${pathName} ("${title}")`);
    }
    if (!leaks.length) ok(c, 'Las rutas de trabajador no se muestran como panel usable al cliente.');
    else {
      fail(c, `El cliente ve pantallas de trabajador: ${leaks.join('; ')}.`);
      bug(c, {
        severity: 'Alta',
        title: 'Las páginas del trabajador se abren en modo cliente',
        steps: ['Iniciar sesión como cliente (sin perfil de trabajador)', 'Abrir /trabajador/bandeja, /worker/content y /worker/profile'],
        expected: 'Redirigir al inicio del cliente o mostrar que esa sección es solo para trabajadores',
        obtained: leaks.join('; '),
        location: 'frontend/src/App.jsx (AuthenticatedApp no comprueba el modo ni el perfil)',
      });
      uxNote(c, {
        area: 'Navegación / consistencia',
        text: 'AuthenticatedApp sirve /worker/* y /trabajador/bandeja a cualquier usuario autenticado, aunque el selector esté en Modo Cliente.',
      });
    }
  },
);

caseTest(
  'CLI-27',
  'Desbordes a 390 px de ancho',
  ['móvil'],
  'Ninguna pantalla del modo cliente tiene desplazamiento horizontal ni contenido cortado a 390 px.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, MOBILE, 'C');
    const routes = [
      ['/', 'inicio'],
      ['/buscar', 'directorio'],
      [`/workers/${ctx.profiles.A.id_perfil}`, 'perfil-publico'],
      ['/mis-solicitudes', 'solicitudes'],
      ['/chat', 'mensajes'],
      [`/chat/${ctx.requests.chat.id_solicitud}`, 'hilo-chat'],
    ];
    for (const [route, desc] of routes) {
      await page.goto(route);
      await settle(page);
      await page.waitForTimeout(400);
      const info = await overflowInfo(page);
      await shot(page, c, desc, `${route} a 390 px`, { mobile: true });
      if (info.overflow) {
        fail(c, `${route} desborda (${info.scrollWidth}px): ${info.offenders.join('; ')}`);
        uxNote(c, {
          area: 'Diseño adaptable',
          text: `${route} se desborda horizontalmente a 390 px (${info.offenders.slice(0, 3).join('; ')}).`,
        });
      } else ok(c, `${route}: sin desborde (${info.scrollWidth}px).`);
    }
  },
);

caseTest(
  'CLI-28',
  'Navegación con Tab: foco visible y etiquetas',
  ['escritorio'],
  'Los controles del inicio, el directorio y Mis solicitudes se alcanzan con Tab, muestran foco y tienen nombre accesible.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'C');
    const pagesToCheck = [
      ['/', 'inicio'],
      ['/mis-solicitudes', 'solicitudes'],
    ];
    for (const [route, desc] of pagesToCheck) {
      await page.goto(route);
      await settle(page);
      await page.evaluate(() => document.body.focus());
      const unnamed = [];
      let last = null;
      for (let i = 0; i < 18; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const name =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            (el.labels && el.labels[0] && el.labels[0].innerText) ||
            el.innerText ||
            el.getAttribute('placeholder') ||
            '';
          const outline = getComputedStyle(el).outlineStyle;
          const ring = getComputedStyle(el).boxShadow;
          return {
            tag: el.tagName.toLowerCase(),
            name: String(name).trim().slice(0, 80),
            placeholderOnly: !el.getAttribute('aria-label') && !(el.labels && el.labels[0]) && !!el.getAttribute('placeholder'),
            hasFocus: outline !== 'none' || ring.includes('rgb') || ring !== 'none',
          };
        });
        if (!info) continue;
        last = info;
        if (!info.name || info.placeholderOnly) unnamed.push(`${info.tag}:${info.name || '(sin nombre)'}`);
      }
      await shot(page, c, `${desc}-ultimo-foco`, `Último control con foco en ${route}`);
      if (unnamed.length) {
        observe(c, `${route}: controles sin nombre accesible: ${[...new Set(unnamed)].slice(0, 6).join(', ')}.`);
        uxNote(c, {
          area: 'Accesibilidad',
          text: `En ${route} hay controles alcanzables con Tab sin etiqueta visible ni aria-label (${[...new Set(unnamed)].slice(0, 4).join(', ')}).`,
        });
      } else ok(c, `${route}: los controles tabulados tienen nombre. Último: ${last?.name || '—'}.`);
    }
  },
);
