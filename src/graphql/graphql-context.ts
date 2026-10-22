import { createProfileLoaders, type ProfileLoaders } from '../profile/profile.loaders.js';
import { createProfileService, type ProfileService } from '../profile/profile.service.js';
import type { ProfileRepository } from '../profile/profile.repository.js';

export type GraphQLContext = Readonly<{ profile: ProfileService; loaders: ProfileLoaders }>;

/**
 * Создаёт сервис и загрузчики заново для каждой операции GraphQL.
 * @param repository - Общий предметный репозиторий приложения.
 * @returns Типизированный контекст без общего кэша между запросами.
 */
export function createGraphQLContext(repository: ProfileRepository): GraphQLContext {
  return { profile: createProfileService(repository), loaders: createProfileLoaders(repository) };
}
