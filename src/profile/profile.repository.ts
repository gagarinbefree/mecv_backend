export type ProfileRecord = Readonly<{ id: string; name: string; description: string }>;
export type ProfileLinkRecord = Readonly<{ profileId: string; label: string; url: string }>;
export type SkillRecord = Readonly<{ profileId: string; name: string }>;
export type ExperienceRecord = Readonly<{
  profileId: string; company: string; position: string;
  startDate: string; endDate: string | null; achievements: readonly string[];
}>;
export type ProjectRecord = Readonly<{
  profileId: string; name: string; description: string | null; url: string;
}>;

export type BatchRead<T> = (profileIds: readonly string[]) => Promise<readonly (readonly T[])[]>;

export type ProfileRepository = Readonly<{
  findProfile: (slug: string) => Promise<ProfileRecord | null>;
  findLinks: BatchRead<ProfileLinkRecord>;
  findSkills: BatchRead<SkillRecord>;
  findExperience: BatchRead<ExperienceRecord>;
  findProjects: BatchRead<ProjectRecord>;
}>;
