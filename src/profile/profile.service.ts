import type { ProfileRecord, ProfileRepository } from './profile.repository.js';
import { demoProfileSlug } from './profile-seed-data.js';

export type ProfileService = Readonly<{ readProfile: () => Promise<ProfileRecord | null> }>;

/**
 * Создаёт сервис публичного профиля с повторным использованием результата внутри запроса.
 * @param repository - Явно переданный источник данных профиля.
 * @returns Сервис выбранного демопрофиля, принадлежащий одному запросу.
 */
export function createProfileService(repository: ProfileRepository): ProfileService {
  let pending: Promise<ProfileRecord | null> | undefined;
  return { readProfile };

  /**
   * Читает зарезервированный демопрофиль и объединяет повторные чтения текущего запроса.
   * @returns Основные данные профиля либо null без загрузки коллекций.
   */
  function readProfile(): Promise<ProfileRecord | null> {
    pending ??= repository.findProfile(demoProfileSlug);
    return pending;
  }
}
