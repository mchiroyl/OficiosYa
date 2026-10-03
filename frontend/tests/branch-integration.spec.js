import { test, expect } from '@playwright/test';

const user = { id_usuario: 100, nombre: 'Cliente de prueba', es_admin: true };
const request = {
  id_solicitud: 81, id_cliente: 100, id_trabajador: 7, id_servicio: 19,
  descripcion: 'Reparar la fuga del lavaplatos', estado: 'PENDIENTE',
  cliente: { id_usuario: 100, nombre: 'María Cliente' },
  trabajador: { id_perfil: 7, id_usuario: 8, nombre: 'Andrea López' },
  servicio: { id_servicio: 19, nombre: 'Plomería residencial' }, resena: null,
};
const respond = (route, json) => route.fulfill({ json });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((user) => sessionStorage.setItem('oficiosya.session',
    JSON.stringify({ user, accessToken: 'test-only-token' })), user);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return respond(route, { user, es_admin: true });
    if (path === '/api/worker/profile') return respond(route, { id_perfil: 7, disponibilidad: 'Ocupado' });
    if (path === '/api/categorias') return respond(route, [{ id_categoria: 1, nombre: 'Plomería' }]);
    if (path === '/api/search/profiles') return respond(route, { total: 0, perfiles: [] });
    return respond(route, []);
  });
});

test('worker legacy route retains filtering, transitions, details and chat', async ({ page }) => {
  let current = { ...request };
  const actions = [];
  await page.route('**/api/requests/worker', (route) => respond(route, [current]));
  await page.route('**/api/requests/81/status', (route) => {
    expect(route.request().method()).toBe('PUT');
    const { accion } = route.request().postDataJSON();
    actions.push(accion);
    current = { ...current, estado: { Aceptar: 'ACEPTADA', Iniciar: 'EN_PROCESO', Finalizar: 'COMPLETADA' }[accion] };
    return respond(route, current);
  });
  await page.goto('/worker/requests');
  await expect(page.getByRole('heading', { name: 'Bandeja de solicitudes' })).toBeVisible();
  await expect(page.getByText('María Cliente', { exact: false })).toBeVisible();
  await expect(page.getByText('Estado visible en el directorio: Ocupado')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expect(page.locator('main').getByRole('link', { name: 'Chat', exact: true })).toHaveAttribute('href', '/chat/81');
  await page.getByRole('button', { name: 'Iniciar trabajo' }).click();
  await expect(page.getByText('En Proceso', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(page.getByText('No hay peticiones en esta vista')).toBeVisible();
  await page.getByRole('button', { name: 'Finalizadas', exact: true }).click();
  await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();
  expect(actions).toEqual(['Aceptar', 'Iniciar', 'Finalizar']);
});

test('client legacy route shows review history and prevents a second review', async ({ page }) => {
  let current = { ...request, estado: 'Completada' };
  const posts = [];
  await page.route('**/api/requests/client', (route) => respond(route, [current]));
  await page.route('**/api/reviews/create', (route) => {
    const body = route.request().postDataJSON();
    posts.push(body);
    current = { ...current, resena: { id_resena: 5, ...body } };
    return respond(route, current.resena);
  });
  await page.goto('/client/requests');
  await expect(page.getByText('Andrea López', { exact: false })).toBeVisible();
  await expect(page.getByText('Plomería residencial', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Calificar', exact: true }).click();
  await page.getByRole('radio', { name: '4 estrellas' }).click();
  await page.getByLabel('Reseña escrita').fill('Buen trabajo y comunicación.');
  await page.getByRole('button', { name: 'Publicar reseña' }).click();
  await expect(page.getByRole('img', { name: 'Calificación 4 de 5', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calificar', exact: true })).toHaveCount(0);
  expect(posts).toEqual([{ id_solicitud: 81, calificacion: 4, comentario: 'Buen trabajo y comunicación.' }]);
  await page.reload();
  await expect(page.getByText('Buen trabajo y comunicación.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calificar', exact: true })).toHaveCount(0);
});

test('category directory and all administration entries remain reachable', async ({ page }) => {
  const queries = [];
  await page.route('**/api/search/profiles**', (route) => {
    queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return respond(route, { total: 0, perfiles: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Plomería/ }).click();
  await expect(page).toHaveURL(/\/categoria\/1$/);
  await expect.poll(() => queries.at(-1)?.id_categoria).toBe('1');
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const name of ['Usuarios', 'Categorías', 'Zonas', 'Auditoría DPI', 'Reportes']) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Chat', exact: true })).toBeVisible();
});
