import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { demoProfileSeedData, demoProfileSlug, type ProfileSeedData } from '../profile/profile-seed-data.js';
import { validateProfileSeed } from '../profile/validate-profile-seed.js';

/**
 * Синхронизирует управляемый демонстрационный профиль с переданными данными.
 * @param client - Клиент Prisma, принадлежащий вызывающему приложению.
 * @param data - Полное актуальное содержимое демонстрационного профиля.
 */
export async function seedDemoProfile(
  client: PrismaClient,
  data: ProfileSeedData = demoProfileSeedData,
): Promise<void> {
  validateProfileSeed(data);
  await client.$transaction(writeProfile);

  /**
   * Выполняет все записи через один транзакционный клиент для полного отката при сбое.
   * @param transaction - Клиент текущей транзакции Prisma.
   */
  async function writeProfile(transaction: Prisma.TransactionClient): Promise<void> {
    await synchronizeProfile(transaction, data);
  }
}

/**
 * Обновляет профиль и синхронизирует его коллекции по стабильным ключам.
 * @param client - Клиент записи, переданный владельцем транзакции.
 * @param data - Полное содержимое управляемого профиля.
 */
async function synchronizeProfile(client: Prisma.TransactionClient, data: ProfileSeedData): Promise<void> {
  const profile = await client.profile.upsert({
    where: { slug: demoProfileSlug },
    create: { slug: demoProfileSlug, name: data.name, description: data.description },
    update: { name: data.name, description: data.description },
  });
  const profileId = profile.id;
  await client.profileLink.deleteMany({ where: { profileId, key: { notIn: data.links.map(readKey) } } });
  for (const record of data.links.map(toLinkRecord)) {
    await client.profileLink.upsert({
      where: { profileId_key: { profileId, key: record.key } },
      create: { ...record, profileId }, update: record,
    });
  }
  await client.skill.deleteMany({ where: { profileId, key: { notIn: data.skills.map(readKey) } } });
  for (const record of data.skills.map(toSkillRecord)) {
    await client.skill.upsert({
      where: { profileId_key: { profileId, key: record.key } },
      create: { ...record, profileId }, update: record,
    });
  }
  await client.experience.deleteMany({ where: { profileId, key: { notIn: data.experience.map(readKey) } } });
  for (const record of data.experience.map(toExperienceRecord)) {
    await client.experience.upsert({
      where: { profileId_key: { profileId, key: record.key } },
      create: { ...record, profileId }, update: record,
    });
  }
  await client.project.deleteMany({ where: { profileId, key: { notIn: data.projects.map(readKey) } } });
  for (const record of data.projects.map(toProjectRecord)) {
    await client.project.upsert({
      where: { profileId_key: { profileId, key: record.key } },
      create: { ...record, profileId }, update: record,
    });
  }
}

/**
 * Извлекает стабильный ключ для удаления только устаревших записей коллекции.
 * @param value - Элемент с проверенным ключом.
 * @returns Ключ элемента во входных данных.
 */
function readKey(value: Readonly<{ key: string }>): string {
  return value.key;
}

/**
 * Добавляет явную позицию профессиональной ссылки для записи в БД.
 * @param value - Проверенная ссылка со стабильным ключом.
 * @param sortOrder - Позиция во входном списке.
 * @returns Данные ссылки без идентификатора владельца.
 */
function toLinkRecord(
  value: ProfileSeedData['links'][number], sortOrder: number,
): Prisma.ProfileLinkCreateWithoutProfileInput {
  return { ...value, sortOrder };
}

/**
 * Добавляет явную позицию навыка для записи в БД.
 * @param value - Проверенный навык со стабильным ключом.
 * @param sortOrder - Позиция во входном списке.
 * @returns Данные навыка без идентификатора владельца.
 */
function toSkillRecord(
  value: ProfileSeedData['skills'][number], sortOrder: number,
): Prisma.SkillCreateWithoutProfileInput {
  return { ...value, sortOrder };
}

/**
 * Преобразует календарные даты в UTC и копирует достижения для Prisma без изменения входа.
 * @param value - Проверенные сведения об опыте работы.
 * @param sortOrder - Позиция во входном списке.
 * @returns Данные опыта без идентификатора владельца.
 */
function toExperienceRecord(
  value: ProfileSeedData['experience'][number], sortOrder: number,
): Prisma.ExperienceCreateWithoutProfileInput {
  return {
    ...value, sortOrder,
    startDate: new Date(`${value.startDate}T00:00:00.000Z`),
    endDate: value.endDate === null ? null : new Date(`${value.endDate}T00:00:00.000Z`),
    achievements: [...value.achievements],
  };
}

/**
 * Добавляет явную позицию проекта для записи в БД.
 * @param value - Проверенное описание проекта со стабильным ключом.
 * @param sortOrder - Позиция во входном списке.
 * @returns Данные проекта без идентификатора владельца.
 */
function toProjectRecord(
  value: ProfileSeedData['projects'][number], sortOrder: number,
): Prisma.ProjectCreateWithoutProfileInput {
  return { ...value, sortOrder };
}
