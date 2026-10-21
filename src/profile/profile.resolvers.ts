import type { Resolvers } from '../generated/graphql.js';
import type { ReadProfile } from './profile-reader.js';

/**
 * Создаёт типизированные резолверы профиля с явно переданной функцией чтения.
 * @param readProfile - Источник профиля, независимый от транспорта GraphQL.
 * @returns Карта функций корневого запроса без доступа к инфраструктуре базы данных.
 */
export function createProfileResolvers(readProfile: ReadProfile): Pick<Resolvers, 'Query'> {
  return { Query: { profile: readProfile } };
}
