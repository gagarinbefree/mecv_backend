import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseApplication } from '../src/bootstrap/create-application.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';
import { demoProfile } from './helpers/demo-profile.js';

const profileQuery = '{ profile { name description links { label url } skills { name } experience { company position startDate endDate achievements } projects { name description url } } }';

describe('application database startup', defineStartupTests);

/** Проверяет подготовку пустой PostgreSQL до HTTP и отказ запуска при реальных ошибках БД. */
function defineStartupTests(): void {
  let fixture: TestDatabase;
  let application: INestApplication<Server> | undefined;
  beforeEach(prepare);
  afterEach(close);
  it('migrates and seeds an empty schema before accepting HTTP', startsFromEmptySchema, 60_000);
  it('restarts without duplicates or changes to unrelated profiles', restarts, 90_000);
  it('refuses HTTP when migrations cannot be applied', rejectsMigrationFailure, 60_000);
  it('refuses HTTP and rolls back when the seed fails', rejectsSeedFailure, 60_000);
  it('refuses HTTP when PostgreSQL is unavailable', rejectsUnavailableDatabase);

  /** Создаёт отдельную пустую схему без ручного применения миграций. */
  async function prepare(): Promise<void> {
    fixture = await createTestDatabase();
  }

  /** Закрывает приложение и удаляет только принадлежащую тесту схему даже после ошибки startup. */
  async function close(): Promise<void> {
    try {
      await application?.close();
      const schema = new URL(fixture.connectionString).searchParams.get('schema');
      const sessions = await fixture.sql.query(
        'SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE $1',
        [`%"${schema ?? ''}".%`],
      );
      expect(sessions.rows).toEqual([]);
    } finally {
      application = undefined;
      await fixture.close();
    }
  }

  /** Проверяет запрос задания и готовность всех связанных данных после единственного listen. */
  async function startsFromEmptySchema(): Promise<void> {
    application = await createDatabaseApplication(fixture.connectionString, { logger: false });
    await application.listen(0, '127.0.0.1');
    expect(await readProfile(application)).toEqual({ data: { profile: demoProfile } });
    const migrations = await fixture.sql.query('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
    expect(migrations.rows).toEqual([{ count: 1 }]);
  }

  /** Проверяет повторную подготовку, стабильные id и сохранность постороннего профиля. */
  async function restarts(): Promise<void> {
    application = await createDatabaseApplication(fixture.connectionString, { logger: false });
    await application.listen(0, '127.0.0.1');
    expect(await readProfile(application)).toEqual({ data: { profile: demoProfile } });
    await fixture.sql.query(`INSERT INTO "Profile" VALUES ('unmanaged', 'unmanaged', 'Other', 'Untouched')`);
    const before = await fixture.sql.query('SELECT "id", "slug", "name" FROM "Profile" ORDER BY "slug"');
    const skills = await fixture.sql.query('SELECT "id", "key" FROM "Skill" ORDER BY "key"');
    await application.close();
    application = await createDatabaseApplication(fixture.connectionString, { logger: false });
    await application.listen(0, '127.0.0.1');
    expect(await readProfile(application)).toEqual({ data: { profile: demoProfile } });
    expect((await fixture.sql.query('SELECT "id", "slug", "name" FROM "Profile" ORDER BY "slug"')).rows).toEqual(before.rows);
    expect((await fixture.sql.query('SELECT "id", "key" FROM "Skill" ORDER BY "key"')).rows).toEqual(skills.rows);
  }

  /** Проверяет отказ migrate deploy на неизвестной непустой схеме без сброса чужих данных. */
  async function rejectsMigrationFailure(): Promise<void> {
    await fixture.sql.query('CREATE TABLE "Unmanaged" (id TEXT PRIMARY KEY)');
    await fixture.sql.query(`INSERT INTO "Unmanaged" VALUES ('keep')`);
    application = await createDatabaseApplication(fixture.connectionString, { logger: false });
    await expect(application.listen(0, '127.0.0.1')).rejects.toThrow();
    expect(application.getHttpServer().listening).toBe(false);
    expect((await fixture.sql.query('SELECT id FROM "Unmanaged"')).rows).toEqual([{ id: 'keep' }]);
  }

  /** Проверяет ошибку поздней записи seed без открытия порта и без частичного профиля. */
  async function rejectsSeedFailure(): Promise<void> {
    await fixture.migrate();
    await fixture.sql.query('ALTER TABLE "Project" ADD CONSTRAINT "test_reject_startup" CHECK (FALSE)');
    application = await createDatabaseApplication(fixture.connectionString, { logger: false });
    await expect(application.listen(0, '127.0.0.1')).rejects.toThrow();
    expect(application.getHttpServer().listening).toBe(false);
    expect((await fixture.sql.query('SELECT "id" FROM "Profile"')).rows).toEqual([]);
  }

  /** Проверяет ошибку соединения до объявления HTTP-готовности. */
  async function rejectsUnavailableDatabase(): Promise<void> {
    const url = new URL(fixture.connectionString);
    url.port = '1';
    application = await createDatabaseApplication(url.toString(), { logger: false });
    await expect(application.listen(0, '127.0.0.1')).rejects.toThrow();
    expect(application.getHttpServer().listening).toBe(false);
  }
}

/**
 * Выполняет полный GraphQL-запрос по адресу действительно запущенного приложения.
 * @param application - Приложение после успешного listen.
 * @returns Неизвестный внешний JSON без приведения к типу ответа.
 */
async function readProfile(application: INestApplication<Server>): Promise<unknown> {
  const response = await fetch(`${await application.getUrl()}/graphql`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: profileQuery }), signal: AbortSignal.timeout(5_000),
  });
  expect(response.status).toBe(200);
  return response.json();
}
