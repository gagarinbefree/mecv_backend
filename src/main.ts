import { createApplication } from './bootstrap/create-application.js';
import { readDemoProfile } from './profile/demo-profile.js';

const application = await createApplication(readDemoProfile);
application.enableShutdownHooks(['SIGINT', 'SIGTERM']);

try {
  await application.listen(3000, '127.0.0.1');
  console.log(`GraphQL и Apollo Sandbox: ${await application.getUrl()}/graphql`);
} catch (error: unknown) {
  await application.close();
  throw error;
}
