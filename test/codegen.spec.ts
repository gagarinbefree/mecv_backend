import { readFileSync } from 'node:fs';
import { generate } from '@graphql-codegen/cli';
import { expect, it } from 'vitest';
import config from '../codegen.js';

it('rejects a new scalar without an explicit TypeScript mapping', rejectsUnmappedScalar);

/**
 * Проверяет остановку генерации при добавлении скаляра без согласованного TypeScript-типа.
 * @returns Промис, завершающийся после проверки ошибки без записи сгенерированных файлов.
 */
async function rejectsUnmappedScalar(): Promise<void> {
  const schema = readFileSync(new URL('../src/profile/profile.graphql', import.meta.url), 'utf8');

  await expect(generate({
    ...config,
    silent: true,
    schema: `${schema}\nscalar Unmapped\nextend type Query { unmapped: Unmapped }`,
  }, false)).rejects.toThrow(/Unknown scalar type Unmapped/);
}
