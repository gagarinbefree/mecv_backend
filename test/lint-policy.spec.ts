import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('mandatory code policy', defineLintPolicyTests);

/**
 * Регистрирует негативные проверки обязательных правил ESLint.
 */
function defineLintPolicyTests(): void {
  it('rejects explicit any', rejectsAny);
  it('rejects class declarations', rejectsClassDeclarations);
  it('rejects class expressions', rejectsClassExpressions);
  it('requires JSDoc for declarations', rejectsUndocumentedDeclarations);
  it('requires JSDoc for arrow functions', rejectsUndocumentedArrows);
  it('requires JSDoc for function expressions', rejectsUndocumentedExpressions);
  it('requires JSDoc for inline callbacks', rejectsUndocumentedCallbacks);
  it('enforces the functional policy in tooling scripts', rejectsScriptClasses);
  it('requires JSDoc in tooling scripts', rejectsUndocumentedScriptFunctions);
}

/**
 * Проверяет нарушение правил через действующую конфигурацию ESLint.
 * @param source - Заведомо некорректный код TypeScript, передаваемый только линтеру.
 * @param ruleId - Идентификатор правила, которое должно обнаружить нарушение.
 * @param filePath - Путь существующего файла проекта для выбора конфигурации.
 * @returns Промис, завершающийся после проверки ожидаемого сообщения об ошибке.
 */
async function expectViolation(
  source: string,
  ruleId: string,
  filePath = 'src/bootstrap/create-application-module.ts',
): Promise<void> {
  const linter = new ESLint();
  const results = await linter.lintText(source, {
    filePath,
  });

  expect(results).toHaveLength(1);
  expect(results[0]?.messages).toEqual(
    expect.arrayContaining([expect.objectContaining({ ruleId, severity: 2 })]),
  );
}

/**
 * Проверяет, что явно указанный any отклоняется в дополнение к проверкам компилятора.
 * @returns Промис, завершающийся после обнаружения запрещённого типа линтером.
 */
async function rejectsAny(): Promise<void> {
  await expectViolation(
    'export const prohibited: any = 1;',
    '@typescript-eslint/no-explicit-any',
  );
}

/**
 * Проверяет запрет объявлений классов без исключений для фреймворка.
 * @returns Промис, завершающийся после проверки отклонённого объявления класса.
 */
async function rejectsClassDeclarations(): Promise<void> {
  await expectViolation('export class Prohibited {}', 'no-restricted-syntax');
}

/**
 * Проверяет, что выражение анонимного класса не позволяет обойти запрет классов.
 * @returns Промис, завершающийся после проверки отклонённого выражения класса.
 */
async function rejectsClassExpressions(): Promise<void> {
  await expectViolation(
    'export const prohibited = class {};',
    'no-restricted-syntax',
  );
}

/**
 * Проверяет обязательность JSDoc для объявлений функций.
 * @returns Промис, завершающийся после обнаружения отсутствующего комментария.
 */
async function rejectsUndocumentedDeclarations(): Promise<void> {
  await expectViolation(
    'export function prohibited(): number { return 1; }',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Проверяет обязательность JSDoc для стрелочных функций.
 * @returns Промис, завершающийся после обнаружения отсутствующего комментария.
 */
async function rejectsUndocumentedArrows(): Promise<void> {
  await expectViolation(
    'export const prohibited = (): number => 1;',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Проверяет обязательность JSDoc для функциональных выражений.
 * @returns Промис, завершающийся после обнаружения отсутствующего комментария.
 */
async function rejectsUndocumentedExpressions(): Promise<void> {
  await expectViolation(
    'export const prohibited = function (): number { return 1; };',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Проверяет обязательность JSDoc для вложенных неэкспортируемых функций обратного вызова.
 * @returns Промис, завершающийся после обнаружения функции без комментария.
 */
async function rejectsUndocumentedCallbacks(): Promise<void> {
  await expectViolation(
    'export const result = [1].map((value: number): number => value * 2);',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Проверяет запрет классов в служебных скриптах JavaScript.
 * @returns Промис, завершающийся после проверки отклонённого класса в скрипте.
 */
async function rejectsScriptClasses(): Promise<void> {
  await expectViolation(
    'export class Prohibited {}',
    'no-restricted-syntax',
    'eslint.config.mjs',
  );
}

/**
 * Проверяет обязательность JSDoc для функций в служебных скриптах JavaScript.
 * @returns Промис, завершающийся после обнаружения функции скрипта без комментария.
 */
async function rejectsUndocumentedScriptFunctions(): Promise<void> {
  await expectViolation(
    'export const prohibited = () => 1;',
    'jsdoc/require-jsdoc',
    'eslint.config.mjs',
  );
}
