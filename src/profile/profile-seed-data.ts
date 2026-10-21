export type ProfileSeedData = Readonly<{
  name: string;
  description: string;
  links: readonly Readonly<{ key: string; label: string; url: string }>[];
  skills: readonly Readonly<{ key: string; name: string }>[];
  experience: readonly Readonly<{
    key: string;
    company: string;
    position: string;
    startDate: string;
    endDate: string | null;
    achievements: readonly string[];
  }>[];
  projects: readonly Readonly<{ key: string; name: string; description: string; url: string }>[];
}>;

export const demoProfileSlug = 'demo-profile';

export const demoProfileSeedData: ProfileSeedData = {
  name: 'Демонстрационный специалист',
  description: 'Учебный профиль бэкенд-разработчика. Все сведения об опыте и достижениях демонстрационные.',
  links: [
    { key: 'github-project', label: 'GitHub проекта', url: 'https://github.com/gagarinbefree/mecv_backend' },
  ],
  skills: [
    { key: 'typescript', name: 'TypeScript' }, { key: 'node-js', name: 'Node.js' },
    { key: 'nestjs', name: 'NestJS' }, { key: 'graphql', name: 'GraphQL' },
    { key: 'prisma', name: 'Prisma' }, { key: 'postgresql', name: 'PostgreSQL' },
  ],
  experience: [
    {
      key: 'demo-backend',
      company: 'Демонстрационная компания',
      position: 'Бэкенд-разработчик (учебный пример)',
      startDate: '2024-02-29',
      endDate: null,
      achievements: ['Разработал учебный GraphQL API', 'Настроил автоматические тесты и сборку'],
    },
  ],
  projects: [
    {
      key: 'mecv',
      name: 'MECV — цифровая визитка',
      description: 'Учебный бэкенд на NestJS с функциональными резолверами GraphQL.',
      url: 'https://github.com/gagarinbefree/mecv_backend',
    },
  ],
};
