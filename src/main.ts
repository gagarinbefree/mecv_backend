import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDatabaseApplication } from './bootstrap/create-application.js';
import { readDatabaseConfig } from './database/database-config.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) loadEnvFile(envPath);
const config = readDatabaseConfig(process.env['DATABASE_URL']);
const application = await createDatabaseApplication(config.connectionString);
application.enableShutdownHooks(['SIGINT', 'SIGTERM']);

try {
  await application.listen(3000, '127.0.0.1');
  console.log(`GraphQL и Apollo Sandbox: ${await application.getUrl()}/graphql`);
} catch (error: unknown) {
  await application.close();
  throw error;
}
