import { describe, expect, it } from 'vitest';
import { readServerConfig } from '../src/bootstrap/server-config.js';

describe('HTTP server configuration', defineServerConfigTests);

/** Проверяет настройки HTTP до запуска подготовки PostgreSQL. */
function defineServerConfigTests(): void {
  it('defaults to the local interface and port 3000', readsDefaults);
  it('accepts an explicit interface and port', readsExplicitConfig);
  it('allows port zero for an operating-system-assigned port', acceptsEphemeralPort);
  it.each(['', 'text', '-1', '65536', '3.5', ' 3000', 'Infinity'])(
    'rejects an invalid port %s', rejectsInvalidPort,
  );
  it.each(['', ' ', '127.0.0.1 invalid'])('rejects an invalid interface %s', rejectsInvalidHost);
}

/** Проверяет стандартный локальный адрес без дополнительных настроек. */
function readsDefaults(): void {
  expect(readServerConfig(undefined, undefined)).toEqual({ port: 3000, host: '127.0.0.1' });
}

/** Проверяет явные параметры для окружения размещения приложения. */
function readsExplicitConfig(): void {
  expect(readServerConfig('8080', '0.0.0.0')).toEqual({ port: 8080, host: '0.0.0.0' });
}

/** Проверяет выделение свободного порта без фиксированного глобального порта тестов. */
function acceptsEphemeralPort(): void {
  expect(readServerConfig('0', '127.0.0.1').port).toBe(0);
}

/**
 * Проверяет отказ от некорректного числового параметра без его интерпретации как пути сокета.
 * @param value - Неверное значение PORT.
 */
function rejectsInvalidPort(value: string): void {
  expect(readServerConfig.bind(undefined, value, undefined)).toThrow('PORT');
}

/**
 * Проверяет отказ от пустого адреса или пробелов в имени интерфейса.
 * @param value - Неверное значение HOST.
 */
function rejectsInvalidHost(value: string): void {
  expect(readServerConfig.bind(undefined, undefined, value)).toThrow('HOST');
}
