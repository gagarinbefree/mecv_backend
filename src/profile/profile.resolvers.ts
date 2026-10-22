import type { Resolvers } from '../generated/graphql.js';
import type { GraphQLContext } from '../graphql/graphql-context.js';
import type { ExperienceRecord, ProfileLinkRecord, ProfileRecord, ProjectRecord, SkillRecord } from './profile.repository.js';

type EmptyArgs = Record<PropertyKey, never>;

/**
 * Связывает публичные поля с сервисом и ленивыми загрузчиками текущего запроса.
 * @returns Типизированная карта резолверов без прямого доступа к Prisma.
 */
export function createProfileResolvers(): Pick<Resolvers, 'Query' | 'Profile'> {
  return { Query: { profile: readProfile }, Profile: {
    links: readLinks, skills: readSkills, experience: readExperience, projects: readProjects,
  } };
}

/**
 * Читает основные поля выбранного публичного профиля.
 * @param _parent - Корень запроса без данных.
 * @param _args - Пустые аргументы текущего контракта.
 * @param context - Зависимости одной операции GraphQL.
 * @returns Профиль либо null без загрузки вложенных коллекций.
 */
function readProfile(_parent: EmptyArgs, _args: EmptyArgs, context: GraphQLContext): Promise<ProfileRecord | null> {
  return context.profile.readProfile();
}

/**
 * Лениво загружает ссылки профиля с объединением повторных ключей.
 * @param parent - Основные поля родительского профиля.
 * @param _args - Пустые аргументы поля.
 * @param context - Контекст текущей операции.
 * @returns Упорядоченные ссылки профиля.
 */
function readLinks(parent: ProfileRecord, _args: EmptyArgs, context: GraphQLContext): Promise<readonly ProfileLinkRecord[]> {
  return context.loaders.links.load(parent.id);
}

/**
 * Лениво загружает навыки профиля через пакетный загрузчик.
 * @param parent - Основные поля родительского профиля.
 * @param _args - Пустые аргументы поля.
 * @param context - Контекст текущей операции.
 * @returns Упорядоченные навыки профиля.
 */
function readSkills(parent: ProfileRecord, _args: EmptyArgs, context: GraphQLContext): Promise<readonly SkillRecord[]> {
  return context.loaders.skills.load(parent.id);
}

/**
 * Лениво загружает опыт профиля через пакетный загрузчик.
 * @param parent - Основные поля родительского профиля.
 * @param _args - Пустые аргументы поля.
 * @param context - Контекст текущей операции.
 * @returns Упорядоченные периоды работы.
 */
function readExperience(parent: ProfileRecord, _args: EmptyArgs, context: GraphQLContext): Promise<readonly ExperienceRecord[]> {
  return context.loaders.experience.load(parent.id);
}

/**
 * Лениво загружает проекты профиля через пакетный загрузчик.
 * @param parent - Основные поля родительского профиля.
 * @param _args - Пустые аргументы поля.
 * @param context - Контекст текущей операции.
 * @returns Упорядоченные проекты профиля.
 */
function readProjects(parent: ProfileRecord, _args: EmptyArgs, context: GraphQLContext): Promise<readonly ProjectRecord[]> {
  return context.loaders.projects.load(parent.id);
}
