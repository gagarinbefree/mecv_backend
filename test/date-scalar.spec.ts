import { GraphQLError, parseValue } from 'graphql';
import { describe, expect, it } from 'vitest';
import { dateScalar } from '../src/graphql/date.scalar.js';

const validDates = ['0001-01-01', '0004-02-29', '2000-02-29', '2024-02-29', '2026-10-21', '9999-12-31'];
const invalidDates = [
  null, undefined, true, 20261021, new Date('2026-10-21'), '',
  '0000-01-01', '0100-02-29', '1900-02-29', '2025-02-29',
  '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32', '2026-04-31',
  '2026-1-01', '2026-10-1', ' 2026-10-21', '2026-10-21 ',
  '2026-10-21T00:00:00Z', '2026-10-21+05:00',
];

describe('calendar Date scalar', defineDateTests);

/** Регистрирует проверки календарных дат на входе и выходе GraphQL. */
function defineDateTests(): void {
  it.each(validDates)('preserves the calendar date %s', acceptsCalendarDate);
  it.each(invalidDates)('rejects the invalid date %s', rejectsInvalidDate);
  it('accepts a string literal', acceptsStringLiteral);
  it('rejects non-string literals', rejectsOtherLiterals);
  it('rejects an impossible date literal', rejectsImpossibleLiteral);
}

/**
 * Проверяет неизменность строки при вводе переменной и сериализации результата.
 * @param value - Корректная дата с учётом високосных годов.
 */
function acceptsCalendarDate(value: string): void {
  expect(dateScalar.parseValue(value)).toBe(value);
  expect(dateScalar.serialize(value)).toBe(value);
}

/**
 * Проверяет отклонение неверного типа, формата и несуществующей календарной даты.
 * @param value - Неизвестное значение на границе GraphQL.
 */
function rejectsInvalidDate(value: unknown): void {
  expect(dateScalar.parseValue.bind(dateScalar, value)).toThrow(GraphQLError);
  expect(dateScalar.serialize.bind(dateScalar, value)).toThrow(GraphQLError);
}

/** Проверяет разбор строкового литерала без преобразования часового пояса. */
function acceptsStringLiteral(): void {
  expect(dateScalar.parseLiteral(parseValue('"2024-02-29"'))).toBe('2024-02-29');
}

/** Проверяет запрет чисел, логических значений и объектов в литералах дат. */
function rejectsOtherLiterals(): void {
  for (const source of ['20261021', 'true', '{}', '[]']) {
    expect(dateScalar.parseLiteral.bind(dateScalar, parseValue(source))).toThrow(GraphQLError);
  }
}

/** Проверяет календарную валидацию строкового литерала. */
function rejectsImpossibleLiteral(): void {
  expect(dateScalar.parseLiteral.bind(dateScalar, parseValue('"2025-02-29"'))).toThrow(GraphQLError);
}
