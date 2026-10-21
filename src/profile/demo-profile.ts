import type { Experience, ProfileLink, Profile, Project, Skill } from '../generated/graphql.js';
import { demoProfileSeedData, type ProfileSeedData } from './profile-seed-data.js';

export const demoProfile: Profile = {
  name: demoProfileSeedData.name,
  description: demoProfileSeedData.description,
  links: demoProfileSeedData.links.map(toLink),
  skills: demoProfileSeedData.skills.map(toSkill),
  experience: demoProfileSeedData.experience.map(toExperience),
  projects: demoProfileSeedData.projects.map(toProject),
};

/**
 * Читает демонстрационный профиль для запуска API до подключения базы данных.
 * @returns Промис с явно обозначенными учебными данными.
 */
export function readDemoProfile(): Promise<Profile | null> {
  return Promise.resolve(demoProfile);
}

/**
 * Выбирает публичные поля ссылки без технического ключа seed.
 * @param value - Ссылка из общих демонстрационных данных.
 * @returns Профессиональная ссылка для GraphQL.
 */
function toLink(value: ProfileSeedData['links'][number]): ProfileLink {
  return { label: value.label, url: value.url };
}

/**
 * Выбирает публичные поля навыка без технического ключа seed.
 * @param value - Навык из общих демонстрационных данных.
 * @returns Навык для GraphQL.
 */
function toSkill(value: ProfileSeedData['skills'][number]): Skill {
  return { name: value.name };
}

/**
 * Выбирает публичные поля опыта без технического ключа seed.
 * @param value - Опыт из общих демонстрационных данных.
 * @returns Сведения об опыте для GraphQL.
 */
function toExperience(value: ProfileSeedData['experience'][number]): Experience {
  return {
    company: value.company, position: value.position, startDate: value.startDate,
    endDate: value.endDate, achievements: value.achievements,
  };
}

/**
 * Выбирает публичные поля проекта без технического ключа seed.
 * @param value - Проект из общих демонстрационных данных.
 * @returns Описание проекта для GraphQL.
 */
function toProject(value: ProfileSeedData['projects'][number]): Project {
  return { name: value.name, description: value.description, url: value.url };
}
