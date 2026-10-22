import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDatabaseApplication } from './bootstrap/create-application.js';
import { readDatabaseConfig } from './database/database-config.js';
import { readServerConfig } from './bootstrap/server-config.js';

try {
  await runApplication();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Не удалось запустить приложение.');
  process.exitCode = 1;
}

/** Загружает конфигурацию и запускает HTTP только после успешной подготовки базы данных. */
async function runApplication(): Promise<void> {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(envPath)) loadEnvFile(envPath);
  const databaseConfig = readDatabaseConfig(process.env['DATABASE_URL']);
  const serverConfig = readServerConfig(process.env['PORT'], process.env['HOST']);
  const application = await createDatabaseApplication(databaseConfig.connectionString);
  application.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    await application.listen(serverConfig.port, serverConfig.host);
    console.log(`GraphQL и Apollo Sandbox: ${await application.getUrl()}/graphql`);
  } catch (error: unknown) {
    await application.close();
    throw error;
  }
}
