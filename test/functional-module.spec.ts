import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { createApplicationModule } from '../src/bootstrap/create-application-module.js';

type Reader = Readonly<{ read: () => string }>;

describe('functional NestJS composition', defineModuleTests);

/**
 * Registers the observable contracts for functional module composition.
 */
function defineModuleTests(): void {
  it('resolves a factory provider with explicit dependencies', resolvesFactory);
  it('executes lifecycle hooks on a plain provider object', executesLifecycle);
}

/**
 * Creates a reader that captures an explicitly supplied dependency.
 * @param prefix - Immutable value supplied through dependency injection.
 * @returns A reader with no prototype or application class.
 */
function createReader(prefix: string): Reader {
  /**
   * Reads the value supplied when the reader was created.
   * @returns The captured dependency value.
   */
  function read(): string {
    return prefix;
  }

  return { read };
}

/**
 * Proves that Nest resolves a functional provider and its dependency token.
 * @returns Completion after the application context has been closed.
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
 * Proves that plain object providers participate in init and shutdown.
 * @returns Completion after both lifecycle contracts have been asserted.
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
