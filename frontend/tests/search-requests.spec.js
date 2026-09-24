import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const user = { id_usuario: 100, nombre: 'Cliente de prueba' };
const worker = {
  id_perfil: 7, id_usuario: 8, nombre: 'Andrea López', oficio_principal: 'Plomería',
  descripcion: 'Instalación y reparación de tuberías. Atención residencial con experiencia y cuidado.',
  disponibilidad: 'Disponible', verificado: true, reputacion: 4.8, total_resenas: 24,
  cobertura: [{ id_zona: 5, nombre: 'Zona 10' }],
  tarifas: { tipo: 'por_servicio', monto_desde: 75, monto_hasta: 250 },
};
const services = [{ id_servicio: 19, id_perfil: 7, nombre: 'Reparación de fugas', activo: true }];
const response = (route, body, status = 200) => route.fulfill({ status, json: body });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((user) => {
    sessionStorage.setItem('oficiosya.session', JSON.stringify({ user, accessToken: 'test-only-token', refreshToken: 'test-only-refresh' }));
  }, user);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return response(route, { user });
    if (url.pathname.endsWith('/zonas')) return response(route, [{ id_zona: 5, nombre: 'Zona 10', estado: 'ACTIVA' }]);
    if (url.pathname.endsWith('/search/profiles')) return response(route, { total: 1, perfiles: [worker] });
    if (url.pathname.endsWith('/servicios')) return response(route, services);
    if (url.pathname.endsWith('/requests/create')) return response(route, { id_solicitud: 321, estado: 'Enviada', servicio: services[0] }, 201);
    throw new Error(`Unexpected API request: ${url.pathname}`);
  });
});

async function openRequest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Solicitar servicio', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: 'Servicio *', exact: true }).selectOption('19');
}

test('HU-10/HU-11: sends combined filters, omits unchecked verification, clears and paginates', async ({ page }) => {
  const queries = [];
  await page.route('**/api/search/profiles**', (route) => {
    queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return response(route, { total: 13, perfiles: [worker] });
  });
  await page.goto('/');
  await expect(page.getByText('13 resultados')).toBeVisible();
  expect(queries.at(-1).verificado).toBeUndefined();
  await page.getByLabel('Buscar por oficio o servicio').fill('  plomería  ');
  await page.getByLabel('Zona de cobertura').selectOption('5');
  await page.getByLabel('Mínimo', { exact: true }).fill('50');
  await page.getByLabel('Máximo', { exact: true }).fill('150');
  await page.getByLabel('Calificación mínima').selectOption('4');
  await page.getByLabel('Solo trabajadores verificados').check();
  await page.getByLabel('Ordenar por').selectOption('precio_asc');
  await page.getByRole('combobox', { name: 'Disponibilidad', exact: true }).selectOption('todos');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => queries.at(-1).q).toBe('plomería');
  expect(queries.at(-1)).toMatchObject({ id_zona: '5', disponibilidad: 'todos', precio_min: '50', precio_max: '150', reputacion_min: '4', verificado: 'true', orden: 'precio_asc', limit: '12', offset: '0' });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect.poll(() => queries.at(-1).offset).toBe('12');
  expect(queries.at(-1).q).toBe('plomería');
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect.poll(() => queries.at(-1).offset).toBe('0');
  expect(queries.at(-1).q).toBeUndefined();
  expect(queries.at(-1).verificado).toBeUndefined();
  await page.getByLabel('Buscar por oficio o servicio').fill('electricidad');
  await page.getByLabel('Buscar por oficio o servicio').press('Enter');
  await expect.poll(() => queries.at(-1).q).toBe('electricidad');
});

test('Rejects inverted prices without a request; handles empty and server errors', async ({ page }) => {
  let count = 0;
  let mode = 'empty';
  await page.route('**/api/search/profiles**', (route) => {
    count += 1;
    return mode === 'error' ? response(route, { message: 'Búsqueda temporalmente no disponible' }, 503) : response(route, { total: 0, perfiles: [] });
  });
  await page.goto('/');
  await expect(page.getByText('No encontramos profesionales')).toBeVisible();
  const before = count;
  await page.getByLabel('Mínimo', { exact: true }).fill('200');
  await page.getByLabel('Máximo', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('alert')).toContainText('mayor o igual');
  expect(count).toBe(before);
  mode = 'error';
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporalmente');
  mode = 'empty';
  await page.getByRole('button', { name: 'Reintentar búsqueda' }).click();
  await expect(page.getByText('No encontramos profesionales')).toBeVisible();
});

test('Latest search wins when an earlier response is delayed', async ({ page }) => {
  await page.route('**/api/search/profiles**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'vieja') await new Promise((resolve) => setTimeout(resolve, 600));
    await response(route, { total: 1, perfiles: [{ ...worker, nombre: q === 'vieja' ? 'Resultado anterior' : 'Resultado actual' }] }).catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel('Buscar por oficio o servicio').fill('vieja');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByLabel('Buscar por oficio o servicio').fill('nueva');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resultado actual' })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByRole('heading', { name: 'Resultado anterior' })).toHaveCount(0);
});

test('HU-13: validates, sends exact authenticated payload once and shows server confirmation', async ({ page }) => {
  const posts = [];
  await page.route('**/api/requests/create', async (route) => {
    posts.push({ body: route.request().postDataJSON(), auth: route.request().headers().authorization });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await response(route, { id_solicitud: 321, estado: 'Enviada', servicio: services[0] }, 201);
  });
  await openRequest(page);
  await page.getByLabel('Descripción del trabajo *').fill('             ');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('10 y 4000');
  expect(posts).toHaveLength(0);
  await page.getByLabel('Descripción del trabajo *').fill('  Hay una fuga de agua en la cocina.  ');
  await page.getByLabel('Ubicación aproximada').fill('  Zona 10  ');
  await page.getByLabel('Fecha y hora deseadas').fill('2020-01-01T09:00');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('futura');
  expect(posts).toHaveLength(0);
  await page.getByLabel('Fecha y hora deseadas').fill('2099-01-01T09:00');
  await page.getByLabel('Necesito atención urgente').check();
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Tu solicitud quedó registrada')).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].auth).toBe('Bearer test-only-token');
  expect(posts[0].body).toEqual({ id_trabajador: 7, id_servicio: 19, descripcion: 'Hay una fuga de agua en la cocina.', ubicacion_aprox: 'Zona 10', fecha_deseada: await page.evaluate(() => new Date('2099-01-01T09:00').toISOString()), urgente: true });
  await expect(page.getByText('#321', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a los resultados' }).click();
  await expect(page.getByRole('button', { name: 'Solicitar servicio', exact: true })).toBeFocused();
});

test('Service failures, no services and own profile block invalid submissions', async ({ page }) => {
  let fail = true;
  await page.route('**/api/servicios**', (route) => fail ? response(route, { message: 'Servicios no disponibles' }, 503) : response(route, []));
  await page.goto('/');
  await page.getByRole('button', { name: 'Solicitar servicio', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Servicios no disponibles');
  await expect(page.getByRole('button', { name: 'Enviar solicitud', exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Reintentar servicios' }).click();
  await expect(page.getByText('Este trabajador no tiene servicios activos para solicitar.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.route('**/api/search/profiles**', (route) => response(route, { total: 1, perfiles: [{ ...worker, id_usuario: user.id_usuario }] }));
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Este es tu perfil' })).toBeDisabled();
});

test('Server rejection retains form; uncertain response cannot be automatically resubmitted', async ({ page }) => {
  let fail = false;
  let count = 0;
  await page.route('**/api/requests/create', (route) => {
    count += 1;
    return fail ? route.abort('failed') : response(route, { message: 'Ese servicio ya no está activo.' }, 400);
  });
  await openRequest(page);
  await page.getByLabel('Descripción del trabajo *').fill('Necesito reparar una fuga en casa.');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ya no está activo');
  await expect(page.getByLabel('Descripción del trabajo *')).toHaveValue('Necesito reparar una fuga en casa.');
  fail = true;
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('podría haberse registrado');
  await expect(page.getByRole('button', { name: 'Enviar solicitud', exact: true })).toBeDisabled();
  expect(count).toBe(2);
  await expect(page.getByText('Tu solicitud quedó registrada')).toHaveCount(0);
});

test('Zone error is recoverable and session expiration is explicit', async ({ page }) => {
  await page.route('**/api/zonas**', (route) => response(route, { message: 'Error' }, 500));
  await openRequest(page);
  await page.route('**/api/requests/create', (route) => response(route, { message: 'Unauthorized' }, 401));
  await page.getByLabel('Descripción del trabajo *').fill('Necesito reparar una fuga en casa.');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('sesión expiró');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar las zonas');
  await page.route('**/api/zonas**', (route) => response(route, [{ id_zona: 5, nombre: 'Zona 10', estado: 'ACTIVA' }]));
  await page.getByRole('button', { name: 'Reintentar zonas' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Desktop/mobile layout and modal keyboard focus; capture manual examples', async ({ page }) => {
  const capture = async (name) => {
    if (!process.env.MANUAL_SCREENSHOTS) return;
    fs.mkdirSync(process.env.MANUAL_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.MANUAL_SCREENSHOTS, name), fullPage: true });
  };
  await page.route('**/api/search/profiles**', (route) => response(route, { total: 2, perfiles: [worker, { ...worker, id_perfil: 9, nombre: 'Miguel Pérez', oficio_principal: 'Electricidad', descripcion: 'Diagnóstico de fallas eléctricas y mantenimiento de instalaciones del hogar.', reputacion: 4.6, tarifas: { tipo: 'por_hora', monto_desde: 95 } }] }));
  await page.goto('/');
  await expect(page.getByText('2 resultados')).toBeVisible();
  await capture('01-busqueda.png');
  await page.getByRole('button', { name: 'Solicitar servicio', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Servicio *', exact: true }).selectOption('19');
  await page.getByLabel('Descripción del trabajo *').fill('Hay una fuga de agua debajo del lavaplatos y necesito repararla.');
  await page.getByLabel('Ubicación aproximada').fill('Zona 10, cerca del centro comercial');
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  }
  await capture('02-solicitud.png');
  await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
  await expect(page.getByText('Tu solicitud quedó registrada')).toBeVisible();
  await capture('03-confirmacion.png');
  await page.getByRole('button', { name: 'Volver a los resultados' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture('04-movil.png');
  await page.getByRole('button', { name: 'Solicitar servicio', exact: true }).first().click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

