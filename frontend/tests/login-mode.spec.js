import { test, expect } from '@playwright/test';

for (const mode of ['cliente', 'trabajador']) {
  test(`login changes interface and opens the ${mode} home`, async ({ page }) => {
    const user = { id_usuario: 10, nombre: 'Prueba' };
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/login') return route.fulfill({ json: {
        user, tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' },
        tienePerfilTrabajador: true, perfilTrabajador: { id_perfil: 7 },
      } });
      if (path === '/api/worker/profile') return route.fulfill({ json: { id_perfil: 7, disponibilidad: 'Disponible' } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('prueba@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Modo Trabajador', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tu oficio, nuevas oportunidades.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingresa como trabajador' })).toBeVisible();
    if (mode === 'cliente') {
      await page.getByRole('button', { name: 'Modo Cliente', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'El profesional que necesitas, a tu alcance.' })).toBeVisible();
    }
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue('prueba@example.com');
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('test-password');
    await page.getByRole('button', { name: `Entrar como ${mode}`, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: mode === 'trabajador' ? 'Tu panel de trabajo' : '¿Qué oficio necesitas hoy?' })).toBeVisible();
  });
}

test('worker selection persists through reload and registration on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Modo Trabajador', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Modo Trabajador', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Ingresa como trabajador' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByLabel('Oficio principal', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al inicio de sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa como trabajador' })).toBeVisible();
});
