import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/database/create-database.js';
import { createProfileRepository } from '../src/database/create-profile-repository.js';
import type { ProfileRepository } from '../src/profile/profile.repository.js';
import { createProfileLoaders } from '../src/profile/profile.loaders.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

describe('Prisma profile repository', defineRepositoryTests);

/** Проверяет результат пакетного чтения и фактическое число SQL-запросов на PostgreSQL. */
function defineRepositoryTests(): void {
  let fixture: TestDatabase;
  let database: Database;
  let repository: ProfileRepository;
  const queries: string[] = [];
  beforeAll(prepare, 60_000);
  afterAll(close);
  beforeEach(clearQueries);
  it('reads only profile fields and returns null for a missing slug', readsProfile);
  it.each(['findLinks', 'findSkills', 'findExperience', 'findProjects'] as const)(
    'aligns %s with reordered, repeated and missing parent keys in one SELECT', readsBatch,
  );
  it('does not query PostgreSQL for empty batches', readsEmptyBatches);
  it('preserves SQL DATE values and ongoing employment', readsDates);
  it.each(['links', 'skills', 'experience', 'projects'] as const)(
    'batches %s for twenty real parents without increasing SELECT count', batchesManyParents,
  );

  /** Готовит независимые профили с намеренно перемешанными строками и равными позициями. */
  async function prepare(): Promise<void> {
    fixture = await createTestDatabase();
    await fixture.migrate();
    await fixture.sql.query(`
      INSERT INTO "Profile" VALUES ('a', 'alpha', 'Alpha', 'First'), ('b', 'beta', 'Beta', 'Second');
      INSERT INTO "ProfileLink" VALUES
        ('a2','a','second','A2','https://example.com/2',0), ('b1','b','first','B1','https://example.com/b',0),
        ('a1','a','first','A1','https://example.com/1',0);
      INSERT INTO "Skill" VALUES ('a2','a','second','A2',1), ('b1','b','first','B1',0), ('a1','a','first','A1',0);
      INSERT INTO "Experience" VALUES
        ('a2','a','second','A2','Developer','2020-01-01',NULL,ARRAY[]::text[],1),
        ('b1','b','first','B1','Developer','0001-01-01','0004-02-29',ARRAY['Done'],0),
        ('a1','a','first','A1','Developer','2024-02-29',NULL,ARRAY[]::text[],0);
      INSERT INTO "Project" VALUES
        ('a2','a','second','A2','Second','https://example.com/2',1),
        ('b1','b','first','B1','Beta','https://example.com/b',0),
        ('a1','a','first','A1','First','https://example.com/1',0);
    `);
    await fixture.sql.query(`
      INSERT INTO "Profile" SELECT 'parent-'||n, 'parent-'||n, 'Parent '||n, 'Batch fixture' FROM generate_series(1,20) n;
      INSERT INTO "ProfileLink" SELECT 'child-'||n,'parent-'||n,'key','Link','https://example.com',0 FROM generate_series(1,20) n;
      INSERT INTO "Skill" SELECT 'child-'||n,'parent-'||n,'key','Skill',0 FROM generate_series(1,20) n;
      INSERT INTO "Experience" SELECT 'child-'||n,'parent-'||n,'key','Company','Developer','2024-01-01'::date,NULL,ARRAY[]::text[],0 FROM generate_series(1,20) n;
      INSERT INTO "Project" SELECT 'child-'||n,'parent-'||n,'key','Project','Description','https://example.com',0 FROM generate_series(1,20) n;
    `);
    database = createDatabase(fixture.connectionString, recordQuery);
    await database.onModuleInit();
    repository = createProfileRepository(database.client);
  }

  /** Закрывает пул и удаляет только собственную схему. */
  async function close(): Promise<void> {
    await database.onModuleDestroy();
    await fixture.close();
  }

  /** Отделяет обращения проверяемого поведения от подготовки фикстур. */
  function clearQueries(): void {
    queries.length = 0;
  }

  /**
   * Сохраняет фактически выполненные SELECT без параметров и значений.
   * @param event - SQL-событие Prisma.
   */
  function recordQuery(event: Readonly<{ query: string }>): void {
    if (/^\s*SELECT\b/i.test(event.query)) queries.push(event.query);
  }

  /** Проверяет отдельное чтение основных полей без неявной загрузки коллекций. */
  async function readsProfile(): Promise<void> {
    expect(await repository.findProfile('alpha')).toEqual({ id: 'a', name: 'Alpha', description: 'First' });
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/ProfileLink|Skill|Experience|Project/);
    expect(await repository.findProfile('missing')).toBeNull();
  }

  /**
   * Проверяет SQL IN, сортировку, совпадение длины, пропущенные связи и повторные ключи.
   * @param method - Проверяемая предметная коллекция.
   */
  async function readsBatch(method: 'findLinks' | 'findSkills' | 'findExperience' | 'findProjects'): Promise<void> {
    const result = await repository[method](['b', 'missing', 'a', 'b']);
    expect(result).toMatchObject([
      [{ profileId: 'b' }], [], [{ profileId: 'a' }, { profileId: 'a' }], [{ profileId: 'b' }],
    ]);
    expect(JSON.stringify(result[2])).toMatch(/A1.*A2/);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/\bIN\s*\(/i);
  }

  /** Проверяет отсутствие бесполезных запросов при пустом пакете каждого раздела. */
  async function readsEmptyBatches(): Promise<void> {
    expect(await repository.findLinks([])).toEqual([]);
    expect(await repository.findSkills([])).toEqual([]);
    expect(await repository.findExperience([])).toEqual([]);
    expect(await repository.findProjects([])).toEqual([]);
    expect(queries).toEqual([]);
  }

  /** Проверяет календарные даты на границе Prisma, включая годы до 0100 и nullable окончание. */
  async function readsDates(): Promise<void> {
    expect(await repository.findExperience(['b', 'a'])).toMatchObject([
      [{ startDate: '0001-01-01', endDate: '0004-02-29', achievements: ['Done'] }],
      [{ startDate: '2024-02-29', endDate: null }, { startDate: '2020-01-01', endDate: null }],
    ]);
  }

  /**
   * Сравнивает малый и большой пакеты на реальных родителях, включая повторы и отсутствующие ключи.
   * @param field - Проверяемый загрузчик коллекции.
   */
  async function batchesManyParents(field: 'links' | 'skills' | 'experience' | 'projects'): Promise<void> {
    const small = createProfileLoaders(repository)[field];
    const result = await small.loadMany(['b', 'missing', 'a', 'b']);
    expect(result).toMatchObject([[{ profileId: 'b' }], [], [{ profileId: 'a' }, { profileId: 'a' }], [{ profileId: 'b' }]]);
    expect(queries).toHaveLength(1);
    queries.length = 0;
    const many = createProfileLoaders(repository)[field];
    const keys = Array.from({ length: 20 }, parentKey);
    const rows = await many.loadMany(keys);
    expect(rows).toHaveLength(20);
    for (const row of rows) expect(row).toHaveLength(1);
    expect(queries).toHaveLength(1);
  }

  /**
   * Формирует идентификатор реальной фикстуры для проверки роста пакета.
   * @param _value - Неиспользуемое значение создаваемого массива.
   * @param index - Индекс элемента от нуля.
   * @returns Идентификатор соответствующего профиля.
   */
  function parentKey(_value: unknown, index: number): string {
    return `parent-${(index + 1).toString()}`;
  }
}
