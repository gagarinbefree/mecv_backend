import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { createGraphQLOptions } from '../graphql/create-graphql-options.js';
import type { ReadProfile } from '../profile/profile-reader.js';
import { createApplicationModule } from './create-application-module.js';

/**
 * Создаёт HTTP-приложение NestJS с явно переданным источником профиля.
 * @param readProfile - Функция чтения профиля для резолвера.
 * @param options - Настройки журналирования NestJS.
 * @returns Приложение, которое вызывающий код запускает на выбранном порту и закрывает после работы.
 */
export async function createApplication(
  readProfile: ReadProfile,
  options: Pick<NestApplicationOptions, 'logger'> = {},
): Promise<INestApplication<Server>> {
  const readerToken = Symbol('ReadProfile');
  const profileModule = {
    ...createApplicationModule([{ provide: readerToken, useValue: readProfile }]),
    exports: [readerToken],
  };
  const graphqlModule = GraphQLModule.forRootAsync<ApolloDriverConfig>({
    driver: ApolloDriver,
    imports: [profileModule],
    inject: [readerToken],
    useFactory: createGraphQLOptions,
  });

  return NestFactory.create<INestApplication<Server>>(
    createApplicationModule([], [graphqlModule]),
    { ...options, abortOnError: false },
  );
}
