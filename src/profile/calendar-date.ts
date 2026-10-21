/**
 * Проверяет строку YYYY-MM-DD по григорианскому календарю без преобразования часового пояса.
 * @param value - Проверяемая календарная дата.
 * @returns Признак существующей даты с годом от 0001 до 9999.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];
  return year !== 0 && maximumDay !== undefined && day >= 1 && day <= maximumDay;
}
