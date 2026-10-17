import { spawn } from 'node:child_process';

const preview = spawn(
  process.execPath,
  ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
  { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // El servidor todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`El servidor de pruebas no inició.\n${previewOutput}`);
}

function stopPreview() {
  if (!preview.killed) preview.kill('SIGTERM');
}

try {
  await waitForServer('http://127.0.0.1:4173/login');
  const cucumber = spawn(
    process.execPath,
    [
      './node_modules/@cucumber/cucumber/bin/cucumber.js',
      '--import', 'features/step_definitions/**/*.mjs',
      '--format', 'progress',
      '--format', 'summary',
    ],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, GHERKIN_BASE_URL: 'http://127.0.0.1:4173' },
    },
  );
  const exitCode = await new Promise((resolve) => cucumber.on('exit', resolve));
  process.exitCode = exitCode ?? 1;
} finally {
  stopPreview();
}
