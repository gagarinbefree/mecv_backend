import type { PrismaClient } from '../generated/prisma/client.js';
import type {
  ExperienceRecord, ProfileLinkRecord, ProfileRecord, ProfileRepository, ProjectRecord, SkillRecord,
} from '../profile/profile.repository.js';

/**
 * Создаёт предметный репозиторий чтения профиля и пакетного чтения его связей.
 * @param client - Единственный клиент Prisma приложения.
 * @returns Функции чтения без раскрытия моделей Prisma вызывающему коду.
 */
export function createProfileRepository(client: PrismaClient): ProfileRepository {
  return { findProfile, findLinks, findSkills, findExperience, findProjects };

  /**
   * Ищет профиль по стабильному публичному ключу.
   * @param slug - Ключ выбранного профиля.
   * @returns Основные поля либо null при отсутствии профиля.
   */
  async function findProfile(slug: string): Promise<ProfileRecord | null> {
    return client.profile.findUnique({ where: { slug }, select: { id: true, name: true, description: true } });
  }

  /**
   * Читает ссылки для пакета профилей.
   * @param ids - Идентификаторы в требуемом порядке.
   * @returns Коллекции в порядке входных идентификаторов.
   */
  async function findLinks(ids: readonly string[]): Promise<readonly (readonly ProfileLinkRecord[])[]> {
    if (ids.length === 0) return [];
    const rows = await client.profileLink.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { profileId: true, label: true, url: true },
    });
    return alignCollections(ids, rows);
  }

  /**
   * Читает навыки для пакета профилей.
   * @param ids - Идентификаторы в требуемом порядке.
   * @returns Коллекции в порядке входных идентификаторов.
   */
  async function findSkills(ids: readonly string[]): Promise<readonly (readonly SkillRecord[])[]> {
    if (ids.length === 0) return [];
    const rows = await client.skill.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { profileId: true, name: true },
    });
    return alignCollections(ids, rows);
  }

  /**
   * Читает опыт для пакета профилей.
   * @param ids - Идентификаторы в требуемом порядке.
   * @returns Коллекции в порядке входных идентификаторов.
   */
  async function findExperience(ids: readonly string[]): Promise<readonly (readonly ExperienceRecord[])[]> {
    if (ids.length === 0) return [];
    const rows = await client.experience.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { profileId: true, company: true, position: true, startDate: true, endDate: true, achievements: true },
    });
    return alignCollections(ids, rows.map(toExperience));
  }

  /**
   * Читает проекты для пакета профилей.
   * @param ids - Идентификаторы в требуемом порядке.
   * @returns Коллекции в порядке входных идентификаторов.
   */
  async function findProjects(ids: readonly string[]): Promise<readonly (readonly ProjectRecord[])[]> {
    if (ids.length === 0) return [];
    const rows = await client.project.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { profileId: true, name: true, description: true, url: true },
    });
    return alignCollections(ids, rows);
  }
}

/**
 * Группирует упорядоченные SQL-строки и выравнивает коллекции по входным ключам за линейное время.
 * @param ids - Исходные ключи, включая повторы и отсутствующие связи.
 * @param rows - Строки с явным идентификатором владельца.
 * @returns Списки той же длины и в том же порядке, что и исходные ключи.
 */
function alignCollections<T extends Readonly<{ profileId: string }>>(
  ids: readonly string[], rows: readonly T[],
): readonly (readonly T[])[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.profileId);
    if (group) group.push(row);
    else groups.set(row.profileId, [row]);
  }
  return ids.map(readGroup);

  /**
   * Читает построенную локальную группу без изменения входных строк.
   * @param id - Идентификатор профиля из исходного пакета.
   * @returns Отсортированная коллекция либо пустой список.
   */
  function readGroup(id: string): readonly T[] {
    return groups.get(id) ?? [];
  }
}

/**
 * Преобразует SQL DATE в календарную строку UTC, сохраняя nullable окончание работы.
 * @param row - Выбранные поля опыта, прочитанные через Prisma.
 * @returns Предметная запись без зависимости от типов даты ORM.
 */
function toExperience(row: Readonly<{
  profileId: string; company: string; position: string;
  startDate: Date; endDate: Date | null; achievements: readonly string[];
}>): ExperienceRecord {
  return { ...row, startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate?.toISOString().slice(0, 10) ?? null };
}
