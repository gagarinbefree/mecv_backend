import { describe, expect, it } from 'vitest';
import { demoProfileSeedData, type ProfileSeedData } from '../src/profile/profile-seed-data.js';
import { validateProfileSeed } from '../src/profile/validate-profile-seed.js';

const invalidSeeds: readonly (readonly [string, ProfileSeedData])[] = [
  ['empty name', { ...demoProfileSeedData, name: '  ' }],
  ['empty description', { ...demoProfileSeedData, description: '' }],
  ['empty link label', withLink({ label: ' ' })],
  ['relative link URL', withLink({ url: '/github' })],
  ['non-HTTP link URL', withLink({ url: 'javascript:alert(1)' })],
  ['credentials in link URL', withLink({ url: 'https://user:secret@example.com' })],
  ['empty skill name', { ...demoProfileSeedData, skills: [{ key: 'ts', name: '\t' }] }],
  ['empty company', withExperience({ company: '' })],
  ['empty position', withExperience({ position: '' })],
  ['impossible start date', withExperience({ startDate: '2025-02-29' })],
  ['timestamp instead of date', withExperience({ startDate: '2024-02-29T00:00:00Z' })],
  ['zero year', withExperience({ startDate: '0000-01-01' })],
  ['impossible end date', withExperience({ endDate: '2026-04-31' })],
  ['reversed period', withExperience({ endDate: '2023-12-31' })],
  ['empty achievement', withExperience({ achievements: ['Valid', ' '] })],
  ['empty project name', withProject({ name: '' })],
  ['empty project description', withProject({ description: '' })],
  ['invalid project URL', withProject({ url: 'not-a-url' })],
  ['FTP project URL', withProject({ url: 'ftp://example.com' })],
  ['empty key', withLink({ key: '' })],
  ['unstable key format', withProject({ key: ' Project Key ' })],
  ['duplicate link keys', { ...demoProfileSeedData, links: [...demoProfileSeedData.links, ...demoProfileSeedData.links] }],
  ['duplicate skill keys', { ...demoProfileSeedData, skills: [...demoProfileSeedData.skills, ...demoProfileSeedData.skills] }],
  ['duplicate experience keys', { ...demoProfileSeedData, experience: [...demoProfileSeedData.experience, ...demoProfileSeedData.experience] }],
  ['duplicate project keys', { ...demoProfileSeedData, projects: [...demoProfileSeedData.projects, ...demoProfileSeedData.projects] }],
];

describe('seed input validation', defineValidationTests);

/** Регистрирует проверки обязательных полей, профессиональных ссылок, дат и стабильных ключей. */
function defineValidationTests(): void {
  it('accepts the demonstration data without changing it', acceptsDemo);
  it('accepts empty collections', acceptsEmptyCollections);
  it('allows the same key in different collections', acceptsIndependentKeys);
  it.each(invalidSeeds)('rejects %s', rejectsInvalidSeed);
}

/** Проверяет корректность исходного демопрофиля и отсутствие преобразования входа валидатором. */
function acceptsDemo(): void {
  const before = structuredClone(demoProfileSeedData);
  expect(validateProfileSeed.bind(undefined, demoProfileSeedData)).not.toThrow();
  expect(demoProfileSeedData).toEqual(before);
}

/** Проверяет допустимость пустых разделов профиля. */
function acceptsEmptyCollections(): void {
  validateProfileSeed({ ...demoProfileSeedData, links: [], skills: [], experience: [], projects: [] });
}

/** Проверяет независимую уникальность ключей в разных коллекциях. */
function acceptsIndependentKeys(): void {
  validateProfileSeed(withLink({ key: 'typescript' }));
}

/**
 * Проверяет отклонение ошибочных значений до передачи в слой базы данных.
 * @param label - Название проверяемого сценария.
 * @param data - Типизированные данные с нарушенным предметным ограничением.
 */
function rejectsInvalidSeed(label: string, data: ProfileSeedData): void {
  expect(validateProfileSeed.bind(undefined, data), label).toThrow();
}

/**
 * Создаёт отдельную ссылку с указанным нарушением для параметризованной проверки.
 * @param changes - Поля, изменяемые только в новой тестовой фикстуре.
 * @returns Профиль с одной тестовой ссылкой.
 */
function withLink(changes: Partial<ProfileSeedData['links'][number]>): ProfileSeedData {
  return { ...demoProfileSeedData, links: [{ key: 'test', label: 'Пример', url: 'https://example.com', ...changes }] };
}

/**
 * Создаёт отдельный период работы для проверки календарных и текстовых ограничений.
 * @param changes - Изменения новой записи опыта.
 * @returns Профиль с одной тестовой записью опыта.
 */
function withExperience(changes: Partial<ProfileSeedData['experience'][number]>): ProfileSeedData {
  return { ...demoProfileSeedData, experience: [{
    key: 'test', company: 'Компания', position: 'Разработчик',
    startDate: '2024-02-29', endDate: null, achievements: [], ...changes,
  }] };
}

/**
 * Создаёт отдельный проект для проверки обязательных описаний и URL.
 * @param changes - Изменения новой записи проекта.
 * @returns Профиль с одним тестовым проектом.
 */
function withProject(changes: Partial<ProfileSeedData['projects'][number]>): ProfileSeedData {
  return { ...demoProfileSeedData, projects: [{
    key: 'test', name: 'Проект', description: 'Описание', url: 'https://example.com', ...changes,
  }] };
}
