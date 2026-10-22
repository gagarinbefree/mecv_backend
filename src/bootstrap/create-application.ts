import 'reflect-metadata';
import type { Server } from 'node:http';
import type { DynamicModule, INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { createGraphQLOptions } from '../graphql/create-graphql-options.js';
import type { ProfileRepository } from '../profile/profile.repository.js';
import { createDatabase, type Database } from '../database/create-database.js';
import { createProfileRepository } from '../database/create-profile-repository.js';
import { createApplicationModule } from './create-application-module.js';

/**
 * Создаёт HTTP-приложение для чтения профиля из PostgreSQL.
 * @param connectionString - Подключение приложения к PostgreSQL.
 * @param options - Настройки журналирования NestJS.
 * @param onQuery - Наблюдатель фактически выполненного SQL.
 * @returns Приложение с ресурсами, принадлежащими его жизненному циклу.
 */
export async function createDatabaseApplication(
  connectionString: string,
  options: Pick<NestApplicationOptions, 'logger'> = {},
  onQuery?: (event: Readonly<{ query: string }>) => void,
): Promise<INestApplication<Server>> {
  const databaseToken = Symbol('Database');
  const repositoryToken = Symbol('ProfileRepository');
  const profileModule = {
    ...createApplicationModule([
      { provide: databaseToken, useFactory: createOwnedDatabase },
      { provide: repositoryToken, useFactory: createRepository, inject: [databaseToken] },
    ]),
    exports: [repositoryToken],
  };
  return createHttpApplication(profileModule, repositoryToken, options);

  /**
   * Создаёт один ресурс БД, lifecycle которого будет вызывать NestJS.
   * @returns Клиент и обработчики открытия и закрытия пула.
   */
  function createOwnedDatabase(): Database {
    return createDatabase(connectionString, onQuery);
  }

  /**
   * Создаёт репозиторий поверх единственного внедрённого клиента приложения.
   * @param database - Ресурс БД из контейнера NestJS.
   * @returns Предметные методы чтения профиля.
   */
  function createRepository(database: Database): ProfileRepository {
    return createProfileRepository(database.client);
  }
}

/**
 * Создаёт HTTP-приложение NestJS с явно переданным источником профиля.
 * @param repository - Предметный источник данных профиля.
 * @param options - Настройки журналирования NestJS.
 * @returns Приложение, которое вызывающий код запускает на выбранном порту и закрывает после работы.
 */
export async function createApplication(
  repository: ProfileRepository,
  options: Pick<NestApplicationOptions, 'logger'> = {},
): Promise<INestApplication<Server>> {
  const repositoryToken = Symbol('ProfileRepository');
  const profileModule = {
    ...createApplicationModule([{ provide: repositoryToken, useValue: repository }]),
    exports: [repositoryToken],
  };
  return createHttpApplication(profileModule, repositoryToken, options);
}

/**
 * Собирает транспорт Apollo поверх модуля с явной зависимостью репозитория.
 * @param profileModule - Модуль, владеющий провайдерами профиля.
 * @param repositoryToken - Токен экспортированного репозитория.
 * @param options - Настройки журналирования NestJS.
 * @returns HTTP-приложение с общей конфигурацией GraphQL.
 */
async function createHttpApplication(
  profileModule: DynamicModule, repositoryToken: symbol,
  options: Pick<NestApplicationOptions, 'logger'>,
): Promise<INestApplication<Server>> {
  const graphqlModule = GraphQLModule.forRootAsync<ApolloDriverConfig>({
    driver: ApolloDriver,
    imports: [profileModule],
    inject: [repositoryToken],
    useFactory: createGraphQLOptions,
  });

  return NestFactory.create<INestApplication<Server>>(
    createApplicationModule([], [graphqlModule]),
    { ...options, abortOnError: false },
  );
}
