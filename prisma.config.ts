import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const url = process.env['DATABASE_URL'];
const shadowDatabaseUrl = process.env['SHADOW_DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url === undefined ? {} : {
    datasource: {
      url,
      ...(shadowDatabaseUrl === undefined ? {} : { shadowDatabaseUrl }),
    },
  }),
});
