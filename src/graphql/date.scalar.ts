import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';
import type { ValueNode } from 'graphql';

export const dateScalar = new GraphQLScalarType<string, string>({
  name: 'Date',
  description: 'Календарная дата YYYY-MM-DD, годы 0001–9999, без времени и часового пояса.',
  serialize: validateDate,
  parseValue: validateDate,
  parseLiteral: parseDateLiteral,
});

/**
 * Проверяет формат и существование даты по григорианскому календарю без преобразования времени.
 * @param value - Неизвестное значение переменной или результата резолвера.
 * @returns Исходная строка корректной календарной даты.
 * @throws {GraphQLError} Если тип, формат или календарная дата недопустимы.
 */
function validateDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new GraphQLError('Date должен быть строкой в формате YYYY-MM-DD.');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];

  if (year === 0 || maximumDay === undefined || day < 1 || day > maximumDay) {
    throw new GraphQLError('Date должен содержать существующую дату с годом от 0001 до 9999.');
  }

  return value;
}

/**
 * Разбирает строковый литерал даты из GraphQL-документа.
 * @param node - Узел литерала, переданный GraphQL.
 * @returns Проверенная календарная дата.
 * @throws {GraphQLError} Если литерал не является строкой или содержит неверную дату.
 */
function parseDateLiteral(node: ValueNode): string {
  if (node.kind !== Kind.STRING) {
    throw new GraphQLError('Date принимает только строковые литералы.', { nodes: node });
  }

  return validateDate(node.value);
}
