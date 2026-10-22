import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);

/**
 * Применяет сохранённую историю Prisma без reset, генерации клиента и shell-интерполяции URL.
 * @param connectionString - Проверенное подключение текущего приложения.
 * @throws {Error} Если CLI или миграция завершились с ошибкой либо превысили ограничение времени.
 */
export async function deployMigrations(connectionString: string): Promise<void> {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const prismaDirectory = dirname(createRequire(import.meta.url).resolve('prisma/package.json'));
  await executeFile(process.execPath, [
    join(prismaDirectory, 'build', 'index.js'), 'migrate', 'deploy', '--config', join(root, 'prisma.config.ts'),
  ], {
    cwd: root, env: { ...process.env, DATABASE_URL: connectionString }, timeout: 60_000,
  });
}
