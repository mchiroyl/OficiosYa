const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEstado, resolveTransition, actorPuede } = require('../dist/requests/request-state');
const { RequestsService } = require('../dist/requests/requests.service');

test('both branch state spellings retain the complete lifecycle', () => {
  for (const value of ['En proceso', 'En Proceso', 'EN_PROCESO']) assert.equal(normalizeEstado(value), 'En Proceso');
  for (const value of ['Completada', 'COMPLETADA', 'Finalizada']) assert.equal(normalizeEstado(value), 'Finalizada');
  assert.equal(resolveTransition('PENDIENTE', 'Aceptar').next, 'Aceptada');
  const start = resolveTransition('ACEPTADA', 'Iniciar');
  assert.equal(start.next, 'En Proceso');
  assert.equal(actorPuede(start.rol, true, false), false);
  assert.equal(actorPuede(start.rol, false, true), true);
  assert.equal(resolveTransition('EN_PROCESO', 'Finalizar').next, 'Finalizada');
  assert.equal(resolveTransition('EN_PROCESO', 'Cancelar').rol, 'cliente');
  assert.equal(resolveTransition('Enviada', 'Iniciar').ok, false);
  assert.equal(resolveTransition('Finalizada', 'Iniciar').ok, false);
});

function database(tables) {
  return { from(table) {
    let rows = tables[table] || [];
    const query = {
      select() { return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
      order() { return query; },
      maybeSingle: async () => ({ data: rows[0] || null }),
      then(resolve) { return Promise.resolve({ data: rows }).then(resolve); },
    };
    return query;
  } };
}

test('client and worker lists isolate ownership and return names, normalized states and reviews', async () => {
  const tables = {
    solicitud_servicio: [
      { id_solicitud: 1, id_cliente: 10, id_trabajador: 7, id_servicio: 4, estado: 'COMPLETADA' },
      { id_solicitud: 2, id_cliente: 20, id_trabajador: 8, id_servicio: 5, estado: 'PENDIENTE' },
    ],
    perfil_trabajador: [{ id_perfil: 7, id_usuario: 30 }, { id_perfil: 8, id_usuario: 40 }],
    usuario: [{ id_usuario: 10, nombre: 'Cliente' }, { id_usuario: 30, nombre: 'Profesional' }],
    servicio_ofrecido: [{ id_servicio: 4, nombre: 'Plomería' }],
    resena: [{ id_solicitud: 1, calificacion: 4 }],
  };
  const service = new RequestsService(database(tables));
  const client = await service.listClient({ id_usuario: 10 });
  assert.equal(client.length, 1);
  assert.equal(client[0].estado, 'Finalizada');
  assert.equal(client[0].trabajador.nombre, 'Profesional');
  assert.equal(client[0].trabajador.id_usuario, 30);
  assert.equal(client[0].resena.calificacion, 4);
  const worker = await service.listWorker({ id_usuario: 30 });
  assert.deepEqual(worker, client);
  assert.deepEqual(await service.listClient({ id_usuario: 99 }), []);
  await assert.rejects(service.listWorker({ id_usuario: 99 }), /perfil de trabajador/);
});

test('starting a job rejects the client and outsiders before writing', async () => {
  const service = new RequestsService({});
  service.findSolicitud = async () => ({ id_solicitud: 1, id_cliente: 10, id_trabajador: 7, estado: 'ACEPTADA' });
  service.findPerfil = async () => ({ id_perfil: 7, id_usuario: 30 });
  await assert.rejects(service.updateStatus({ id_usuario: 10 }, 1, { accion: 'Iniciar' }), /Solo el trabajador/);
  await assert.rejects(service.updateStatus({ id_usuario: 99 }, 1, { accion: 'Iniciar' }), /No puedes cambiar/);
});

test('optimistic fallback detects concurrent changes instead of overwriting them', async () => {
  const conditions = [];
  const query = {
    update() { return query; }, eq(key, value) { conditions.push([key, value]); return query; },
    select() { return query; }, maybeSingle: async () => ({ data: null }),
  };
  const service = new RequestsService({ from: () => query });
  await assert.rejects(service.updateStatusLocked({ id_solicitud: 1, estado: 'ACEPTADA' }, 'En Proceso'), /cambió de estado/);
  assert.deepEqual(conditions, [['id_solicitud', 1], ['estado', 'ACEPTADA']]);
});
