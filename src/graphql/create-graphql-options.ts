import { readFileSync } from 'node:fs';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import type { Resolvers } from '../generated/graphql.js';
import type { ProfileRepository } from '../profile/profile.repository.js';
import { createProfileResolvers } from '../profile/profile.resolvers.js';
import { dateScalar } from './date.scalar.js';
import { createGraphQLContext, type GraphQLContext } from './graphql-context.js';

/**
 * Настраивает SDL, функциональные резолверы и встроенный Apollo Sandbox.
 * @param repository - Репозиторий, полученный из контейнера NestJS.
 * @returns Настройки Apollo для публичного API цифровой визитки.
 */
export function createGraphQLOptions(repository: ProfileRepository): ApolloDriverConfig {
  const resolvers = {
    ...createProfileResolvers(),
    Date: dateScalar,
  } satisfies Resolvers;

  return {
    path: '/graphql',
    typeDefs: readFileSync(new URL('../profile/profile.graphql', import.meta.url), 'utf8'),
    resolvers,
    context: createContext,
    playground: false,
    introspection: true,
    includeStacktraceInErrorResponses: false,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  };

  /**
   * Создаёт изолированный контекст при каждом обращении Apollo.
   * @returns Новый сервис и новые загрузчики для текущей операции.
   */
  function createContext(): GraphQLContext {
    return createGraphQLContext(repository);
  }
}
