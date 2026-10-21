import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplicationModule } from '../src/bootstrap/create-application-module.js';
import { createDatabase, type Database } from '../src/database/create-database.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

describe('Prisma lifecycle', defineLifecycleTests);

/** Проверяет владение клиентом и пулом через настоящий контекст NestJS и PostgreSQL. */
function defineLifecycleTests(): void {
  let fixture: TestDatabase;
  beforeAll(prepareDatabase, 60_000);
  afterAll(closeDatabase);
  it('reuses one client and releases its PostgreSQL sessions on Nest shutdown', releasesPool);
  it('rejects startup when PostgreSQL is unavailable', rejectsUnavailableDatabase);
  it('keeps clients isolated between application instances', isolatesClients);

  /** Создаёт отдельную схему с применённой историей миграций. */
  async function prepareDatabase(): Promise<void> {
    fixture = await createTestDatabase();
    await fixture.migrate();
  }

  /** Удаляет только принадлежащую этому набору тестов схему. */
  async function closeDatabase(): Promise<void> {
    await fixture.close();
  }

  /** Проверяет singleton-провайдер, реальное чтение через Prisma и освобождение SQL-сессии. */
  async function releasesPool(): Promise<void> {
    const configToken = Symbol('database-url');
    const databaseToken = Symbol('database');
    const application = await NestFactory.createApplicationContext(createApplicationModule([
      { provide: configToken, useValue: fixture.connectionString },
      { provide: databaseToken, useFactory: createDatabase, inject: [configToken] },
    ]), { logger: false, abortOnError: false });
    const database = application.get<Database>(databaseToken);
    try {
      expect(application.get<Database>(databaseToken).client).toBe(database.client);
      expect(await database.client.profile.count()).toBe(0);
      const sessions = await database.client.$queryRaw<readonly { pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      const pid = sessions[0]?.pid;
      expect(pid).toBeTypeOf('number');
      await application.close();
      const remaining = await fixture.sql.query('SELECT pid FROM pg_stat_activity WHERE pid = $1', [pid]);
      expect(remaining.rows).toEqual([]);
    } finally {
      await application.close();
      await database.client.$disconnect();
    }
  }

  /** Проверяет реальное соединение при инициализации вместо отложенной ошибки первого запроса. */
  async function rejectsUnavailableDatabase(): Promise<void> {
    const url = new URL(fixture.connectionString);
    url.port = '1';
    const database = createDatabase(url.toString());
    try {
      await expect(database.onModuleInit()).rejects.toThrow();
    } finally {
      await database.client.$disconnect();
    }
  }

  /** Проверяет отсутствие общего изменяемого клиента между экземплярами приложения. */
  async function isolatesClients(): Promise<void> {
    const first = createDatabase(fixture.connectionString);
    const second = createDatabase(fixture.connectionString);
    try {
      await first.onModuleInit();
      await second.onModuleInit();
      expect(first.client).not.toBe(second.client);
      await first.onModuleDestroy();
      expect(await second.client.profile.count()).toBe(0);
    } finally {
      await first.client.$disconnect();
      await second.client.$disconnect();
    }
  }
}
