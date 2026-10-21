import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { readTestDatabaseConfig } from '../../src/database/database-config.js';

const executeFile = promisify(execFile);

export type TestDatabase = Readonly<{
  connectionString: string;
  sql: pg.Client;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}>;

/**
 * Создаёт отдельную схему внутри разрешённой тестовой базы, не затрагивая соседние данные.
 * @returns Подключение, применение миграций и очистка только созданной схемы.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  for (const name of ['.env.test', '.env']) {
    const path = fileURLToPath(new URL(`../../${name}`, import.meta.url));
    if (existsSync(path)) loadEnvFile(path);
  }
  const config = readTestDatabaseConfig(
    process.env['TEST_DATABASE_URL'], process.env['DATABASE_URL'],
  );
  const schema = `mecv_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(config.connectionString);
  url.searchParams.set('schema', schema);
  const connectionString = url.toString();
  const sql = new pg.Client({ connectionString, connectionTimeoutMillis: 5_000 });
  await sql.connect();
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query('SELECT set_config(\'search_path\', $1, false)', [schema]);
  } catch (error) {
    await sql.end();
    throw error;
  }

  /** Применяет настоящую историю Prisma к изолированной пустой схеме. */
  async function migrate(): Promise<void> {
    await executeFile(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: { ...process.env, DATABASE_URL: connectionString },
      timeout: 45_000,
    });
  }

  /** Удаляет исключительно схему этой фикстуры и освобождает соединение. */
  async function close(): Promise<void> {
    try {
      readTestDatabaseConfig(connectionString, process.env['DATABASE_URL']);
      if (!/^mecv_test_[a-f0-9]{32}$/.test(schema)) {
        throw new Error('Очистка неизвестной тестовой схемы запрещена.');
      }
      await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await sql.end();
    }
  }

  return { connectionString, sql, migrate, close };
}
