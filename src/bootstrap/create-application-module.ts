import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';

type ProviderExtras = Readonly<{ providers: readonly Provider[] }>;

/**
 * Собирает модуль NestJS из явно переданных провайдеров приложения.
 * @param providers - Провайдеры, принадлежащие этому приложению.
 * @returns Динамический модуль для создания контекста приложения NestJS.
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
 * Добавляет провайдеры приложения, сохраняя провайдер настроек, созданный NestJS.
 * @param definition - Определение динамического модуля, созданное NestJS.
 * @param extras - Провайдеры для этого экземпляра приложения.
 * @returns Определение модуля с провайдерами фреймворка и приложения.
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
