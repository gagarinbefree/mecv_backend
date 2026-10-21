import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';

type ModuleImport = NonNullable<DynamicModule['imports']>[number];
type ModuleExtras = Readonly<{
  providers: readonly Provider[];
  imports: readonly ModuleImport[];
}>;

/**
 * Собирает модуль NestJS из явно переданных провайдеров приложения.
 * @param providers - Провайдеры, принадлежащие этому приложению.
 * @param imports - Модули, необходимые этим провайдерам.
 * @returns Динамический модуль для создания контекста приложения NestJS.
 */
export function createApplicationModule(
  providers: readonly Provider[],
  imports: readonly ModuleImport[] = [],
): DynamicModule {
  const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<
    Readonly<{ name: string }>
  >({ moduleName: 'Mecv' })
    .setExtras<ModuleExtras>({ providers: [], imports: [] }, appendComposition)
    .build();

  return ConfigurableModuleClass.register({ name: 'Mecv', providers, imports });
}

/**
 * Добавляет провайдеры и импорты приложения, сохраняя настройки, созданные NestJS.
 * @param definition - Определение динамического модуля, созданное NestJS.
 * @param extras - Провайдеры и импорты для этого экземпляра приложения.
 * @returns Определение модуля с зависимостями фреймворка и приложения.
 */
function appendComposition(
  definition: DynamicModule,
  extras: ModuleExtras,
): DynamicModule {
  return {
    ...definition,
    providers: [...(definition.providers ?? []), ...extras.providers],
    imports: [...(definition.imports ?? []), ...extras.imports],
  };
}
