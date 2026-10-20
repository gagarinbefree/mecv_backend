import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { createApplicationModule } from '../src/bootstrap/create-application-module.js';

type Reader = Readonly<{ read: () => string }>;

describe('functional NestJS composition', defineModuleTests);

/**
 * Регистрирует проверки функциональной композиции модулей.
 */
function defineModuleTests(): void {
  it('resolves a factory provider with explicit dependencies', resolvesFactory);
  it('executes lifecycle hooks on a plain provider object', executesLifecycle);
}

/**
 * Создаёт объект чтения, замыкающий явно переданную зависимость.
 * @param prefix - Неизменяемое значение, переданное через внедрение зависимостей.
 * @returns Объект с функцией чтения без собственного класса.
 */
function createReader(prefix: string): Reader {
  /**
   * Читает значение, переданное при создании объекта чтения.
   * @returns Значение зависимости, сохранённое в замыкании.
   */
  function read(): string {
    return prefix;
  }

  return { read };
}

/**
 * Проверяет, что NestJS создаёт провайдер через фабрику и внедряет его зависимость.
 * @returns Промис, завершающийся после проверки и закрытия контекста приложения.
 */
async function resolvesFactory(): Promise<void> {
  const prefixToken = Symbol('prefix');
  const readerToken = Symbol('reader');
  const application = await NestFactory.createApplicationContext(
    createApplicationModule([
      { provide: prefixToken, useValue: 'mecv' },
      { provide: readerToken, useFactory: createReader, inject: [prefixToken] },
    ]),
    { logger: false },
  );

  try {
    expect(application.get<Reader>(readerToken).read()).toBe('mecv');
  } finally {
    await application.close();
  }
}

/**
 * Проверяет вызов обработчиков жизненного цикла у провайдера в виде обычного объекта.
 * @returns Промис, завершающийся после проверки инициализации и завершения работы.
 */
async function executesLifecycle(): Promise<void> {
  const providerToken = Symbol('lifecycle');
  const onModuleInit = vi.fn<() => void>();
  const onModuleDestroy = vi.fn<() => void>();
  const provider = { onModuleInit, onModuleDestroy };
  const application = await NestFactory.createApplicationContext(
    createApplicationModule([{ provide: providerToken, useValue: provider }]),
    { logger: false },
  );

  try {
    expect(application.get<typeof provider>(providerToken)).toBe(provider);
    expect(onModuleInit).toHaveBeenCalledOnce();
    expect(onModuleDestroy).not.toHaveBeenCalled();
  } finally {
    await application.close();
  }

  expect(onModuleDestroy).toHaveBeenCalledOnce();
}
