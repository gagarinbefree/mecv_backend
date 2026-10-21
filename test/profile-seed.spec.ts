import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/database/create-database.js';
import { seedDemoProfile } from '../src/database/seed-demo-profile.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { demoProfileSeedData, demoProfileSlug, type ProfileSeedData } from '../src/profile/profile-seed-data.js';
import { createTestDatabase, type TestDatabase } from './helpers/test-database.js';

type StoredProfile = Prisma.ProfileGetPayload<{
  include: { links: true; skills: true; experience: true; projects: true };
}>;

describe('demonstration profile seed', defineSeedTests);

/** Регистрирует проверки сохранения демопрофиля на настоящей PostgreSQL. */
function defineSeedTests(): void {
  let fixture: TestDatabase;
  let database: Database;
  beforeAll(prepareDatabase, 60_000);
  afterAll(closeDatabase);
  beforeEach(resetProfiles);
  it('populates an empty database with the complete demonstration profile', createsProfile);
  it('preserves record identities and avoids duplicates on repeated seeding', repeatsSeed);
  it('updates existing records, adds new keys and removes obsolete skills', updatesProfile);
  it('clears every managed collection without changing another profile', preservesOtherProfile);
  it.each([false, true])('rolls back all writes after a database failure; existing profile: %s', rollsBack);
  it('rejects invalid seed data without changing the stored profile', rejectsInvalidData);

  /** Создаёт отдельную схему и подключает настоящий клиент Prisma. */
  async function prepareDatabase(): Promise<void> {
    fixture = await createTestDatabase();
    await fixture.migrate();
    database = createDatabase(fixture.connectionString);
    await database.onModuleInit();
  }

  /** Закрывает пул перед удалением принадлежащей тестам схемы. */
  async function closeDatabase(): Promise<void> {
    await database.onModuleDestroy();
    await fixture.close();
  }

  /** Очищает только известные фикстуры внутри собственной тестовой схемы. */
  async function resetProfiles(): Promise<void> {
    await database.client.profile.deleteMany({ where: { slug: { in: [demoProfileSlug, 'other'] } } });
  }

  /** Проверяет содержание каждой коллекции, даты и порядок после заполнения пустой базы. */
  async function createsProfile(): Promise<void> {
    await seedDemoProfile(database.client);
    const stored = await snapshot();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      ...demoProfileSeedData,
      slug: demoProfileSlug,
      experience: [{
        ...demoProfileSeedData.experience[0],
        startDate: new Date('2024-02-29T00:00:00.000Z'), endDate: null,
      }],
    });
    expect(stored[0]?.skills[0]).toMatchObject({ key: 'typescript', sortOrder: 0 });
    expect(stored[0]?.skills[5]).toMatchObject({ key: 'postgresql', sortOrder: 5 });
  }

  /** Проверяет неизменность идентификаторов и отсутствие дубликатов при повторном запуске. */
  async function repeatsSeed(): Promise<void> {
    await seedDemoProfile(database.client);
    const before = await snapshot();
    expect(before).toHaveLength(1);
    await seedDemoProfile(database.client);
    expect(await snapshot()).toEqual(before);
  }

  /** Проверяет обновление всех разделов, явный порядок и сохранность идентификаторов стабильных ключей. */
  async function updatesProfile(): Promise<void> {
    await seedDemoProfile(database.client);
    const before = (await snapshot())[0];
    const changed: ProfileSeedData = {
      name: 'Обновлённый учебный профиль', description: 'Обновлённое описание',
      links: [{ key: 'github-project', label: 'Исходники', url: 'https://example.com/source' }],
      skills: [{ key: 'git', name: 'Git' }, { key: 'typescript', name: 'TypeScript 6' }],
      experience: [{
        key: 'demo-backend', company: 'Новая учебная компания', position: 'Разработчик',
        startDate: '2024-01-15', endDate: '2025-01-31', achievements: ['Обновлённое достижение'],
      }],
      projects: [{ key: 'mecv', name: 'Обновлённый проект', description: 'Новое описание', url: 'https://example.com/project' }],
    };
    await seedDemoProfile(database.client, changed);
    const after = (await snapshot())[0];
    expect(after).toMatchObject({
      ...changed,
      experience: [{ ...changed.experience[0], startDate: new Date('2024-01-15T00:00:00Z'), endDate: new Date('2025-01-31T00:00:00Z') }],
    });
    expect(after?.id).toBe(before?.id);
    expect(after?.links[0]?.id).toBe(before?.links[0]?.id);
    expect(after?.skills).toHaveLength(2);
    expect(after?.skills[1]).toMatchObject({ id: before?.skills[0]?.id, sortOrder: 1 });
    expect(after?.experience[0]?.id).toBe(before?.experience[0]?.id);
    expect(after?.projects[0]?.id).toBe(before?.projects[0]?.id);
  }

  /** Проверяет пустые коллекции и неизменность чужих записей даже при совпадающих дочерних ключах. */
  async function preservesOtherProfile(): Promise<void> {
    await seedDemoProfile(database.client);
    await fixture.sql.query(`
      INSERT INTO "Profile" VALUES ('other-profile', 'other', 'Посторонний профиль', 'Не управляется seed');
      INSERT INTO "ProfileLink" VALUES ('other-link', 'other-profile', 'github-project', 'Ссылка', 'https://example.com', 0);
      INSERT INTO "Skill" VALUES ('other-skill', 'other-profile', 'typescript', 'Другой навык', 0);
      INSERT INTO "Experience" VALUES (
        'other-experience', 'other-profile', 'demo-backend', 'Другая компания', 'Другая должность',
        '2023-01-01', NULL, ARRAY['Другое достижение'], 0
      );
      INSERT INTO "Project" VALUES ('other-project', 'other-profile', 'mecv', 'Другой проект', 'Описание', 'https://example.com', 0);
    `);
    const other = (await snapshot())[1];
    expect(other?.slug).toBe('other');
    const empty = { ...demoProfileSeedData, links: [], skills: [], experience: [], projects: [] };
    await seedDemoProfile(database.client, empty);
    const stored = await snapshot();
    expect(stored).toHaveLength(2);
    expect(stored).toContainEqual(other);
    expect(stored).toContainEqual(expect.objectContaining(empty));
  }

  /**
   * Вызывает настоящую ошибку последнего раздела после предыдущих записей и проверяет полный откат.
   * @param existing - Нужно ли проверять восстановление уже существующего профиля.
   */
  async function rollsBack(existing: boolean): Promise<void> {
    if (existing) await seedDemoProfile(database.client);
    const before = await snapshot();
    await fixture.sql.query(`ALTER TABLE "Project" ADD CONSTRAINT "test_reject_name" CHECK ("name" <> 'Rejected project')`);
    try {
      await expect(seedDemoProfile(database.client, {
        name: 'Частичное обновление', description: 'Не должно сохраниться',
        links: [], skills: [], experience: [],
        projects: [{ key: 'rejected', name: 'Rejected project', description: 'Ошибка PostgreSQL', url: 'https://example.com' }],
      })).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally {
      await fixture.sql.query('ALTER TABLE "Project" DROP CONSTRAINT "test_reject_name"');
    }
  }

  /** Проверяет вызов предметной валидации самим seed и сохранность ранее записанных данных. */
  async function rejectsInvalidData(): Promise<void> {
    await seedDemoProfile(database.client);
    const before = await snapshot();
    await expect(seedDemoProfile(database.client, { ...demoProfileSeedData, name: ' ' }))
      .rejects.toThrow('Поле name не должно быть пустым.');
    expect(await snapshot()).toEqual(before);
  }

  /**
   * Читает все сохранённые данные с детерминированной сортировкой для сравнения запусков.
   * @returns Профили со всеми дочерними записями и техническими идентификаторами.
   */
  async function snapshot(): Promise<StoredProfile[]> {
    return database.client.profile.findMany({
      orderBy: { slug: 'asc' },
      include: {
        links: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        skills: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        experience: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        projects: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
  }
}
