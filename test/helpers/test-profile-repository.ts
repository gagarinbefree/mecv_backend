import type { Profile } from '../../src/generated/graphql.js';
import type { BatchRead, ProfileRecord, ProfileRepository } from '../../src/profile/profile.repository.js';

export type ReadTestProfile = () => Promise<Profile | null>;

/**
 * Адаптирует фиксированную фикстуру для транспортных тестов без подмены Prisma.
 * @param read - Управляемый тестом источник полного профиля или ошибки.
 * @returns Репозиторий фикстуры одного тестового приложения.
 */
export function createTestProfileRepository(read: ReadTestProfile): ProfileRepository {
  let pending: Promise<Profile | null> | undefined;
  return {
    findProfile, findLinks: createBatch(readLinks), findSkills: createBatch(readSkills),
    findExperience: createBatch(readExperience), findProjects: createBatch(readProjects),
  };

  /**
   * Читает фиксированную фикстуру один раз за транспортный тест.
   * @returns Полный профиль, null или исходная тестовая ошибка.
   */
  function readFixture(): Promise<Profile | null> {
    pending ??= read();
    return pending;
  }

  /**
   * Выбирает основные поля фикстуры для корневого резолвера.
   * @returns Основные поля либо null.
   */
  async function findProfile(): Promise<ProfileRecord | null> {
    const value = await readFixture();
    return value === null ? null : { id: 'fixture', name: value.name, description: value.description };
  }

  /**
   * Читает ссылки транспортной фикстуры.
   * @returns Ссылки либо пустой список.
   */
  async function readLinks(): Promise<Profile['links']> {
    return (await readFixture())?.links ?? [];
  }

  /**
   * Читает навыки транспортной фикстуры.
   * @returns Навыки либо пустой список.
   */
  async function readSkills(): Promise<Profile['skills']> {
    return (await readFixture())?.skills ?? [];
  }

  /**
   * Читает опыт транспортной фикстуры.
   * @returns Опыт либо пустой список.
   */
  async function readExperience(): Promise<Profile['experience']> {
    return (await readFixture())?.experience ?? [];
  }

  /**
   * Читает проекты транспортной фикстуры.
   * @returns Проекты либо пустой список.
   */
  async function readProjects(): Promise<Profile['projects']> {
    return (await readFixture())?.projects ?? [];
  }
}

/**
 * Создаёт пакетное чтение фиксированной коллекции для известных и отсутствующих ключей.
 * @param readValues - Источник неизменяемых элементов фикстуры.
 * @returns Пакетный метод с явным владельцем каждой записи.
 */
function createBatch<T extends object>(readValues: () => Promise<readonly T[]>): BatchRead<Readonly<T & { profileId: string }>> {
  return readBatch;

  /**
   * Выравнивает коллекцию фикстуры по ключам без изменения исходных данных.
   * @param ids - Запрошенные идентификаторы профилей.
   * @returns Отдельный результат для каждого входного ключа.
   */
  async function readBatch(ids: readonly string[]): Promise<readonly (readonly Readonly<T & { profileId: string }>[])[]> {
    const values = (await readValues()).map(withOwner);
    return ids.map(selectValues);

    /**
     * Выбирает значения только для идентификатора фикстуры.
     * @param id - Проверяемый ключ профиля.
     * @returns Коллекция фикстуры либо пустой список.
     */
    function selectValues(id: string): readonly Readonly<T & { profileId: string }>[] {
      return id === 'fixture' ? values : [];
    }
  }

  /**
   * Добавляет владельца, не меняя объект исходной фикстуры.
   * @param value - Публичные поля элемента.
   * @returns Новая запись с владельцем фикстуры.
   */
  function withOwner(value: T): Readonly<T & { profileId: string }> {
    return { ...value, profileId: 'fixture' };
  }
}
