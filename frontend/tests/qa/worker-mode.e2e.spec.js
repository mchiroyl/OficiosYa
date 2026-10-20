// Prueba E2E del modo trabajador (TRB-01 … TRB-28) contra el backend real.
// Solo prueba y documenta: no modifica la aplicación. Cada caso registra su resultado
// en qa-reports/worker/results.json y sus capturas en qa-reports/worker/screenshots/.
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'qa-reports', 'worker');
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
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

const CREDS = {
  A: { email: process.env.QA_WORKER_A_EMAIL, password: process.env.QA_WORKER_A_PASSWORD },
  B: { email: process.env.QA_WORKER_B_EMAIL, password: process.env.QA_WORKER_B_PASSWORD },
  C: { email: process.env.QA_CLIENT_EMAIL, password: process.env.QA_CLIENT_PASSWORD },
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
  photos: {},
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

// ---------- Registro por caso ----------

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

async function openPage(browser, c, viewport, who, mode = 'worker') {
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

// ---------- Datos de prueba ----------

async function makeImages(browser) {
  fs.mkdirSync(FIXTURES, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.setContent(`<body style="margin:0;width:800px;height:600px;background:linear-gradient(135deg,#0f766e,#f59e0b);display:grid;place-items:center;font:700 54px Segoe UI">
    <div style="background:#fff;padding:24px 36px;border-radius:16px">Trabajo QA</div></body>`);
  const png = await page.screenshot({ type: 'png' });
  await page.setContent('<body style="margin:0;width:800px;height:600px;background:#1e3a8a;color:#fff;display:grid;place-items:center;font:700 48px Segoe UI">DPI DE PRUEBA</body>');
  const dpi = await page.screenshot({ type: 'jpeg', quality: 80 });
  await context.close();

  const files = {
    portfolio: path.join(FIXTURES, 'trabajo-qa.png'),
    dpi: path.join(FIXTURES, 'dpi-prueba.jpg'),
    text: path.join(FIXTURES, 'documento.txt'),
    big: path.join(FIXTURES, 'imagen-9mb.jpg'),
  };
  fs.writeFileSync(files.portfolio, png);
  fs.writeFileSync(files.dpi, dpi);
  fs.writeFileSync(files.text, 'Esto no es una imagen. Archivo de prueba QA.\n');
  const big = Buffer.alloc(9 * 1024 * 1024, 0x41);
  dpi.copy(big, 0, 0, Math.min(dpi.length, big.length));
  fs.writeFileSync(files.big, big);
  ctx.files = files;
  ctx.pngBuffer = png;
}

async function seed(browser) {
  for (const who of ['A', 'B', 'C']) {
    const res = await call('POST', '/auth/login', {
      body: { correo: CREDS[who].email, password: CREDS[who].password, rememberMe: true },
    });
    if (!res.ok) throw new Error(`Login API de ${who} falló (${res.status}): ${short(res.data, 200)}`);
    ctx.sessions[who] = res.data;
    report.meta.accounts[who] = {
      email: CREDS[who].email,
      id_usuario: res.data.user?.id_usuario,
      rol: who === 'C' ? 'cliente' : `trabajador ${who}`,
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
        tarifas: { tipo: 'por_servicio', monto_desde: 100, monto_hasta: 300, moneda: 'GTQ' },
        horarios: [{ dia: 'lunes', desde: '08:00', hasta: '17:00' }],
        cobertura,
        contacto_visible: true,
      },
    });
    if (!res.ok) throw new Error(`No se pudo preparar el perfil de ${who}: ${res.status} ${short(res.data, 200)}`);
    await call('PUT', '/worker/availability', { token: token(who), body: { disponibilidad: 'Disponible' } });
  }
  report.seedNotes.push(
    `Perfiles A y B preparados por API: tarifa por servicio Q100–Q300, horario lunes 08:00–17:00, zona "${ctx.zones[0]?.nombre || 'ninguna'}", Disponible.`,
  );

  for (const who of ['A', 'B']) {
    const res = await call('POST', '/servicios', {
      token: token(who),
      body: {
        id_perfil: ctx.profiles[who].id_perfil,
        id_categoria: (who === 'A' ? ctx.catMain : ctx.catOther).id_categoria,
        nombre: `QA Servicio base ${who}`,
        descripcion: `Servicio semilla de la prueba E2E (${who}).`,
        activo: true,
      },
    });
    if (!res.ok) throw new Error(`No se pudo crear el servicio semilla de ${who}: ${res.status} ${short(res.data, 200)}`);
    ctx.services[who] = res.data;
  }
  report.seedNotes.push('Se creó por API un servicio semilla para A y otro para B (necesarios para recibir solicitudes).');

  const form = new FormData();
  form.append('file', new Blob([ctx.pngBuffer], { type: 'image/png' }), 'trabajo-b.png');
  form.append('titulo', 'Foto semilla B');
  const photo = await call('POST', '/portfolio/upload', { token: token('B'), form });
  if (photo.ok) {
    ctx.photos.B = photo.data;
    report.seedNotes.push('Se subió por API una foto al portafolio de B (para el caso TRB-17).');
  } else {
    report.seedNotes.push(`No se pudo subir la foto semilla de B (${photo.status}): ${short(photo.data, 200)}`);
  }

  const makeRequest = async (who, key, descripcion) => {
    const res = await call('POST', '/requests/create', {
      token: token('C'),
      body: {
        id_trabajador: ctx.profiles[who].id_perfil,
        id_servicio: ctx.services[who].id_servicio,
        descripcion,
        ubicacion_aprox: 'El Asintal, zona centro',
      },
    });
    if (!res.ok) throw new Error(`No se pudo crear la solicitud ${key}: ${res.status} ${short(res.data, 200)}`);
    ctx.requests[key] = res.data;
  };
  await makeRequest('A', 'flujo', `QA flujo completo ${STAMP}: revisar instalación eléctrica de la cocina.`);
  await makeRequest('A', 'rechazo', `QA rechazo ${STAMP}: cambiar tomacorrientes de la sala.`);
  await makeRequest('A', 'ajena', `QA permisos y chat ${STAMP}: revisar breaker que se dispara.`);
  await makeRequest('B', 'deB', `QA solicitud para B ${STAMP}: fuga en lavamanos del baño.`);
  report.seedNotes.push(
    `Con la cuenta de cliente se crearon 4 solicitudes por API: #${ctx.requests.flujo.id_solicitud}, #${ctx.requests.rechazo.id_solicitud} y #${ctx.requests.ajena.id_solicitud} para A; #${ctx.requests.deB.id_solicitud} para B.`,
  );
}

test.use({ baseURL: BASE, viewport: DESKTOP });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  report.meta.browser = `${browser.browserType().name()} ${browser.version()}`;
  if (missingEnv.length) return;
  try {
    fs.rmSync(SHOTS, { recursive: true, force: true });
    await makeImages(browser);
    await seed(browser);
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

// ---------- Helpers de UI ----------

async function uiLoginWorker(page, email, password) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Modo Trabajador' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
}

const workerHeading = (page) => page.getByRole('heading', { name: /Tu panel de\s*trabajo/i });

function requestCard(page, id) {
  return page.locator('li').filter({ has: page.getByText(`#${id}`, { exact: true }) });
}

// Pulsa el botón del formulario; si no sale ninguna petición, prueba Enter en un campo de texto
// (envío implícito del formulario) para poder seguir comprobando el resto del caso.
async function submitForm(page, button, textField, urlPart) {
  const first = page
    .waitForResponse((r) => r.url().includes(urlPart) && r.request().method() === 'POST', { timeout: 6000 })
    .catch(() => null);
  await button.click();
  const viaClick = await first;
  if (viaClick) return { resp: viaClick, via: 'clic' };
  const second = page
    .waitForResponse((r) => r.url().includes(urlPart) && r.request().method() === 'POST', { timeout: 45000 })
    .catch(() => null);
  await textField.press('Enter');
  return { resp: await second, via: 'Enter' };
}

async function requestState(id) {
  const res = await call('GET', '/requests/worker', { token: token('A') });
  const row = Array.isArray(res.data) ? res.data.find((r) => r.id_solicitud === id) : null;
  return row?.estado || null;
}

const ACTION_NAMES = ['Chat', 'Aceptar', 'Rechazar', 'Iniciar trabajo', 'Confirmar cierre'];

async function visibleButtons(card) {
  const names = [];
  for (const el of await card.locator('button, a').all()) {
    if (!(await el.isVisible())) continue;
    const text = ((await el.textContent()) || '').trim();
    if (ACTION_NAMES.includes(text)) names.push(text);
  }
  return [...new Set(names)];
}

// ======================= CASOS =======================

caseTest(
  'TRB-01',
  'Inicio de sesión con el selector de trabajador',
  ['escritorio', 'móvil'],
  'Con "Modo Trabajador" seleccionado, el formulario dice "Ingresa como trabajador" y tras entrar se abre el panel del trabajador.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp);
      await uiLoginWorker(page, CREDS.A.email, CREDS.A.password);
      const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
      await shot(page, c, 'login-modo-trabajador', `Pantalla de login con "Modo Trabajador" seleccionado (${label})`, { mobile });
      if (!/trabajador/i.test(heading || '')) fail(c, `(${label}) El título del login no cambia a trabajador: "${heading}".`);
      const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
      await page.getByRole('button', { name: 'Entrar como trabajador' }).click();
      const resp = await loginResp;
      c.http.push({ label: `Login (${label})`, request: 'POST /api/auth/login', status: resp.status(), body: '' });
      const landed = await workerHeading(page).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      await settle(page);
      await shot(page, c, 'panel-tras-login', `Panel tras iniciar sesión como trabajador (${label})`, { mobile });
      const mode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
      if (landed && mode === 'worker') ok(c, `(${label}) Login correcto: abre "Tu panel de trabajo" y guarda modo "worker".`);
      else fail(c, `(${label}) Tras el login no se mostró el panel del trabajador (modo guardado: ${mode}).`);
      await close();
    }
  },
);

caseTest(
  'TRB-02',
  'Contraseña incorrecta',
  ['escritorio'],
  'Se muestra un mensaje claro en español ("Correo o contraseña incorrectos."), no se crea sesión y el formulario sigue utilizable.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await uiLoginWorker(page, CREDS.A.email, 'Incorrecta-QA-123');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.getByRole('button', { name: 'Entrar como trabajador' }).click();
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
        steps: ['Ir a /login', 'Seleccionar Modo Trabajador', 'Escribir un correo válido y una contraseña incorrecta', 'Pulsar "Entrar como trabajador"'],
        expected: 'Mensaje en español: "Correo o contraseña incorrectos."',
        obtained: `Mensaje: "${message}"`,
        location: 'frontend/src/api/client.js (readMessage)',
      });
    }
    if (resp.status() !== 401) observe(c, `El backend responde HTTP ${resp.status()} (se esperaba 401).`);
  },
);

caseTest(
  'TRB-03',
  'El cambio de modo se mantiene al recargar',
  ['escritorio'],
  'Al cambiar a Modo Cliente y recargar, sigue en cliente; al volver a Modo Trabajador y recargar, sigue el panel del trabajador.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await uiLoginWorker(page, CREDS.A.email, CREDS.A.password);
    await page.getByRole('button', { name: 'Entrar como trabajador' }).click();
    await workerHeading(page).waitFor();
    await settle(page);

    await page.getByRole('button', { name: 'Modo Cliente' }).first().click();
    await settle(page);
    await page.reload();
    await settle(page);
    const clientMode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
    const stillWorker = await workerHeading(page).isVisible().catch(() => false);
    await shot(page, c, 'modo-cliente-tras-recargar', 'Después de cambiar a Modo Cliente y recargar');
    if (clientMode === 'client' && !stillWorker) ok(c, 'Modo Cliente se mantiene tras recargar.');
    else fail(c, `Tras recargar no se mantuvo Modo Cliente (modo guardado: ${clientMode}).`);

    await page.getByRole('button', { name: 'Modo Trabajador' }).first().click();
    await workerHeading(page).waitFor({ timeout: 10000 }).catch(() => {});
    await page.reload();
    await settle(page);
    const workerVisible = await workerHeading(page).isVisible().catch(() => false);
    const workerMode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
    const pressed = await page.getByRole('button', { name: 'Modo Trabajador' }).first().getAttribute('aria-pressed');
    await shot(page, c, 'modo-trabajador-tras-recargar', 'Después de volver a Modo Trabajador y recargar');
    if (workerVisible && workerMode === 'worker') ok(c, `Modo Trabajador se mantiene tras recargar (aria-pressed="${pressed}").`);
    else fail(c, `Tras recargar no se mantuvo Modo Trabajador (modo: ${workerMode}).`);
  },
);

caseTest(
  'TRB-04',
  'Enlace directo a /worker/content sin sesión',
  ['escritorio'],
  'Sin sesión redirige a /login; tras iniciar sesión regresa a /worker/content.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP);
    await page.goto('/worker/content');
    await page.waitForURL('**/login', { timeout: 10000 }).catch(() => {});
    await settle(page);
    const url1 = new URL(page.url()).pathname;
    await shot(page, c, 'redirige-a-login', 'Al abrir /worker/content sin sesión');
    const leaked = await page.getByRole('heading', { name: /Servicios, portafolio/i }).isVisible().catch(() => false);
    if (url1 === '/login' && !leaked) ok(c, 'Sin sesión redirige a /login sin mostrar contenido privado.');
    else fail(c, `Sin sesión la URL quedó en ${url1} (contenido privado visible: ${leaked}).`);

    await page.getByRole('button', { name: 'Modo Trabajador' }).click();
    await page.getByLabel('Correo electrónico').fill(CREDS.A.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(CREDS.A.password);
    await page.getByRole('button', { name: 'Entrar como trabajador' }).click();
    await workerHeading(page).waitFor({ timeout: 15000 }).catch(() => {});
    await settle(page);
    const url2 = new URL(page.url()).pathname;
    await shot(page, c, 'destino-tras-login', 'Destino después de iniciar sesión desde el enlace directo');
    if (url2 === '/worker/content') ok(c, 'Tras el login regresa a /worker/content.');
    else {
      observe(c, `Tras el login se pierde el enlace original: termina en "${url2}" en lugar de /worker/content.`);
      uxNote(c, {
        area: 'Navegación',
        text: 'Al abrir un enlace privado sin sesión, el login siempre lleva al panel ("/") y se pierde la página que el usuario quería abrir.',
      });
    }
  },
);

caseTest(
  'TRB-05',
  'Panel del trabajador (WorkerHome)',
  ['escritorio', 'móvil'],
  'El panel carga sin errores, muestra la disponibilidad y los cuatro accesos rápidos, y en móvil no hay desbordes.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp, 'A');
      await page.goto('/');
      await workerHeading(page).waitFor();
      await settle(page);
      await shot(page, c, 'panel-trabajador', `Panel del trabajador (${label})`, { mobile });
      const err = await alertText(page);
      if (err) fail(c, `(${label}) Error visible en el panel: "${err}".`);
      const status = await page.getByText(/Estado en el directorio:/).textContent().catch(() => '');
      const tiles = await page.locator('main button').filter({ hasText: /Bandeja|Mi oferta|Vista cliente|Verificación DPI/ }).count();
      if (status && tiles === 4) ok(c, `(${label}) Se ve "${status.trim()}" y los 4 accesos rápidos.`);
      else fail(c, `(${label}) Faltan elementos: estado="${status}", accesos=${tiles}.`);
      const pending = await page.getByText(/nueva\(s\)/).textContent().catch(() => '');
      if (pending) ok(c, `(${label}) El acceso a la bandeja indica "${pending.trim()}".`);
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) {
          fail(c, `(móvil) Desborde horizontal: ancho de página ${info.scrollWidth}px > ${info.width}px. Elementos: ${info.offenders.join('; ')}`);
          bug(c, {
            severity: 'Media',
            title: 'El panel del trabajador se desborda horizontalmente en móvil',
            steps: ['Iniciar sesión como trabajador', 'Abrir "/" con pantalla de 390 px de ancho'],
            expected: 'Sin desplazamiento horizontal',
            obtained: `scrollWidth=${info.scrollWidth}px; ${info.offenders.join('; ')}`,
          });
        }
      }
      await close();
    }
  },
);

caseTest(
  'TRB-06',
  'Cambiar disponibilidad y recargar',
  ['escritorio'],
  'El interruptor cambia Disponible ↔ Ocupado, el cambio se guarda en el servidor y se mantiene al recargar.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/');
    await workerHeading(page).waitFor();
    await settle(page);
    const statusLine = page.getByText(/Estado en el directorio:/);
    const before = (await statusLine.textContent()).replace(/.*:\s*/, '').trim();
    const sw = page.locator('main label:has(input[type="checkbox"])').first();
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/worker/availability'));
    await sw.click();
    const resp = await respPromise;
    c.http.push({ label: 'Cambio de disponibilidad', request: 'PUT /api/worker/availability', status: resp.status(), body: short(await resp.text(), 200) });
    await page.waitForTimeout(500);
    const after = (await statusLine.textContent()).replace(/.*:\s*/, '').trim();
    await shot(page, c, 'tras-cambiar-disponibilidad', `Tras pulsar el interruptor: ${before} → ${after}`);
    await page.reload();
    await workerHeading(page).waitFor();
    await settle(page);
    const reloaded = (await page.getByText(/Estado en el directorio:/).textContent()).replace(/.*:\s*/, '').trim();
    await shot(page, c, 'disponibilidad-tras-recargar', `Disponibilidad tras recargar: ${reloaded}`);
    const apiState = http(c, await call('GET', '/worker/profile', { token: token('A') }), 'Perfil tras el cambio');
    if (before !== after && after === reloaded && apiState.data?.disponibilidad === after) {
      ok(c, `Cambio ${before} → ${after}; se mantiene al recargar y el servidor guarda "${apiState.data.disponibilidad}".`);
    } else {
      fail(c, `Antes "${before}", después "${after}", tras recargar "${reloaded}", servidor "${apiState.data?.disponibilidad}".`);
    }
    const name = await page.locator('main input[type="checkbox"]').first().evaluate((el) =>
      (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.title || '').trim(),
    );
    if (!name) {
      observe(c, 'El interruptor de disponibilidad no tiene nombre accesible (un lector de pantalla solo dice "casilla").');
      uxNote(c, {
        area: 'Accesibilidad',
        text: 'El interruptor de "Disponibilidad inmediata" del panel no tiene etiqueta ni aria-label; un lector de pantalla no sabe qué controla.',
      });
    }
    await call('PUT', '/worker/availability', { token: token('A'), body: { disponibilidad: 'Disponible' } });
    c.notes.push('Al terminar, la disponibilidad de A se dejó en "Disponible" por API para no afectar los demás casos.');
  },
);

caseTest(
  'TRB-07',
  'Accesos rápidos y las rutas que abren',
  ['escritorio'],
  'Cada tarjeta abre la sección que promete: Bandeja → bandeja; Mi oferta → tarifas, zonas, horarios y portafolio; Vista cliente → modo cliente; Verificación DPI → sección DPI.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    const tiles = [
      { name: 'Bandeja de solicitudes', expect: '/trabajador/bandeja' },
      { name: 'Mi oferta y contenido', expect: '/worker/content' },
      { name: 'Verificación DPI', expect: '/worker/profile' },
      { name: 'Vista cliente', expect: '/mis-solicitudes' },
    ];
    const seen = [];
    for (const tile of tiles) {
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('oficiosya.mode', 'worker'));
      await page.reload();
      await workerHeading(page).waitFor();
      await page.locator('main button').filter({ hasText: tile.name }).click();
      await page.waitForTimeout(800);
      await settle(page);
      const pathName = new URL(page.url()).pathname;
      const h1 = ((await page.getByRole('heading', { level: 1 }).first().textContent().catch(() => '')) || '').trim();
      const mode = await page.evaluate(() => localStorage.getItem('oficiosya.mode'));
      seen.push({ ...tile, pathName, h1, mode });
      await shot(page, c, `acceso-${tile.name}`, `Acceso rápido "${tile.name}" → ${pathName} (${h1})`);
      if (pathName !== tile.expect) fail(c, `"${tile.name}" abre ${pathName} (se esperaba ${tile.expect}).`);
      else ok(c, `"${tile.name}" abre ${pathName} — "${h1}".`);
    }
    const vista = seen.find((s) => s.name === 'Vista cliente');
    if (vista?.mode === 'worker') {
      observe(c, '"Vista cliente" abre /mis-solicitudes pero el selector sigue en Modo Trabajador.');
      uxNote(c, {
        area: 'Navegación',
        text: 'La tarjeta "Vista cliente" lleva a "Mis solicitudes" sin cambiar el modo: la cabecera sigue mostrando el menú del trabajador.',
        evidence: [c.evidence[2]?.file].filter(Boolean),
      });
    }
    const dpi = seen.find((s) => s.name === 'Verificación DPI');
    const oferta = seen.find((s) => s.name.startsWith('Mi oferta'));
    if (dpi && oferta && dpi.pathName === oferta.pathName) {
      observe(c, '"Mi oferta" y "Verificación DPI" abren exactamente la misma página, sin llevar a la sección de DPI.');
      uxNote(c, {
        area: 'Navegación',
        text: '"Verificación DPI" abre /worker/profile desde arriba (igual que "Mi oferta"); el usuario debe buscar la sección DPI. Además "Mi oferta" promete "portafolio", pero el portafolio está en /worker/content.',
        evidence: [c.evidence[1]?.file, c.evidence[3]?.file].filter(Boolean),
      });
    }
  },
);

caseTest(
  'TRB-08',
  'Página /worker/profile',
  ['escritorio', 'móvil'],
  'La página carga los datos del perfil, mantiene la navegación del sitio y se adapta al móvil.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp, 'A');
      await page.goto('/worker/profile');
      await page.getByRole('heading', { name: /Datos del perfil y verificación|Perfil y disponibilidad/ }).waitFor();
      await settle(page);
      await shot(page, c, 'perfil-trabajador', `Página "Perfil y disponibilidad" (${label})`, { mobile });
      const err = await alertText(page);
      if (err) fail(c, `(${label}) Error visible: "${err}".`);
      const desde = await page.locator('#tarifa-desde').inputValue().catch(() => '');
      if (desde) ok(c, `(${label}) Carga los datos guardados (monto desde = ${desde}).`);
      else fail(c, `(${label}) No se cargaron las tarifas guardadas.`);
      const hasNav = await page.locator('header nav, nav').count();
      if (!hasNav && !mobile) {
        observe(c, 'La página no tiene la cabecera/menú del sitio; solo hay un enlace "Volver al menú principal".');
        uxNote(c, {
          area: 'Navegación / consistencia',
          text: '/worker/profile no usa AppHeader: desaparecen el menú (Panel, Bandeja, Chat…) y el selector de modo, a diferencia del resto de páginas del trabajador.',
        });
      }
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde horizontal ${info.scrollWidth}px: ${info.offenders.join('; ')}`);
        else ok(c, '(móvil) Sin desborde horizontal.');
      }
      await close();
    }
  },
);

caseTest(
  'TRB-09',
  'Tarifa "desde" mayor que "hasta" y valores negativos',
  ['escritorio'],
  'Ambos casos se rechazan antes de guardar con un mensaje claro en español junto al campo; no se guarda nada inválido.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/profile');
    await page.locator('#tarifa-desde').waitFor();
    await settle(page);
    const puts = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/api/worker/profile')) puts.push(r.postData());
    });

    await page.locator('#tarifa-tipo').selectOption('por_hora');
    await page.locator('#tarifa-desde').fill('200');
    await page.locator('#tarifa-hasta').fill('100');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.waitForTimeout(800);
    const msg1 = await alertText(page);
    await shot(page, c, 'desde-mayor-que-hasta', 'Guardar con "desde" 200 y "hasta" 100');
    if (/no puede ser menor/i.test(msg1) && puts.length === 0) ok(c, `Desde > hasta: bloqueado en el formulario ("${msg1}"), sin llamada al servidor.`);
    else fail(c, `Desde > hasta: mensaje "${msg1}", llamadas PUT enviadas: ${puts.length}.`);

    await page.locator('#tarifa-desde').fill('-50');
    await page.locator('#tarifa-hasta').fill('100');
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/worker/profile') && r.request().method() === 'PUT', { timeout: 8000 }).catch(() => null);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    const resp = await respPromise;
    await page.waitForTimeout(1200);
    const msg2 = await alertText(page);
    const success = await page.getByRole('status').first().textContent().catch(() => '');
    await shot(page, c, 'monto-negativo', 'Guardar con "desde" = -50');
    if (resp) c.http.push({ label: 'Guardar tarifa negativa', request: 'PUT /api/worker/profile', status: resp.status(), body: short(await resp.text().catch(() => ''), 300) });
    const saved = http(c, await call('GET', '/worker/profile', { token: token('A') }), 'Perfil tras intentar guardar -50');
    const savedDesde = saved.data?.tarifas?.monto_desde;
    if (Number(savedDesde) < 0) {
      fail(c, `Se guardó una tarifa negativa (monto_desde = ${savedDesde}).`);
      bug(c, {
        severity: 'Alta',
        title: 'Se puede guardar una tarifa negativa',
        steps: ['Abrir /worker/profile', 'Escribir -50 en "Monto desde"', 'Guardar cambios'],
        expected: 'Rechazo con mensaje claro',
        obtained: `monto_desde guardado = ${savedDesde}`,
        location: 'backend/src/worker/dto/tarifas.dto.ts',
      });
    } else if (resp && msg2) {
      const technical = /must|should|not be less|monto_desde|tarifas\./i.test(msg2);
      if (technical) {
        fail(c, `El negativo se rechaza solo en el servidor (HTTP ${resp.status()}) con un mensaje técnico: "${msg2}".`);
        bug(c, {
          severity: 'Baja',
          title: 'La tarifa negativa muestra un mensaje técnico del servidor',
          steps: ['Abrir /worker/profile', 'Escribir -50 en "Monto desde" y 100 en "Monto hasta"', 'Pulsar "Guardar cambios"'],
          expected: 'Validación en el formulario: "El monto no puede ser negativo."',
          obtained: `El formulario no valida (tiene noValidate); el servidor responde ${resp.status()} y se muestra: "${msg2}"`,
          location: 'frontend/src/pages/WorkerProfile.jsx (handleSubmit) y backend/src/worker/dto/tarifas.dto.ts (mensajes de @Min)',
        });
      } else {
        observe(c, `El negativo no se valida en el formulario; el servidor lo rechaza (HTTP ${resp.status()}) con: "${msg2}".`);
      }
    } else if (!resp && msg2) {
      ok(c, `Negativo bloqueado en el formulario: "${msg2}".`);
    } else {
      fail(c, `Valor negativo: sin mensaje de error visible (mensaje de éxito: "${success}").`);
    }
  },
);

caseTest(
  'TRB-10',
  'Guardado válido y revisión en el perfil público /workers/:id',
  ['escritorio'],
  'Guardar tarifas válidas muestra confirmación; el perfil público refleja nombre, tarifa, zonas y descripción legibles, también sin iniciar sesión.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/profile');
    await page.locator('#tarifa-desde').waitFor();
    await settle(page);
    await page.locator('#tarifa-tipo').selectOption('por_hora');
    await page.locator('#tarifa-desde').fill('75');
    await page.locator('#tarifa-hasta').fill('150');
    await page.locator('#tarifa-notas').fill('Incluye diagnóstico (QA)');
    const zone = ctx.zones[0];
    if (zone) {
      const box = page.locator(`#zona-${zone.id_zona}`);
      if (!(await box.isChecked())) await box.check({ force: true });
    }
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/worker/profile') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    const resp = await respPromise;
    c.http.push({ label: 'Guardar perfil válido', request: 'PUT /api/worker/profile', status: resp.status(), body: short(await resp.text(), 300) });
    await page.getByRole('status').first().waitFor({ timeout: 5000 }).catch(() => {});
    await shot(page, c, 'guardado-correcto', 'Mensaje tras guardar tarifas válidas');
    const success = await page.getByRole('status').first().textContent().catch(() => '');
    if (resp.ok() && /actualizado/i.test(success)) ok(c, `Guardado correcto: "${success.trim()}".`);
    else fail(c, `Guardado: HTTP ${resp.status()}, mensaje "${success}".`);
    await page.waitForTimeout(1200);
    const after = new URL(page.url()).pathname;
    if (after === '/') {
      observe(c, 'Tras guardar, la página salta sola al panel a los 0,9 s; no da tiempo de revisar lo guardado.');
      uxNote(c, {
        area: 'Flujo',
        text: 'Al guardar el perfil, la app redirige al panel automáticamente en menos de 1 segundo. El usuario no puede verificar lo guardado ni seguir editando.',
      });
    }

    const idA = ctx.profiles.A.id_perfil;
    const pub = await openPage(browser, c, DESKTOP, 'C', 'client');
    await pub.page.goto(`/workers/${idA}`);
    await settle(pub.page);
    await pub.page.waitForTimeout(800);
    await shot(pub.page, c, 'perfil-publico-con-sesion', `Perfil público /workers/${idA} visto por el cliente`);
    const name = ((await pub.page.locator('h1').first().textContent().catch(() => '')) || '').trim();
    const bodyText = await pub.page.locator('body').innerText();
    const expectedName = ctx.sessions.A.user?.nombre || 'QA Trabajador A';
    const problems = [];
    if (!name.includes(expectedName)) problems.push(`el título muestra "${name}" en lugar del nombre "${expectedName}"`);
    const hasRate = /Q\s?75|Q\s?100|por hora|por servicio|a convenir|GTQ/i.test(bodyText);
    if (!hasRate) problems.push('no aparece ninguna tarifa (ni la de perfil ni la del servicio)');
    if (/\{\s*"|"tarifas"|"horarios"/.test(bodyText)) problems.push('se ve texto JSON crudo en la descripción');
    if (zone && !bodyText.includes(zone.nombre)) problems.push(`no aparece la zona "${zone.nombre}"`);
    if (/Horario por coordinar/.test(bodyText)) problems.push('dice "Horario por coordinar" aunque hay un horario guardado (lunes 08:00–17:00)');
    if (problems.length) {
      fail(c, `Perfil público con sesión: ${problems.join('; ')}.`);
      bug(c, {
        severity: 'Alta',
        title: 'El perfil público del trabajador muestra datos incorrectos',
        steps: ['Como trabajador, guardar tarifa 75–150 y una zona en /worker/profile', `Como cliente, abrir /workers/${idA}`],
        expected: `Nombre "${expectedName}", "Tarifa base desde Q75.00", zona "${zone?.nombre}", descripción legible`,
        obtained: problems.join('; '),
        location: 'frontend/src/pages/PublicWorkerProfile.jsx (lee la fila cruda de /perfiles-trabajador/:id: sin nombre, tarifas dentro del JSON de descripcion, cobertura no incluida)',
      });
    } else ok(c, 'Perfil público con sesión: nombre, tarifa, zona y descripción correctos.');
    await pub.close();

    const anon = await openPage(browser, c, DESKTOP);
    await anon.page.goto(`/workers/${idA}`);
    await settle(anon.page);
    await anon.page.waitForTimeout(800);
    await shot(anon.page, c, 'perfil-publico-sin-sesion', `Perfil público /workers/${idA} sin iniciar sesión`);
    const notFound = await anon.page.getByText(/Trabajador no encontrado/).isVisible().catch(() => false);
    const anonApi = http(c, await call('GET', `/perfiles-trabajador/${idA}`), 'Perfil público sin token');
    if (notFound || anonApi.status === 401) {
      fail(c, `Sin sesión, /workers/${idA} muestra "Trabajador no encontrado" (API sin token: HTTP ${anonApi.status}).`);
      bug(c, {
        severity: 'Media',
        title: 'El perfil público del trabajador no se puede ver sin iniciar sesión',
        steps: ['Cerrar sesión', `Abrir /workers/${idA}`],
        expected: 'Ver el perfil público (la ruta está pensada como pública)',
        obtained: `"Trabajador no encontrado"; GET /api/perfiles-trabajador/${idA} sin token → ${anonApi.status}`,
        location: 'backend/src/resources/resources.config.ts (perfiles-trabajador sin publicRead) y PublicWorkerProfile.jsx',
      });
    } else ok(c, 'Sin sesión el perfil público también se ve.');
  },
);

caseTest(
  'TRB-11',
  'Estado de la verificación DPI y número enmascarado',
  ['escritorio'],
  'Muestra "Sin documentos"; tras enviar frente, reverso y número, pasa a "En revisión" y el número solo se ve enmascarado (nunca completo, ni en pantalla ni en la API).',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/profile');
    await page.locator('#dpi-frente').waitFor();
    await settle(page);
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Verificación de identidad/ }) });
    const before = ((await section.locator('strong').first().textContent()) || '').trim();
    ok(c, `Estado inicial: "${before}".`);
    const fullNumber = '2345678901234';
    await page.locator('#dpi-frente').setInputFiles(ctx.files.dpi);
    await page.locator('#dpi-reverso').setInputFiles(ctx.files.dpi);
    await page.locator('#dpi-numero').fill(fullNumber);
    await section.scrollIntoViewIfNeeded();
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/identity/dpi') && r.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button', { name: 'Enviar documentos' }).click();
    const resp = await respPromise.catch(() => null);
    const respBody = resp ? await resp.text() : '';
    if (resp) c.http.push({ label: 'Envío de DPI', request: 'POST /api/identity/dpi', status: resp.status(), body: short(respBody.replaceAll(fullNumber, '[NÚMERO COMPLETO]'), 300) });
    await page.waitForTimeout(800);
    const after = ((await section.locator('strong').first().textContent()) || '').trim();
    const masked = ((await page.getByText(/^DPI\s/).first().textContent().catch(() => '')) || '').trim();
    await shot(page, c, 'dpi-enviado', `Sección DPI tras enviar documentos: "${after}" ${masked}`);
    const pageText = await page.locator('body').innerText();
    const apiDpi = await call('GET', '/identity/dpi', { token: token('A') });
    http(c, { ...apiDpi, data: JSON.parse(JSON.stringify(apiDpi.data).replaceAll(fullNumber, '[NÚMERO COMPLETO]')) }, 'Consulta del DPI propio');
    if (!resp || !resp.ok()) {
      fail(c, `El envío de DPI falló (HTTP ${resp?.status() ?? 'sin respuesta'}). Mensaje: "${await alertText(page)}".`);
      return;
    }
    if (/revisión/i.test(after)) ok(c, `Tras enviar, el estado es "${after}".`);
    else fail(c, `Tras enviar, el estado es "${after}" (se esperaba "En revisión").`);
    if (masked && !masked.includes(fullNumber)) ok(c, `Número enmascarado: "${masked}".`);
    else if (!masked) observe(c, 'No se muestra el número enmascarado tras enviar.');
    const leaks = [];
    if (pageText.includes(fullNumber) && !(await page.locator('#dpi-numero').inputValue()).includes(fullNumber)) leaks.push('pantalla');
    if (JSON.stringify(apiDpi.data).includes(fullNumber) || respBody.includes(fullNumber)) leaks.push('API');
    if (leaks.length) {
      fail(c, `El número completo del DPI aparece en: ${leaks.join(', ')}.`);
      bug(c, {
        severity: 'Alta',
        title: 'El número completo del DPI se expone',
        steps: ['Enviar DPI con número desde /worker/profile', 'Consultar GET /api/identity/dpi'],
        expected: 'Solo el número enmascarado',
        obtained: `Número completo visible en ${leaks.join(', ')}`,
      });
    } else ok(c, 'El número completo no aparece en la pantalla ni en las respuestas de la API.');
    const inputStill = await page.locator('#dpi-numero').inputValue();
    if (inputStill === fullNumber) {
      observe(c, 'Tras enviar, el campo "Número de DPI" sigue mostrando el número completo.');
      uxNote(c, { area: 'Privacidad', text: 'Después de enviar el DPI, el campo de número no se limpia y deja el número completo a la vista en pantalla.' });
    }
  },
);

caseTest(
  'TRB-12',
  'Crear un servicio y verlo en el directorio de su categoría',
  ['escritorio'],
  'El servicio se crea con confirmación y el trabajador aparece en /categoria/:id de esa categoría.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/content');
    await page.getByLabel('Nombre del servicio').waitFor();
    await settle(page);
    const reviewsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Reseñas recibidas' }) });
    const reviewsText = ((await reviewsSection.innerText().catch(() => '')) || '').replace('Reseñas recibidas', '').trim();
    if (!reviewsText) {
      await shot(page, c, 'contenido-inicial', '/worker/content antes de crear el servicio (sección de reseñas vacía)');
      uxNote(c, {
        area: 'Estados vacíos',
        text: 'Sin reseñas, la sección "Reseñas recibidas" queda en blanco: no hay mensaje como "Aún no tienes reseñas" ni explicación de cómo conseguirlas.',
      });
    }
    const cat = ctx.catOther;
    const name = `QA Servicio TRB-12 ${STAMP}`;
    await page.getByLabel('Nombre del servicio').fill(name);
    await page.getByLabel('Categoría').selectOption(String(cat.id_categoria));
    await page.getByLabel('Descripción del servicio').fill('Servicio creado desde la UI por la prueba E2E.');
    await page.getByLabel('Precio desde (Q)').fill('150');
    const { resp, via } = await submitForm(
      page,
      page.getByRole('button', { name: 'Agregar servicio' }),
      page.getByLabel('Nombre del servicio'),
      '/api/servicios',
    );
    if (via === 'Enter') {
      await page.waitForTimeout(600);
      const clickFile = c.evidence.length;
      fail(c, 'Al pulsar "Agregar servicio" no ocurre nada: no se envía ninguna petición ni aparece un mensaje.');
      c.notes.push('Para seguir con el caso se envió el formulario pulsando Enter en "Nombre del servicio" (envío implícito del navegador).');
      await shot(page, c, 'boton-agregar-sin-efecto', 'Tras pulsar "Agregar servicio": el formulario sigue lleno y no hay mensaje');
      bug(c, {
        severity: 'Crítica',
        title: 'Los botones "Agregar servicio" y "Subir fotografía" no hacen nada',
        steps: ['Abrir /worker/content', 'Escribir nombre, elegir categoría y descripción', 'Pulsar "Agregar servicio" (igual con "Subir fotografía" en Portafolio)'],
        expected: 'Se envía el formulario y se crea el servicio / se sube la foto',
        obtained: 'No se envía ninguna petición ni se muestra mensaje. Solo funciona pulsando Enter dentro de un campo de texto, algo que un usuario no sabrá. Sin servicios, el trabajador no puede recibir solicitudes.',
        evidence: c.evidence.slice(clickFile).map((e) => e.file),
        location: 'frontend/src/components/ui/Button.jsx (type="button" por defecto) usado sin type="submit" en frontend/src/pages/WorkerContent.jsx',
      });
    }
    const created = resp ? await resp.json().catch(() => ({})) : {};
    if (resp) c.http.push({ label: `Crear servicio (vía ${via})`, request: 'POST /api/servicios', status: resp.status(), body: short(created, 300) });
    await page.getByText(name).waitFor({ timeout: 8000 }).catch(() => {});
    await shot(page, c, 'servicio-creado', `Servicio "${name}" en /worker/content (enviado con ${via})`);
    if (resp?.ok() && (await page.getByText(name).isVisible())) {
      ok(c, `Servicio creado (id ${created.id_servicio}, enviado con ${via}) y listado con "${(await page.getByRole('status').first().textContent().catch(() => '')) || ''}".`);
      ctx.services.trb12 = created;
    } else {
      fail(c, `No se creó el servicio (HTTP ${resp?.status() ?? 'sin petición'}): ${await alertText(page)}`);
      return;
    }

    await page.goto(`/categoria/${cat.id_categoria}`);
    await settle(page, 10000);
    await page.waitForTimeout(1500);
    const workerName = ctx.sessions.A.user?.nombre || 'QA Trabajador A';
    const found = await page.getByRole('heading', { name: workerName }).first().isVisible().catch(() => false);
    await shot(page, c, 'directorio-categoria', `Directorio /categoria/${cat.id_categoria} (${cat.nombre})`);
    const search = http(
      c,
      await call('GET', `/search/profiles?id_categoria=${cat.id_categoria}&limit=50`, { token: token('C') }),
      'Búsqueda por categoría (API)',
    );
    const list = Array.isArray(search.data) ? search.data : search.data?.perfiles || search.data?.data || [];
    const inApi = list.some((w) => Number(w.id_perfil) === Number(ctx.profiles.A.id_perfil));
    if (found) ok(c, `A aparece en el directorio de "${cat.nombre}".`);
    else {
      fail(c, `A no aparece en el directorio de "${cat.nombre}" (en la API: ${inApi ? 'sí' : 'no'}).`);
      bug(c, {
        severity: 'Alta',
        title: 'Un servicio nuevo no hace aparecer al trabajador en el directorio de su categoría',
        steps: ['Como trabajador, crear un servicio en una categoría en /worker/content', `Abrir /categoria/${cat.id_categoria}`],
        expected: `El trabajador "${workerName}" aparece en "${cat.nombre}"`,
        obtained: `No aparece en la pantalla; en GET /api/search/profiles?id_categoria=${cat.id_categoria}: ${inApi ? 'sí aparece' : 'tampoco aparece'}`,
        location: inApi
          ? 'frontend/src/pages/SearchDirectory.jsx (añade q = nombre de la categoría a la búsqueda)'
          : 'backend/src/search (índice de búsqueda no se actualiza con servicio_ofrecido nuevo)',
      });
    }
  },
);

caseTest(
  'TRB-13',
  'Pausar, reactivar y eliminar un servicio',
  ['escritorio'],
  'Pausar marca "Pausado", reactivar vuelve a "Activo" y eliminar lo quita tras pedir confirmación.',
  async ({ browser, c }) => {
    const svc = ctx.services.trb12;
    if (!svc) {
      block(c, 'No existe el servicio creado en TRB-12.');
      return;
    }
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/content');
    await page.getByText(svc.nombre).waitFor();
    const row = () => page.locator('li').filter({ hasText: svc.nombre });
    await row().getByRole('button', { name: 'Pausar' }).click();
    await row().getByText(/Pausado/).waitFor({ timeout: 8000 }).catch(() => {});
    await shot(page, c, 'servicio-pausado', 'Servicio tras pulsar "Pausar"');
    const paused = http(c, await call('GET', `/servicios/${svc.id_servicio}`), 'Servicio tras pausar');
    if (paused.data?.activo === false) ok(c, 'Pausar: el servicio queda inactivo en el servidor y la lista dice "Pausado".');
    else fail(c, `Pausar: activo = ${paused.data?.activo}.`);

    await row().getByRole('button', { name: 'Reactivar' }).click();
    await row().getByText(/Activo/).waitFor({ timeout: 8000 }).catch(() => {});
    await shot(page, c, 'servicio-reactivado', 'Servicio tras pulsar "Reactivar"');
    const active = http(c, await call('GET', `/servicios/${svc.id_servicio}`), 'Servicio tras reactivar');
    if (active.data?.activo === true) ok(c, 'Reactivar: vuelve a activo.');
    else fail(c, `Reactivar: activo = ${active.data?.activo}.`);

    let dialogShown = false;
    page.once('dialog', async (dialog) => {
      dialogShown = true;
      await dialog.accept();
    });
    await row().getByRole('button', { name: 'Eliminar' }).click();
    await page.waitForTimeout(1500);
    await shot(page, c, 'servicio-eliminado', 'Lista tras pulsar "Eliminar"');
    const gone = http(c, await call('GET', `/servicios/${svc.id_servicio}`), 'Servicio tras eliminar');
    const visible = await row().count();
    if ((gone.status === 404 || !gone.data?.id_servicio) && visible === 0) ok(c, 'Eliminar: desaparece de la lista y del servidor.');
    else fail(c, `Eliminar: HTTP ${gone.status}, filas visibles ${visible}.`);
    if (!dialogShown) {
      observe(c, 'Eliminar borra el servicio de inmediato, sin pedir confirmación ni ofrecer deshacer.');
      uxNote(c, {
        area: 'Prevención de errores',
        text: 'El botón "Eliminar" de servicios (y de fotos del portafolio) borra al primer clic, sin confirmación ni opción de deshacer.',
      });
    }
  },
);

caseTest(
  'TRB-14',
  'Con el token de A, editar o eliminar un servicio de B por API',
  ['API'],
  'El servidor responde 403 a PATCH y DELETE sobre un servicio que no es de A; el servicio de B no cambia.',
  async ({ browser, c }) => {
    const svcB = ctx.services.B;
    const original = await call('GET', `/servicios/${svcB.id_servicio}`);
    const patch = http(
      c,
      await call('PATCH', `/servicios/${svcB.id_servicio}`, { token: token('A'), body: { nombre: 'Modificado por A (QA)' } }),
      'A edita el servicio de B',
    );
    const afterPatch = await call('GET', `/servicios/${svcB.id_servicio}`);
    const move = http(
      c,
      await call('PATCH', `/servicios/${svcB.id_servicio}`, { token: token('A'), body: { id_perfil: ctx.profiles.A.id_perfil } }),
      'A intenta reasignarse el servicio de B',
    );
    if (patch.ok || move.ok) {
      await call('PATCH', `/servicios/${svcB.id_servicio}`, {
        token: token('B'),
        body: { nombre: original.data?.nombre || 'QA Servicio base B', id_perfil: ctx.profiles.B.id_perfil },
      });
    }
    const del = http(c, await call('DELETE', `/servicios/${svcB.id_servicio}`, { token: token('A') }), 'A elimina el servicio de B');
    const afterDelete = http(c, await call('GET', `/servicios/${svcB.id_servicio}`), 'Servicio de B después');
    const spare = await call('POST', '/servicios', {
      token: token('B'),
      body: { id_perfil: ctx.profiles.B.id_perfil, id_categoria: ctx.catOther.id_categoria, nombre: 'QA Servicio B sin solicitudes', activo: true },
    });
    let delSpare = null;
    if (spare.ok) {
      c.notes.push(`Con la cuenta de B se creó por API el servicio #${spare.data.id_servicio} (sin solicitudes) para probar el borrado sin la restricción de clave foránea.`);
      delSpare = http(c, await call('DELETE', `/servicios/${spare.data.id_servicio}`, { token: token('A') }), 'A elimina un servicio de B sin solicitudes');
    }
    const file = await evidenceShot(browser, c, 'api-servicio-ajeno', 'A intenta editar y eliminar un servicio de B', [
      { label: `PATCH /api/servicios/${svcB.id_servicio} con token de A`, text: `HTTP ${patch.status}\n${short(patch.data, 500)}` },
      { label: 'Nombre del servicio de B tras el PATCH', text: `"${afterPatch.data?.nombre}" (antes: "${original.data?.nombre}")` },
      { label: `PATCH id_perfil → perfil de A`, text: `HTTP ${move.status}\n${short(move.data, 300)}` },
      { label: `DELETE /api/servicios/${svcB.id_servicio} con token de A`, text: `HTTP ${del.status}\n${short(del.data, 300)}` },
      { label: 'GET del servicio de B después', text: `HTTP ${afterDelete.status}\n${short(afterDelete.data, 300)}` },
      ...(delSpare
        ? [{ label: `DELETE /api/servicios/${spare.data.id_servicio} (servicio de B sin solicitudes) con token de A`, text: `HTTP ${delSpare.status}\n${short(delSpare.data, 300)}` }]
        : []),
    ]);
    const bad = [];
    if (patch.ok) bad.push(`PATCH aceptado (${patch.status}); nombre cambió a "${afterPatch.data?.nombre}"`);
    if (move.ok) bad.push(`reasignación de id_perfil aceptada (${move.status})`);
    if (del.ok) bad.push(`DELETE aceptado (${del.status}); el servicio de B ${afterDelete.status === 404 ? 'fue borrado' : 'sigue'}`);
    if (!del.ok && /foreign key/i.test(JSON.stringify(del.data))) {
      c.notes.push('El primer DELETE no se bloqueó por permisos sino por la clave foránea (el servicio tiene solicitudes); además expone el mensaje SQL en inglés.');
    }
    if (delSpare?.ok) bad.push(`DELETE de un servicio de B sin solicitudes aceptado (${delSpare.status}): el servicio se borró`);
    if (bad.length) {
      fail(c, `Sin control de dueño: ${bad.join('; ')}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'Cualquier usuario autenticado puede editar o borrar servicios de otro trabajador',
        steps: ['Iniciar sesión como trabajador A', `Enviar PATCH/DELETE /api/servicios/${svcB.id_servicio} (servicio de B) con el token de A`],
        expected: 'HTTP 403 y el servicio de B sin cambios',
        obtained: bad.join('; '),
        evidence: [file],
        location: 'backend/src/resources/resource.service.ts (CRUD genérico sin comprobación de propietario para servicio_ofrecido)',
      });
      if (del.ok) {
        const recreated = await call('POST', '/servicios', {
          token: token('B'),
          body: { id_perfil: ctx.profiles.B.id_perfil, id_categoria: ctx.catOther.id_categoria, nombre: 'QA Servicio base B', activo: true },
        });
        if (recreated.ok) ctx.services.B = recreated.data;
        c.notes.push('Como A borró el servicio de B, se volvió a crear con la cuenta de B para continuar.');
      }
    } else ok(c, `PATCH → ${patch.status}, reasignación → ${move.status}, DELETE → ${del.status}. El servicio de B no cambió.`);
  },
);

caseTest(
  'TRB-15',
  'Subir una imagen válida y ver la miniatura',
  ['escritorio', 'móvil'],
  'La foto se sube con confirmación y aparece su miniatura cargada en la galería.',
  async ({ browser, c }) => {
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const title = `Trabajo QA TRB-15 ${label}`;
      const { page, close } = await openPage(browser, c, vp, 'A');
      await page.goto('/worker/content');
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Portafolio' }) });
      await section.locator('input[type="file"]').waitFor({ state: 'attached' });
      await settle(page);
      await section.locator('input[type="file"]').setInputFiles(ctx.files.portfolio);
      await section.getByLabel('Título del trabajo').fill(title);
      await section.getByLabel('Descripción', { exact: true }).fill('Foto subida por la prueba E2E.');
      const { resp, via } = await submitForm(
        page,
        section.getByRole('button', { name: 'Subir fotografía' }),
        section.getByLabel('Título del trabajo'),
        '/api/portfolio/upload',
      );
      if (via === 'Enter') {
        fail(c, `(${label}) Al pulsar "Subir fotografía" no ocurre nada; la foto solo se sube pulsando Enter en "Título del trabajo".`);
        if (!mobile) {
          c.notes.push('Se usó Enter en "Título del trabajo" para continuar el caso (mismo defecto que BUG de "Agregar servicio", TRB-12).');
        }
      }
      if (!resp) {
        fail(c, `(${label}) No se pudo enviar la foto ni con clic ni con Enter.`);
        await shot(page, c, 'foto-no-enviada', `Portafolio: la foto no se envió (${label})`, { mobile });
        await close();
        continue;
      }
      const data = await resp.json().catch(() => ({}));
      c.http.push({ label: `Subir foto (${label}, vía ${via})`, request: 'POST /api/portfolio/upload', status: resp.status(), body: short(data, 300) });
      const img = section.getByRole('img', { name: title });
      await img.waitFor({ timeout: 15000 }).catch(() => {});
      await img.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1200);
      const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
      const src = await img.getAttribute('src').catch(() => '');
      await shot(page, c, 'foto-subida', `Galería tras subir "${title}" (${label})`, { mobile });
      if (resp.ok() && loaded) ok(c, `(${label}) Foto subida y miniatura cargada (${/thumb/.test(src || '') ? 'usa la miniatura' : 'usa la imagen completa'}).`);
      else fail(c, `(${label}) HTTP ${resp.status()}, miniatura cargada: ${loaded}. ${await alertText(page)}`);
      if (data.id_elemento) (ctx.photos.A ||= []).push(data);
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde horizontal en /worker/content: ${info.offenders.join('; ')}`);
      }
      await close();
    }
  },
);

caseTest(
  'TRB-16',
  'Subir un archivo que no es imagen y otro de más de 8 MB',
  ['escritorio'],
  'Ambos se rechazan con un mensaje claro en español; no se agrega nada a la galería.',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/content');
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Portafolio' }) });
    await section.locator('input[type="file"]').waitFor({ state: 'attached' });
    await settle(page);
    const count0 = await section.getByRole('img').count();
    const accept = await section.locator('input[type="file"]').getAttribute('accept');
    c.notes.push(`El selector de archivos filtra por accept="${accept}"; la prueba adjunta los archivos directamente para comprobar la validación del servidor.`);

    for (const [file, desc, hint] of [
      [ctx.files.text, 'archivo-txt', 'archivo .txt'],
      [ctx.files.big, 'imagen-9mb', 'archivo JPG de 9 MB'],
    ]) {
      await section.locator('input[type="file"]').setInputFiles(file);
      const { resp, via } = await submitForm(
        page,
        section.getByRole('button', { name: 'Subir fotografía' }),
        section.getByLabel('Título del trabajo'),
        '/api/portfolio/upload',
      );
      if (via === 'Enter' && !c.notes.some((n) => n.includes('Enter'))) {
        c.notes.push('El botón "Subir fotografía" no envía el formulario (ver TRB-12/TRB-15); se envió con Enter en "Título del trabajo" para comprobar la validación.');
      }
      const body = resp ? await resp.text() : '';
      if (resp) c.http.push({ label: `Subir ${hint} (vía ${via})`, request: 'POST /api/portfolio/upload', status: resp.status(), body: short(body, 300) });
      await page.waitForTimeout(800);
      const msg = await alertText(page);
      await shot(page, c, desc, `Mensaje al subir un ${hint}`);
      if (msg && !report.observations.some((o) => o.caseId === c.id && o.area === 'Mensajes de error')) {
        const alertBox = await page.getByRole('alert').first().boundingBox();
        const formBox = await section.boundingBox();
        if (alertBox && formBox && formBox.y - (alertBox.y + alertBox.height) > 150) {
          uxNote(c, {
            area: 'Mensajes de error',
            text: `Los errores del portafolio se muestran arriba de la página, a ${Math.round(formBox.y - alertBox.y)} px del formulario de fotos; con la página desplazada el usuario no los ve.`,
          });
        }
      }
      if (resp?.ok()) {
        fail(c, `Se aceptó el ${hint} (HTTP ${resp.status()}).`);
        bug(c, {
          severity: 'Alta',
          title: `El portafolio acepta un ${hint}`,
          steps: ['Abrir /worker/content', `Adjuntar un ${hint} en Portafolio`, 'Pulsar "Subir fotografía"'],
          expected: 'Rechazo con mensaje claro',
          obtained: `HTTP ${resp.status()}`,
        });
      } else if (!msg) {
        fail(c, `Con el ${hint} no aparece ningún mensaje (HTTP ${resp?.status()}).`);
      } else if (/too large|file|payload|must|unexpected|unsupported|input buffer|sharp/i.test(msg) && !/MB|imagen|archivo no/i.test(msg)) {
        fail(c, `Con el ${hint} se rechaza (HTTP ${resp?.status()}) pero el mensaje es técnico o en inglés: "${msg}".`);
        bug(c, {
          severity: 'Baja',
          title: `Mensaje técnico al subir un ${hint} al portafolio`,
          steps: ['Abrir /worker/content', `Adjuntar un ${hint} en Portafolio`, 'Pulsar "Subir fotografía"'],
          expected: hint.includes('MB') ? '"La imagen supera el máximo de 8 MB."' : '"Solo se permiten imágenes JPG, PNG, WebP o GIF."',
          obtained: `HTTP ${resp?.status()} — "${msg}"`,
          location: 'backend/src/portfolio (FileInterceptor/limits sin mensaje propio) y frontend/src/pages/WorkerContent.jsx (sin validar tipo ni tamaño antes de enviar)',
        });
      } else ok(c, `Con el ${hint}: rechazado (HTTP ${resp?.status()}) con "${msg}".`);
    }
    const count1 = await section.getByRole('img').count();
    if (count1 > count0) fail(c, `La galería pasó de ${count0} a ${count1} imágenes.`);
  },
);

caseTest(
  'TRB-17',
  'Con el token de A, borrar una foto de B por API',
  ['API'],
  'El servidor responde 403 tanto en /portfolio/:id como en el CRUD genérico /portafolio/:id; la foto de B sigue.',
  async ({ browser, c }) => {
    const photo = ctx.photos.B;
    if (!photo?.id_elemento) {
      block(c, 'No se pudo subir la foto semilla de B en la preparación.');
      return;
    }
    const del1 = http(c, await call('DELETE', `/portfolio/${photo.id_elemento}`, { token: token('A') }), 'A borra foto de B (/portfolio)');
    const del2 = http(c, await call('DELETE', `/portafolio/${photo.id_elemento}`, { token: token('A') }), 'A borra foto de B (/portafolio genérico)');
    const list = await call('GET', '/portfolio', { token: token('B') });
    const still = Array.isArray(list.data) && list.data.some((p) => p.id_elemento === photo.id_elemento);
    http(c, { ...list, data: `fotos de B: ${Array.isArray(list.data) ? list.data.length : '?'}; la foto semilla ${still ? 'sigue' : 'ya no existe'}` }, 'Portafolio de B después');
    const file = await evidenceShot(browser, c, 'api-foto-ajena', 'A intenta borrar una foto del portafolio de B', [
      { label: `DELETE /api/portfolio/${photo.id_elemento} con token de A`, text: `HTTP ${del1.status}\n${short(del1.data, 300)}` },
      { label: `DELETE /api/portafolio/${photo.id_elemento} (CRUD genérico) con token de A`, text: `HTTP ${del2.status}\n${short(del2.data, 300)}` },
      { label: 'Portafolio de B después', text: still ? 'La foto sigue en el portafolio de B.' : 'La foto YA NO está en el portafolio de B.' },
    ]);
    const bad = [];
    if (del1.ok) bad.push(`/portfolio/:id aceptó (${del1.status})`);
    if (del2.ok) bad.push(`/portafolio/:id aceptó (${del2.status})`);
    if (bad.length || !still) {
      fail(c, `A pudo borrar la foto de B: ${bad.join('; ') || 'la foto desapareció'}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'Un trabajador puede borrar fotos del portafolio de otro',
        steps: ['Iniciar sesión como A', `DELETE /api/portafolio/${photo.id_elemento} (foto de B) con el token de A`],
        expected: 'HTTP 403 y la foto intacta',
        obtained: bad.join('; '),
        evidence: [file],
        location: del2.ok ? 'backend/src/resources/resources.config.ts (portafolio expuesto en el CRUD genérico sin control de propietario)' : 'backend/src/portfolio/portfolio.service.ts',
      });
    } else ok(c, `/portfolio → ${del1.status}; /portafolio → ${del2.status}. La foto de B sigue.`);
  },
);

caseTest(
  'TRB-20',
  'Filtros de la bandeja de solicitudes',
  ['escritorio', 'móvil'],
  'Activas, Finalizadas y Todas muestran lo que corresponde y marcan el filtro activo (aria-pressed).',
  async ({ browser, c }) => {
    const ids = [ctx.requests.flujo, ctx.requests.rechazo, ctx.requests.ajena].map((r) => r.id_solicitud);
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const { page, close } = await openPage(browser, c, vp, 'A');
      await page.goto('/trabajador/bandeja');
      await page.getByRole('heading', { name: 'Bandeja de solicitudes' }).waitFor();
      await settle(page);
      for (const filter of mobile ? ['Activas'] : ['Activas', 'Finalizadas', 'Todas']) {
        await page.getByRole('group', { name: 'Filtrar solicitudes' }).getByRole('button', { name: filter }).click();
        await page.waitForTimeout(400);
        const pressed = await page.getByRole('button', { name: filter }).getAttribute('aria-pressed');
        const shown = [];
        for (const id of ids) if (await page.getByText(`#${id}`, { exact: true }).isVisible().catch(() => false)) shown.push(id);
        await shot(page, c, `filtro-${filter}`, `Bandeja con el filtro "${filter}" (${label})`, { mobile });
        const expected = filter === 'Finalizadas' ? 0 : ids.length;
        if (pressed === 'true' && shown.length === expected) ok(c, `(${label}) "${filter}": ${shown.length} de las solicitudes de prueba visibles; filtro marcado.`);
        else fail(c, `(${label}) "${filter}": visibles ${shown.length} (se esperaban ${expected}), aria-pressed=${pressed}.`);
      }
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde horizontal en la bandeja: ${info.offenders.join('; ')}`);
        else ok(c, '(móvil) La bandeja no se desborda.');
      } else {
        const cardText = await requestCard(page, ids[0]).innerText();
        const repeatedLocation = (cardText.match(/Ubicación/g) || []).length > 1;
        const description = ctx.requests.flujo.descripcion;
        const repeatedDescription = cardText.split(description).length > 2;
        if (repeatedLocation || repeatedDescription) {
          uxNote(c, {
            area: 'Diseño de la bandeja',
            text: `Cada tarjeta repite información: ${[repeatedLocation && 'la ubicación aparece dos veces', repeatedDescription && 'la descripción se usa como título y otra vez en "Descripción:"'].filter(Boolean).join(' y ')}. Alarga la lista sin aportar datos.`,
            evidence: [c.evidence.find((e) => e.file.includes('filtro-activas'))?.file].filter(Boolean),
          });
        }
      }
      await close();
    }
  },
);

caseTest(
  'TRB-21',
  'Aceptar, Iniciar y Finalizar mostrando solo los botones válidos',
  ['escritorio'],
  'Enviada: Aceptar/Rechazar. Aceptada: Chat, Iniciar trabajo. En Proceso: Chat, Confirmar cierre. Finalizada: solo Chat. Cada paso se guarda.',
  async ({ browser, c }) => {
    const id = ctx.requests.flujo.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/trabajador/bandeja');
    await page.getByText(`#${id}`, { exact: true }).waitFor();
    await settle(page);
    const card = () => requestCard(page, id);
    const VALID = {
      Enviada: ['Aceptar', 'Rechazar'],
      Aceptada: ['Chat', 'Iniciar trabajo'],
      'En Proceso': ['Chat', 'Confirmar cierre'],
      Finalizada: ['Chat'],
    };
    const checkCurrent = async () => {
      const estado = await requestState(id);
      return expectButtons(estado, VALID[estado] || []);
    };
    const expectButtons = async (estado, expected) => {
      await page.getByRole('button', { name: 'Todas' }).click();
      await card().waitFor();
      const btns = await visibleButtons(card());
      const missing = expected.filter((b) => !btns.includes(b));
      const extra = btns.filter((b) => !expected.includes(b));
      await card().scrollIntoViewIfNeeded();
      await shot(page, c, `estado-${estado}`, `Solicitud #${id} en estado "${estado}" — botones: ${btns.join(', ') || 'ninguno'}`);
      if (!missing.length && !extra.length) ok(c, `${estado}: botones correctos (${btns.join(', ')}).`);
      else {
        const msg = `${estado}: botones visibles [${btns.join(', ')}]${missing.length ? `; faltan [${missing.join(', ')}]` : ''}${extra.length ? `; sobran [${extra.join(', ')}]` : ''}.`;
        if (estado === 'Aceptada' && extra.length === 1 && extra[0] === 'Confirmar cierre' && !missing.length) observe(c, msg);
        else fail(c, msg);
      }
      return btns;
    };
    let confirmAsked = false;
    const act = async (name, accion, { confirm = false } = {}) => {
      const dialogP = confirm
        ? page.waitForEvent('dialog', { timeout: 8000 }).catch(() => null)
        : Promise.resolve(null);
      const respPromise = page
        .waitForResponse((r) => r.url().includes(`/api/requests/${id}/status`) && r.request().method() === 'PUT', {
          timeout: 20000,
        })
        .catch(() => null);
      await card().getByRole('button', { name }).click();
      const dialog = await dialogP;
      if (dialog) {
        confirmAsked = true;
        await dialog.accept();
      }
      const resp = await respPromise;
      if (!resp) {
        fail(c, `${accion}: no hubo respuesta de /requests/:id/status tras pulsar "${name}".`);
        return false;
      }
      c.http.push({ label: accion, request: `PUT /api/requests/${id}/status`, status: resp.status(), body: short(await resp.text(), 200) });
      await page.waitForTimeout(800);
      await settle(page);
      return resp.ok();
    };

    await checkCurrent();
    if (!(await act('Aceptar', 'Aceptar'))) fail(c, `Aceptar falló: ${await alertText(page)}`);
    const acceptedBtns = await checkCurrent();
    if (acceptedBtns.includes('Confirmar cierre')) {
      uxNote(c, {
        area: 'Flujo de solicitudes',
        text: 'En estado "Aceptada" se muestran a la vez "Iniciar trabajo" y "Confirmar cierre"; se puede finalizar un trabajo que nunca se inició. Conviene mostrar solo el siguiente paso.',
      });
    }
    if (!(await act('Iniciar trabajo', 'Iniciar'))) {
      const message = await alertText(page);
      await card().scrollIntoViewIfNeeded();
      await shot(page, c, 'error-iniciar-trabajo', `Error al pulsar "Iniciar trabajo": ${message}`);
      if (/Reintentar/.test(message)) {
        uxNote(c, {
          area: 'Mensajes de error',
          text: 'El aviso de error de la bandeja incluye un botón "Reintentar" con el estilo por defecto del navegador; además "Reintentar" solo recarga la lista, no repite la acción fallida.',
        });
      }
      fail(c, `"Iniciar trabajo" falla: "${message}". La solicitud sigue en "${await requestState(id)}".`);
      bug(c, {
        severity: 'Alta',
        title: '"Iniciar trabajo" siempre falla y la solicitud no pasa a "En Proceso"',
        steps: ['Como trabajador, aceptar una solicitud en /trabajador/bandeja', 'Pulsar "Iniciar trabajo"'],
        expected: 'La solicitud pasa a "En Proceso"',
        obtained: `HTTP 400 y mensaje contradictorio: "${message.replace(/\s*Reintentar$/, '')}" (dice que "Iniciar" es válida y aun así la rechaza)`,
        location: 'Causa probable (no confirmada): en Supabase sigue la función cambiar_estado_solicitud de backend/src/requests/sql/001_maquina_estados_solicitud.sql; falta aplicar 002_integracion_en_proceso.sql, que añade "Iniciar".',
      });
    }
    await checkCurrent();
    if ((await requestState(id)) === 'En Proceso') {
      if (!(await act('Confirmar cierre', 'Finalizar', { confirm: true }))) fail(c, `Finalizar falló: ${await alertText(page)}`);
    } else {
      fail(c, 'No se pulsó "Confirmar cierre" porque la solicitud no pasó a En Proceso.');
    }
    await checkCurrent();
    const state = http(c, await call('GET', '/requests/worker', { token: token('A') }), 'Bandeja de A (API)');
    const row = Array.isArray(state.data) ? state.data.find((r) => r.id_solicitud === id) : null;
    if (row?.estado === 'Finalizada') ok(c, 'El servidor confirma el estado "Finalizada".');
    else fail(c, `Estado en el servidor: ${row?.estado}.`);
    if (!confirmAsked) {
      uxNote(c, {
        area: 'Prevención de errores',
        text: '"Confirmar cierre" finaliza la solicitud al primer clic, sin un diálogo de confirmación, aunque es un paso irreversible.',
      });
    }
    ctx.flowFinished = row?.estado === 'Finalizada';
  },
);

caseTest(
  'TRB-22',
  'Rechazar una solicitud',
  ['escritorio'],
  'Rechazar pide un motivo (mínimo 5 caracteres); al confirmar queda "Rechazada" y pasa a Finalizadas.',
  async ({ browser, c }) => {
    const id = ctx.requests.rechazo.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/trabajador/bandeja');
    await page.getByText(`#${id}`, { exact: true }).waitFor();
    await settle(page);
    const card = requestCard(page, id);
    await card.getByRole('button', { name: 'Rechazar' }).click();
    const motivo = page.locator(`#motivo-${id}`);
    await motivo.fill('no');
    const confirm = card.getByRole('button', { name: 'Confirmar rechazo' });
    const disabledShort = await confirm.isDisabled();
    await card.scrollIntoViewIfNeeded();
    await shot(page, c, 'motivo-corto', 'Motivo de 2 caracteres: el botón "Confirmar rechazo" está deshabilitado');
    if (disabledShort) ok(c, 'Con un motivo de 2 caracteres el botón de confirmar está deshabilitado.');
    else fail(c, 'Con un motivo de 2 caracteres el botón de confirmar está habilitado.');
    const hint = await card.getByText(/5 caracteres|mínimo/i).isVisible().catch(() => false);
    if (!hint) {
      observe(c, 'No se indica que el motivo necesita al menos 5 caracteres; el botón solo aparece deshabilitado.');
      uxNote(c, { area: 'Formularios', text: 'Al rechazar, el botón queda deshabilitado con menos de 5 caracteres pero no hay texto que explique el mínimo.' });
    }
    await motivo.fill('No tengo disponibilidad esta semana (QA).');
    const respPromise = page.waitForResponse((r) => r.url().includes(`/api/requests/${id}/status`));
    await confirm.click();
    const resp = await respPromise;
    c.http.push({ label: 'Rechazar', request: `PUT /api/requests/${id}/status`, status: resp.status(), body: short(await resp.text(), 200) });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Finalizadas' }).click();
    await page.waitForTimeout(400);
    const inFinished = await page.getByText(`#${id}`, { exact: true }).isVisible().catch(() => false);
    await shot(page, c, 'solicitud-rechazada', `Solicitud #${id} en el filtro "Finalizadas" tras rechazarla`);
    const state = await call('GET', '/requests/worker', { token: token('A') });
    const row = Array.isArray(state.data) ? state.data.find((r) => r.id_solicitud === id) : null;
    http(c, { ...state, data: row ? { estado: row.estado, descripcion: row.descripcion } : state.data }, 'Estado en el servidor');
    if (resp.ok() && row?.estado === 'Rechazada' && inFinished) ok(c, 'Queda "Rechazada" en el servidor y aparece en "Finalizadas".');
    else fail(c, `HTTP ${resp.status()}, estado ${row?.estado}, visible en Finalizadas: ${inFinished}.`);
  },
);

caseTest(
  'TRB-23',
  'Con el token de B, cambiar el estado de una solicitud de A',
  ['API'],
  'El servidor responde 403 y la solicitud de A no cambia.',
  async ({ browser, c }) => {
    const id = ctx.requests.ajena.id_solicitud;
    const res = http(c, await call('PUT', `/requests/${id}/status`, { token: token('B'), body: { accion: 'Aceptar' } }), 'B acepta la solicitud de A');
    const res2 = http(c, await call('PUT', `/requests/${id}/status`, { token: token('B'), body: { accion: 'Rechazar', motivo: 'Intento de B (QA)' } }), 'B rechaza la solicitud de A');
    const state = await call('GET', '/requests/worker', { token: token('A') });
    const row = Array.isArray(state.data) ? state.data.find((r) => r.id_solicitud === id) : null;
    const file = await evidenceShot(browser, c, 'api-solicitud-ajena', 'B intenta cambiar el estado de una solicitud de A', [
      { label: `PUT /api/requests/${id}/status {accion:"Aceptar"} con token de B`, text: `HTTP ${res.status}\n${short(res.data, 300)}` },
      { label: `PUT /api/requests/${id}/status {accion:"Rechazar"} con token de B`, text: `HTTP ${res2.status}\n${short(res2.data, 300)}` },
      { label: 'Estado de la solicitud después (vista de A)', text: String(row?.estado) },
    ]);
    if (res.status === 403 && res2.status === 403 && row?.estado === 'Enviada') ok(c, `Ambos intentos → 403 ("${res.data?.message}"). La solicitud sigue "Enviada".`);
    else {
      fail(c, `Respuestas ${res.status}/${res2.status}; estado final "${row?.estado}".`);
      bug(c, {
        severity: 'Crítica',
        title: 'Un trabajador puede cambiar el estado de solicitudes de otro',
        steps: ['Iniciar sesión como B', `PUT /api/requests/${id}/status con {accion:"Aceptar"}`],
        expected: 'HTTP 403',
        obtained: `HTTP ${res.status}/${res2.status}; estado ${row?.estado}`,
        evidence: [file],
      });
    }
  },
);

caseTest(
  'TRB-18',
  'Responder una reseña y verla en el perfil público',
  ['escritorio'],
  'El trabajador publica una respuesta; el formulario desaparece y la respuesta se ve en su perfil público.',
  async ({ browser, c }) => {
    const id = ctx.requests.flujo.id_solicitud;
    if (!ctx.flowFinished) {
      for (const accion of ['Aceptar', 'Iniciar', 'Finalizar']) await call('PUT', `/requests/${id}/status`, { token: token('A'), body: { accion } });
      report.seedNotes.push(`TRB-18: la solicitud #${id} se finalizó por API porque TRB-21 no la dejó finalizada.`);
    }
    const created = http(
      c,
      await call('POST', '/reviews/create', {
        token: token('C'),
        body: { id_solicitud: id, calificacion: 4, comentario: `Buen trabajo y puntual (reseña QA ${STAMP}).` },
      }),
      'El cliente crea la reseña',
    );
    if (!created.ok) {
      block(c, `No se pudo crear la reseña con la cuenta de cliente (HTTP ${created.status}): ${short(created.data, 200)}`);
      return;
    }
    ctx.review = created.data;
    report.seedNotes.push(`TRB-18: con la cuenta de cliente se creó por API una reseña de 4 estrellas sobre la solicitud #${id} (id_resena ${created.data.id_resena}).`);

    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto('/worker/content');
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Reseñas recibidas' }) });
    const input = section.getByPlaceholder(/Escribe tu respuesta|Responder públicamente/).first();
    await input.waitFor({ timeout: 15000 });
    await settle(page);
    await section.scrollIntoViewIfNeeded();
    await shot(page, c, 'resena-sin-responder', 'Reseña recibida con el campo "Responder públicamente"');
    const reply = `Gracias por tu confianza (respuesta QA ${STAMP}).`;
    await input.fill(reply);
    const respPromise = page.waitForResponse((r) => r.url().includes('/reply'), { timeout: 20000 }).catch(() => null);
    await section.getByRole('button', { name: 'Responder' }).first().click();
    const resp = await respPromise;
    if (!resp) {
      fail(c, 'No hubo respuesta al publicar la reseña.');
      return;
    }
    c.http.push({ label: 'Responder reseña', request: `PUT /api/reviews/${ctx.review.id_resena}/reply`, status: resp.status(), body: short(await resp.text(), 300) });
    await section.getByText(reply).waitFor({ timeout: 8000 }).catch(() => {});
    await section.scrollIntoViewIfNeeded();
    await shot(page, c, 'resena-respondida', 'Reseña tras publicar la respuesta');
    const formGone = (await section.getByPlaceholder(/Escribe tu respuesta|Responder públicamente/).count()) === 0;
    if (resp.ok() && formGone && (await section.getByText(reply).isVisible())) ok(c, 'Respuesta publicada; se muestra "Tu respuesta" y desaparece el formulario.');
    else fail(c, `HTTP ${resp.status()}, formulario oculto: ${formGone}. ${await alertText(page)}`);

    const pub = await openPage(browser, c, DESKTOP, 'C', 'client');
    await pub.page.goto(`/workers/${ctx.profiles.A.id_perfil}`);
    await settle(pub.page);
    await pub.page.waitForTimeout(1000);
    const seen = await pub.page.getByText(reply, { exact: false }).isVisible().catch(() => false);
    await pub.page.getByRole('heading', { name: 'Calificación' }).scrollIntoViewIfNeeded().catch(() => {});
    await shot(pub.page, c, 'respuesta-en-perfil-publico', 'Perfil público del trabajador visto por el cliente');
    if (seen) ok(c, 'La respuesta aparece en el perfil público.');
    else fail(c, 'La respuesta no aparece en el perfil público.');
  },
);

caseTest(
  'TRB-19',
  'Una segunda respuesta devuelve 409',
  ['API'],
  'Un segundo PUT /reviews/:id/reply responde 409 con mensaje en español y no reemplaza la primera respuesta.',
  async ({ browser, c }) => {
    if (!ctx.review?.id_resena) {
      block(c, 'No hay reseña creada (TRB-18 no pudo crearla).');
      return;
    }
    const id = ctx.review.id_resena;
    const second = http(c, await call('PUT', `/reviews/${id}/reply`, { token: token('A'), body: { respuesta: 'Segundo intento de respuesta (QA).' } }), 'Segunda respuesta');
    const other = http(c, await call('PUT', `/reviews/${id}/reply`, { token: token('B'), body: { respuesta: 'B responde reseña ajena (QA).' } }), 'B responde la reseña de A');
    const after = await call('GET', `/resenas/${id}`);
    const stored = after.data?.respuesta || after.data?.respuesta_trabajador;
    http(c, { ...after, data: { respuesta: stored } }, 'Respuesta guardada');
    const file = await evidenceShot(browser, c, 'api-segunda-respuesta', 'Segunda respuesta a la misma reseña', [
      { label: `PUT /api/reviews/${id}/reply (segunda vez, token de A)`, text: `HTTP ${second.status}\n${short(second.data, 300)}` },
      { label: `PUT /api/reviews/${id}/reply con token de B`, text: `HTTP ${other.status}\n${short(other.data, 300)}` },
      { label: 'Respuesta guardada', text: String(stored) },
    ]);
    if (second.status === 409 && !/Segundo intento/.test(stored || '')) ok(c, `Segunda respuesta → 409 "${second.data?.message}". La original se mantiene.`);
    else {
      fail(c, `Segunda respuesta → HTTP ${second.status}; respuesta guardada: "${stored}".`);
      bug(c, {
        severity: 'Media',
        title: 'Se puede responder dos veces la misma reseña',
        steps: ['Responder una reseña', 'Enviar otra vez PUT /api/reviews/:id/reply'],
        expected: 'HTTP 409',
        obtained: `HTTP ${second.status}`,
        evidence: [file],
      });
    }
    if (other.ok) {
      fail(c, `B pudo responder una reseña de A (HTTP ${other.status}).`);
      bug(c, {
        severity: 'Alta',
        title: 'Un trabajador puede responder reseñas de otro',
        steps: ['Iniciar sesión como B', `PUT /api/reviews/${id}/reply`],
        expected: 'HTTP 403',
        obtained: `HTTP ${other.status}`,
        evidence: [file],
      });
    } else ok(c, `B no puede responder la reseña de A (HTTP ${other.status}).`);
  },
);

caseTest(
  'TRB-24',
  'Enviar un mensaje en el chat',
  ['escritorio', 'móvil'],
  'El mensaje aparece al instante como "Tú", queda guardado y el cliente lo recibe.',
  async ({ browser, c }) => {
    const id = ctx.requests.ajena.id_solicitud;
    const acc = http(c, await call('PUT', `/requests/${id}/status`, { token: token('A'), body: { accion: 'Aceptar' } }), 'A acepta la solicitud por API');
    report.seedNotes.push(`TRB-24: la solicitud #${id} se aceptó por API con la cuenta de A para habilitar el chat (HTTP ${acc.status}).`);
    for (const [vp, mobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ]) {
      const label = mobile ? 'móvil' : 'escritorio';
      const text = `Hola, soy el trabajador QA (${label} ${STAMP}).`;
      const { page, close } = await openPage(browser, c, vp, 'A');
      await page.goto(`/chat/${id}`);
      await page.getByPlaceholder('Escribe un mensaje').waitFor();
      await page.getByText('Cargando mensajes…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const transport = await page.getByRole('status').first().textContent().catch(() => '');
      await page.getByPlaceholder('Escribe un mensaje').fill(text);
      const respPromise = page.waitForResponse((r) => r.url().includes(`/api/chat/threads/${id}/messages`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Enviar' }).click();
      const resp = await respPromise;
      c.http.push({ label: `Enviar mensaje (${label})`, request: `POST /api/chat/threads/${id}/messages`, status: resp.status(), body: short(await resp.text(), 200) });
      await page.getByText(text).waitFor({ timeout: 8000 }).catch(() => {});
      await shot(page, c, 'mensaje-enviado', `Chat de la solicitud #${id} tras enviar un mensaje (${label}) — ${transport}`, { mobile });
      const bubble = page.locator('article').filter({ hasText: text });
      const mine = await bubble.getByText(/^Tú/).isVisible().catch(() => false);
      const empty = await page.getByPlaceholder('Escribe un mensaje').inputValue();
      if (resp.ok() && (await bubble.count()) === 1 && mine && !empty) ok(c, `(${label}) Mensaje enviado y mostrado como "Tú"; el campo se limpia. Conexión: ${transport?.trim()}.`);
      else fail(c, `(${label}) HTTP ${resp.status()}, burbujas ${await bubble.count()}, marcado como "Tú": ${mine}.`);
      const subtitle = ((await page.locator('header p').first().textContent().catch(() => '')) || '').trim();
      if (!mobile && /Usuario ·/.test(subtitle)) observe(c, `El encabezado del chat no muestra el nombre del cliente: "${subtitle}".`);
      if (!mobile && /ACEPTADA|EN_PROCESO|PENDIENTE|COMPLETADA/.test(subtitle)) {
        observe(c, `El chat muestra el estado con el código interno de la base de datos: "${subtitle}".`);
        uxNote(c, {
          area: 'Consistencia',
          text: `El encabezado del chat muestra el estado en mayúsculas tal como está en la base de datos ("${subtitle.split('·').pop().trim()}"), mientras la bandeja usa "Aceptada".`,
        });
      }
      if (!mobile && (await page.locator('nav').count()) === 0) {
        uxNote(c, {
          area: 'Navegación / consistencia',
          text: 'El hilo de chat (/chat/:id) no tiene la cabecera del sitio ni el selector de modo; solo el enlace "Volver a mensajes".',
        });
      }
      if (mobile) {
        const info = await overflowInfo(page);
        if (info.overflow) fail(c, `(móvil) Desborde horizontal en el chat: ${info.offenders.join('; ')}`);
      }
      await close();
    }
    const clientView = await call('GET', `/chat/threads/${id}/messages?limit=100`, { token: token('C') });
    const msgs = Array.isArray(clientView.data) ? clientView.data : clientView.data?.messages || [];
    http(c, { ...clientView, data: `${msgs.length} mensajes; último: ${short(msgs.at(-1)?.contenido || '', 120)}` }, 'El cliente lee el hilo (API)');
    if (msgs.some((m) => /trabajador QA/.test(m.contenido || ''))) ok(c, 'El cliente ve los mensajes del trabajador.');
    else fail(c, 'El cliente no ve los mensajes enviados.');
  },
);

caseTest(
  'TRB-25',
  'El texto XSS se muestra como texto',
  ['escritorio'],
  `El mensaje ${XSS} se muestra literalmente; no se crea ninguna imagen ni se ejecuta alert().`,
  async ({ browser, c }) => {
    const id = ctx.requests.ajena.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    let alertFired = false;
    page.on('dialog', async (d) => {
      alertFired = true;
      await d.dismiss();
    });
    await page.goto(`/chat/${id}`);
    await page.getByPlaceholder('Escribe un mensaje').waitFor();
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('Escribe un mensaje').fill(XSS);
    const respPromise = page.waitForResponse((r) => r.url().includes(`/api/chat/threads/${id}/messages`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar' }).click();
    const resp = await respPromise;
    c.http.push({ label: 'Enviar payload XSS', request: `POST /api/chat/threads/${id}/messages`, status: resp.status(), body: short(await resp.text(), 200) });
    await page.waitForTimeout(1500);
    await page.reload();
    await page.getByPlaceholder('Escribe un mensaje').waitFor();
    await page.waitForTimeout(2000);
    const asText = await page.locator('article p').filter({ hasText: XSS }).count();
    const injected = await page.locator('article img[src="x"]').count();
    await shot(page, c, 'xss-como-texto', 'Mensaje con <img src=x onerror=alert(1)> tras recargar el chat');
    if (!alertFired && !injected && asText > 0) ok(c, 'El payload se ve como texto literal; no hay <img> inyectada ni alert().');
    else {
      fail(c, `alert ejecutado: ${alertFired}; <img src=x> inyectadas: ${injected}; mostrado como texto: ${asText}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'XSS en el chat',
        steps: [`Abrir /chat/${id}`, `Enviar ${XSS}`],
        expected: 'Texto literal',
        obtained: `alert: ${alertFired}; img inyectada: ${injected}`,
      });
    }
  },
);

caseTest(
  'TRB-26',
  'Abrir el /chat/:id de otra persona',
  ['escritorio'],
  'Se muestra un aviso claro de que no tiene acceso, sin mensajes ni caja de escribir; la API responde 403.',
  async ({ browser, c }) => {
    const id = ctx.requests.deB.id_solicitud;
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    await page.goto(`/chat/${id}`);
    await page.getByText('Cargando mensajes…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const msg = await alertText(page);
    const composerEnabled = await page.getByPlaceholder('Escribe un mensaje').isEnabled().catch(() => false);
    const transport = ((await page.getByRole('status').first().textContent().catch(() => '')) || '').trim();
    await shot(page, c, 'chat-ajeno', `A abre /chat/${id} (solicitud entre el cliente y B)`);
    const apiRead = http(c, await call('GET', `/chat/threads/${id}/messages`, { token: token('A') }), 'A lee el hilo ajeno (API)');
    const apiSend = http(c, await call('POST', `/chat/threads/${id}/messages`, { token: token('A'), body: { contenido: 'Intrusión QA' } }), 'A escribe en el hilo ajeno (API)');
    if (apiRead.status === 403 && apiSend.status === 403) ok(c, `La API bloquea lectura y envío (403 / 403).`);
    else {
      fail(c, `La API permite acceso: lectura ${apiRead.status}, envío ${apiSend.status}.`);
      bug(c, {
        severity: 'Crítica',
        title: 'Un usuario puede leer o escribir en chats ajenos',
        steps: ['Iniciar sesión como A', `GET/POST /api/chat/threads/${id}/messages`],
        expected: 'HTTP 403',
        obtained: `lectura ${apiRead.status}, envío ${apiSend.status}`,
      });
    }
    if (msg) ok(c, `La pantalla muestra: "${msg}".`);
    else fail(c, 'La pantalla no explica que no hay acceso.');
    if (composerEnabled || /En vivo/.test(transport)) {
      observe(c, `Aunque no hay acceso, la caja de mensaje sigue activa${/En vivo/.test(transport) ? ` y el indicador dice "${transport}"` : ''}.`);
      uxNote(c, {
        area: 'Estados de error',
        text: `En un chat sin permiso se muestra el error, pero la caja para escribir sigue activa${/En vivo/.test(transport) ? ` y el indicador dice "${transport}"` : ''}, lo que invita a escribir mensajes que fallarán.`,
      });
    }
  },
);

caseTest(
  'TRB-27',
  'Desbordes a 390 px de ancho',
  ['móvil'],
  'Ninguna pantalla del modo trabajador tiene desplazamiento horizontal ni contenido cortado a 390 px.',
  async ({ browser, c }) => {
    const routes = [
      ['/', 'panel'],
      ['/trabajador/bandeja', 'bandeja'],
      ['/worker/profile', 'perfil'],
      ['/worker/content', 'contenido'],
      ['/chat', 'mensajes'],
      [`/chat/${ctx.requests.ajena.id_solicitud}`, 'hilo-chat'],
      [`/workers/${ctx.profiles.A.id_perfil}`, 'perfil-publico'],
    ];
    const { page } = await openPage(browser, c, MOBILE, 'A');
    const failing = [];
    for (const [route, desc] of routes) {
      await page.goto(route);
      await settle(page);
      await page.waitForTimeout(1200);
      const info = await overflowInfo(page);
      const file = await shot(page, c, desc, `${route} a 390 px${info.overflow ? ` — DESBORDE: ${info.scrollWidth}px` : ''}`, { mobile: true });
      if (info.overflow) {
        failing.push({ route, info, file });
        fail(c, `${route}: ancho ${info.scrollWidth}px > 390px. Elementos: ${info.offenders.join('; ')}`);
      } else ok(c, `${route}: sin desborde.`);
    }
    if (failing.length) {
      bug(c, {
        severity: 'Media',
        title: 'Pantallas del trabajador con desplazamiento horizontal en móvil',
        steps: ['Iniciar sesión como trabajador', 'Abrir cada ruta a 390 × 844 px'],
        expected: 'Sin desplazamiento horizontal',
        obtained: failing.map((f) => `${f.route} (${f.info.scrollWidth}px: ${f.info.offenders.slice(0, 3).join(', ')})`).join('; '),
        evidence: failing.map((f) => f.file),
      });
    }
  },
);

caseTest(
  'TRB-28',
  'Navegación con Tab: foco visible y etiquetas',
  ['escritorio'],
  'Todos los controles se alcanzan con Tab, muestran un foco visible y tienen un nombre accesible (etiqueta o aria-label, no solo placeholder).',
  async ({ browser, c }) => {
    const { page } = await openPage(browser, c, DESKTOP, 'A');
    const unnamedAll = [];
    const placeholderOnly = [];
    const noFocus = [];
    for (const [route, desc, steps] of [
      ['/', 'panel', 25],
      ['/worker/content', 'contenido', 40],
      ['/worker/profile', 'perfil', 60],
    ]) {
      await page.goto(route);
      await settle(page);
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      const seen = [];
      let switchShot = false;
      for (let i = 0; i < steps; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const labelText = () => {
            const aria = el.getAttribute('aria-label');
            if (aria) return aria.trim();
            const by = el.getAttribute('aria-labelledby');
            if (by) return by.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
            if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
            if (['BUTTON', 'A', 'SUMMARY'].includes(el.tagName)) return (el.textContent || '').trim();
            return (el.getAttribute('title') || '').trim();
          };
          const style = getComputedStyle(el);
          const ring =
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
            (style.boxShadow && style.boxShadow !== 'none');
          let parentRing = false;
          const parent = el.parentElement;
          if (parent) {
            const ps = getComputedStyle(parent);
            parentRing = (ps.outlineStyle !== 'none' && parseFloat(ps.outlineWidth) > 0) || (ps.boxShadow && ps.boxShadow !== 'none');
          }
          const sibling = el.nextElementSibling;
          let siblingRing = false;
          if (sibling) {
            const ss = getComputedStyle(sibling);
            siblingRing = (ss.outlineStyle !== 'none' && parseFloat(ss.outlineWidth) > 0) || (ss.boxShadow && ss.boxShadow !== 'none');
          }
          const id = el.id ? `#${el.id}` : '';
          return {
            key: `${el.tagName}${id}|${el.getAttribute('type') || ''}|${labelText()}|${el.getAttribute('placeholder') || ''}`,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            id,
            name: labelText(),
            placeholder: el.getAttribute('placeholder') || '',
            focusVisible: Boolean(ring || parentRing || siblingRing),
          };
        });
        if (!info) continue;
        if (seen.includes(info.key)) break;
        seen.push(info.key);
        const ident = `${route} → <${info.tag}${info.type ? ` type="${info.type}"` : ''}${info.id ? ` ${info.id}` : ''}>`;
        if (!info.name && info.placeholder) placeholderOnly.push(`${ident} (placeholder "${info.placeholder}")`);
        else if (!info.name) unnamedAll.push(ident);
        if (!info.focusVisible) noFocus.push(`${ident} "${info.name || info.placeholder}"`);
        if (!switchShot && info.type === 'checkbox' && !info.name) {
          switchShot = true;
          await shot(page, c, `${desc}-foco-control-sin-nombre`, `${route}: foco con Tab sobre un control sin nombre accesible`);
        }
      }
      await shot(page, c, `${desc}-ultimo-foco`, `${route}: último elemento enfocado tras recorrer con Tab (${seen.length} elementos)`);
      ok(c, `${route}: ${seen.length} elementos alcanzados con Tab.`);
    }
    if (unnamedAll.length) {
      fail(c, `Controles sin nombre accesible: ${unnamedAll.join('; ')}.`);
      bug(c, {
        severity: 'Media',
        title: 'Controles del modo trabajador sin nombre accesible',
        steps: ['Iniciar sesión como trabajador', 'Recorrer /, /worker/content y /worker/profile con la tecla Tab'],
        expected: 'Cada control tiene etiqueta o aria-label',
        obtained: unnamedAll.join('; '),
        location: 'frontend/src/pages/WorkerHome.jsx y WorkerInbox.jsx (interruptor), WorkerContent.jsx (input de archivo)',
      });
    }
    if (placeholderOnly.length) {
      observe(c, `Campos que solo tienen placeholder como etiqueta: ${placeholderOnly.join('; ')}.`);
      uxNote(c, {
        area: 'Accesibilidad',
        text: `Campos sin etiqueta visible (solo placeholder, que desaparece al escribir): ${placeholderOnly.join('; ')}.`,
      });
    }
    if (noFocus.length) {
      observe(c, `Elementos sin indicador de foco detectable: ${noFocus.slice(0, 8).join('; ')}${noFocus.length > 8 ? '…' : ''}.`);
      uxNote(c, { area: 'Accesibilidad', text: `Al navegar con Tab, ${noFocus.length} elemento(s) no muestran un contorno de foco detectable (p. ej. ${noFocus.slice(0, 3).join('; ')}).` });
    }
  },
);
