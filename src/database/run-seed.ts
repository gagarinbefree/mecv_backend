import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './create-database.js';
import { readDatabaseConfig } from './database-config.js';
import { seedDemoProfile } from './seed-demo-profile.js';

try {
  await runSeed();
} catch {
  console.error('Не удалось заполнить демопрофиль. Проверь подключение, применённые миграции и ограничения PostgreSQL.');
  process.exitCode = 1;
}

/** Загружает локальную конфигурацию, заполняет демопрофиль и освобождает пул при любом результате. */
async function runSeed(): Promise<void> {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (existsSync(envPath)) loadEnvFile(envPath);
  const config = readDatabaseConfig(process.env['DATABASE_URL']);
  const database = createDatabase(config.connectionString);
  try {
    await database.onModuleInit();
    await seedDemoProfile(database.client);
    console.info('Демонстрационный профиль сохранён.');
  } finally {
    await database.onModuleDestroy();
  }
}
