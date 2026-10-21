import type { CodegenConfig } from '@graphql-codegen/cli';

const pluginConfig = {
  useTypeImports: true,
  immutableTypes: true,
  avoidOptionals: { field: true },
  strictScalars: true,
  defaultScalarType: 'unknown',
  scalars: {
    Date: { input: 'string', output: 'string' },
  },
  contextType: '../graphql/graphql-context.js#GraphQLContext',
};

const config = {
  schema: 'src/profile/profile.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: pluginConfig,
    },
  },
} satisfies CodegenConfig;

export default config;
