import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';
import { stopApplication, waitForApplication } from './helpers/application-process.js';
import { demoProfile } from './helpers/demo-profile.js';

const executeFile = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const mainPath = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const otherDirectory = fileURLToPath(new URL('../scripts/', import.meta.url));

describe('compiled application startup', defineMainTests);

/** Проверяет настоящую точку входа Node.js с пустой PostgreSQL и отдельным HTTP-процессом. */
function defineMainTests(): void {
  let fixture: TestDatabase;
  beforeAll(compile, 60_000);
  beforeEach(prepare);
  afterEach(close);
  it('starts from another working directory and serves initialized data and Sandbox', startsCompiledMain, 90_000);
  it.each([
    { PORT: 'invalid' },
    { DATABASE_URL: 'postgresql://private-placeholder:private-placeholder@localhost:invalid/mecv_dev' },
  ])('rejects invalid configuration before modifying PostgreSQL %#', rejectsInvalidConfiguration, 45_000);
  it('exits with code one without announcing readiness when seeding fails', reportsSeedFailure, 60_000);
  it('closes the application and exits when the HTTP port is occupied', rejectsOccupiedPort, 60_000);

  /** Компилирует настоящую точку входа и копирует SDL без платформенной shell-цепочки. */
  async function compile(): Promise<void> {
    await executeFile(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.build.json'], { cwd: root, timeout: 45_000 });
    await executeFile(process.execPath, ['scripts/copy-assets.mjs'], { cwd: root, timeout: 5_000 });
  }

  /** Создаёт отдельную пустую схему, которую должен подготовить сам дочерний процесс. */
  async function prepare(): Promise<void> {
    fixture = await createTestDatabase();
  }

  /** Проверяет отсутствие соединений завершённого процесса и удаляет только свою схему. */
  async function close(): Promise<void> {
    try {
      const schema = new URL(fixture.connectionString).searchParams.get('schema');
      const sessions = await fixture.sql.query(
        'SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE $1',
        [`%"${schema ?? ''}".%`],
      );
      expect(sessions.rows).toEqual([]);
    } finally {
      await fixture.close();
    }
  }

  /** Проверяет реальную сборку, абсолютные пути миграций и готовность данных до первой HTTP-операции. */
  async function startsCompiledMain(): Promise<void> {
    const child = spawn(process.execPath, [mainPath], {
      cwd: otherDirectory, env: environment(), stdio: 'pipe',
    });
    try {
      const endpoint = await waitForApplication(child);
      const health = await fetch(new URL('/health', endpoint), { signal: AbortSignal.timeout(5_000) });
      const healthBody: unknown = await health.json();
      expect(health.status).toBe(200);
      expect(healthBody).toEqual({ status: 'ok' });
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ profile { name skills { name } } }' }), signal: AbortSignal.timeout(5_000),
      });
      const result: unknown = await response.json();
      expect(result).toEqual({ data: { profile: { name: demoProfile.name, skills: demoProfile.skills } } });
      const sandbox = await fetch(endpoint, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(5_000) });
      expect(await sandbox.text()).toContain('embeddable-sandbox');
      expect((await fixture.sql.query('SELECT count(*)::int AS count FROM "Profile"')).rows).toEqual([{ count: 1 }]);
    } finally {
      await stopApplication(child);
    }
  }

  /**
   * Проверяет отказ до миграций, отсутствие готовности и отсутствие секретов в диагностике.
   * @param overrides - Некорректные настройки отдельного запуска.
   */
  async function rejectsInvalidConfiguration(overrides: Readonly<Record<string, string>>): Promise<void> {
    const failure = await runFailure(overrides);
    expect(failure.stdout).not.toContain('GraphQL и Apollo Sandbox:');
    expect(failure.stderr).not.toContain('private-placeholder');
    const tables = await fixture.sql.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema()');
    expect(tables.rows).toEqual([]);
  }

  /** Проверяет распространение ошибки seed до кода процесса и отсутствие частичного профиля. */
  async function reportsSeedFailure(): Promise<void> {
    await fixture.migrate();
    await fixture.sql.query('ALTER TABLE "Project" ADD CONSTRAINT "test_reject_main" CHECK (FALSE)');
    const failure = await runFailure({});
    expect(failure.stderr).toContain('заполнение демопрофиля');
    expect(failure.stdout).not.toContain('GraphQL и Apollo Sandbox:');
    expect((await fixture.sql.query('SELECT "id" FROM "Profile"')).rows).toEqual([]);
  }

  /** Проверяет освобождение ресурсов после EADDRINUSE, возникшего уже после подготовки БД. */
  async function rejectsOccupiedPort(): Promise<void> {
    const blocker = createServer();
    const listening = once(blocker, 'listening');
    blocker.listen(0, '127.0.0.1');
    await listening;
    try {
      const address = blocker.address();
      if (address === null || typeof address === 'string') throw new Error('Не удалось занять тестовый TCP-порт.');
      const failure = await runFailure({ PORT: address.port.toString() });
      expect(failure.stdout).not.toContain('GraphQL и Apollo Sandbox:');
      expect((await fixture.sql.query('SELECT count(*)::int AS count FROM "Profile"')).rows).toEqual([{ count: 1 }]);
    } finally {
      await promisify(blocker.close.bind(blocker))();
    }
  }

  /**
   * Передаёт тестовое подключение только через окружение дочернего процесса.
   * @returns Настройки свободного локального порта и изолированной базы.
   */
  function environment(): NodeJS.ProcessEnv {
    return { ...process.env, DATABASE_URL: fixture.connectionString, PORT: '0', HOST: '127.0.0.1' };
  }

  /**
   * Запускает точку входа, которая обязана завершиться с ошибкой, сохраняя stdout/stderr как строки.
   * @param overrides - Изменения окружения текущего сценария.
   * @returns Проверенный результат неуспешного процесса.
   */
  async function runFailure(overrides: Readonly<Record<string, string>>): Promise<Readonly<{ stdout: string; stderr: string }>> {
    let failure: unknown;
    try {
      await executeFile(process.execPath, [mainPath], {
        cwd: otherDirectory, env: { ...environment(), ...overrides }, timeout: 30_000,
      });
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 1 });
    if (typeof failure !== 'object' || failure === null
      || !('stdout' in failure) || typeof failure.stdout !== 'string'
      || !('stderr' in failure) || typeof failure.stderr !== 'string') {
      throw new Error('Процесс не вернул ожидаемую ошибку с текстовой диагностикой.');
    }
    return { stdout: failure.stdout, stderr: failure.stderr };
  }
}
