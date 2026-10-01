// Starts the Django API for end-to-end tests on a fresh, seeded database of its
// own (backend/e2e.sqlite3), leaving the development database untouched.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');
const venvPython =
  process.platform === 'win32'
    ? path.join(backend, '.venv', 'Scripts', 'python.exe')
    : path.join(backend, '.venv', 'bin', 'python');
const python = process.env.PYTHON ?? (existsSync(venvPython) ? venvPython : 'python');
const port = process.env.E2E_API_PORT ?? '8100';
const options = {
  cwd: backend,
  stdio: 'inherit',
  env: { ...process.env, DJANGO_DB_NAME: 'e2e.sqlite3' },
};

for (const args of [
  ['migrate', '--verbosity', '0'],
  ['seed', '--clear'],
]) {
  const result = spawnSync(python, ['manage.py', ...args], options);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const server = spawn(
  python,
  ['manage.py', 'runserver', `127.0.0.1:${port}`, '--noreload'],
  options,
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
