import { copyFile } from 'node:fs/promises';
import { URL } from 'node:url';

await copyFile(
  new URL('../src/profile/profile.graphql', import.meta.url),
  new URL('../dist/profile/profile.graphql', import.meta.url),
);
