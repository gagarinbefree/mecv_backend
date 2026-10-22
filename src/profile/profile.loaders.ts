import DataLoader from 'dataloader';
import type { ExperienceRecord, ProfileLinkRecord, ProfileRepository, ProjectRecord, SkillRecord } from './profile.repository.js';

export type ProfileLoaders = Readonly<{
  links: DataLoader<string, readonly ProfileLinkRecord[]>;
  skills: DataLoader<string, readonly SkillRecord[]>;
  experience: DataLoader<string, readonly ExperienceRecord[]>;
  projects: DataLoader<string, readonly ProjectRecord[]>;
}>;

/**
 * Создаёт независимый кэш и пакетные загрузчики для одного GraphQL-запроса.
 * @param repository - Общий репозиторий приложения с пакетными методами чтения.
 * @returns Новый набор загрузчиков без общего кэша между запросами.
 */
export function createProfileLoaders(repository: ProfileRepository): ProfileLoaders {
  return {
    links: new DataLoader(repository.findLinks), skills: new DataLoader(repository.findSkills),
    experience: new DataLoader(repository.findExperience), projects: new DataLoader(repository.findProjects),
  };
}
