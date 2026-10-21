import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import type { GraphQLContext } from '../src/graphql/graphql-context.js';
import type {
  Experience,
  Profile,
  ProfileResolvers,
  Project,
  Query,
  QueryResolvers,
  Scalars,
  Skill,
} from '../src/generated/graphql.js';

type FieldParameters<T> = T extends (...parameters: infer P) => unknown ? P : never;
type FieldResult<T> = T extends (...parameters: never[]) => infer R ? Awaited<R> : never;

it('maps Date input and output to strings',
  /** Проверяет строковое представление даты и запрет чисел на границе резолвера. */
  (): void => {
    expectTypeOf<Scalars['Date']['input']>().toEqualTypeOf<string>();
    expectTypeOf<Scalars['Date']['output']>().toEqualTypeOf<string>();
    expectTypeOf<Experience['startDate']>().toEqualTypeOf<string>();
    expectTypeOf<number>().not.toExtend<Experience['startDate']>();
  },
);

it('preserves nullable values without adding undefined',
  /** Проверяет отсутствие профиля, дату текущей работы и необязательное описание проекта. */
  (): void => {
    expectTypeOf<Query['profile']>().toEqualTypeOf<Profile | null>();
    expectTypeOf<Experience['endDate']>().toEqualTypeOf<string | null>();
    expectTypeOf<Project['description']>().toEqualTypeOf<string | null>();
  },
);

it('keeps profile data and related lists immutable',
  /** Проверяет неизменяемость профиля, вложенных списков и достижений. */
  (): void => {
    expectTypeOf<Profile>().toEqualTypeOf<Readonly<Profile>>();
    expectTypeOf<Profile['skills']>().toEqualTypeOf<readonly Skill[]>();
    expectTypeOf<Experience['achievements']>().toEqualTypeOf<readonly string[]>();
  },
);

it('types all query resolver parameters and its result',
  /** Проверяет parent, пустые аргументы, контекст, информацию о запросе и результат резолвера. */
  (): void => {
    type Parameters = FieldParameters<QueryResolvers['profile']>;
    expectTypeOf<Parameters[0]>().toEqualTypeOf<Record<PropertyKey, never>>();
    expectTypeOf<Parameters[1]>().toEqualTypeOf<Record<PropertyKey, never>>();
    expectTypeOf<Parameters[2]>().toEqualTypeOf<GraphQLContext>();
    expectTypeOf<Parameters[3]>().toEqualTypeOf<GraphQLResolveInfo>();
    expectTypeOf<FieldResult<QueryResolvers['profile']>>().toEqualTypeOf<Profile | null>();
  },
);

it('types nested resolver parents and their results',
  /** Проверяет тип родительского профиля, контекст и результат резолвера навыков. */
  (): void => {
    type Parameters = FieldParameters<ProfileResolvers['skills']>;
    expectTypeOf<Parameters[0]>().toEqualTypeOf<Profile>();
    expectTypeOf<Parameters[2]>().toEqualTypeOf<GraphQLContext>();
    expectTypeOf<FieldResult<ProfileResolvers['skills']>>()
      .toEqualTypeOf<readonly (Skill | Promise<Skill>)[]>();
  },
);
