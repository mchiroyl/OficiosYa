import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  Given,
  Then,
  When,
  setDefaultTimeout,
  setWorldConstructor,
} from '@cucumber/cucumber';
import { chromium, expect } from '@playwright/test';

setDefaultTimeout(30_000);

const baseURL = process.env.GHERKIN_BASE_URL || 'http://127.0.0.1:4173';
let browser;

const user = { id_usuario: 10, nombre: 'Johan Gómez', correo: 'johan@example.com' };
const profile = {
  id_perfil: 7,
  id_usuario: 10,
  oficio_principal: 'Electricista',
  descripcion: 'Especialista en instalaciones residenciales y comerciales.',
  experiencia: 'Más de 5 años',
  contacto_visible: true,
  disponibilidad: 'Disponible',
  reputacion: 4.8,
  total_resenas: 12,
  tarifas: { tipo: 'por_hora', monto_desde: 500, moneda: 'GTQ' },
  cobertura: [{ id_zona: 1, nombre: 'El Asintal', tipo: 'municipio', estado: 'ACTIVA' }],
  horarios: [{ dia: 'lunes', desde: '08:00', hasta: '17:00' }],
};
const publicProfile = {
  id_perfil: 7,
  id_usuario: 10,
  nombre: 'Johan Gómez',
  oficio_principal: 'Electricista',
  descripcion: JSON.stringify({ v: 1, bio: 'Biografía profesional legible para clientes.', tarifas: { monto_desde: 500 } }),
  tarifas: { tipo: 'por_hora', monto_desde: 500, moneda: 'GTQ' },
  disponibilidad: 'Disponible',
  reputacion: 4.8,
  total_resenas: 12,
  cobertura: [{ id_zona: 1, nombre: 'El Asintal', tipo: 'municipio' }],
  horarios: [],
};

class OficiosYaWorld {
  async mockApi() {
    this.searchRequests = [];
    await this.page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const respond = (json, status = 200) => route.fulfill({ status, json });
      if (path === '/api/categorias') return respond([
        { id_categoria: 3, nombre: 'Electricidad', estado: 'ACTIVA' },
        { id_categoria: 4, nombre: 'Plomería', estado: 'ACTIVA' },
      ]);
      if (path === '/api/zonas') return respond([
        { id_zona: 1, nombre: 'El Asintal', tipo: 'municipio', estado: 'ACTIVA' },
      ]);
      if (path === '/api/search/profiles') {
        this.searchRequests.push(new URL(route.request().url()));
        return respond({ motor: 'mock', total: 1, perfiles: [{ ...profile, nombre: 'Johan Gómez' }] });
      }
      if (path === '/api/perfiles-trabajador/7') return respond(publicProfile);
      if (path === '/api/resenas') return respond([
        { id_resena: 1, id_trabajador: 7, calificacion: 5, comentario: 'Trabajo excelente.' },
        { id_resena: 2, id_trabajador: 7, calificacion: 3, comentario: 'Buen servicio.' },
      ]);
      if (path === '/api/auth/login') return respond({
        user,
        tokens: { accessToken: 'gherkin-token', refreshToken: 'gherkin-refresh' },
        tienePerfilTrabajador: true,
        perfilTrabajador: { id_perfil: 7 },
      }, 201);
      if (path === '/api/auth/me') return respond({
        user,
        tienePerfilTrabajador: true,
        perfilTrabajador: { id_perfil: 7 },
      });
      if (path === '/api/worker/profile') return respond(profile);
      if (path === '/api/worker/contact') return respond({ correo: user.correo, telefono: '55554589' });
      if (path === '/api/identity/dpi') return respond({});
      if (path === '/api/servicios') return respond([
        { id_servicio: 1, id_perfil: 7, id_categoria: 3, nombre: 'Instalación eléctrica', descripcion: 'Instalaciones seguras', activo: true },
      ]);
      if (path === '/api/chat/conversations') return respond([
        { id_solicitud: 121, estado: 'Enviada', contraparte: { nombre: 'Cliente de prueba' } },
      ]);
      if (path === '/api/chat/threads/121/messages') return respond([{
        id_mensaje: 1,
        id_solicitud: 121,
        id_emisor: 10,
        mio: true,
        emisor_nombre: 'Johan Gómez',
        fecha_envio: '2026-10-15T12:00:00.000Z',
        contenido: '9'.repeat(800),
      }]);
      if (path === '/api/portfolio') return respond([]);
      if (path === '/api/requests/worker') return respond([]);
      return respond([]);
    });
  }
}

setWorldConstructor(OficiosYaWorld);

BeforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

Before(async function () {
  this.context = await browser.newContext({ baseURL });
  this.page = await this.context.newPage();
  await this.mockApi();
});

After(async function () {
  await this.context?.close();
});

AfterAll(async () => {
  await browser?.close();
});

Given('que estoy en la pantalla de inicio de sesión', async function () {
  await this.page.goto('/login');
});

Given('selecciono el modo trabajador', async function () {
  await this.page.getByRole('button', { name: 'Modo Trabajador', exact: true }).click();
});

Given('que soy un trabajador autenticado', async function () {
  await this.page.addInitScript(({ user }) => {
    localStorage.setItem('oficiosya.mode', 'worker');
    sessionStorage.setItem('oficiosya.session', JSON.stringify({
      user,
      accessToken: 'gherkin-token',
      refreshToken: 'gherkin-refresh',
      tienePerfilTrabajador: true,
      perfilTrabajador: { id_perfil: 7 },
    }));
  }, { user });
});

Given('que uso una pantalla móvil', async function () {
  await this.page.setViewportSize({ width: 390, height: 844 });
});

When('intento ingresar sin completar las credenciales', async function () {
  await this.page.getByRole('button', { name: /Entrar como/ }).click();
});

When('ingreso con credenciales válidas', async function () {
  await this.page.getByLabel('Correo electrónico', { exact: true }).fill('johan@example.com');
  await this.page.getByLabel('Contraseña', { exact: true }).fill('Prueba2026!');
  await this.page.getByRole('button', { name: 'Entrar como trabajador', exact: true }).click();
});

When('abro mi perfil', async function () {
  await this.page.goto('/worker/my-profile');
  await expect(this.page.getByRole('heading', { name: 'Johan Gómez' })).toBeVisible();
});

When('abro el directorio de la categoría {string}', async function (categoryName) {
  const ids = { Electricidad: 3, 'Plomería': 4 };
  await this.page.goto(`/categoria/${ids[categoryName]}`);
  await expect(this.page.getByRole('heading', { name: `Categoría: ${categoryName}` })).toBeVisible();
  await expect(this.page.getByRole('heading', { name: 'Johan Gómez', exact: true })).toBeVisible();
});

When('abro el perfil público del trabajador de prueba', async function () {
  await this.page.goto('/workers/7');
  await expect(this.page.getByRole('heading', { name: 'Johan Gómez', exact: true })).toBeVisible();
});

When('abro el chat con un mensaje continuo extenso', async function () {
  this.longMessage = '9'.repeat(800);
  await this.page.goto('/chat/121');
  await expect(this.page.getByText(this.longMessage, { exact: true })).toBeVisible();
});

When('intento enviar un DPI con una imagen mayor de 8 MB', async function () {
  await this.page.goto('/worker/profile');
  await expect(this.page.getByRole('heading', { name: 'Perfil y disponibilidad' })).toBeVisible();
  await this.page.getByLabel('Frente').setInputFiles({
    name: 'dpi-grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  });
  await this.page.getByLabel('Reverso').setInputFiles({
    name: 'dpi-reverso.png',
    mimeType: 'image/png',
    buffer: Buffer.from('imagen de prueba'),
  });
  await this.page.getByRole('button', { name: 'Enviar documentos', exact: true }).click();
});

When('intento guardar una tarifa negativa', async function () {
  await this.page.goto('/worker/profile');
  await expect(this.page.getByRole('heading', { name: 'Perfil y disponibilidad' })).toBeVisible();
  await this.page.getByLabel('Monto desde').fill('-50');
  await this.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
});

When('presiono el botón {string}', async function (label) {
  await this.page.getByRole('link', { name: label, exact: true }).click();
});

Then('debo ver el mensaje {string}', async function (message) {
  await expect(this.page.getByText(message, { exact: true })).toBeVisible();
});

Then('debo entrar al panel del trabajador', async function () {
  await expect(this.page).toHaveURL(/\/$/);
  await expect(this.page.getByRole('heading', { name: 'Tu panel de trabajo' })).toBeVisible();
});

Then('debo ver la opción {string} en el menú', async function (label) {
  await expect(this.page.getByRole('link', { name: label, exact: true })).toBeVisible();
});

Then('debo ver mi nombre {string}', async function (name) {
  await expect(this.page.getByRole('heading', { name, exact: true })).toBeVisible();
});

Then('debo ver mi oficio {string}', async function (trade) {
  await expect(this.page.getByText(trade, { exact: true })).toBeVisible();
});

Then('debo ver las secciones principales del perfil', async function () {
  for (const heading of ['Información de contacto', 'Sobre mí', 'Servicios ofrecidos', 'Portafolio de trabajos']) {
    await expect(this.page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

Then('debo ver el servicio {string}', async function (service) {
  await expect(this.page.getByText(service, { exact: true })).toBeVisible();
});

Then('la búsqueda debe enviar la categoría {string} como texto sin el parámetro id_categoria', async function (categoryName) {
  await expect.poll(() => this.searchRequests.length).toBeGreaterThan(0);
  expect(this.searchRequests.every((url) => !url.searchParams.has('id_categoria'))).toBe(true);
  expect(this.searchRequests.some((url) => url.searchParams.get('q') === categoryName)).toBe(true);
});

Then('la búsqueda no debe publicar tarifas ni incluir un filtro de precio', async function () {
  const body = this.page.locator('body');
  await expect(body).not.toContainText('Rango de precio (Q)');
  await expect(body).not.toContainText('Q 500.00');
});

Then('debo ver la biografía legible sin los metadatos ni precios públicos', async function () {
  const body = this.page.locator('body');
  await expect(body).toContainText('Biografía profesional legible para clientes.');
  await expect(body).not.toContainText('"tarifas"');
  await expect(body).not.toContainText('Q 500.00');
  await expect(body).toContainText('El precio y el alcance se acuerdan en privado');
  await expect(body).toContainText('4.0');
  await expect(body).toContainText('Basado en 2 reseñas');
});

Then('el mensaje debe ajustarse al ancho disponible', async function () {
  const text = this.page.getByText(this.longMessage, { exact: true });
  const metrics = await text.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

Then('debo ver el aviso del tamaño máximo en español', async function () {
  await expect(this.page.getByRole('alert')).toHaveText(
    'El archivo supera el límite permitido de 8 MB. Elige una imagen más pequeña.',
  );
});

Then('debo ver la validación de tarifa en español', async function () {
  await expect(this.page.getByRole('alert')).toHaveText(
    'Los montos de tarifa deben ser mayores o iguales a Q 0.',
  );
});

Then('debo ver mi teléfono enmascarado', async function () {
  const contactSection = this.page.getByRole('heading', { name: 'Información de contacto' }).locator('..');
  await expect(contactSection).toContainText('589');
  await expect(contactSection).not.toContainText('55554589');
});

Then('debo llegar al formulario de edición del perfil', async function () {
  await expect(this.page).toHaveURL(/\/worker\/profile$/);
  await expect(this.page.getByRole('heading', { name: 'Perfil y disponibilidad' })).toBeVisible();
});

Then('el perfil no debe desbordarse horizontalmente', async function () {
  const fits = await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});

Then('debo ver el botón {string}', async function (label) {
  await expect(this.page.getByRole('link', { name: label, exact: true })).toBeVisible();
});
