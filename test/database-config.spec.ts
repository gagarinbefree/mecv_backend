import { describe, expect, it } from 'vitest';
import { readDatabaseConfig, readTestDatabaseConfig } from '../src/database/database-config.js';

const developmentUrl = 'postgresql://example:example@127.0.0.1:5432/mecv_dev';
const testUrl = 'postgresql://example:example@127.0.0.1:5432/mecv_test';

describe('database configuration', defineConfigurationTests);

/** Регистрирует проверки конфигурации без подключения к серверу PostgreSQL. */
function defineConfigurationTests(): void {
  it('reads the database URL and defaults to public schema', readsDatabaseUrl);
  it('accepts an explicit SQL schema', readsSchema);
  it.each([
    undefined, '', 'not-a-url', 'https://localhost/mecv_dev',
    'postgresql://localhost/', 'postgresql://localhost/mecv_dev?schema=',
    'postgresql://localhost/mecv_dev?schema=public%3BDROP%20SCHEMA%20public',
    'postgresql://localhost/mecv_dev?schema=public&schema=other',
    'postgresql://localhost/mecv_dev?host=example.com',
    'postgresql://localhost/mecv_dev?port=5433',
  ])('rejects an invalid database configuration %#', rejectsInvalidConfiguration);
  it('does not disclose credentials in configuration errors', hidesCredentials);
  it('accepts an isolated local test database', acceptsTestDatabase);
  it.each([
    developmentUrl, 'postgresql://localhost/postgres',
    'postgresql://example.com/mecv_test',
  ])('rejects an unsafe test database %#', rejectsUnsafeTestDatabase);
  it('rejects a test database also configured as development', rejectsSharedDatabase);
}

/** Проверяет сохранение URL и выбор стандартной схемы PostgreSQL. */
function readsDatabaseUrl(): void {
  expect(readDatabaseConfig(developmentUrl)).toEqual({
    connectionString: developmentUrl, schema: 'public',
  });
}

/** Проверяет явное имя схемы для изолированного запуска интеграционных тестов. */
function readsSchema(): void {
  expect(readDatabaseConfig(`${testUrl}?schema=mecv_test_a1`).schema).toBe('mecv_test_a1');
}

/**
 * Проверяет отказ от неверного протокола, отсутствующей базы и опасного идентификатора схемы.
 * @param value - Некорректное значение переменной окружения.
 */
function rejectsInvalidConfiguration(value: string | undefined): void {
  expect(readDatabaseConfig.bind(undefined, value)).toThrow();
}

/** Проверяет, что сообщение ошибки не содержит пользовательскую часть URL. */
function hidesCredentials(): void {
  expect(readDatabaseConfig.bind(undefined,
    'postgresql://example:private-placeholder@localhost:invalid/mecv_dev',
  )).toThrow('DATABASE_URL должен быть корректным URL PostgreSQL.');
}

/** Проверяет допустимое подключение к отдельной локальной базе тестов. */
function acceptsTestDatabase(): void {
  expect(readTestDatabaseConfig(testUrl, developmentUrl).connectionString).toBe(testUrl);
}

/**
 * Проверяет запрет разработки, служебной базы кластера и удалённого адреса для тестовой очистки.
 * @param value - Подключение, которое не разрешено использовать тестам.
 */
function rejectsUnsafeTestDatabase(value: string): void {
  expect(readTestDatabaseConfig.bind(undefined, value, developmentUrl)).toThrow();
}

/** Проверяет запрет тестов на базе, одновременно назначенной базой разработки. */
function rejectsSharedDatabase(): void {
  expect(readTestDatabaseConfig.bind(undefined, testUrl, testUrl)).toThrow();
}
