import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

describe('PostgreSQL migrations', defineMigrationTests);

/** Проверяет историю миграций на настоящей PostgreSQL в отдельной схеме. */
function defineMigrationTests(): void {
  let database: TestDatabase;
  beforeAll(prepareDatabase, 60_000);
  afterAll(closeDatabase);
  it('creates all profile tables from an empty schema', createsTables);
  it('preserves records when migrations run again', preservesRecords);
  it('enforces unique profile slugs and child keys per profile', enforcesKeys);
  it('rejects children without a profile and deletes them with their owner', enforcesOwnership);
  it('stores calendar dates and accepts an ongoing job', storesDates);
  it('rejects an employment end date before its start date', rejectsReversedDates);
  it('rejects a negative collection position', rejectsNegativeOrder);

  /** Подготавливает пустую схему и применяет версионируемые миграции. */
  async function prepareDatabase(): Promise<void> {
    database = await createTestDatabase();
    await database.migrate();
    await database.sql.query(`INSERT INTO "Profile" VALUES ('owner', 'demo', 'Demo', 'Fixture')`);
  }

  /** Удаляет схему после проверки, включая случай неуспешной миграции. */
  async function closeDatabase(): Promise<void> {
    await database.close();
  }

  /** Проверяет наличие всех сущностей профиля после первого применения миграций. */
  async function createsTables(): Promise<void> {
    const result = await database.sql.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name <> '_prisma_migrations'
       ORDER BY table_name`,
    );
    expect(result.rows).toEqual([
      { table_name: 'Experience' }, { table_name: 'Profile' },
      { table_name: 'ProfileLink' }, { table_name: 'Project' }, { table_name: 'Skill' },
    ]);
  }

  /** Проверяет сохранность данных при повторном migrate deploy без сброса схемы. */
  async function preservesRecords(): Promise<void> {
    await database.migrate();
    const result = await database.sql.query('SELECT "name" FROM "Profile" WHERE "id" = $1', ['owner']);
    expect(result.rows).toEqual([{ name: 'Demo' }]);
  }

  /** Проверяет стабильные ключи профиля и уникальность дочерних ключей в пределах владельца. */
  async function enforcesKeys(): Promise<void> {
    await expect(database.sql.query(
      `INSERT INTO "Profile" VALUES ('duplicate', 'demo', 'Other', 'Fixture')`,
    )).rejects.toMatchObject({ code: '23505' });
    await database.sql.query(`INSERT INTO "Skill" VALUES ('s1', 'owner', 'ts', 'TypeScript', 0)`);
    await expect(database.sql.query(
      `INSERT INTO "Skill" VALUES ('s2', 'owner', 'ts', 'Duplicate', 1)`,
    )).rejects.toMatchObject({ code: '23505' });
    await database.sql.query(`INSERT INTO "Profile" VALUES ('other', 'other', 'Other', 'Fixture')`);
    await database.sql.query(`INSERT INTO "Skill" VALUES ('s3', 'other', 'ts', 'TypeScript', 0)`);
  }

  /** Проверяет внешний ключ и каскадное удаление только дочерних записей владельца. */
  async function enforcesOwnership(): Promise<void> {
    await expect(database.sql.query(
      `INSERT INTO "Skill" VALUES ('orphan', 'missing', 'ts', 'TypeScript', 0)`,
    )).rejects.toMatchObject({ code: '23503' });
    await database.sql.query(`INSERT INTO "Profile" VALUES ('cascade', 'cascade', 'Cascade', 'Fixture')`);
    await database.sql.query(`INSERT INTO "Skill" VALUES ('cascade-skill', 'cascade', 'ts', 'TypeScript', 0)`);
    await database.sql.query(`DELETE FROM "Profile" WHERE "id" = 'cascade'`);
    const children = await database.sql.query('SELECT "id" FROM "Skill" WHERE "id" = $1', ['cascade-skill']);
    expect(children.rows).toEqual([]);
    const owner = await database.sql.query('SELECT "id" FROM "Profile" WHERE "id" = $1', ['owner']);
    expect(owner.rows).toEqual([{ id: 'owner' }]);
  }

  /** Проверяет SQL DATE без времени и nullable дату завершения текущей работы. */
  async function storesDates(): Promise<void> {
    await insertExperience('current', null);
    const result = await database.sql.query(
      `SELECT "startDate"::text AS "start", "endDate"::text AS "end" FROM "Experience" WHERE "id" = 'current'`,
    );
    expect(result.rows).toEqual([{ start: '2024-01-15', end: null }]);
  }

  /** Проверяет защиту периода работы на уровне самой базы, независимо от приложения. */
  async function rejectsReversedDates(): Promise<void> {
    await expect(insertExperience('reversed', '2023-12-31')).rejects.toMatchObject({ code: '23514' });
  }

  /** Проверяет запрет отрицательной позиции элемента коллекции. */
  async function rejectsNegativeOrder(): Promise<void> {
    await expect(database.sql.query(
      `INSERT INTO "Skill" VALUES ('negative', 'owner', 'negative', 'Invalid', -1)`,
    )).rejects.toMatchObject({ code: '23514' });
  }

  /**
   * Добавляет опыт с фиксированной датой начала для проверки ограничений периода.
   * @param id - Уникальный ключ тестовой записи.
   * @param endDate - Проверяемая дата завершения либо текущая работа.
   */
  async function insertExperience(id: string, endDate: string | null): Promise<void> {
    await database.sql.query(
      `INSERT INTO "Experience" VALUES ($1, 'owner', $1, 'Demo', 'Developer', '2024-01-15', $2, ARRAY['Achievement'], 0)`,
      [id, endDate],
    );
  }
}
