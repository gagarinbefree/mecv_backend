import { describe, expect, it, vi } from 'vitest';
import { createApplication } from '../src/bootstrap/create-application.js';
import { demoProfile } from './helpers/demo-profile.js';
import { createTestProfileRepository, type ReadTestProfile as ReadProfile } from './helpers/test-profile-repository.js';

const fullQuery = `query {
  profile {
    name description links { label url } skills { name }
    experience { company position startDate endDate achievements }
    projects { name description url }
  }
}`;

describe('profile HTTP API', defineHttpTests);

/** Регистрирует проверки настоящего HTTP-сервера NestJS и Apollo. */
function defineHttpTests(): void {
  it('returns the profile and all nested data over HTTP', returnsProfile);
  it('returns null when the profile is absent', returnsAbsentProfile);
  it('serves embedded Apollo Sandbox', servesSandbox);
  it('supports introspection for Sandbox', supportsIntrospection);
  it('rejects unknown fields', rejectsUnknownFields);
  it('rejects an impossible date returned by the reader', rejectsInvalidOutputDate);
  it('reports reader errors without exposing a stack trace', reportsReaderError);
}

/**
 * Запускает приложение на свободном локальном порту и гарантирует закрытие после проверки.
 * @param readProfile - Источник данных для отдельного экземпляра приложения.
 * @param verify - Проверка, получающая адрес GraphQL.
 * @returns Промис, завершающийся после проверки и освобождения HTTP-порта.
 */
async function withApplication(
  readProfile: ReadProfile,
  verify: (endpoint: string) => Promise<void>,
): Promise<void> {
  const application = await createApplication(createTestProfileRepository(readProfile), { logger: false });
  try {
    await application.listen(0, '127.0.0.1');
    await verify(`${await application.getUrl()}/graphql`);
  } finally {
    await application.close();
  }
}

/**
 * Выполняет GraphQL POST-запрос с ограниченным временем ожидания.
 * @param endpoint - Адрес запущенного тестового приложения.
 * @param query - Документ GraphQL.
 * @returns HTTP-ответ без небезопасного приведения JSON к типам приложения.
 */
async function postQuery(endpoint: string, query: string): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(5_000),
  });
}

/**
 * Проверяет доставку вложенных данных и единственное чтение профиля за запрос.
 * @returns Промис, завершающийся после проверки ответа HTTP.
 */
async function returnsProfile(): Promise<void> {
  const reader = vi.fn<ReadProfile>().mockResolvedValue(demoProfile);
  await withApplication(reader,
    /**
     * Сравнивает публичный ответ со всеми запрошенными полями.
     * @param endpoint - Адрес GraphQL тестового сервера.
     * @returns Промис проверки результата запроса.
     */
    async (endpoint: string): Promise<void> => {
      const response = await postQuery(endpoint, fullQuery);
      const body: unknown = await response.json();
      expect(response.status).toBe(200);
      expect(body).toEqual({ data: { profile: demoProfile } });
      expect(reader).toHaveBeenCalledOnce();
    },
  );
}

/**
 * Проверяет null при отсутствии профиля без ошибки GraphQL.
 * @returns Промис проверки ответа и закрытия приложения.
 */
async function returnsAbsentProfile(): Promise<void> {
  await withApplication(vi.fn<ReadProfile>().mockResolvedValue(null), verifyAbsentProfile);
}

/**
 * Проверяет JSON-ответ для отсутствующего профиля.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки HTTP-ответа.
 */
async function verifyAbsentProfile(endpoint: string): Promise<void> {
  const response = await postQuery(endpoint, fullQuery);
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(body).toEqual({ data: { profile: null } });
}

/**
 * Проверяет доступность HTML со встроенным Apollo Sandbox.
 * @returns Промис проверки страницы и закрытия приложения.
 */
async function servesSandbox(): Promise<void> {
  await withApplication(vi.fn<ReadProfile>().mockResolvedValue(null), verifySandbox);
}

/**
 * Запрашивает страницу как браузер и проверяет загрузчик встроенного Sandbox.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки HTTP-страницы.
 */
async function verifySandbox(endpoint: string): Promise<void> {
  const response = await fetch(endpoint, {
    headers: { accept: 'text/html' },
    signal: AbortSignal.timeout(5_000),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(await response.text()).toContain('embeddable-sandbox');
}

/**
 * Проверяет доступность интроспекции, необходимой редактору запросов Sandbox.
 * @returns Промис проверки схемы по HTTP.
 */
async function supportsIntrospection(): Promise<void> {
  await withApplication(vi.fn<ReadProfile>().mockResolvedValue(null), verifyIntrospection);
}

/**
 * Читает имя корневого типа из схемы по HTTP.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки интроспекции.
 */
async function verifyIntrospection(endpoint: string): Promise<void> {
  const response = await postQuery(endpoint, '{ __schema { queryType { name } } }');
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(body).toEqual({ data: { __schema: { queryType: { name: 'Query' } } } });
}

/**
 * Проверяет валидацию запроса до обращения к источнику данных.
 * @returns Промис проверки ошибки неизвестного поля.
 */
async function rejectsUnknownFields(): Promise<void> {
  const reader = vi.fn<ReadProfile>().mockResolvedValue(null);
  await withApplication(reader, verifyUnknownField);
  expect(reader).not.toHaveBeenCalled();
}

/**
 * Проверяет статус и код ошибки для поля вне SDL-контракта.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки ответа валидации.
 */
async function verifyUnknownField(endpoint: string): Promise<void> {
  const response = await postQuery(endpoint, '{ profile { unknownField } }');
  const body: unknown = await response.json();
  expect(response.status).toBe(400);
  expect(body).toMatchObject({
    errors: [{ extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }],
  });
}

/**
 * Проверяет, что сериализация Date действительно подключена к HTTP GraphQL.
 * @returns Промис проверки ошибки некорректной даты в связанных данных.
 */
async function rejectsInvalidOutputDate(): Promise<void> {
  const invalidProfile = {
    ...demoProfile,
    experience: [{
      company: 'Учебная компания', position: 'Разработчик',
      startDate: '2025-02-29', endDate: null, achievements: [],
    }],
  };
  await withApplication(vi.fn<ReadProfile>().mockResolvedValue(invalidProfile), verifyInvalidDate);
}

/**
 * Проверяет распространение ошибки обязательной даты до nullable-профиля.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки ошибки сериализации.
 */
async function verifyInvalidDate(endpoint: string): Promise<void> {
  const response = await postQuery(endpoint, '{ profile { experience { startDate } } }');
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(body).toMatchObject({
    data: { profile: null },
    errors: [{ path: ['profile', 'experience', 0, 'startDate'] }],
  });
}

/**
 * Проверяет GraphQL-ответ при отказе источника данных.
 * @returns Промис проверки ошибки чтения и закрытия приложения.
 */
async function reportsReaderError(): Promise<void> {
  const reader = vi.fn<ReadProfile>().mockRejectedValue(new Error('Reader unavailable'));
  await withApplication(reader, verifyReaderError);
}

/**
 * Проверяет путь ошибки, nullable-профиль и отсутствие стека реализации в ответе.
 * @param endpoint - Адрес GraphQL тестового сервера.
 * @returns Промис проверки обработки ошибки.
 */
async function verifyReaderError(endpoint: string): Promise<void> {
  const response = await postQuery(endpoint, '{ profile { name } }');
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(body).toMatchObject({
    data: { profile: null },
    errors: [{ path: ['profile'], extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
  });
  expect(JSON.stringify(body)).not.toContain('stacktrace');
}
