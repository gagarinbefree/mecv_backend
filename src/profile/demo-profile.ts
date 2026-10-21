import type { Profile } from '../generated/graphql.js';

export const demoProfile: Profile = {
  name: 'Демонстрационный специалист',
  description: 'Учебный профиль бэкенд-разработчика. Все сведения об опыте и достижениях демонстрационные.',
  links: [
    { label: 'GitHub проекта', url: 'https://github.com/gagarinbefree/mecv_backend' },
  ],
  skills: [
    { name: 'TypeScript' }, { name: 'Node.js' }, { name: 'NestJS' },
    { name: 'GraphQL' }, { name: 'Prisma' }, { name: 'PostgreSQL' },
  ],
  experience: [
    {
      company: 'Демонстрационная компания',
      position: 'Бэкенд-разработчик (учебный пример)',
      startDate: '2024-02-29',
      endDate: null,
      achievements: ['Разработал учебный GraphQL API', 'Настроил автоматические тесты и сборку'],
    },
  ],
  projects: [
    {
      name: 'MECV — цифровая визитка',
      description: 'Учебный бэкенд на NestJS с функциональными резолверами GraphQL.',
      url: 'https://github.com/gagarinbefree/mecv_backend',
    },
  ],
};

/**
 * Читает демонстрационный профиль для запуска API до подключения базы данных.
 * @returns Промис с явно обозначенными учебными данными.
 */
export function readDemoProfile(): Promise<Profile | null> {
  return Promise.resolve(demoProfile);
}
