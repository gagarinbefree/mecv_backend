import type { Profile } from '../generated/graphql.js';

/** Асинхронный источник профиля; отсутствие данных представляется null. */
export type ReadProfile = () => Promise<Profile | null>;
