import { readFileSync } from 'node:fs';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import type { Resolvers } from '../generated/graphql.js';
import type { ReadProfile } from '../profile/profile-reader.js';
import { createProfileResolvers } from '../profile/profile.resolvers.js';
import { dateScalar } from './date.scalar.js';
import { createGraphQLContext } from './graphql-context.js';

/**
 * Настраивает SDL, функциональные резолверы и встроенный Apollo Sandbox.
 * @param readProfile - Функция чтения, полученная из контейнера NestJS.
 * @returns Настройки Apollo для публичного API цифровой визитки.
 */
export function createGraphQLOptions(readProfile: ReadProfile): ApolloDriverConfig {
  const resolvers = {
    ...createProfileResolvers(readProfile),
    Date: dateScalar,
  } satisfies Resolvers;

  return {
    path: '/graphql',
    typeDefs: readFileSync(new URL('../profile/profile.graphql', import.meta.url), 'utf8'),
    resolvers,
    context: createGraphQLContext,
    playground: false,
    introspection: true,
    includeStacktraceInErrorResponses: false,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  };
}
