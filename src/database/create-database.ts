import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { readDatabaseConfig } from './database-config.js';

export type Database = Readonly<{
  client: PrismaClient;
  onModuleInit: () => Promise<void>;
  onModuleDestroy: () => Promise<void>;
}>;

/**
 * Создаёт ресурс Prisma с собственным пулом и обработчиками жизненного цикла NestJS.
 * @param connectionString - Проверяемый URL PostgreSQL.
 * @returns Клиент и обработчики подготовки и освобождения ресурса.
 */
export function createDatabase(connectionString: string): Database {
  const config = readDatabaseConfig(connectionString);
  const adapter = new PrismaPg({
    connectionString: config.connectionString,
    max: 5,
    connectionTimeoutMillis: 5_000,
  }, { schema: config.schema });
  const client = new PrismaClient({ adapter });

  /** Инициализирует клиент перед использованием приложения. */
  async function onModuleInit(): Promise<void> {
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
    } catch (error) {
      await client.$disconnect();
      throw error;
    }
  }

  /** Завершает работу ресурса при закрытии приложения. */
  async function onModuleDestroy(): Promise<void> {
    await client.$disconnect();
  }

  return { client, onModuleInit, onModuleDestroy };
}
