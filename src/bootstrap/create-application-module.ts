import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';

type ProviderExtras = Readonly<{ providers: readonly Provider[] }>;

/**
 * Composes the application providers into a NestJS module.
 * @param providers - Explicit providers owned by this application.
 * @returns A dynamic module accepted by the Nest application factory.
 */
export function createApplicationModule(
  providers: readonly Provider[],
): DynamicModule {
  const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<
    Readonly<{ name: string }>
  >({ moduleName: 'Mecv' })
    .setExtras<ProviderExtras>({ providers: [] }, appendProviders)
    .build();

  return ConfigurableModuleClass.register({ name: 'Mecv', providers });
}

/**
 * Adds functional providers while preserving the builder's options provider.
 * @param definition - Dynamic module generated internally by NestJS.
 * @param extras - Explicit providers for this application instance.
 * @returns A module definition containing both framework and application providers.
 */
function appendProviders(
  definition: DynamicModule,
  extras: ProviderExtras,
): DynamicModule {
  return {
    ...definition,
    providers: [...(definition.providers ?? []), ...extras.providers],
  };
}
