export type DatabaseConfig = Readonly<{
  connectionString: string;
  schema: string;
}>;

/**
 * Разбирает конфигурацию подключения PostgreSQL без открытия соединения.
 * @param value - Значение переменной окружения DATABASE_URL.
 * @returns Параметры подключения и SQL-схема для адаптера Prisma.
 * @throws {Error} Если URL или имя схемы некорректны; сообщение не раскрывает credentials.
 */
export function readDatabaseConfig(value: string | undefined): DatabaseConfig {
  if (!value) {
    throw new Error('DATABASE_URL не задан.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL должен быть корректным URL PostgreSQL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.hostname || url.pathname.length <= 1 || url.hash
    || url.searchParams.has('host') || url.searchParams.has('port')) {
    throw new Error('DATABASE_URL должен быть корректным URL PostgreSQL.');
  }

  const schema = url.searchParams.get('schema') ?? 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(schema)
    || url.searchParams.getAll('schema').length > 1) {
    throw new Error('DATABASE_URL содержит недопустимое имя SQL-схемы.');
  }

  return { connectionString: value, schema };
}

/**
 * Проверяет назначение подключения перед подготовкой тестовой базы.
 * @param value - Отдельный URL тестовой базы.
 * @param developmentValue - URL базы разработки для проверки изоляции.
 * @returns Параметры отдельной тестовой базы.
 * @throws {Error} Если не подтверждены отдельная локальная тестовая база и изоляция от разработки.
 */
export function readTestDatabaseConfig(
  value: string | undefined,
  developmentValue: string | undefined,
): DatabaseConfig {
  const config = readDatabaseConfig(value);
  const url = new URL(config.connectionString);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/mecv_test') {
    throw new Error('Тесты требуют отдельную локальную базу mecv_test.');
  }
  if (developmentValue !== undefined) {
    const development = readDatabaseConfig(developmentValue);
    if (new URL(development.connectionString).pathname === url.pathname) {
      throw new Error('Тестовая база не должна использоваться для разработки.');
    }
  }
  return config;
}
