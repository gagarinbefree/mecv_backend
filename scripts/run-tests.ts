import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { readTestDatabaseConfig } from '../src/database/database-config.ts';
import { startTestPostgres } from './test-postgres.ts';

await runTests();

/** Запускает полный набор Vitest и всегда освобождает собственный кластер CI. */
async function runTests(): Promise<void> {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['.env.test', '.env']) {
    const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
    if (existsSync(path)) loadEnvFile(path);
  }
  const postgres = process.env['GITHUB_ACTIONS'] === 'true' && process.platform === 'linux'
    ? await startTestPostgres() : undefined;
  try {
    const config = readTestDatabaseConfig(
      postgres?.connectionString ?? process.env['TEST_DATABASE_URL'], process.env['DATABASE_URL'],
    );
    const result = spawnSync(process.execPath, [
      'node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2),
    ], {
      cwd: root,
      env: { ...process.env, TEST_DATABASE_URL: config.connectionString },
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    await postgres?.close();
  }
}
