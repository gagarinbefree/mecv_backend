import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';

const executeFile = promisify(execFile);

export type TestPostgres = Readonly<{
  connectionString: string;
  close: () => Promise<void>;
}>;

/**
 * Запускает принадлежащий тестам временный кластер из PostgreSQL, установленной на Linux runner.
 * @returns URL отдельной базы и остановка только созданного кластера.
 */
export async function startTestPostgres(): Promise<TestPostgres> {
  const binaries = (await executeFile('pg_config', ['--bindir'])).stdout.trim();
  const directory = await mkdtemp(join(tmpdir(), 'mecv-postgres-'));
  const data = join(directory, 'data');
  const passwordFile = join(directory, 'password');
  const password = randomBytes(24).toString('hex');

  /** Останавливает собственный сервер перед удалением его временных файлов. */
  async function close(): Promise<void> {
    if (existsSync(join(data, 'postmaster.pid'))) {
      await executeFile(join(binaries, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { timeout: 30_000 });
    }
    await rm(directory, { recursive: true, force: true });
  }

  try {
    const port = await findAvailablePort();
    const url = new URL(`postgresql://127.0.0.1:${port.toString()}/postgres`);
    url.username = 'mecv_test';
    url.password = password;
    await writeFile(passwordFile, password, { mode: 0o600 });
    await executeFile(join(binaries, 'initdb'), [
      '-D', data, '-U', 'mecv_test', '--auth=scram-sha-256',
      '--pwfile', passwordFile, '--no-locale', '--encoding=UTF8',
    ], { timeout: 30_000 });
    await executeFile(join(binaries, 'pg_ctl'), [
      '-D', data, '-l', join(directory, 'postgres.log'),
      '-o', `-h 127.0.0.1 -p ${port.toString()} -k "${directory}" -F`, '-w', 'start',
    ], { timeout: 30_000 });
    const administrator = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
    try {
      await administrator.connect();
      await administrator.query('CREATE DATABASE mecv_test');
    } finally {
      await administrator.end();
    }
    url.pathname = '/mecv_test';
    return { connectionString: url.toString(), close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Находит свободный TCP-порт для временного сервера PostgreSQL.
 * @returns Номер порта, выделенный операционной системой.
 */
async function findAvailablePort(): Promise<number> {
  const server = createServer();
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Не удалось выделить TCP-порт для PostgreSQL.');
    }
    return address.port;
  } finally {
    await promisify(server.close.bind(server))();
  }
}
