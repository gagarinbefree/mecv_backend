import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('mandatory code policy', defineLintPolicyTests);

/**
 * Registers negative cases that must be rejected by the real ESLint config.
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
 * Checks a deliberate policy violation using a real typed project file.
 * @param source - Deliberately invalid TypeScript supplied only to the linter.
 * @param ruleId - Rule that must identify the violation.
 * @param filePath - Existing project file that selects the appropriate config.
 * @returns Completion after the expected diagnostic has been found.
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
 * Verifies that a written any cannot bypass strict compiler settings.
 * @returns Completion after the linter identifies the unsafe type.
 */
async function rejectsAny(): Promise<void> {
  await expectViolation(
    'export const prohibited: any = 1;',
    '@typescript-eslint/no-explicit-any',
  );
}

/**
 * Verifies that named classes have no framework exception.
 * @returns Completion after the declaration is rejected.
 */
async function rejectsClassDeclarations(): Promise<void> {
  await expectViolation('export class Prohibited {}', 'no-restricted-syntax');
}

/**
 * Verifies that anonymous class expressions cannot bypass the policy.
 * @returns Completion after the expression is rejected.
 */
async function rejectsClassExpressions(): Promise<void> {
  await expectViolation(
    'export const prohibited = class {};',
    'no-restricted-syntax',
  );
}

/**
 * Verifies that declared functions need a documentation comment.
 * @returns Completion after the missing documentation is reported.
 */
async function rejectsUndocumentedDeclarations(): Promise<void> {
  await expectViolation(
    'export function prohibited(): number { return 1; }',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Verifies that arrow functions need a documentation comment.
 * @returns Completion after the missing documentation is reported.
 */
async function rejectsUndocumentedArrows(): Promise<void> {
  await expectViolation(
    'export const prohibited = (): number => 1;',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Verifies that function expressions need a documentation comment.
 * @returns Completion after the missing documentation is reported.
 */
async function rejectsUndocumentedExpressions(): Promise<void> {
  await expectViolation(
    'export const prohibited = function (): number { return 1; };',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Verifies that inline callbacks are covered even when they are not exported.
 * @returns Completion after the undocumented callback has been reported.
 */
async function rejectsUndocumentedCallbacks(): Promise<void> {
  await expectViolation(
    'export const result = [1].map((value: number): number => value * 2);',
    'jsdoc/require-jsdoc',
  );
}

/**
 * Verifies that JavaScript tooling cannot introduce application classes.
 * @returns Completion after the script class has been rejected.
 */
async function rejectsScriptClasses(): Promise<void> {
  await expectViolation(
    'export class Prohibited {}',
    'no-restricted-syntax',
    'eslint.config.mjs',
  );
}

/**
 * Verifies that JavaScript tooling functions also require documentation.
 * @returns Completion after the undocumented script function has been reported.
 */
async function rejectsUndocumentedScriptFunctions(): Promise<void> {
  await expectViolation(
    'export const prohibited = () => 1;',
    'jsdoc/require-jsdoc',
    'eslint.config.mjs',
  );
}
