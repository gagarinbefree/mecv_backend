import type { ProfileSeedData } from './profile-seed-data.js';
import { isCalendarDate } from './calendar-date.js';

/**
 * Проверяет полный набор данных до начала транзакции заполнения профиля.
 * @param data - Типизированные исходные данные демонстрационного профиля.
 * @throws {Error} Если обязательные поля, ссылки, ключи или периоды некорректны.
 */
export function validateProfileSeed(data: ProfileSeedData): void {
  requireText(data.name, 'name');
  requireText(data.description, 'description');
  validateKeys(data.links, 'links');
  validateKeys(data.skills, 'skills');
  validateKeys(data.experience, 'experience');
  validateKeys(data.projects, 'projects');
  for (const link of data.links) {
    requireText(link.label, 'links.label');
    validateUrl(link.url, 'links.url');
  }
  for (const skill of data.skills) requireText(skill.name, 'skills.name');
  for (const experience of data.experience) {
    requireText(experience.company, 'experience.company');
    requireText(experience.position, 'experience.position');
    if (!isCalendarDate(experience.startDate)
      || (experience.endDate !== null && !isCalendarDate(experience.endDate))) {
      throw new Error('Период работы должен содержать существующие даты YYYY-MM-DD, годы 0001–9999.');
    }
    if (experience.endDate !== null && experience.endDate < experience.startDate) {
      throw new Error('Дата завершения работы не может предшествовать дате начала.');
    }
    for (const achievement of experience.achievements) requireText(achievement, 'experience.achievements');
  }
  for (const project of data.projects) {
    requireText(project.name, 'projects.name');
    requireText(project.description, 'projects.description');
    validateUrl(project.url, 'projects.url');
  }
}

/**
 * Проверяет наличие содержательного текста без изменения исходных данных.
 * @param value - Проверяемая строка.
 * @param field - Имя поля для диагностического сообщения.
 */
function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`Поле ${field} не должно быть пустым.`);
}

/**
 * Проверяет абсолютную профессиональную HTTP-ссылку, не раскрывая её содержимое в ошибке.
 * @param value - Проверяемый URL.
 * @param field - Имя поля для диагностического сообщения.
 */
function validateUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Поле ${field} должно содержать абсолютный HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`Поле ${field} должно содержать HTTP(S) URL без учётных данных.`);
  }
}

/**
 * Проверяет формат стабильных ключей и их уникальность внутри одной коллекции.
 * @param items - Проверяемая коллекция с ключами.
 * @param field - Название раздела для диагностического сообщения.
 */
function validateKeys(items: readonly Readonly<{ key: string }>[], field: string): void {
  const keys = items.map(readKey);
  if (new Set(keys).size !== keys.length) throw new Error(`Ключи ${field} должны быть уникальными.`);
  for (const key of keys) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
      throw new Error(`Ключи ${field} должны состоять из строчных латинских букв, цифр и одиночных дефисов.`);
    }
  }
}

/**
 * Извлекает ключ элемента без изменения исходной коллекции.
 * @param item - Элемент проверяемого раздела.
 * @returns Стабильный ключ элемента.
 */
function readKey(item: Readonly<{ key: string }>): string {
  return item.key;
}
