import { readFileSync } from 'node:fs';
import { buildSchema, graphql, parse, validate, validateSchema } from 'graphql';
import { describe, expect, it } from 'vitest';

const schema = buildSchema(
  readFileSync(new URL('../src/profile/profile.graphql', import.meta.url), 'utf8'),
);

const assignmentQuery = `
  query {
    profile {
      name
      description
      skills { name }
      experience { company position }
      projects { name }
    }
  }
`;

const fullProfileQuery = `
  query {
    profile {
      name
      description
      links { label url }
      skills { name }
      experience { company position startDate endDate achievements }
      projects { name description url }
    }
  }
`;

const emptyProfile = {
  name: 'Демонстрационный специалист',
  description: 'Учебный профиль разработчика',
  links: [],
  skills: [],
  experience: [],
  projects: [],
} as const;

const collectionFields = ['links', 'skills', 'experience', 'projects'] as const;
type CollectionField = (typeof collectionFields)[number];

describe('profile schema contract', defineSchemaTests);

/**
 * Регистрирует проверки публичного контракта профиля без HTTP и базы данных.
 */
function defineSchemaTests(): void {
  it('accepts the query from the assignment', acceptsAssignmentQuery);
  it('accepts all profile fields and relations', acceptsFullProfileQuery);
  it('allows an absent profile', allowsAbsentProfile);
  it('returns empty collections', allowsEmptyCollections);
  it('allows ongoing work and an optional project description', allowsOptionalFields);
  it.each(collectionFields)('rejects a null %s collection', rejectsNullCollection);
  it.each(collectionFields)('rejects null items in %s', rejectsNullCollectionItem);
  it('does not expose mutations', rejectsMutations);
}

/**
 * Проверяет корректность схемы и совместимость с запросом из задания.
 */
function acceptsAssignmentQuery(): void {
  expect(validateSchema(schema)).toEqual([]);
  expect(validate(schema, parse(assignmentQuery))).toEqual([]);
}

/**
 * Проверяет доступность ссылок, периодов работы, достижений и данных проектов.
 */
function acceptsFullProfileQuery(): void {
  expect(validate(schema, parse(fullProfileQuery))).toEqual([]);
}

/**
 * Проверяет, что отсутствие профиля представляется null без ошибки GraphQL.
 * @returns Промис, завершающийся после проверки ответа.
 */
async function allowsAbsentProfile(): Promise<void> {
  const result = await graphql({
    schema,
    source: fullProfileQuery,
    rootValue: { profile: null },
  });

  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ profile: null });
}

/**
 * Проверяет, что отсутствие связанных записей представляется пустыми массивами.
 * @returns Промис, завершающийся после проверки всех коллекций профиля.
 */
async function allowsEmptyCollections(): Promise<void> {
  const result = await graphql({
    schema,
    source: fullProfileQuery,
    rootValue: { profile: emptyProfile },
  });

  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ profile: emptyProfile });
}

/**
 * Проверяет допустимость null у окончания текущей работы и описания проекта.
 * @returns Промис, завершающийся после проверки необязательных полей.
 */
async function allowsOptionalFields(): Promise<void> {
  const profile = {
    ...emptyProfile,
    links: [{ label: 'Портфолио', url: 'https://example.com/portfolio' }],
    skills: [{ name: 'TypeScript' }],
    experience: [
      {
        company: 'Учебная компания',
        position: 'Разработчик',
        startDate: '2022-01-01',
        endDate: '2023-12-31',
        achievements: ['Разработал учебный API'],
      },
      {
        company: 'Демонстрационная компания',
        position: 'Бэкенд-разработчик',
        startDate: '2024-01-01',
        endDate: null,
        achievements: [],
      },
    ],
    projects: [
      { name: 'Визитка', description: null, url: 'https://example.com/project' },
    ],
  } as const;

  const result = await graphql({
    schema,
    source: fullProfileQuery,
    rootValue: { profile },
  });

  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ profile });
}

/**
 * Проверяет обязательность массива для каждой связи профиля.
 * @param field - Проверяемая коллекция связанных записей.
 * @returns Промис, завершающийся после проверки ошибки и её пути.
 */
async function rejectsNullCollection(field: CollectionField): Promise<void> {
  const result = await graphql({
    schema,
    source: fullProfileQuery,
    rootValue: { profile: { ...emptyProfile, [field]: null } },
  });

  expect(result.data).toEqual({ profile: null });
  expect(result.errors).toHaveLength(1);
  expect(result.errors?.[0]?.path).toEqual(['profile', field]);
}

/**
 * Проверяет запрет null среди элементов каждой коллекции профиля.
 * @param field - Коллекция, в которую передаётся недопустимый элемент.
 * @returns Промис, завершающийся после проверки ошибки и индекса элемента.
 */
async function rejectsNullCollectionItem(field: CollectionField): Promise<void> {
  const result = await graphql({
    schema,
    source: fullProfileQuery,
    rootValue: { profile: { ...emptyProfile, [field]: [null] } },
  });

  expect(result.data).toEqual({ profile: null });
  expect(result.errors).toHaveLength(1);
  expect(result.errors?.[0]?.path).toEqual(['profile', field, 0]);
}

/**
 * Проверяет, что контракт предоставляет только чтение данных.
 * @returns Промис, завершающийся после проверки отклонённой мутации.
 */
async function rejectsMutations(): Promise<void> {
  const result = await graphql({
    schema,
    source: 'mutation { profile { name } }',
  });

  expect(result.data).toBeNull();
  expect(result.errors).toHaveLength(1);
}
