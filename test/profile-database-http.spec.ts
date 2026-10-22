import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseApplication } from '../src/bootstrap/create-application.js';
import { createDatabase } from '../src/database/create-database.js';
import { seedDemoProfile } from '../src/database/seed-demo-profile.js';
import { demoProfile } from './helpers/demo-profile.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

const fullQuery = '{ profile { name description links { label url } skills { name } experience { company position startDate endDate achievements } projects { name description url } } }';

describe('PostgreSQL profile HTTP API', defineDatabaseHttpTests);

/** Проверяет настоящие HTTP-запросы и число SELECT, выполненных Prisma на PostgreSQL. */
function defineDatabaseHttpTests(): void {
  let fixture: TestDatabase;
  let application: INestApplication<Server>;
  let endpoint: string;
  const queries: string[] = [];
  beforeAll(prepare, 60_000);
  beforeEach(restoreProfile);
  afterAll(close);
  it('reads the stored name with one SELECT and no relations', readsStoredName);
  it.each([
    ['links { label }', 'ProfileLink'], ['skills { name }', 'Skill'],
    ['experience { company }', 'Experience'], ['projects { name }', 'Project'],
  ])('loads only the requested relation %s', loadsSelectedRelation);
  it('returns all stored nested fields in five SELECTs', readsFullProfile);
  it('reuses profile and relation reads for repeated aliases', reusesAliases);
  it('creates a fresh cache for the next HTTP request', isolatesRequests);
  it('returns null without reading relations when the profile is absent', readsAbsentProfile);
  it('returns empty lists for existing profiles without children', readsEmptyCollections);

  /** Запускает сервер, использующий тот же изолированный PostgreSQL, что и фикстуры. */
  async function prepare(): Promise<void> {
    fixture = await createTestDatabase();
    await fixture.migrate();
    application = await createDatabaseApplication(fixture.connectionString, { logger: false }, recordQuery);
    await application.listen(0, '127.0.0.1');
    endpoint = `${await application.getUrl()}/graphql`;
  }

  /** Восстанавливает демопрофиль и задаёт отличающееся от демофайла имя перед каждой проверкой. */
  async function restoreProfile(): Promise<void> {
    const writer = createDatabase(fixture.connectionString);
    try {
      await seedDemoProfile(writer.client);
    } finally {
      await writer.onModuleDestroy();
    }
    await fixture.sql.query('UPDATE "Profile" SET "name" = $1', ['Stored profile']);
    queries.length = 0;
  }

  /** Останавливает HTTP и его пул перед удалением тестовой схемы. */
  async function close(): Promise<void> {
    try {
      await application.close();
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

  /**
   * Сохраняет только SELECT приложения, исключая служебную подготовку и параметры.
   * @param event - Событие SQL Prisma.
   */
  function recordQuery(event: Readonly<{ query: string }>): void {
    if (/^\s*SELECT\b/i.test(event.query)) queries.push(event.query);
  }

  /**
   * Выполняет POST GraphQL через настоящий HTTP и сохраняет неизвестный тип внешнего JSON.
   * @param query - Проверяемый документ GraphQL.
   * @returns Ответ без небезопасного приведения к контракту приложения.
   */
  async function request(query: string): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }), signal: AbortSignal.timeout(5_000),
    });
    expect(response.status).toBe(200);
    return response.json();
  }

  /** Проверяет фактический источник имени и отсутствие неявной загрузки связей. */
  async function readsStoredName(): Promise<void> {
    expect(await request('{ profile { name } }')).toEqual({ data: { profile: { name: 'Stored profile' } } });
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/ProfileLink|Skill|Experience|Project/);
  }

  /**
   * Проверяет ленивое чтение только запрошенной коллекции.
   * @param selection - Выборка вложенных полей.
   * @param table - Единственная дочерняя таблица, которую разрешено читать.
   */
  async function loadsSelectedRelation(selection: string, table: string): Promise<void> {
    expect(await request(`{ profile { ${selection} } }`)).toHaveProperty('data.profile');
    expect(queries).toHaveLength(2);
    expect(queries[1]).toContain(`"${table}"`);
  }

  /** Проверяет все разделы, включая календарные даты, и фиксированное число обращений к БД. */
  async function readsFullProfile(): Promise<void> {
    expect(await request(fullQuery)).toEqual({ data: { profile: { ...demoProfile, name: 'Stored profile' } } });
    expect(queries).toHaveLength(5);
  }

  /** Проверяет общий кэш чтения внутри операции с повторными корневыми и вложенными алиасами. */
  async function reusesAliases(): Promise<void> {
    expect(await request('{ a: profile { x: skills { name } y: skills { name } } b: profile { skills { name } } }'))
      .toHaveProperty('data.a.x');
    expect(queries).toHaveLength(2);
  }

  /** Проверяет видимость обновления БД в новом HTTP-запросе и отсутствие общего кэша. */
  async function isolatesRequests(): Promise<void> {
    await request('{ profile { skills { name } } }');
    await fixture.sql.query('UPDATE "Skill" SET "name" = $1 WHERE "key" = $2', ['Changed between requests', 'typescript']);
    const result = await request('{ profile { skills { name } } }');
    expect(result).toMatchObject({ data: { profile: { skills: [{ name: 'Changed between requests' }, {}, {}, {}, {}, {}] } } });
    expect(queries).toHaveLength(4);
  }

  /** Проверяет nullable профиль и отсутствие бессмысленных запросов связей. */
  async function readsAbsentProfile(): Promise<void> {
    await fixture.sql.query('DELETE FROM "Profile"');
    expect(await request(fullQuery)).toEqual({ data: { profile: null } });
    expect(queries).toHaveLength(1);
  }

  /** Проверяет обязательные пустые списки после удаления всех дочерних фикстур. */
  async function readsEmptyCollections(): Promise<void> {
    await fixture.sql.query('DELETE FROM "ProfileLink"; DELETE FROM "Skill"; DELETE FROM "Experience"; DELETE FROM "Project"');
    expect(await request(fullQuery)).toEqual({ data: { profile: {
      ...demoProfile, name: 'Stored profile', links: [], skills: [], experience: [], projects: [],
    } } });
    expect(queries).toHaveLength(5);
  }
}
