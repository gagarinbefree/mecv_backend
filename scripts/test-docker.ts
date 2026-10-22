import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const project = `mecv-check-${randomBytes(6).toString('hex')}`;
const environment = {
  ...process.env,
  MECV_DATABASE_PASSWORD: randomBytes(32).toString('hex'),
  MECV_BIND_ADDRESS: '127.0.0.1',
  MECV_HTTP_PORT: '0',
};
const query = `query {
  profile {
    name description links { label url } skills { name }
    experience { company position startDate endDate achievements }
    projects { name description url }
  }
}`;

await testDocker();

/** Проверяет образ на новом volume и всегда удаляет только ресурсы собственного случайного проекта. */
async function testDocker(): Promise<void> {
  try {
    console.log('Docker: сборка и первый запуск с пустой PostgreSQL.');
    await compose(['up', '--build', '--detach', '--wait', '--wait-timeout', '150'], 600_000);
    const first = await verifyHttp();
    assert.notEqual((await compose(['exec', '-T', 'backend', 'id', '-u'])).trim(), '0');
    const identities = await readIdentities();
    assert(identities.length > 0);
    assert.equal((await compose(['exec', '-T', 'database', 'psql', '-U', 'mecv', '-d', 'mecv', '-tAc', 'SELECT count(*) FROM "Profile"'])).trim(), '1');

    console.log('Docker: пересоздание контейнеров с сохранением volume.');
    await compose(['down']);
    await compose(['up', '--detach', '--wait', '--wait-timeout', '150']);
    assert.deepEqual(await verifyHttp(), first);
    assert.equal(await readIdentities(), identities);
    console.log('Docker: GraphQL, Sandbox, healthcheck, non-root и сохранность данных проверены.');
  } finally {
    await compose(['down', '--volumes', '--remove-orphans']);
  }
}

/**
 * Выполняет Compose с фиксированными файлами и изолированным именем проекта без shell.
 * @param args - Аргументы команды без секретов.
 * @param timeout - Предельная продолжительность команды в миллисекундах.
 * @returns Стандартный вывод завершившегося процесса.
 */
async function compose(args: readonly string[], timeout = 180_000): Promise<string> {
  const result = await executeFile('docker', [
    'compose', '--project-name', project, '--env-file', '.env.docker.example', '-f', 'compose.yaml', ...args,
  ], { cwd: root, env: environment, timeout, maxBuffer: 8 * 1024 * 1024 });
  return result.stdout;
}

/**
 * Проверяет публичный HTTP-контракт готового контейнера на назначенном Docker порту.
 * @returns Данные профиля для сравнения после пересоздания контейнеров.
 */
async function verifyHttp(): Promise<unknown> {
  const address = (await compose(['port', 'backend', '3000'])).trim();
  const base = new URL(`http://${address}`);
  const health = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(5_000) });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const sandbox = await fetch(new URL('/graphql', base), {
    headers: { accept: 'text/html' }, signal: AbortSignal.timeout(5_000),
  });
  assert.equal(sandbox.status, 200);
  assert.match(await sandbox.text(), /embeddable-sandbox/);
  const response = await fetch(new URL('/graphql', base), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 200);
  const body: unknown = await response.json();
  assert(typeof body === 'object' && body !== null && !('errors' in body) && 'data' in body);
  const data: unknown = body.data;
  assert(typeof data === 'object' && data !== null && 'profile' in data);
  const profile: unknown = data.profile;
  assert(typeof profile === 'object' && profile !== null && 'name' in profile);
  assert.equal(typeof profile.name, 'string');
  return body;
}

/**
 * Читает идентификаторы всех управляемых записей непосредственно из контейнерной PostgreSQL.
 * @returns Упорядоченный снимок, выявляющий дубликаты и потерю volume при повторном старте.
 */
function readIdentities(): Promise<string> {
  return compose(['exec', '-T', 'database', 'psql', '-U', 'mecv', '-d', 'mecv', '-tAc', `
    SELECT 'profile:' || id FROM "Profile"
    UNION ALL SELECT 'link:' || id FROM "ProfileLink"
    UNION ALL SELECT 'skill:' || id FROM "Skill"
    UNION ALL SELECT 'experience:' || id FROM "Experience"
    UNION ALL SELECT 'project:' || id FROM "Project" ORDER BY 1
  `]);
}
