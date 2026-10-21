import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { demoProfileSlug } from '../src/profile/profile-seed-data.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

const executeFile = promisify(execFile);

describe('Prisma seed command', defineCommandTests);

/** Проверяет конфигурацию Prisma и завершение отдельного процесса заполнения БД. */
function defineCommandTests(): void {
  let fixture: TestDatabase;
  beforeAll(prepareDatabase, 60_000);
  beforeEach(clearProfile);
  afterAll(closeDatabase);
  it('runs the configured seed twice without duplicates', runsSeedCommand, 150_000);
  it('returns a failure exit code when PostgreSQL rejects a write', reportsFailure, 90_000);

  /** Создаёт пустую изолированную схему и применяет настоящие миграции. */
  async function prepareDatabase(): Promise<void> {
    fixture = await createTestDatabase();
    await fixture.migrate();
    await executeFile(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.build.json'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 45_000,
    });
  }

  /** Удаляет только управляемый профиль этой тестовой схемы. */
  async function clearProfile(): Promise<void> {
    await fixture.sql.query('DELETE FROM "Profile" WHERE "slug" = $1', [demoProfileSlug]);
  }

  /** Удаляет принадлежащую набору тестов схему после завершения дочерних процессов. */
  async function closeDatabase(): Promise<void> {
    await fixture.close();
  }

  /** Проверяет реальную запись через стандартную Prisma CLI и успешное завершение обоих запусков. */
  async function runsSeedCommand(): Promise<void> {
    const output = await executeSeed();
    expect(output).toContain('Демонстрационный профиль сохранён.');
    const first = await fixture.sql.query('SELECT "id", "name" FROM "Profile"');
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]).toMatchObject({ name: 'Демонстрационный специалист' });
    await executeSeed();
    expect((await fixture.sql.query('SELECT "id", "name" FROM "Profile"')).rows).toEqual(first.rows);
    const skills = await fixture.sql.query('SELECT count(*)::int AS count FROM "Skill"');
    expect(skills.rows).toEqual([{ count: 6 }]);
  }

  /** Проверяет ненулевой код завершения и отсутствие частичного профиля при ошибке последней коллекции. */
  async function reportsFailure(): Promise<void> {
    await fixture.sql.query('ALTER TABLE "Project" ADD CONSTRAINT "test_reject_seed" CHECK (FALSE)');
    try {
      await expect(executeSeed()).rejects.toMatchObject({ code: 1 });
      expect((await fixture.sql.query('SELECT "id" FROM "Profile"')).rows).toEqual([]);
    } finally {
      await fixture.sql.query('ALTER TABLE "Project" DROP CONSTRAINT "test_reject_seed"');
    }
  }

  /**
   * Выполняет сконфигурированный seed на тестовом подключении без shell-интерполяции URL.
   * @returns Стандартный вывод процесса с результатом заполнения.
   */
  async function executeSeed(): Promise<string> {
    const result = await executeFile(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'seed'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, DATABASE_URL: fixture.connectionString },
      timeout: 60_000,
    });
    return result.stdout;
  }
}
