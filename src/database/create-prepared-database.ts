import { createDatabase, type Database } from './create-database.js';
import { deployMigrations } from './deploy-migrations.js';
import { seedDemoProfile } from './seed-demo-profile.js';

/**
 * Создаёт единственный ресурс БД и подготавливает его до открытия HTTP-порта NestJS.
 * @param connectionString - Подключение приложения к PostgreSQL.
 * @param onQuery - Необязательный наблюдатель SQL без вывода параметров.
 * @returns Клиент, подготовка при инициализации и закрытие при завершении приложения.
 */
export function createPreparedDatabase(
  connectionString: string,
  onQuery?: (event: Readonly<{ query: string }>) => void,
): Database {
  const database = createDatabase(connectionString, onQuery);
  return { ...database, onModuleInit: prepare };

  /**
   * Проверяет соединение, применяет миграции и заполняет данные на том же клиенте приложения.
   * @throws {Error} Если подготовка не завершена; пул закрывается до передачи ошибки вызывающему коду.
   */
  async function prepare(): Promise<void> {
    let stage = 'соединение с PostgreSQL';
    try {
      await database.onModuleInit();
      stage = 'применение миграций';
      await deployMigrations(connectionString);
      stage = 'заполнение демопрофиля';
      await seedDemoProfile(database.client);
    } catch {
      await database.onModuleDestroy();
      throw new Error(`Подготовка базы не выполнена: ${stage}.`);
    }
  }
}
