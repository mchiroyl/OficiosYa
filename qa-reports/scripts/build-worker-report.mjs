// Genera qa-reports/worker/Informe_QA_E2E_Modo_Trabajador.docx a partir de
// qa-reports/worker/results.json y las capturas de qa-reports/worker/screenshots/.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(QA_ROOT, '..');
const WORKER = path.join(QA_ROOT, 'worker');
const RESULTS = path.join(WORKER, 'results.json');
const OUTPUT = path.join(WORKER, 'Informe_QA_E2E_Modo_Trabajador.docx');
const VERSION = '1.0';

if (!fs.existsSync(RESULTS)) {
  console.error(`No existe ${RESULTS}. Ejecuta primero frontend/tests/qa/worker-mode.e2e.spec.js.`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const results = [...data.results].sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));

const git = (cmd) => {
  try {
    return execSync(cmd, { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return 'no disponible';
  }
};
const branch = git('git rev-parse --abbrev-ref HEAD');
const commit = git('git rev-parse --short HEAD');
const dirty = git('git status --porcelain') ? ' (con cambios locales sin confirmar)' : '';

let playwrightVersion = 'no disponible';
try {
  playwrightVersion = JSON.parse(
    fs.readFileSync(path.join(REPO, 'frontend/node_modules/@playwright/test/package.json'), 'utf8'),
  ).version;
} catch {
  // se deja "no disponible"
}

const fmtDate = (iso, opts = { dateStyle: 'long', timeStyle: 'short' }) =>
  iso ? new Date(iso).toLocaleString('es-GT', { ...opts, timeZone: 'America/Guatemala' }) : '—';

// ---------- Estilo ----------

const FONT = 'Calibri';
const STATUS_STYLE = {
  Aprobado: { fill: 'C6EFCE', color: '006100' },
  Fallido: { fill: 'FFC7CE', color: '9C0006' },
  Bloqueado: { fill: 'D9D9D9', color: '3F3F3F' },
  Observación: { fill: 'FFEB9C', color: '9C5700' },
};
const SEVERITY_ORDER = ['Crítica', 'Alta', 'Media', 'Baja'];
const SEVERITY_STYLE = {
  Crítica: { fill: 'C00000', color: 'FFFFFF' },
  Alta: { fill: 'F4B183', color: '843C0C' },
  Media: { fill: 'FFEB9C', color: '9C5700' },
  Baja: { fill: 'DDEBF7', color: '1F4E79' },
};
const KIND_STYLE = {
  ok: { mark: '✔', color: '006100' },
  fail: { mark: '✖', color: '9C0006' },
  warn: { mark: '⚠', color: '9C5700' },
};
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const run = (text, opts = {}) => new TextRun({ text: String(text ?? ''), font: FONT, ...opts });
const p = (text, opts = {}) =>
  new Paragraph({ spacing: { after: 120 }, ...opts, children: Array.isArray(text) ? text : [run(text)] });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run(text)] });
const bullet = (children, level = 0) =>
  new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 60 },
    children: Array.isArray(children) ? children : [run(children)],
  });
let listInstance = 0;
const numbered = (items) => {
  listInstance += 1;
  return items.map(
    (item) =>
      new Paragraph({
        numbering: { reference: 'steps', level: 0, instance: listInstance },
        spacing: { after: 40 },
        children: [run(item)],
      }),
  );
};
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function cell(content, { width, fill, color, bold, align, size } = {}) {
  const children = (Array.isArray(content) ? content : [content]).map((item) =>
    item instanceof Paragraph
      ? item
      : new Paragraph({
          alignment: align,
          spacing: { before: 40, after: 40 },
          children: [run(item, { bold, color, size })],
        }),
  );
  return new TableCell({
    children,
    borders: BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((head, i) => cell(head, { width: widths?.[i], fill: '1F4E79', color: 'FFFFFF', bold: true })),
      }),
      ...rows.map((cells) => new TableRow({ children: cells.map((c, i) => (c instanceof TableCell ? c : cell(c, { width: widths?.[i] }))) })),
    ],
  });
}

const kvTable = (pairs) =>
  table(
    ['Campo', 'Valor'],
    pairs.map(([k, v]) => [cell(k, { bold: true, width: 28, fill: 'F2F2F2' }), cell(v, { width: 72 })]),
    [28, 72],
  );

const statusCell = (status, width) => {
  const style = STATUS_STYLE[status] || STATUS_STYLE.Bloqueado;
  return cell(status, { width, fill: style.fill, color: style.color, bold: true, align: AlignmentType.CENTER });
};
const severityCell = (severity, width) => {
  const style = SEVERITY_STYLE[severity] || SEVERITY_STYLE.Baja;
  return cell(severity, { width, fill: style.fill, color: style.color, bold: true, align: AlignmentType.CENTER });
};

// ---------- Imágenes ----------

const CM = 96 / 2.54;
const MAX_W = Math.round(15 * CM);
const MAX_H = Math.round(19 * CM);
let figureNo = 0;
const figureIndex = new Map();

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function figure(file, caption) {
  const full = path.join(WORKER, file);
  if (!fs.existsSync(full)) return [p(`[Falta la captura ${file}]`, { children: [run(`[Falta la captura ${file}]`, { italics: true, color: '9C0006' })] })];
  const buffer = fs.readFileSync(full);
  const size = pngSize(buffer);
  let width = MAX_W;
  let height = Math.round((size.height / size.width) * width);
  if (height > MAX_H) {
    height = MAX_H;
    width = Math.round((size.width / size.height) * height);
  }
  figureNo += 1;
  if (!figureIndex.has(file)) figureIndex.set(file, figureNo);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({ type: 'png', data: buffer, transformation: { width, height } })],
    }),
    new Paragraph({
      style: 'Caption',
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [run(`Figura ${figureNo}. `, { bold: true }), run(`${caption} `), run(`(${path.basename(file)})`, { color: '7F7F7F' })],
    }),
  ];
}

const captionOf = (file) => {
  for (const r of results) {
    const found = r.evidence.find((e) => e.file === file);
    if (found) return found.caption;
  }
  return path.basename(file);
};

// ---------- Datos derivados ----------

const counts = { Aprobado: 0, Observación: 0, Fallido: 0, Bloqueado: 0 };
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;

const bugs = [...data.bugs]
  .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.caseId.localeCompare(b.caseId, 'es', { numeric: true }))
  .map((b, i) => ({ ...b, code: `BUG-TRB-${String(i + 1).padStart(2, '0')}` }));
const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, bugs.filter((b) => b.severity === s).length]));
const blocked = results.filter((r) => r.status === 'Bloqueado');
const casesWithMobile = results.filter((r) => r.viewports.includes('móvil')).map((r) => r.id);

const summaryOf = (r) => {
  if (r.status === 'Bloqueado') return `Bloqueado: ${r.blockedReason}`;
  const pick = (kind) => r.obtained.filter((o) => o.kind === kind).map((o) => o.text);
  const list = r.status === 'Fallido' ? pick('fail') : r.status === 'Observación' ? pick('warn') : pick('ok');
  const text = list.slice(0, 2).join(' ');
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
};

const bugsOf = (caseId) => bugs.filter((b) => b.caseId === caseId).map((b) => b.code);
const nb = (text) => String(text).replaceAll('-', '\u2011');

// Hallazgos vistos solo en el código (no reproducidos en esta prueba).
const SUSPECTED = [
  {
    title: 'Otros recursos del CRUD genérico sin control de propietario',
    detail:
      'El mismo patrón confirmado en TRB-14 y TRB-17 (servicios y portafolio) aplica a perfiles-trabajador, perfiles-zona, cotizaciones y bitácora: cualquier usuario con sesión podría editarlos o borrarlos. No se probó en esta ronda.',
    location: 'backend/src/resources/resources.config.ts y resource.service.ts',
  },
  {
    title: 'Las páginas del trabajador no comprueban el modo ni el perfil',
    detail:
      'App.jsx muestra /worker/profile, /worker/content y /trabajador/bandeja a cualquier usuario autenticado, también en Modo Cliente o sin perfil de trabajador. Queda para la prueba del modo cliente.',
    location: 'frontend/src/App.jsx (AuthenticatedApp)',
  },
  {
    title: 'Borrar un servicio con solicitudes mostraría un error SQL en inglés',
    detail:
      'Confirmado por API en TRB-14 (DELETE responde 400 con "violates foreign key constraint fk_solicitud_servicio"). En la pantalla, el botón "Eliminar" de un servicio con solicitudes mostraría ese texto, pero no se reprodujo desde la interfaz.',
    location: 'backend/src/resources/resource.service.ts (devuelve error.message de Supabase)',
  },
  {
    title: 'Página RequestChat.jsx sin uso y que no funcionaría',
    detail:
      'Envía mensajes con el recurso "mensajes", que tiene denyMutations. La ruta antigua /solicitudes/:id/chat redirige a /chat/:id, así que parece código muerto.',
    location: 'frontend/src/pages/RequestChat.jsx',
  },
];

// ---------- Secciones ----------

const children = [];

// Portada
children.push(
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run('OficiosYa', { size: 36, color: '2E7D74', bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [run('Informe de pruebas E2E — Modo Trabajador', { size: 52, bold: true, color: '1F4E79' })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: '2E7D74', space: 12 } },
    spacing: { after: 120 },
    children: [run(`Fecha: ${fmtDate(data.meta.startedAt, { dateStyle: 'long' })}`, { size: 26 })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(`Versión: ${VERSION}`, { size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run('Autor: QA automatizado', { size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [run(`Rama ${branch} · commit ${commit}`, { size: 20, color: '7F7F7F' })] }),
  pageBreak(),
);

// Índice
children.push(
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 240 }, children: [run('Índice', { size: 32, bold: true, color: '1F4E79' })] }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  p([run('Si el índice aparece vacío, en Word pulse clic derecho sobre él y elija "Actualizar campos".', { italics: true, color: '7F7F7F', size: 18 })]),
  pageBreak(),
);

// 1. Resumen ejecutivo
const topBugs = bugs.filter((b) => ['Crítica', 'Alta'].includes(b.severity));
children.push(
  h1('1. Resumen ejecutivo'),
  p(
    `Se ejecutaron ${results.length} casos de prueba de extremo a extremo (TRB-01 a TRB-28) del modo trabajador contra el backend real (Supabase), en Google Chrome, en escritorio (1366 × 768) y, para ${casesWithMobile.length} casos, también en móvil (390 × 844). Se tomaron ${results.reduce((n, r) => n + r.evidence.length, 0)} capturas de pantalla.`,
  ),
  table(
    ['Resultado', 'Casos', 'Significado'],
    [
      [statusCell('Aprobado', 22), cell(String(counts.Aprobado), { align: AlignmentType.CENTER, width: 12 }), cell('El comportamiento coincide con lo esperado.', { width: 66 })],
      [statusCell('Observación', 22), cell(String(counts.Observación), { align: AlignmentType.CENTER, width: 12 }), cell('Funciona, pero con un problema de usabilidad, accesibilidad o diseño.', { width: 66 })],
      [statusCell('Fallido', 22), cell(String(counts.Fallido), { align: AlignmentType.CENTER, width: 12 }), cell('No se cumple lo esperado; hay al menos un bug confirmado.', { width: 66 })],
      [statusCell('Bloqueado', 22), cell(String(counts.Bloqueado), { align: AlignmentType.CENTER, width: 12 }), cell('No se pudo ejecutar; se indica el motivo.', { width: 66 })],
    ],
    [22, 12, 66],
  ),
  p(''),
  p([
    run('Bugs confirmados: ', { bold: true }),
    run(`${bugs.length} (${SEVERITY_ORDER.map((s) => `${bySeverity[s]} ${s.toLowerCase()}${bySeverity[s] === 1 ? '' : 's'}`).join(', ')}). `),
    run('Observaciones de UI/UX: ', { bold: true }),
    run(`${data.observations.length}.`),
  ]),
  p([run('Hallazgos más importantes:', { bold: true })]),
  ...topBugs.map((b) => bullet([run(`${b.code} (${b.severity}) — `, { bold: true }), run(`${b.title}. `), run(`[${b.caseId}]`, { color: '7F7F7F' })])),
  p(''),
  p([
    run('Valoración: ', { bold: true }),
    run(
      bySeverity['Crítica'] > 0
        ? 'el modo trabajador no está listo para producción. Hay fallos críticos de autorización (un trabajador puede modificar o borrar datos de otro) y dos funciones básicas de "Contenido" no responden al botón. Lo que sí está bien resuelto: inicio de sesión, cambio de modo, filtros de la bandeja, rechazo con motivo, respuesta única a reseñas, chat en vivo, protección contra XSS en el chat y permisos de solicitudes y chats ajenos.'
        : 'no hay fallos críticos; los problemas encontrados se pueden corregir de forma incremental.',
    ),
  ]),
  pageBreak(),
);

// 2. Entorno
const accountRows = Object.entries(data.meta.accounts || {}).map(([k, v]) => [
  k === 'C' ? 'Cliente' : `Trabajador ${k}`,
  `${v.email} (id_usuario ${v.id_usuario}${v.id_perfil ? `, id_perfil ${v.id_perfil}` : ''})`,
]);
children.push(
  h1('2. Entorno de prueba'),
  kvTable([
    ['Frontend', data.meta.baseUrl],
    ['Backend (API)', data.meta.apiUrl],
    ['Base de datos', 'Supabase real (sin respuestas simuladas)'],
    ['Navegador', `Google Chrome ${String(data.meta.browser || '').replace(/^chromium\s*/i, '')} (canal "chrome" de Playwright)`],
    ['Herramienta', `Playwright ${playwrightVersion} — frontend/tests/qa/worker-mode.e2e.spec.js`],
    ['Resoluciones', 'Escritorio 1366 × 768; móvil 390 × 844 (casos marcados [M])'],
    ['Inicio de la ejecución', fmtDate(data.meta.startedAt, { dateStyle: 'full', timeStyle: 'medium' })],
    ['Fin de la ejecución', fmtDate(data.meta.finishedAt, { dateStyle: 'full', timeStyle: 'medium' })],
    ['Rama y commit', `${branch} · ${commit}${dirty}`],
    ...accountRows,
  ]),
  p(''),
  p([run('Credenciales: ', { bold: true }), run('las contraseñas no aparecen en el código ni en este informe; la prueba las lee de las variables de entorno QA_*.')]),
  h2('2.1 Datos de prueba creados'),
  p('Para poder ejecutar los casos se prepararon estos datos con las cuentas de prueba (todas creadas para esta ejecución):'),
  ...data.seedNotes.map((note) => bullet(note)),
  pageBreak(),
);

// 3. Alcance
children.push(
  h1('3. Alcance'),
  h2('3.1 Qué se probó'),
  ...[
    'Acceso: inicio de sesión con el selector de trabajador, contraseña incorrecta, persistencia del modo y enlace directo sin sesión (TRB-01 a TRB-04).',
    'Panel y oferta: panel del trabajador, disponibilidad, accesos rápidos, perfil, tarifas, perfil público y verificación DPI (TRB-05 a TRB-11).',
    'Contenido: servicios, portafolio y reseñas, incluidos los permisos entre trabajadores (TRB-12 a TRB-19).',
    'Solicitudes: bandeja, filtros y máquina de estados, incluidos los permisos (TRB-20 a TRB-23).',
    'Chat: envío, XSS y acceso a chats ajenos (TRB-24 a TRB-26).',
    'Diseño adaptable y accesibilidad con teclado (TRB-27 y TRB-28).',
  ].map((t) => bullet(t)),
  h2('3.2 Fuera de alcance'),
  ...['Modo cliente (se probará en otra ronda).', 'Panel de administración.', 'Rendimiento, carga y compatibilidad con otros navegadores.'].map((t) => bullet(t)),
  h2('3.3 Método'),
  ...[
    'Las pruebas no modifican el código de la aplicación. Si encuentran un bug, lo documentan.',
    'Los casos de interfaz se ejecutan en el navegador como lo haría un usuario. Los casos de permisos (TRB-14, 17, 19, 23 y 26) llaman a la API con el token de otra cuenta; su evidencia es una captura de la petición y la respuesta.',
    'Se toma una captura de página completa en cada paso clave y siempre que hay un fallo, un error visible, una pantalla vacía o algo raro de diseño.',
    'Confirmado = reproducido en esta ejecución y con captura. Sospechado = visto solo en el código; aparece aparte en la sección 5.2.',
  ].map((t) => bullet(t)),
  pageBreak(),
);

// 4. Matriz de casos
children.push(
  h1('4. Matriz de casos'),
  p('Resultado de cada caso. La columna "Bugs" enlaza con la sección 5 y el detalle completo con capturas está en el Anexo A.'),
  table(
    ['ID', 'Caso', 'Vista', 'Resultado', 'Resumen', 'Bugs'],
    results.map((r) => [
      cell(nb(r.id), { bold: true, width: 9, size: 20 }),
      cell(r.title, { width: 21 }),
      cell(r.viewports.join(' + '), { width: 10, size: 18 }),
      statusCell(r.status, 12),
      cell(summaryOf(r), { width: 35, size: 18 }),
      cell(bugsOf(r.id).map(nb).join(', ') || '—', { width: 13, size: 16 }),
    ]),
    [9, 21, 10, 12, 35, 13],
  ),
  pageBreak(),
);

// 5. Bugs
children.push(
  h1('5. Bugs'),
  p(`Bugs confirmados, ordenados de mayor a menor severidad. Crítica: seguridad o función esencial inutilizable. Alta: función importante rota o datos incorrectos para el cliente. Media: afecta a parte de los usuarios o tiene alternativa. Baja: mensaje o detalle menor.`),
  h2('5.1 Bugs confirmados'),
);
for (const b of bugs) {
  children.push(
    h3(`${b.code} — ${b.title}`),
    table(
      ['Campo', 'Detalle'],
      [
        [cell('Severidad', { bold: true, width: 24, fill: 'F2F2F2' }), severityCell(b.severity, 76)],
        [cell('Caso', { bold: true, width: 24, fill: 'F2F2F2' }), cell(`${b.caseId} — ${results.find((r) => r.id === b.caseId)?.title || ''}`, { width: 76 })],
        [cell('Pasos para reproducir', { bold: true, width: 24, fill: 'F2F2F2' }), cell(numbered(b.steps || []), { width: 76 })],
        [cell('Resultado esperado', { bold: true, width: 24, fill: 'F2F2F2' }), cell(b.expected, { width: 76 })],
        [cell('Resultado obtenido', { bold: true, width: 24, fill: 'F2F2F2' }), cell(b.obtained, { width: 76 })],
        [cell('Ubicación probable', { bold: true, width: 24, fill: 'F2F2F2' }), cell(b.location ? `${b.location} (deducida del código)` : '—', { width: 76 })],
        [cell('Evidencia', { bold: true, width: 24, fill: 'F2F2F2' }), cell((b.evidence || []).map((f) => path.basename(f)).join(', ') || '—', { width: 76 })],
      ],
      [24, 76],
    ),
  );
  for (const file of b.evidence || []) children.push(...figure(file, captionOf(file)));
}
children.push(
  h2('5.2 Sospechas no confirmadas (solo revisión de código)'),
  p('Estos puntos se vieron en el código pero no se reprodujeron en esta ejecución. No cuentan como bugs hasta probarlos.'),
  table(
    ['Sospecha', 'Detalle', 'Dónde'],
    SUSPECTED.map((s) => [cell(s.title, { bold: true, width: 26 }), cell(s.detail, { width: 48, size: 18 }), cell(s.location, { width: 26, size: 18 })]),
    [26, 48, 26],
  ),
  pageBreak(),
);

// 6. Observaciones UI/UX
const areas = [...new Set(data.observations.map((o) => o.area))];
children.push(
  h1('6. Observaciones de UI/UX'),
  p('Problemas de usabilidad, accesibilidad o diseño que no rompen la función pero empeoran la experiencia. Todos se vieron en esta ejecución.'),
);
let obsNo = 0;
for (const area of areas) {
  children.push(h2(`6.${areas.indexOf(area) + 1} ${area}`));
  for (const o of data.observations.filter((x) => x.area === area)) {
    obsNo += 1;
    children.push(p([run(`UX-${String(obsNo).padStart(2, '0')} `, { bold: true }), run(`[${o.caseId}] `, { color: '7F7F7F' }), run(o.text)]));
    const file = (o.evidence || [])[0];
    if (file) children.push(...figure(file, captionOf(file)));
  }
}
children.push(pageBreak());

// 7. Casos bloqueados
children.push(h1('7. Casos bloqueados'));
if (!blocked.length) {
  children.push(
    p('Ningún caso quedó bloqueado. Los que necesitaban datos previos los obtuvieron con las cuentas de prueba (ver 2.1):'),
    ...[
      'TRB-18 y TRB-19: la cuenta de cliente creó la reseña sobre la solicitud finalizada en TRB-21.',
      'TRB-24 a TRB-26: la cuenta de cliente creó las solicitudes, y A aceptó una de ellas por API para habilitar el chat.',
      'TRB-12, TRB-15 y TRB-16: como el botón del formulario no funciona, se envió con Enter para poder comprobar el resto del caso. El defecto del botón queda registrado como bug.',
    ].map((t) => bullet(t)),
  );
} else {
  children.push(table(['ID', 'Caso', 'Motivo'], blocked.map((r) => [cell(nb(r.id), { bold: true, width: 12 }), cell(r.title, { width: 38 }), cell(r.blockedReason, { width: 50 })]), [12, 38, 50]));
}
children.push(pageBreak());

// 8. Conclusión
children.push(
  h1('8. Conclusión'),
  p(
    `De ${results.length} casos, ${counts.Aprobado} se aprobaron, ${counts.Observación} se aprobaron con observaciones, ${counts.Fallido} fallaron y ${counts.Bloqueado} quedaron bloqueados. Se confirmaron ${bugs.length} bugs: ${bySeverity['Crítica']} críticos, ${bySeverity['Alta']} altos, ${bySeverity['Media']} medios y ${bySeverity['Baja']} bajos.`,
  ),
  p([run('Orden de corrección recomendado:', { bold: true })]),
  ...numbered([
    ...bugs.filter((b) => b.severity === 'Crítica').map((b) => `${b.code}: ${b.title}.`),
    ...bugs.filter((b) => b.severity === 'Alta').map((b) => `${b.code}: ${b.title}.`),
    'Después, los bugs medios y bajos y las observaciones de accesibilidad (etiquetas en el interruptor de disponibilidad y en los campos del portafolio).',
  ]),
  p(''),
  p('Tras corregir, conviene repetir esta misma prueba (el spec es reutilizable) y luego hacer la ronda del modo cliente.'),
  pageBreak(),
);

// Anexo
children.push(h1('Anexo A. Detalle y evidencias por caso'));
for (const r of results) {
  children.push(
    h2(`${r.id} — ${r.title}`),
    table(
      ['Campo', 'Detalle'],
      [
        [cell('Resultado', { bold: true, width: 22, fill: 'F2F2F2' }), statusCell(r.status, 78)],
        [cell('Vista', { bold: true, width: 22, fill: 'F2F2F2' }), cell(r.viewports.join(' + '), { width: 78 })],
        [cell('Esperado', { bold: true, width: 22, fill: 'F2F2F2' }), cell(r.expected, { width: 78 })],
        [
          cell('Obtenido', { bold: true, width: 22, fill: 'F2F2F2' }),
          cell(
            r.status === 'Bloqueado'
              ? [new Paragraph({ children: [run(`Bloqueado: ${r.blockedReason}`, { color: '3F3F3F' })] })]
              : r.obtained.map(
                  (o) =>
                    new Paragraph({
                      spacing: { before: 20, after: 20 },
                      children: [run(`${KIND_STYLE[o.kind].mark} `, { color: KIND_STYLE[o.kind].color, bold: true }), run(o.text, { size: 20 })],
                    }),
                ),
            { width: 78 },
          ),
        ],
        ...(r.notes.length ? [[cell('Notas', { bold: true, width: 22, fill: 'F2F2F2' }), cell(r.notes.join(' '), { width: 78, size: 20 })]] : []),
        ...(bugsOf(r.id).length ? [[cell('Bugs', { bold: true, width: 22, fill: 'F2F2F2' }), cell(bugsOf(r.id).join(', '), { width: 78 })]] : []),
        ...(r.consoleErrors.length
          ? [[cell('Consola del navegador', { bold: true, width: 22, fill: 'F2F2F2' }), cell(r.consoleErrors.slice(0, 4).join(' | '), { width: 78, size: 16 })]]
          : []),
      ],
      [22, 78],
    ),
  );
  if (r.http.length) {
    children.push(
      h3('Evidencia de red'),
      table(
        ['Petición', 'HTTP', 'Respuesta (extracto)'],
        r.http.map((h) => [
          cell(`${h.label}\n${h.request}`.split('\n').map((line, i) => new Paragraph({ children: [run(line, { size: 16, bold: i === 0 })] })), { width: 30 }),
          cell(String(h.status), { width: 8, align: AlignmentType.CENTER, bold: true, color: h.status >= 400 ? '9C0006' : '006100' }),
          cell(h.body || '—', { width: 62, size: 16 }),
        ]),
        [30, 8, 62],
      ),
    );
  }
  if (r.evidence.length) {
    children.push(h3('Capturas'));
    for (const e of r.evidence) children.push(...figure(e.file, e.caption));
  }
}

// ---------- Documento ----------

const footer = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        run('OficiosYa · Informe E2E Modo Trabajador · Página ', { size: 18, color: '7F7F7F' }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '7F7F7F' }),
        run(' de ', { size: 18, color: '7F7F7F' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '7F7F7F' }),
      ],
    }),
  ],
});

const doc = new Document({
  creator: 'QA automatizado',
  title: 'Informe de pruebas E2E — Modo Trabajador',
  description: 'OficiosYa — pruebas E2E del modo trabajador',
  features: { updateFields: true },
  styles: {
    default: {
      document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 264 } } },
      heading1: { run: { font: FONT, size: 32, bold: true, color: '1F4E79' }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true } },
      heading2: { run: { font: FONT, size: 26, bold: true, color: '2E7D74' }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
      heading3: { run: { font: FONT, size: 23, bold: true, color: '404040' }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true } },
    },
    paragraphStyles: [
      {
        id: 'Caption',
        name: 'Caption',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: 18, italics: true, color: '404040' },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
        ],
      },
      {
        reference: 'steps',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }],
      },
    ],
  },
  sections: [
    {
      properties: {
        titlePage: true,
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } },
      },
      footers: { default: footer, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUTPUT, buffer);
console.log(`Informe generado: ${OUTPUT}`);
console.log(`Casos: ${results.length} · ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`Bugs: ${bugs.length} · ${SEVERITY_ORDER.map((s) => `${s} ${bySeverity[s]}`).join(' · ')} · Figuras: ${figureNo}`);
